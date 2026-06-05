import { useState } from "react";
import { supabase } from "@/ledgerly/integrations/supabase/client";
import { useCompany } from "@/ledgerly/contexts/CompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface QuickItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  purchase_rate: number;
  selling_rate: number;
  stock_qty: number;
  avg_cost: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (item: QuickItem) => void;
  /** Which rate field to focus by default */
  context?: "purchase" | "selling";
}

export const QuickAddItemDialog = ({ open, onOpenChange, onCreated, context = "selling" }: Props) => {
  const { companyId } = useCompany();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("kg");
  const [purchaseRate, setPurchaseRate] = useState("0");
  const [sellingRate, setSellingRate] = useState("0");
  const [openingQty, setOpeningQty] = useState("0");

  const reset = () => {
    setName(""); setSku(""); setUnit("kg");
    setPurchaseRate("0"); setSellingRate("0"); setOpeningQty("0");
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!companyId) { toast.error("No active company"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const payload = {
        user_id: u.user.id,
        company_id: companyId,
        name: name.trim(),
        sku: sku.trim() || null,
        unit: unit.trim() || "kg",
        purchase_rate: parseFloat(purchaseRate || "0") || 0,
        selling_rate: parseFloat(sellingRate || "0") || 0,
        stock_qty: parseFloat(openingQty || "0") || 0,
        avg_cost: parseFloat(purchaseRate || "0") || 0,
      };
      const { data, error } = await supabase.from("items").insert(payload).select("*").single();
      if (error || !data) throw error ?? new Error("Insert failed");
      toast.success("Item created");
      onCreated(data as QuickItem);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create new item</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, pcs, box…" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Purchase rate</Label>
              <Input type="number" step="0.01" value={purchaseRate} onChange={(e) => setPurchaseRate(e.target.value)} autoFocus={context === "purchase"} />
            </div>
            <div className="space-y-1.5">
              <Label>Selling rate</Label>
              <Input type="number" step="0.01" value={sellingRate} onChange={(e) => setSellingRate(e.target.value)} autoFocus={context === "selling"} />
            </div>
            <div className="space-y-1.5">
              <Label>Opening qty</Label>
              <Input type="number" step="0.0001" value={openingQty} onChange={(e) => setOpeningQty(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Create item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
