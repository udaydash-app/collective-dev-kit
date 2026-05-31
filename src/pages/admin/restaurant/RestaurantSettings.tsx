import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Building2, Image as ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import { useRef } from 'react';

const sb: any = supabase;

type Settings = {
  id?: string;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_number: string | null;
  receipt_footer: string | null;
  currency_symbol: string;
  paper_width_mm: number;
};

const empty: Settings = {
  company_name: 'Restaurant',
  logo_url: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  tax_number: '',
  receipt_footer: 'Thank you for dining with us!',
  currency_symbol: 'FCFA',
  paper_width_mm: 80,
};

export default function RestaurantSettings() {
  const [s, setS] = useState<Settings>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await sb.from('restaurant_settings').select('*').limit(1).maybeSingle();
    if (data) setS({ ...empty, ...data });
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    const payload = { ...s, updated_at: new Date().toISOString() };
    let res;
    if (s.id) {
      res = await sb.from('restaurant_settings').update(payload).eq('id', s.id).select().single();
    } else {
      res = await sb.from('restaurant_settings').insert(payload).select().single();
    }
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    setS({ ...empty, ...res.data });
    toast.success('Settings saved');
  }

  function setF<K extends keyof Settings>(k: K, v: Settings[K]) { setS(prev => ({ ...prev, [k]: v })); }

  async function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `logos/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from('restaurant-assets').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = sb.storage.from('restaurant-assets').getPublicUrl(path);
      setF('logo_url', data.publicUrl);
      toast.success('Logo uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-6 w-full space-y-6 min-h-screen">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
          <Building2 className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Restaurant Settings</h1>
          <p className="text-xs text-muted-foreground">Used for printed bills, KOTs and customer-facing receipts.</p>
        </div>
        <Button onClick={save} disabled={saving || loading} className="ml-auto bg-gradient-to-r from-orange-500 to-red-600 text-white border-0">
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Brand</h2>
        <div className="space-y-1.5">
          <Label>Company name *</Label>
          <Input value={s.company_name} onChange={e => setF('company_name', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Logo</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ''; }}
          />
          {s.logo_url ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
              <img src={s.logo_url} alt="Logo preview" className="h-20 w-20 object-contain bg-white rounded border" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">Current logo</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                Replace
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => setF('logo_url', '')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-muted/40 transition-colors"
            >
              {uploading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
              <span className="text-sm font-medium">{uploading ? 'Uploading…' : 'Click to upload logo'}</span>
              <span className="text-[11px] text-muted-foreground">PNG, JPG, SVG up to 5MB</span>
            </button>
          )}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-sm">Contact</h2>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Textarea rows={2} value={s.address || ''} onChange={e => setF('address', e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Phone</Label><Input value={s.phone || ''} onChange={e => setF('phone', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={s.email || ''} onChange={e => setF('email', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Website</Label><Input value={s.website || ''} onChange={e => setF('website', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Tax / NCC number</Label><Input value={s.tax_number || ''} onChange={e => setF('tax_number', e.target.value)} /></div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-sm">Receipt</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Currency symbol</Label>
            <Input value={s.currency_symbol} onChange={e => setF('currency_symbol', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Paper width (mm)</Label>
            <Input type="number" min={48} max={110} value={s.paper_width_mm} onChange={e => setF('paper_width_mm', Number(e.target.value) || 80)} />
            <p className="text-[11px] text-muted-foreground">Thermal printers are typically 80mm or 58mm.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Footer message</Label>
          <Textarea rows={2} value={s.receipt_footer || ''} onChange={e => setF('receipt_footer', e.target.value)} />
        </div>
      </Card>
    </div>
  );
}