import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

export interface CompanySettings {
  company_name?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_address?: string | null;
  logo_url?: string | null;
}

let cachedSettings: CompanySettings | null = null;
let settingsPromise: Promise<CompanySettings | null> | null = null;

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  if (cachedSettings) return cachedSettings;
  if (settingsPromise) return settingsPromise;
  settingsPromise = (async () => {
    const { data } = await supabase
      .from('settings')
      .select('company_name, company_email, company_phone, company_address, logo_url')
      .limit(1)
      .maybeSingle();
    cachedSettings = (data as CompanySettings) || null;
    return cachedSettings;
  })();
  return settingsPromise;
}

export function clearCompanySettingsCache() {
  cachedSettings = null;
  settingsPromise = null;
}

export interface LogoData {
  dataUrl: string;
  w: number;
  h: number;
}

const logoCache = new Map<string, LogoData | null>();

async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function resolveLogoForOutput(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  const logo = await loadLogoTransparent(url);
  return logo?.dataUrl || (await imageUrlToDataUrl(url)) || url;
}

export async function waitForImagesToLoad(container: HTMLElement, timeoutMs = 3000): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  if (!images.length) return;

  await Promise.all(images.map((img) => new Promise<void>((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    const done = () => {
      img.removeEventListener('load', done);
      img.removeEventListener('error', done);
      resolve();
    };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, timeoutMs);
  })));
}

/**
 * Load an image URL and return a PNG data URL with near-white pixels
 * converted to transparent (background removal for logos with white bg).
 */
export async function loadLogoTransparent(url: string): Promise<LogoData | null> {
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url)!;

  try {
    const source = (await imageUrlToDataUrl(url)) || url;
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = source;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no ctx');
    ctx.drawImage(img, 0, 0);

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      const threshold = 240;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r >= threshold && g >= threshold && b >= threshold) {
          d[i + 3] = 0;
        } else if (r >= 220 && g >= 220 && b >= 220) {
          // Soft edges: partial transparency
          const avg = (r + g + b) / 3;
          const a = Math.max(0, Math.min(255, Math.round(255 - (avg - 220) * (255 / 35))));
          d[i + 3] = a;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // cross-origin tainted; fall back to original
    }

    const dataUrl = canvas.toDataURL('image/png');
    const result = { dataUrl, w: canvas.width, h: canvas.height };
    logoCache.set(url, result);
    return result;
  } catch {
    logoCache.set(url, null);
    return null;
  }
}

/**
 * Draw the company branding header (logo + name + address + phone/email)
 * centered at the top of the current page. Returns the next y position
 * below the header.
 */
export async function addPdfHeader(
  doc: jsPDF,
  settings: CompanySettings | null,
  opts: { startY?: number; maxLogoHeight?: number } = {}
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let yPos = opts.startY ?? 10;
  const maxH = opts.maxLogoHeight ?? 22;

  if (settings?.logo_url) {
    const logo = await loadLogoTransparent(settings.logo_url);
    if (logo) {
      const ratio = logo.w / Math.max(1, logo.h);
      const h = maxH;
      const w = h * ratio;
      try {
        doc.addImage(logo.dataUrl, 'PNG', (pageWidth - w) / 2, yPos, w, h);
        yPos += h + 3;
      } catch {
        // ignore
      }
    }
  }

  if (settings?.company_name) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(settings.company_name, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  if (settings?.company_address) {
    const lines = doc.splitTextToSize(settings.company_address, pageWidth - margin * 2);
    doc.text(lines, pageWidth / 2, yPos, { align: 'center' });
    yPos += lines.length * 4;
  }

  const contactBits = [
    settings?.company_phone ? `Tel: ${settings.company_phone}` : null,
    settings?.company_email || null,
  ].filter(Boolean) as string[];
  if (contactBits.length) {
    doc.text(contactBits.join('  |  '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }

  doc.setLineWidth(0.4);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  return yPos;
}

/**
 * Format a short WhatsApp prefix using company name so messages identify
 * the sender. Returns an encoded string ready to append after `?text=`.
 */
export function whatsappCompanyPrefix(settings: CompanySettings | null, body?: string): string {
  const name = settings?.company_name?.trim();
  const greeting = name ? `Hello from ${name}` : 'Hello';
  const msg = body ? `${greeting}\n\n${body}` : greeting;
  return encodeURIComponent(msg);
}