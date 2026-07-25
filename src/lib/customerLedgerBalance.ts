import { supabase } from "@/integrations/supabase/client";

/**
 * Compute a contact's current ledger balance the same way General Ledger does:
 *   customer A/R  = customer_opening_balance + sum(debit - credit) on customer account
 *   supplier A/P  = supplier_opening_balance + sum(credit - debit) on supplier account
 *   unified (dual-role) = customer A/R - supplier A/P
 *
 * Ignores journal entries with description ILIKE '%opening balance%' since opening
 * balances live on contacts.*_opening_balance. Only posted entries are counted.
 *
 * Returns null on any failure so callers can silently skip printing the balance.
 */
export async function getContactLedgerBalance(contactId: string): Promise<
  | {
      customerBalance: number | null;
      supplierBalance: number | null;
      unifiedBalance: number | null;
      isUnified: boolean;
      displayBalance: number | null;
    }
  | null
> {
  try {
    const { data: contact } = await supabase
      .from("contacts")
      .select(
        "id, is_customer, is_supplier, opening_balance, supplier_opening_balance, customer_ledger_account_id, supplier_ledger_account_id"
      )
      .eq("id", contactId)
      .maybeSingle();

    if (!contact) return null;

    const sumLines = async (accountId: string | null | undefined) => {
      if (!accountId) return { debit: 0, credit: 0 };
      const { data } = await supabase
        .from("journal_entry_lines")
        .select(
          `debit_amount, credit_amount, journal_entries!inner(status, description)`
        )
        .eq("account_id", accountId)
        .eq("journal_entries.status", "posted")
        .not("journal_entries.description", "ilike", "%opening balance%");
      const debit = (data || []).reduce(
        (s: number, l: any) => s + Number(l.debit_amount || 0),
        0
      );
      const credit = (data || []).reduce(
        (s: number, l: any) => s + Number(l.credit_amount || 0),
        0
      );
      return { debit, credit };
    };

    let customerBalance: number | null = null;
    let supplierBalance: number | null = null;

    if (contact.is_customer && contact.customer_ledger_account_id) {
      const { debit, credit } = await sumLines(contact.customer_ledger_account_id);
      customerBalance =
        Number(contact.opening_balance || 0) + debit - credit;
    }

    if (contact.is_supplier && contact.supplier_ledger_account_id) {
      const { debit, credit } = await sumLines(contact.supplier_ledger_account_id);
      supplierBalance =
        Number(contact.supplier_opening_balance || 0) + credit - debit;
    }

    const isUnified = !!(contact.is_customer && contact.is_supplier);
    const unifiedBalance = isUnified
      ? (customerBalance || 0) - (supplierBalance || 0)
      : null;

    const displayBalance = isUnified
      ? unifiedBalance
      : customerBalance !== null
      ? customerBalance
      : supplierBalance;

    return {
      customerBalance,
      supplierBalance,
      unifiedBalance,
      isUnified,
      displayBalance,
    };
  } catch (e) {
    console.warn("[getContactLedgerBalance] failed", e);
    return null;
  }
}