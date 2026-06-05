import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type ContactType = "customer" | "supplier" | "both";

export interface QuickContact {
  id: string;
  name: string;
  type: ContactType;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (contact: QuickContact) => void;
  /** Default + locked type (e.g. "customer" on InvoiceForm, "supplier" on BillForm) */
  defaultType?: ContactType;
  lockType?: boolean;
}

export const QuickAddContactDialog = ({ open, onOpenChange, onCreated, defaultType = "customer", lockType = false }: Props) => {
  const { companyId } = useCompany();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ContactType>(defaultType);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => { if (open) setType(defaultType); }, [open, defaultType]);

  const reset = () => {
    setName(""); setEmail(""); setPhone(""); setAddress("");
    setType(defaultType);
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
        type,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      };
      const { data, error } = await supabase.from("contacts").insert(payload).select("id, name, type").single();
      if (error || !data) throw error ?? new Error("Insert failed");
      toast.success("Contact created");
      onCreated(data as QuickContact);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const label = defaultType === "supplier" ? "supplier" : defaultType === "both" ? "contact" : "customer";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create new {label}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={`${label.charAt(0).toUpperCase() + label.slice(1)} name`} />
          </div>
          {!lockType && (
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ContactType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
