import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Send, Upload, FileText, X } from 'lucide-react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

type Item = {
  id: string;
  brand: string;
  quality: string | null;
  packaging: string | null;
  buy_price: number | null;
  sell_price: number | null;
  warehouse: string | null;
  payment_condition: string | null;
  bank_details: string | null;
  image_urls: string[];
  created_at: string;
  updated_at: string;
};

const emptyForm: Omit<Item, 'id' | 'created_at' | 'updated_at'> = {
  brand: '', quality: '', packaging: '', buy_price: 0, sell_price: 0,
  warehouse: '', payment_condition: '', bank_details: '', image_urls: [],
};

export default function TradingQuote() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploading, setUploading] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [language, setLanguage] = useState<'en' | 'fr'>('en');
  const [sendOrder, setSendOrder] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trading_quote_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    else {
      setItems(
        (data ?? []).map((row: any) => ({
          ...row,
          image_urls: Array.isArray(row.image_urls) ? row.image_urls : [],
        })) as Item[]
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (it: Item) => {
    setEditingId(it.id);
    setForm({
      brand: it.brand,
      quality: it.quality ?? '',
      packaging: it.packaging ?? '',
      buy_price: Number(it.buy_price ?? 0),
      sell_price: Number(it.sell_price ?? 0),
      warehouse: it.warehouse ?? '',
      payment_condition: it.payment_condition ?? '',
      bank_details: it.bank_details ?? '',
      image_urls: Array.isArray(it.image_urls) ? [...it.image_urls] : [],
    });
    setDialogOpen(true);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('trading-quote-images').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('trading-quote-images').getPublicUrl(path);
      setForm((f) => ({ ...f, image_urls: [...f.image_urls, data.publicUrl] }));
      toast.success('Image uploaded');
    } catch (e: any) {
      toast.error(e.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setForm((f) => ({ ...f, image_urls: f.image_urls.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.brand.trim()) { toast.error('Brand is required'); return; }
    const payload = {
      ...form,
      buy_price: Number(form.buy_price) || 0,
      sell_price: Number(form.sell_price) || 0,
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('trading_quote_items').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Updated');
      } else {
        const { error } = await supabase.from('trading_quote_items').insert(payload);
        if (error) throw error;
        toast.success('Added');
      }
      setDialogOpen(false);
      fetchItems();
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    const { error } = await supabase.from('trading_quote_items').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
      fetchItems();
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };

  const openSend = () => {
    setSendOrder(items.filter((i) => selected.has(i.id)).map((i) => i.id));
    setSendOpen(true);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    setSendOrder((arr) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const loadImage = (
    url: string
  ): Promise<{ data: string; w: number; h: number } | null> =>
    new Promise(async (resolve) => {
      try {
        // Fetch as blob first to avoid canvas tainting from cross-origin images.
        const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
        if (!res.ok) return resolve(null);
        const blob = await res.blob();
        const dataUrl: string = await new Promise((r, j) => {
          const fr = new FileReader();
          fr.onload = () => r(fr.result as string);
          fr.onerror = j;
          fr.readAsDataURL(blob);
        });
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            canvas.getContext('2d')?.drawImage(img, 0, 0);
            resolve({
              data: canvas.toDataURL('image/jpeg', 0.85),
              w: canvas.width,
              h: canvas.height,
            });
          } catch {
            // Fall back to raw data URL (jsPDF accepts PNG/JPEG data URLs directly)
            resolve({ data: dataUrl, w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
          }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      } catch {
        resolve(null);
      }
    });

  // Fit (contain) image within a box preserving aspect ratio, returns centered placement.
  const fitBox = (iw: number, ih: number, bw: number, bh: number) => {
    const r = Math.min(bw / iw, bh / ih);
    const w = iw * r;
    const h = ih * r;
    return { w, h, ox: (bw - w) / 2, oy: (bh - h) / 2 };
  };

  const buildPdf = async (): Promise<{ doc: jsPDF; fileName: string } | null> => {
    const order = sendOrder.length ? sendOrder : items.filter((i) => selected.has(i.id)).map((i) => i.id);
    const byId = new Map(items.map((i) => [i.id, i]));
    const chosen = order.map((id) => byId.get(id)).filter(Boolean) as Item[];
    if (chosen.length === 0) { toast.error('Select at least one item'); return null; }
    if (!clientName.trim()) { toast.error('Client name required'); return null; }
    const t = language === 'fr'
      ? { title: 'MEILLEUR PRIX DISPONIBLE CHEZ NOUS', client: 'Client', Quality: 'Qualité', Packaging: 'Emballage', Warehouse: 'Entrepôt', Payment: 'Paiement', Bank: 'Banque', file: 'Offre' }
      : { title: 'BEST PRICE AVAILABLE WITH US', client: 'Client', Quality: 'Quality', Packaging: 'Packaging', Warehouse: 'Warehouse', Payment: 'Payment', Bank: 'Bank', file: 'Quotation' };
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      let y = margin;

      // ----- Header banner -----
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(0, 0, pageW, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold').setFontSize(16);
      doc.text(t.title, margin, 15);
      doc.setFont('helvetica', 'normal').setFontSize(10);
      doc.text(new Date().toLocaleDateString(), pageW - margin, 15, { align: 'right' });
      doc.setTextColor(20, 20, 20);
      y = 32;
      doc.setFont('helvetica', 'bold').setFontSize(12);
      doc.text(`${t.client}: ${clientName}`, margin, y);
      y += 8;

      // ----- Item cards: one per row, big image + details columns -----
      const cardH = 70; // mm
      const imgW = 60;
      const imgH = 60;
      const padding = 5;

      for (const it of chosen) {
        if (y + cardH > pageH - margin - 20) { doc.addPage(); y = margin; }

        // Card border
        doc.setDrawColor(220);
        doc.setFillColor(250, 250, 252);
        doc.roundedRect(margin, y, pageW - margin * 2, cardH, 2, 2, 'FD');

        const imgs = Array.isArray(it.image_urls) ? it.image_urls : [];
        const cardX = margin + padding;
        const cardY = y + padding;

        // Main image box (letterboxed to preserve aspect ratio)
        doc.setFillColor(240, 240, 244);
        doc.rect(cardX, cardY, imgW, imgH, 'F');
        if (imgs[0]) {
          const im = await loadImage(imgs[0]);
          if (im) {
            const f = fitBox(im.w, im.h, imgW, imgH);
            try { doc.addImage(im.data, 'JPEG', cardX + f.ox, cardY + f.oy, f.w, f.h); } catch {}
          }
        }

        // Thumbnails (2nd & 3rd) stacked beside main, aspect preserved
        const thumbW = 28;
        const thumbH = 28;
        const thumbX = cardX + imgW + 4;
        for (let i = 1; i < Math.min(imgs.length, 3); i++) {
          const ty = cardY + (i - 1) * (thumbH + 4);
          doc.setFillColor(240, 240, 244);
          doc.rect(thumbX, ty, thumbW, thumbH, 'F');
          const im = await loadImage(imgs[i]);
          if (im) {
            const f = fitBox(im.w, im.h, thumbW, thumbH);
            try { doc.addImage(im.data, 'JPEG', thumbX + f.ox, ty + f.oy, f.w, f.h); } catch {}
          }
        }

        // Right: details in two columns (label / value)
        const detailsX = thumbX + thumbW + 8;
        const labelColW = 28;

        // Price highlight (top-right) — drawn first so we can reserve space
        const priceTxt = `${Number(it.sell_price ?? 0).toLocaleString()}`;
        doc.setFont('helvetica', 'bold').setFontSize(12);
        const priceW = doc.getTextWidth(priceTxt) + 8;
        const priceH = 8;
        const priceX = pageW - margin - padding - priceW;
        const priceY = cardY + 2;
        doc.setFillColor(34, 197, 94);
        doc.roundedRect(priceX, priceY, priceW, priceH, 1.5, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(priceTxt, priceX + priceW - 4, priceY + priceH - 2.2, { align: 'right' });
        doc.setTextColor(50, 50, 50);

        // Brand title (wrap so it doesn't run under price badge)
        let dy = cardY + 6;
        doc.setFont('helvetica', 'bold').setFontSize(14);
        doc.setTextColor(15, 23, 42);
        const brandMaxW = priceX - detailsX - 4;
        const brandLines = doc.splitTextToSize(it.brand, brandMaxW).slice(0, 1);
        doc.text(brandLines, detailsX, dy);
        // Move below the price badge to avoid any overlap with detail rows
        dy = Math.max(dy + 6, priceY + priceH + 4);

        // Detail rows
        const rows: [string, string][] = [];
        if (it.quality) rows.push([t.Quality, it.quality]);
        if (it.packaging) rows.push([t.Packaging, it.packaging]);
        if (it.warehouse) rows.push([t.Warehouse, it.warehouse]);
        if (it.payment_condition) rows.push([t.Payment, it.payment_condition]);
        if (it.bank_details) rows.push([t.Bank, it.bank_details]);

        doc.setFontSize(9.5);
        const maxValW = pageW - margin - padding - detailsX - labelColW - 2;
        for (const [label, value] of rows) {
          if (dy > cardY + cardH - 4) break;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 116, 139);
          doc.text(label, detailsX, dy);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          const wrapped = doc.splitTextToSize(String(value), maxValW);
          const shown = wrapped.slice(0, 2);
          doc.text(shown, detailsX + labelColW, dy);
          dy += 4.5 * shown.length + 1.5;
        }

        y += cardH + 4;
      }
    const fileName = `${t.file}-${clientName.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
    return { doc, fileName };
  };

  const openPreview = async () => {
    setGenerating(true);
    try {
      const res = await buildPdf();
      if (!res) return;
      const blob = res.doc.output('blob');
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setPreviewFileName(res.fileName);
      setPreviewOpen(true);
    } catch (e: any) {
      toast.error(e.message ?? 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const downloadFromPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = previewFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setPreviewOpen(false);
    setSendOpen(false);
    setClientName('');
    toast.success('Quotation downloaded');
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="shrink-0 px-4 py-3 border-b bg-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h1 className="text-lg font-semibold">Trading Quote</h1>
          <span className="text-xs text-slate-400 ml-2">{items.length} items · {selected.size} selected</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            disabled={selected.size === 0}
            onClick={openSend}
            className="gap-1.5"
          >
            <Send className="h-4 w-4" /> Send ({selected.size})
          </Button>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="text-center text-slate-400 py-10">Loading...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-slate-400 py-10">No items yet</div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-2 w-10">
                    <Checkbox
                      checked={selected.size === items.length && items.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="p-2 w-16">Images</th>
                  <th className="p-2 text-left">Brand</th>
                  <th className="p-2 text-left">Quality</th>
                  <th className="p-2 text-left">Packaging</th>
                  <th className="p-2 text-right">Buy</th>
                  <th className="p-2 text-right">Sell</th>
                  <th className="p-2 text-left">Warehouse</th>
                  <th className="p-2 text-left">Payment</th>
                  <th className="p-2 text-left">Bank</th>
                  <th className="p-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t hover:bg-slate-50">
                    <td className="p-2 text-center">
                      <Checkbox checked={selected.has(it.id)} onCheckedChange={() => toggleSelect(it.id)} />
                    </td>
                    <td className="p-2">
                      {Array.isArray(it.image_urls) && it.image_urls.length > 0 ? (
                        <div className="flex -space-x-2">
                          {it.image_urls.slice(0, 3).map((url, i) => (
                            <img key={i} src={url} alt="" className="h-8 w-8 object-cover rounded border border-white" />
                          ))}
                          {it.image_urls.length > 3 && (
                            <span className="h-8 w-8 rounded bg-slate-200 text-xs flex items-center justify-center border border-white">+{it.image_urls.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <div className="h-8 w-8 bg-slate-100 rounded" />
                      )}
                    </td>
                    <td className="p-2 font-medium">{it.brand}</td>
                    <td className="p-2">{it.quality}</td>
                    <td className="p-2">{it.packaging}</td>
                    <td className="p-2 text-right">{Number(it.buy_price ?? 0).toLocaleString()}</td>
                    <td className="p-2 text-right font-semibold">{Number(it.sell_price ?? 0).toLocaleString()}</td>
                    <td className="p-2">{it.warehouse}</td>
                    <td className="p-2">{it.payment_condition}</td>
                    <td className="p-2 max-w-[200px] truncate">{it.bank_details}</td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(it)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(it.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Item' : 'Add Item'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Brand *</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <Label>Quality</Label>
              <Input value={form.quality ?? ''} onChange={(e) => setForm({ ...form, quality: e.target.value })} />
            </div>
            <div>
              <Label>Packaging</Label>
              <Input value={form.packaging ?? ''} onChange={(e) => setForm({ ...form, packaging: e.target.value })} />
            </div>
            <div>
              <Label>Buy Price</Label>
              <Input type="number" value={form.buy_price} onChange={(e) => setForm({ ...form, buy_price: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Sell Price</Label>
              <Input type="number" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Warehouse</Label>
              <Input value={form.warehouse ?? ''} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
            </div>
            <div>
              <Label>Payment Condition</Label>
              <Input value={form.payment_condition ?? ''} onChange={(e) => setForm({ ...form, payment_condition: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Bank Details</Label>
              <Textarea
                value={form.bank_details ?? ''}
                onChange={(e) => setForm({ ...form, bank_details: e.target.value })}
                rows={2}
              />
            </div>
            <div className="col-span-2">
              <Label>Images</Label>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {form.image_urls.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img src={url} alt="" className="h-20 w-20 rounded object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <input
                  type="file"
                  ref={fileRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach((f) => handleUpload(f));
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-1" />
                  {uploading ? 'Uploading...' : 'Upload Images'}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? 'Update' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send / Client name dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Quotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{selected.size} item(s) selected</p>
            <div>
              <Label>Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
                autoFocus
              />
            </div>
            <div>
              <Label>Language</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" size="sm" variant={language === 'en' ? 'default' : 'outline'} onClick={() => setLanguage('en')}>English</Button>
                <Button type="button" size="sm" variant={language === 'fr' ? 'default' : 'outline'} onClick={() => setLanguage('fr')}>Français</Button>
              </div>
            </div>
            <div>
              <Label>Order (drag arrows to reorder)</Label>
              <div className="mt-1 border rounded divide-y max-h-64 overflow-auto">
                {sendOrder.map((id, idx) => {
                  const it = items.find((i) => i.id === id);
                  if (!it) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 p-2 text-sm">
                      <span className="w-5 text-slate-400">{idx + 1}.</span>
                      {it.image_urls?.[0] ? (
                        <img src={it.image_urls[0]} alt="" className="h-8 w-8 object-cover rounded" />
                      ) : <div className="h-8 w-8 bg-slate-100 rounded" />}
                      <span className="flex-1 truncate">{it.brand}</span>
                      <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => moveItem(idx, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={idx === sendOrder.length - 1} onClick={() => moveItem(idx, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={openPreview} disabled={generating}>
              {generating ? 'Generating...' : 'Preview'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={(o) => { setPreviewOpen(o); if (!o && previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>Quotation Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded overflow-hidden bg-slate-100">
            {previewUrl && (
              <iframe src={previewUrl} title="Quotation preview" className="w-full h-full" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Back to Edit</Button>
            <Button onClick={downloadFromPreview}>Download PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
