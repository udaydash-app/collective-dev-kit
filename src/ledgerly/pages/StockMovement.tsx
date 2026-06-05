import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";
import { downloadElementAsPdf } from "@/lib/pdf";
import { useCompany } from "@/contexts/CompanyContext";

interface Item { id: string; name: string; sku: string | null; unit: string; stock_qty: number; }
interface Contact { id: string; name: string; type: string; }

interface Movement {
  kind: "purchase" | "sale";
  date: string;
  doc_id: string;
  doc_number: string;
  contact_id: string;
  contact_name: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface ItemReport {
  item: Item;
  movements: Movement[];
  purchasedQty: number;
  soldQty: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthAgoISO = () => {
  const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10);
};

const StockMovement = () => {
  const { companyId } = useCompany();
  const [from, setFrom] = useState(monthAgoISO());
  const [to, setTo] = useState(todayISO());
  const [itemId, setItemId] = useState<string>("all");
  const [contactId, setContactId] = useState<string>("all");
  const [items, setItems] = useState<Item[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [reports, setReports] = useState<ItemReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [{ data: itemsData }, { data: contactsData }] = await Promise.all([
        supabase.from("items").select("id,name,sku,unit,stock_qty").eq("company_id", companyId).order("name"),
        supabase.from("contacts").select("id,name,type").eq("company_id", companyId).order("name"),
      ]);
      setItems((itemsData ?? []) as Item[]);
      setContacts((contactsData ?? []) as Contact[]);
    })();
  }, [companyId]);

  const load = async () => {
    setLoading(true);
    try {
      const itemFilter = itemId !== "all" ? [itemId] : null;

      // Purchases: bill_lines joined to bills
      let billLinesQ = supabase
        .from("bill_lines")
        .select("item_id,quantity,rate,amount,bill_id,bills!inner(id,bill_number,bill_date,contact_id)")
        .gte("bills.bill_date", from)
        .lte("bills.bill_date", to)
        .not("item_id", "is", null);
      if (itemFilter) billLinesQ = billLinesQ.in("item_id", itemFilter);
      if (contactId !== "all") billLinesQ = billLinesQ.eq("bills.contact_id", contactId);

      // Sales: invoice_lines joined to invoices
      let invLinesQ = supabase
        .from("invoice_lines")
        .select("item_id,quantity,rate,amount,invoice_id,invoices!inner(id,invoice_number,invoice_date,contact_id)")
        .gte("invoices.invoice_date", from)
        .lte("invoices.invoice_date", to)
        .not("item_id", "is", null);
      if (itemFilter) invLinesQ = invLinesQ.in("item_id", itemFilter);
      if (contactId !== "all") invLinesQ = invLinesQ.eq("invoices.contact_id", contactId);

      const [{ data: bLines, error: bErr }, { data: iLines, error: iErr }] = await Promise.all([
        billLinesQ,
        invLinesQ,
      ]);
      if (bErr) throw bErr;
      if (iErr) throw iErr;

      const contactMap = new Map<string, string>(contacts.map((c) => [c.id, c.name]));
      const itemMap = new Map<string, Item>(items.map((i) => [i.id, i]));

      const movByItem = new Map<string, Movement[]>();
      const push = (itemId: string, m: Movement) => {
        if (!movByItem.has(itemId)) movByItem.set(itemId, []);
        movByItem.get(itemId)!.push(m);
      };

      (bLines ?? []).forEach((l: any) => {
        const b = l.bills;
        if (!b || !l.item_id) return;
        push(l.item_id, {
          kind: "purchase",
          date: b.bill_date,
          doc_id: b.id,
          doc_number: b.bill_number,
          contact_id: b.contact_id,
          contact_name: contactMap.get(b.contact_id) ?? "—",
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          amount: Number(l.amount),
        });
      });

      (iLines ?? []).forEach((l: any) => {
        const inv = l.invoices;
        if (!inv || !l.item_id) return;
        push(l.item_id, {
          kind: "sale",
          date: inv.invoice_date,
          doc_id: inv.id,
          doc_number: inv.invoice_number,
          contact_id: inv.contact_id,
          contact_name: contactMap.get(inv.contact_id) ?? "—",
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          amount: Number(l.amount),
        });
      });

      const result: ItemReport[] = [];
      const ids = itemFilter ?? Array.from(movByItem.keys());
      // Include all items with movements; if a specific item is selected, include it even if empty
      const allIds = new Set<string>(ids);
      movByItem.forEach((_v, k) => allIds.add(k));

      allIds.forEach((id) => {
        const item = itemMap.get(id);
        if (!item) return;
        const movs = (movByItem.get(id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
        const purchasedQty = movs.filter((m) => m.kind === "purchase").reduce((s, m) => s + m.quantity, 0);
        const soldQty = movs.filter((m) => m.kind === "sale").reduce((s, m) => s + m.quantity, 0);
        result.push({ item, movements: movs, purchasedQty, soldQty });
      });

      result.sort((a, b) => a.item.name.localeCompare(b.item.name));
      setReports(result);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (items.length) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [items.length]);

  const totals = useMemo(() => {
    let purchased = 0, sold = 0, purchaseValue = 0, salesValue = 0;
    reports.forEach((r) => {
      purchased += r.purchasedQty;
      sold += r.soldQty;
      r.movements.forEach((m) => {
        if (m.kind === "purchase") purchaseValue += m.amount;
        else salesValue += m.amount;
      });
    });
    return { purchased, sold, purchaseValue, salesValue };
  }, [reports]);

  const exportCSV = () => {
    const rows: string[] = ["Item,SKU,Type,Date,Document,Contact,Quantity,Unit,Rate,Amount"];
    reports.forEach((r) => {
      r.movements.forEach((m) => {
        rows.push([
          JSON.stringify(r.item.name),
          JSON.stringify(r.item.sku ?? ""),
          m.kind,
          m.date,
          JSON.stringify(m.doc_number),
          JSON.stringify(m.contact_name),
          m.quantity,
          JSON.stringify(r.item.unit),
          m.rate,
          m.amount,
        ].join(","));
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `stock-movement-${from}-to-${to}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(reportRef.current, `stock-movement-${from}-to-${to}.pdf`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const selectedItemLabel = itemId === "all" ? "All items" : items.find((i) => i.id === itemId)?.name ?? "";
  const selectedContactLabel = contactId === "all" ? "All contacts" : contacts.find((c) => c.id === contactId)?.name ?? "";

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader title="Stock Movement" description="Purchases and sales per item, with dates and contacts" />
      <div className="flex-1 p-6 space-y-4 overflow-auto">
        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label>Item</Label>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}{i.sku ? ` (${i.sku})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All contacts</SelectItem>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}<span className="text-muted-foreground"> · {c.type}</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={load} disabled={loading}>{loading ? "Loading..." : "Run report"}</Button>
            <Button variant="outline" onClick={exportCSV} disabled={!reports.length}><Download className="h-4 w-4 mr-2" />CSV</Button>
            <Button variant="outline" onClick={downloadPDF} disabled={!reports.length || downloading}>
              <FileDown className="h-4 w-4 mr-2" />{downloading ? "Generating..." : "PDF"}
            </Button>
          </CardContent>
        </Card>

        <div ref={reportRef} className="space-y-4 bg-background p-4 rounded-md">
          <div className="border-b pb-3">
            <div className="text-xl font-semibold">Stock Movement Report</div>
            <div className="text-sm text-muted-foreground">
              {formatDate(from)} → {formatDate(to)} · Item: {selectedItemLabel} · Contact: {selectedContactLabel}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total purchased qty</div><div className="text-xl font-semibold num">{formatNumber(totals.purchased)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total sold qty</div><div className="text-xl font-semibold num">{formatNumber(totals.sold)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Purchase value</div><div className="text-xl font-semibold num">{formatMoney(totals.purchaseValue)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Sales value</div><div className="text-xl font-semibold num">{formatMoney(totals.salesValue)}</div></CardContent></Card>
          </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item / Movement</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No movements in this range</TableCell></TableRow>
                )}
                {reports.map((r) => (
                  <Fragment key={r.item.id}>
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={4}>
                        {r.item.name}{r.item.sku ? <span className="text-muted-foreground font-normal"> · {r.item.sku}</span> : null}
                        <span className="text-muted-foreground font-normal text-xs ml-2">Current stock: {formatNumber(r.item.stock_qty)} {r.item.unit}</span>
                      </TableCell>
                      <TableCell className="text-right num text-xs">
                        <span className="text-success">+{formatNumber(r.purchasedQty)}</span>
                        {" / "}
                        <span className="text-destructive">-{formatNumber(r.soldQty)}</span>
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                    {r.movements.map((m, idx) => (
                      <TableRow key={`${r.item.id}-${idx}`}>
                        <TableCell className="pl-8">
                          <Badge variant={m.kind === "purchase" ? "secondary" : "outline"} className="capitalize">
                            {m.kind}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(m.date)}</TableCell>
                        <TableCell>
                          <Link
                            to={m.kind === "purchase" ? `/bills/${m.doc_id}` : `/invoices/${m.doc_id}`}
                            className="text-primary hover:underline"
                          >{m.doc_number}</Link>
                        </TableCell>
                        <TableCell className="break-words">{m.contact_name}</TableCell>
                        <TableCell className={`text-right num ${m.kind === "purchase" ? "text-success" : "text-destructive"}`}>
                          {m.kind === "purchase" ? "+" : "-"}{formatNumber(m.quantity)}
                        </TableCell>
                        <TableCell className="text-right num">{formatMoney(m.rate)}</TableCell>
                        <TableCell className="text-right num">{formatMoney(m.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
};

export default StockMovement;