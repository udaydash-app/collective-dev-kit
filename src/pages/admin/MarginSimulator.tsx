import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Percent, Search } from "lucide-react";
import { formatCurrency, getEffectiveCost, getVariantEffectiveCost } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  price: number | null;
  cost_price: number | null;
  local_charges: number | null;
  category_id: string | null;
};
type Variant = {
  id: string;
  product_id: string;
  label: string | null;
  barcode: string | null;
  price: number | null;
  cost_price: number | null;
};
type Category = { id: string; name: string };

type Row = {
  key: string;
  name: string;
  barcode: string;
  categoryId: string | null;
  categoryName: string;
  cost: number;
  currentPrice: number;
};

type SortKey = "name" | "cost_asc" | "cost_desc" | "delta_asc" | "delta_desc";

export default function MarginSimulator() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [percent, setPercent] = useState<number>(50);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showZeroCost, setShowZeroCost] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [p, v, c] = await Promise.all([
        supabase.from("products").select("id,name,barcode,price,cost_price,local_charges,category_id").order("name"),
        supabase.from("product_variants").select("id,product_id,label,barcode,price,cost_price"),
        supabase.from("categories").select("id,name").order("name"),
      ]);
      setProducts((p.data as Product[]) ?? []);
      setVariants((v.data as Variant[]) ?? []);
      setCategories((c.data as Category[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo<Row[]>(() => {
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const variantsByProduct = new Map<string, Variant[]>();
    for (const v of variants) {
      const arr = variantsByProduct.get(v.product_id) ?? [];
      arr.push(v);
      variantsByProduct.set(v.product_id, arr);
    }
    const out: Row[] = [];
    for (const p of products) {
      const vs = variantsByProduct.get(p.id) ?? [];
      const catName = p.category_id ? (catMap.get(p.category_id) ?? "—") : "—";
      if (vs.length === 0) {
        out.push({
          key: p.id,
          name: p.name,
          barcode: p.barcode ?? "",
          categoryId: p.category_id,
          categoryName: catName,
          cost: getEffectiveCost(p),
          currentPrice: Number(p.price) || 0,
        });
      } else {
        for (const v of vs) {
          out.push({
            key: `${p.id}:${v.id}`,
            name: `${p.name}${v.label ? ` — ${v.label}` : ""}`,
            barcode: v.barcode ?? p.barcode ?? "",
            categoryId: p.category_id,
            categoryName: catName,
            cost: getVariantEffectiveCost(v, p),
            currentPrice: Number(v.price) || Number(p.price) || 0,
          });
        }
      }
    }
    return out;
  }, [products, variants, categories]);

  const factor = 1 + (Number(percent) || 0) / 100;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (!showZeroCost && r.cost <= 0) return false;
      if (categoryId !== "all" && r.categoryId !== categoryId) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.barcode.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q)
      );
    });
    const withCalc = list.map((r) => {
      const simulated = r.cost * factor;
      const delta = simulated - r.currentPrice;
      const currentMarkup = r.cost > 0 ? ((r.currentPrice - r.cost) / r.cost) * 100 : 0;
      return { ...r, simulated, delta, currentMarkup };
    });
    switch (sortBy) {
      case "cost_asc": withCalc.sort((a, b) => a.cost - b.cost); break;
      case "cost_desc": withCalc.sort((a, b) => b.cost - a.cost); break;
      case "delta_asc": withCalc.sort((a, b) => a.delta - b.delta); break;
      case "delta_desc": withCalc.sort((a, b) => b.delta - a.delta); break;
      default: withCalc.sort((a, b) => a.name.localeCompare(b.name));
    }
    return withCalc;
  }, [rows, search, categoryId, sortBy, factor, showZeroCost]);

  const exportCsv = () => {
    const headers = ["Product", "Barcode", "Category", "Effective Cost", "Current Price", "Simulated Price", "Delta", "Current Markup %"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const safe = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
      lines.push([
        safe(r.name), safe(r.barcode), safe(r.categoryName),
        r.cost.toFixed(2), r.currentPrice.toFixed(2),
        r.simulated.toFixed(2), r.delta.toFixed(2), r.currentMarkup.toFixed(2),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `margin-simulator-${percent}pct.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Percent className="h-6 w-6 text-primary" /> Margin Simulator
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter a target markup on cost and compare suggested sale prices with current prices.
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Simulation controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3 space-y-2">
              <Label>Target profit % (markup on cost)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={percent}
                  onChange={(e) => setPercent(Number(e.target.value))}
                  min={0}
                  step={1}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Slider
                value={[Math.min(percent, 500)]}
                min={0}
                max={500}
                step={1}
                onValueChange={(v) => setPercent(v[0])}
              />
            </div>
            <div className="md:col-span-4 space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Product, barcode, category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="md:col-span-3 space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Sort by</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="cost_asc">Cost ↑</SelectItem>
                  <SelectItem value="cost_desc">Cost ↓</SelectItem>
                  <SelectItem value="delta_asc">Delta ↑</SelectItem>
                  <SelectItem value="delta_desc">Delta ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Switch id="zero" checked={showZeroCost} onCheckedChange={setShowZeroCost} />
              <Label htmlFor="zero" className="cursor-pointer">Include items without cost</Label>
            </div>
            <div className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "item" : "items"} · Formula:
              <span className="font-mono ml-1">sale = cost × (1 + {percent}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Effective Cost</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right bg-primary/5">Simulated Price</TableHead>
                  <TableHead className="text-right">Δ vs Current</TableHead>
                  <TableHead className="text-right">Current Markup</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No products match the filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{r.barcode || "—"}</TableCell>
                      <TableCell>{r.categoryName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.cost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(r.currentPrice)}</TableCell>
                      <TableCell className="text-right font-semibold bg-primary/5">
                        {formatCurrency(r.simulated)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={r.delta >= 0 ? "default" : "destructive"} className="font-mono">
                          {r.delta >= 0 ? "+" : ""}{formatCurrency(r.delta)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {r.cost > 0 ? `${r.currentMarkup.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}