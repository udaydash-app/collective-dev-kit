import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, TrendingUp, X, Bell, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const OVERDUE_DAYS = 15;

interface OverdueCustomer {
  id: string;
  name: string;
  balance: number;
  days: number;
}

export const OverdueCreditsMonitor = () => {
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const navigate = useNavigate();
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [overdueList, setOverdueList] = useState<OverdueCustomer[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    // Skip on customer-facing pages
    if (!location.pathname.startsWith("/admin") && location.pathname !== "/pos") return;

    const check = async () => {
      try {
        const cutoff = new Date(Date.now() - OVERDUE_DAYS * 86400000)
          .toISOString()
          .slice(0, 10);

        const { data: customers, error } = await supabase
          .from("contacts")
          .select("id, name, customer_ledger_account_id, accounts:customer_ledger_account_id(id, current_balance)")
          .eq("is_customer", true)
          .not("customer_ledger_account_id", "is", null);

        if (error || !customers) return;

        const overdue: OverdueCustomer[] = [];

        for (const c of customers as any[]) {
          const acc = c.accounts;
          if (!acc || Number(acc.current_balance) <= 0) continue;

          const { data: lines } = await supabase
            .from("journal_entry_lines")
            .select("debit_amount, journal_entries!inner(entry_date, status)")
            .eq("account_id", acc.id)
            .gt("debit_amount", 0)
            .eq("journal_entries.status", "posted")
            .order("journal_entries(entry_date)", { ascending: true })
            .limit(1);

          const oldest = lines?.[0] as any;
          if (!oldest?.journal_entries?.entry_date) continue;
          if (oldest.journal_entries.entry_date > cutoff) continue;

          const days = Math.floor(
            (Date.now() - new Date(oldest.journal_entries.entry_date).getTime()) / 86400000
          );
          overdue.push({ id: c.id, name: c.name, balance: Number(acc.current_balance), days });
        }

        if (overdue.length === 0) return;

        overdue.sort((a, b) => b.days - a.days);
        setOverdueList(overdue);
        setOpen(true);
      } catch (e) {
        console.error("Overdue credits check failed:", e);
      }
    };

    // Run once immediately, then every hour
    check();
    timerRef.current = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isAdmin, location.pathname]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);

  const totalOutstanding = overdueList.reduce((sum, o) => sum + o.balance, 0);
  const maxDays = overdueList[0]?.days ?? 0;

  const getSeverity = (days: number) => {
    if (days >= 60) return { label: "Critical", className: "bg-destructive text-destructive-foreground" };
    if (days >= 30) return { label: "High", className: "bg-destructive/70 text-destructive-foreground" };
    return { label: "Overdue", className: "bg-primary/15 text-primary" };
  };

  const handleViewCustomer = (id: string) => {
    setOpen(false);
    navigate(`/admin/accounts-receivable?customer=${id}`);
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate("/admin/accounts-receivable");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 border-0">
        {/* Animated gradient header */}
        <div className="relative bg-gradient-to-br from-destructive via-orange-500 to-yellow-500 p-6 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/20 blur-3xl animate-pulse" />
            <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          </div>
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 animate-scale-in">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div>
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                    Credit Alert
                  </DialogTitle>
                  <DialogDescription className="text-white/90">
                    {overdueList.length} customer{overdueList.length > 1 ? "s" : ""} with overdue balance &gt; {OVERDUE_DAYS} days
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Stats row */}
          <div className="relative grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 ring-1 ring-white/20">
              <div className="flex items-center gap-1.5 text-xs text-white/80 mb-1">
                <TrendingUp className="h-3 w-3" />
                Outstanding
              </div>
              <div className="text-lg font-bold tabular-nums">{fmt(totalOutstanding)}</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 ring-1 ring-white/20">
              <div className="flex items-center gap-1.5 text-xs text-white/80 mb-1">
                <Bell className="h-3 w-3" />
                Customers
              </div>
              <div className="text-lg font-bold tabular-nums">{overdueList.length}</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 ring-1 ring-white/20">
              <div className="flex items-center gap-1.5 text-xs text-white/80 mb-1">
                <Clock className="h-3 w-3" />
                Oldest
              </div>
              <div className="text-lg font-bold tabular-nums">{maxDays}d</div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-background">
          <ScrollArea className="max-h-[340px]">
            <div className="p-4 space-y-2">
              {overdueList.map((o, idx) => {
                const sev = getSeverity(o.days);
                return (
                  <button
                    key={o.id}
                    onClick={() => handleViewCustomer(o.id)}
                    className="group w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/40 hover:shadow-md transition-all text-left animate-fade-in"
                    style={{ animationDelay: `${idx * 40}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold text-primary ring-1 ring-primary/20 shrink-0">
                      {o.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium truncate">{o.name}</span>
                        <Badge className={`${sev.className} text-[10px] px-1.5 py-0 h-4 shrink-0`}>
                          {sev.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {o.days} days
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold tabular-nums">{fmt(o.balance)}</div>
                      <div className="text-[10px] text-muted-foreground">FCFA</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 p-4 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Auto-checked every hour
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Dismiss
              </Button>
              <Button size="sm" onClick={handleViewAll} className="gap-1.5">
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
