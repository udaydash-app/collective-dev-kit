import { useEffect, useRef, useState, Fragment } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Sparkles, Package, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { usePriceMasking } from "@/hooks/usePriceMasking";
import { computeMaskedPrice } from "@/lib/priceMasking";

export interface ProductRow {
  id: string;
  name: string;
  image_url?: string | null;
  barcode?: string | null;
  categories?: { name: string } | null;
  contacts?: { name: string } | null;
  stores?: { name: string } | null;
  stock_quantity?: number | null;
  price: number;
  cost_price?: number | null;
  local_charges?: number | null;
  is_available?: boolean;
  is_featured?: boolean;
  product_variants?: { price: number; cost_price?: number | null }[];
}

type ColKey =
  | "select" | "product" | "image" | "barcode" | "category"
  | "supplier" | "store" | "stock" | "price" | "status" | "actions";

interface ColDef {
  key: ColKey;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

const DEFAULT_COLS: ColDef[] = [
  { key: "select", label: "", width: 36, align: "center" },
  { key: "product", label: "Product", width: 240 },
  { key: "image", label: "Image", width: 70, align: "center" },
  { key: "barcode", label: "Barcode", width: 130 },
  { key: "category", label: "Category", width: 130 },
  { key: "supplier", label: "Supplier", width: 130 },
  { key: "store", label: "Store", width: 110 },
  { key: "stock", label: "Stock", width: 70, align: "right" },
  { key: "price", label: "Price", width: 130, align: "right" },
  { key: "status", label: "Status", width: 100 },
  { key: "actions", label: "Actions", width: 110, align: "right" },
];

const STORAGE_KEY = "products_table_cols_v1";

function loadCols(): ColDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLS;
    const saved = JSON.parse(raw) as ColDef[];
    // Merge defaults so new columns appear
    const byKey = new Map(saved.map(c => [c.key, c]));
    const merged = DEFAULT_COLS.map(d => byKey.get(d.key) || d);
    // Preserve saved ordering for keys we know
    const ordered = saved
      .map(c => merged.find(m => m.key === c.key))
      .filter(Boolean) as ColDef[];
    // Append any new defaults not in saved
    for (const d of merged) if (!ordered.find(o => o.key === d.key)) ordered.push(d);
    return ordered;
  } catch {
    return DEFAULT_COLS;
  }
}

interface Props {
  rows: ProductRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (p: ProductRow) => void;
  onDelete: (id: string) => void;
  onEnrich?: (p: ProductRow) => void;
  enrichingIds?: Set<string>;
  duplicateGroups?: ProductRow[][];
  showDuplicates?: boolean;
  onAdd?: () => void;
  searchQuery?: string;
}

export function ResizableProductsTable({
  rows, selected, onToggle, onToggleAll, onEdit, onDelete, onEnrich,
  enrichingIds, duplicateGroups, showDuplicates, onAdd, searchQuery,
}: Props) {
  const [cols, setCols] = useState<ColDef[]>(() => loadCols());
  const resizing = useRef<{ key: ColKey; startX: number; startW: number } | null>(null);
  const dragKey = useRef<ColKey | null>(null);
  const { showMasked } = usePriceMasking();
  const maskSell = (real: number | null | undefined, product: ProductRow, variant?: { cost_price?: number | null }): number | null => {
    if (real == null) return null;
    if (!showMasked) return Number(real);
    const m = computeMaskedPrice(
      { price: Number(real), cost_price: variant?.cost_price ?? product?.cost_price, local_charges: product?.local_charges },
      { local_charges: product?.local_charges, price: Number(real) },
    );
    return m || Number(real);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
  }, [cols]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizing.current) return;
      const dx = e.clientX - resizing.current.startX;
      const w = Math.max(40, resizing.current.startW + dx);
      setCols(cs => cs.map(c => c.key === resizing.current!.key ? { ...c, width: w } : c));
    }
    function onUp() { resizing.current = null; document.body.style.cursor = ""; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(e: React.MouseEvent, key: ColKey, width: number) {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = { key, startX: e.clientX, startW: width };
    document.body.style.cursor = "col-resize";
  }

  function onDragStart(e: React.DragEvent, key: ColKey) {
    dragKey.current = key;
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(e: React.DragEvent, targetKey: ColKey) {
    e.preventDefault();
    const src = dragKey.current;
    dragKey.current = null;
    if (!src || src === targetKey) return;
    setCols(cs => {
      const next = [...cs];
      const from = next.findIndex(c => c.key === src);
      const to = next.findIndex(c => c.key === targetKey);
      if (from < 0 || to < 0) return cs;
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }

  function renderCell(col: ColDef, p: ProductRow, badge?: React.ReactNode): React.ReactNode {
    switch (col.key) {
      case "select":
        return (
          <span onClick={e => e.stopPropagation()}>
            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => onToggle(p.id)} />
          </span>
        );
      case "product":
        return (
          <div className="flex items-center gap-1 min-w-0">
            {badge}
            <span className="truncate" title={p.name}>{p.name}</span>
            {p.product_variants && p.product_variants.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-1">({p.product_variants.length}v)</span>
            )}
          </div>
        );
      case "image":
        return (
          <span className={p.image_url ? "text-emerald-600 font-semibold" : "text-muted-foreground"}>
            {p.image_url ? "Yes" : "No"}
          </span>
        );
      case "barcode": {
        if (!p.barcode) return "-";
        const arr = p.barcode.split(",").map(b => b.trim()).filter(Boolean);
        if (arr.length === 1) return arr[0];
        return <span title={arr.join(", ")}>{arr[0]} <span className="text-[10px] text-primary">+{arr.length - 1}</span></span>;
      }
      case "category": return p.categories?.name || "-";
      case "supplier": return p.contacts?.name || "-";
      case "store": return p.stores?.name || "-";
      case "stock": {
        const s = p.stock_quantity ?? 0;
        const cls = s < 0 ? "text-red-600" : s > 0 ? "text-green-600" : "text-muted-foreground";
        return <span className={`font-semibold ${cls}`}>{s < 0 ? "-" : ""}{Math.abs(s)}</span>;
      }
      case "price":
        if (p.product_variants && p.product_variants.length > 0) {
          const prices = p.product_variants.map(v => maskSell(v.price, p, v) ?? v.price);
          return <span className="font-medium">{formatCurrency(Math.min(...prices))} - {formatCurrency(Math.max(...prices))}</span>;
        }
        return <span className="font-medium">{formatCurrency(maskSell(p.price, p) ?? p.price)}</span>;
      case "status":
        return (
          <div className="flex items-center gap-1">
            <Badge variant={p.is_available ? "default" : "secondary"} className="text-[10px] h-5">
              {p.is_available ? "OK" : "N/A"}
            </Badge>
            {p.is_featured && <Badge variant="outline" className="text-[10px] h-5">⭐</Badge>}
          </div>
        );
      case "actions":
        return (
          <span className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {onEnrich && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="AI Enrich"
                onClick={() => onEnrich(p)} disabled={enrichingIds?.has(p.id)}>
                <Sparkles className={`h-3 w-3 ${enrichingIds?.has(p.id) ? "animate-spin" : ""}`} />
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Edit" onClick={() => onEdit(p)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-destructive" title="Delete"
              onClick={() => { if (confirm("Delete this product?")) onDelete(p.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </span>
        );
    }
  }

  const totalWidth = cols.reduce((s, c) => s + c.width, 0);

  function renderRow(p: ProductRow, badge?: React.ReactNode, extra?: string) {
    return (
      <tr key={p.id}
        className={`group cursor-pointer border-b border-border/60 hover:bg-accent/40 ${extra || ""}`}
        onClick={() => onEdit(p)}>
        {cols.map(c => (
          <td key={c.key}
            style={{ width: c.width, minWidth: c.width, maxWidth: c.width, textAlign: c.align || "left" }}
            className="border-r border-border/60 px-2 py-1 text-xs truncate">
            {renderCell(c, p, c.key === "product" ? badge : undefined)}
          </td>
        ))}
      </tr>
    );
  }

  const allChecked = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="border rounded-md bg-card overflow-auto max-h-[calc(100vh-260px)] font-mono">
      <table style={{ width: totalWidth }} className="text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr>
            {cols.map(c => (
              <th key={c.key}
                draggable={c.key !== "select"}
                onDragStart={e => onDragStart(e, c.key)}
                onDragOver={onDragOver}
                onDrop={e => onDrop(e, c.key)}
                style={{ width: c.width, minWidth: c.width, maxWidth: c.width, textAlign: c.align || "left" }}
                className="relative border-r border-border/60 px-2 py-1 text-[11px] font-bold uppercase tracking-tight select-none">
                {c.key === "select" ? (
                  <Checkbox checked={allChecked} onCheckedChange={onToggleAll} />
                ) : c.label}
                <span
                  onMouseDown={e => startResize(e, c.key, c.width)}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="text-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Package className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{searchQuery ? "No products found" : "No products"}</p>
                  {!searchQuery && onAdd && (
                    <Button onClick={onAdd} size="sm" className="gap-2 mt-2"><Plus className="h-3 w-3" /> Add Product</Button>
                  )}
                </div>
              </td>
            </tr>
          ) : showDuplicates && duplicateGroups ? (
            duplicateGroups.map((group, gi) => (
              <Fragment key={gi}>
                {group.map((p, pi) => renderRow(
                  p,
                  pi === 0 ? <Badge variant="outline" className="text-[10px] px-1 py-0 mr-1">{group.length}x</Badge> : null,
                  pi === 0 ? "border-t-2 border-primary/30" : "",
                ))}
              </Fragment>
            ))
          ) : (
            rows.map(p => renderRow(p))
          )}
        </tbody>
      </table>
    </div>
  );
}