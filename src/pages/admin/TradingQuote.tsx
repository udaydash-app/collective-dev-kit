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
  const [generating, setGenerating] = useState(false);
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

  const loadImage = (url: string): Promise<string | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const generatePdf = async () => {
    const chosen = items.filter((i) => selected.has(i.id));
    if (chosen.length === 0) { toast.error('Select at least one item'); return; }
    if (!clientName.trim()) { toast.error('Client name required'); return; }
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      let y = margin;

      doc.setFontSize(18).setFont('helvetica', 'bold');
      doc.text('QUOTATION', pageW / 2, y + 6, { align: 'center' });
      y += 14;
      doc.setFontSize(11).setFont('helvetica', 'normal');
      doc.text(`Client: ${clientName}`, margin, y);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - margin, y, { align: 'right' });
      y += 8;
      doc.setDrawColor(180); doc.line(margin, y, pageW - margin, y); y += 6;

      for (const it of chosen) {
        const imgs = Array.isArray(it.image_urls) ? it.image_urls : [];
        const blockH = imgs.length > 0 ? 56 : 30;
        if (y + blockH > pageH - margin) { doc.addPage(); y = margin; }

        let imgX = margin;
        for (const imgUrl of imgs.slice(0, 3)) {
          const data = await loadImage(imgUrl);
          if (data) {
            try { doc.addImage(data, 'JPEG', imgX, y, 40, 40); } catch { /* ignore */ }
          }
          imgX += 45;
        }
        const tx = margin + (imgs.length > 0 ? Math.min(imgs.length, 3) * 45 - 5 + 6 : 0);
        doc.setFont('helvetica', 'bold').setFontSize(12);
        doc.text(it.brand, tx, y + 5);
        doc.setFont('helvetica', 'normal').setFontSize(10);
        const lines: string[] = [];
        if (it.quality) lines.push(`Quality: ${it.quality}`);
        if (it.packaging) lines.push(`Packaging: ${it.packaging}`);
        if (it.warehouse) lines.push(`Warehouse: ${it.warehouse}`);
        if (it.payment_condition) lines.push(`Payment: ${it.payment_condition}`);
        if (it.bank_details) lines.push(`Bank: ${it.bank_details}`);
        let ly = y + 11;
        for (const l of lines) {
          const wrapped = doc.splitTextToSize(l, pageW - tx - margin - 30);
          doc.text(wrapped, tx, ly);
          ly += 4.5 * wrapped.length;
        }
        doc.setFont('helvetica', 'bold').setFontSize(13);
        doc.text(`Price: ${Number(it.sell_price ?? 0).toLocaleString()}`, pageW - margin, y + 5, { align: 'right' });

        y += blockH;
        doc.setDrawColor(220); doc.line(margin, y - 2, pageW - margin, y - 2);
      }

      const total = chosen.reduce((s, i) => s + Number(i.sell_price ?? 0), 0);
      if (y + 14 > pageH - margin) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold').setFontSize(13);
      doc.text(`Total: ${total.toLocaleString()}`, pageW - margin, y + 6, { align: 'right' });

      doc.save(`Quotation-${clientName.replace(/\s+/g, '_')}-${Date.now()}.pdf`);
      setSendOpen(false);
      setClientName('');
      toast.success('Quotation generated');
    } catch (e: any) {
      toast.error(e.message ?? 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
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
            onClick={() => setSendOpen(true)}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={generatePdf} disabled={generating}>
              {generating ? 'Generating...' : 'Generate PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
