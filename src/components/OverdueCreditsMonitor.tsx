import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdmin } from "@/hooks/useAdmin";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const OVERDUE_DAYS = 15;

export const OverdueCreditsMonitor = () => {
  const { isAdmin } = useAdmin();
  const location = useLocation();
  const timerRef = useRef<number | null>(null);

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

        const overdue: { name: string; balance: number; days: number }[] = [];

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
          overdue.push({ name: c.name, balance: Number(acc.current_balance), days });
        }

        if (overdue.length === 0) return;

        overdue.sort((a, b) => b.days - a.days);
        const top = overdue.slice(0, 5);
        const fmt = (n: number) =>
          new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);

        toast.warning(`⚠️ ${overdue.length} customer(s) with overdue credit (>${OVERDUE_DAYS} days)`, {
          description: top
            .map((o) => `• ${o.name} — ${fmt(o.balance)} (${o.days}d)`)
            .join("\n") + (overdue.length > top.length ? `\n…and ${overdue.length - top.length} more` : ""),
          duration: 30000,
        });
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

  return null;
};
