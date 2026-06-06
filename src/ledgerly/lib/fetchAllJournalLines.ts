import { supabase } from "@/ledgerly/integrations/supabase/client";

/**
 * Fetch every journal_lines row matching the date range, bypassing the
 * 1000-row PostgREST default that was silently truncating P&L / Trial
 * Balance / Balance Sheet totals. Pages through 1000 rows at a time.
 *
 * Pass `from = null` for an "as-of" query (no lower bound).
 */
export async function fetchAllJournalLines(
  companyId: string,
  from: string | null,
  to: string,
): Promise<Array<{ account_id: string; debit: number; credit: number }>> {
  const PAGE = 1000;
  const all: Array<{ account_id: string; debit: number; credit: number }> = [];
  let offset = 0;
  // Guard against runaway loops on bad responses.
  for (let i = 0; i < 1000; i++) {
    let q = supabase
      .from("journal_lines")
      .select("account_id, debit, credit, entry:journal_entries!inner(entry_date)")
      .eq("company_id", companyId)
      .lte("entry.entry_date", to)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (from) q = q.gte("entry.entry_date", from);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as any[];
    rows.forEach((r) => all.push({
      account_id: r.account_id,
      debit: Number(r.debit) || 0,
      credit: Number(r.credit) || 0,
    }));
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}