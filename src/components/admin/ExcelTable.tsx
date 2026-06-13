import { useEffect, useRef, useState } from "react";

export interface ExcelColumn<T> {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  storageKey: string;
  columns: ExcelColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  loading?: boolean;
  maxHeight?: string;
}

interface SavedCol { key: string; width: number }

function load(storageKey: string, defaults: { key: string; width: number }[]): { order: string[]; widths: Record<string, number> } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { order: defaults.map(d => d.key), widths: Object.fromEntries(defaults.map(d => [d.key, d.width])) };
    const saved = JSON.parse(raw) as SavedCol[];
    const knownKeys = new Set(defaults.map(d => d.key));
    const order = saved.map(s => s.key).filter(k => knownKeys.has(k));
    for (const d of defaults) if (!order.includes(d.key)) order.push(d.key);
    const widths: Record<string, number> = Object.fromEntries(defaults.map(d => [d.key, d.width]));
    for (const s of saved) if (knownKeys.has(s.key)) widths[s.key] = s.width;
    return { order, widths };
  } catch {
    return { order: defaults.map(d => d.key), widths: Object.fromEntries(defaults.map(d => [d.key, d.width])) };
  }
}

export function ExcelTable<T>({
  storageKey, columns, rows, getRowId, onRowClick, empty, loading, maxHeight = "calc(100vh - 260px)",
}: Props<T>) {
  const defaults = columns.map(c => ({ key: c.key, width: c.width }));
  const [state, setState] = useState(() => load(storageKey, defaults));
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const dragKey = useRef<string | null>(null);

  useEffect(() => {
    const payload: SavedCol[] = state.order.map(k => ({ key: k, width: state.widths[k] }));
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [state, storageKey]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizing.current) return;
      const dx = e.clientX - resizing.current.startX;
      const w = Math.max(40, resizing.current.startW + dx);
      const k = resizing.current.key;
      setState(s => ({ ...s, widths: { ...s.widths, [k]: w } }));
    }
    function onUp() { resizing.current = null; document.body.style.cursor = ""; }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  function startResize(e: React.MouseEvent, key: string) {
    e.stopPropagation(); e.preventDefault();
    resizing.current = { key, startX: e.clientX, startW: state.widths[key] };
    document.body.style.cursor = "col-resize";
  }

  function onDragStart(e: React.DragEvent, key: string) {
    dragKey.current = key;
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(e: React.DragEvent, targetKey: string) {
    e.preventDefault();
    const src = dragKey.current; dragKey.current = null;
    if (!src || src === targetKey) return;
    setState(s => {
      const next = [...s.order];
      const from = next.indexOf(src);
      const to = next.indexOf(targetKey);
      if (from < 0 || to < 0) return s;
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return { ...s, order: next };
    });
  }

  const colByKey = new Map(columns.map(c => [c.key, c]));
  const orderedCols = state.order.map(k => colByKey.get(k)).filter(Boolean) as ExcelColumn<T>[];
  const totalWidth = orderedCols.reduce((sum, c) => sum + (state.widths[c.key] ?? c.width), 0);

  return (
    <div className="border rounded-md bg-card overflow-auto font-mono" style={{ maxHeight }}>
      <table style={{ width: totalWidth }} className="text-xs border-collapse">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr>
            {orderedCols.map(c => {
              const w = state.widths[c.key] ?? c.width;
              return (
                <th key={c.key}
                  draggable
                  onDragStart={e => onDragStart(e, c.key)}
                  onDragOver={onDragOver}
                  onDrop={e => onDrop(e, c.key)}
                  style={{ width: w, minWidth: w, maxWidth: w, textAlign: c.align || "left" }}
                  className="relative border-r border-border/60 px-2 py-1 text-[11px] font-bold uppercase tracking-tight select-none cursor-move">
                  {c.label}
                  <span
                    onMouseDown={e => startResize(e, c.key)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60"
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={orderedCols.length} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={orderedCols.length} className="text-center py-8 text-muted-foreground">{empty || "No data"}</td></tr>
          ) : rows.map(r => (
            <tr key={getRowId(r)}
              className={`border-b border-border/60 hover:bg-accent/40 ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={() => onRowClick?.(r)}>
              {orderedCols.map(c => {
                const w = state.widths[c.key] ?? c.width;
                return (
                  <td key={c.key}
                    style={{ width: w, minWidth: w, maxWidth: w, textAlign: c.align || "left" }}
                    className="border-r border-border/60 px-2 py-1 truncate">
                    {c.render(r)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}