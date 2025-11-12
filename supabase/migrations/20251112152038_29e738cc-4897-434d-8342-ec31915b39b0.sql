-- Fix account balance calculation to handle DELETE, include opening balances, and update both OLD and NEW accounts

-- Drop existing trigger
DROP TRIGGER IF EXISTS update_account_balance_on_post ON public.journal_entry_lines;

-- Create improved function to update account balances
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_account_id uuid;
BEGIN
  -- On DELETE, use OLD record
  -- On INSERT or UPDATE, use NEW record
  IF TG_OP = 'DELETE' THEN
    affected_account_id := OLD.account_id;
  ELSE
    affected_account_id := NEW.account_id;
  END IF;

  -- Update the account balance based on account type
  -- Include opening balance from contacts table
  UPDATE accounts
  SET current_balance = (
    -- Opening balance from contact (if this account is linked to a contact)
    COALESCE((
      SELECT COALESCE(opening_balance, 0)
      FROM contacts
      WHERE customer_ledger_account_id = accounts.id
         OR supplier_ledger_account_id = accounts.id
      LIMIT 1
    ), 0)
    +
    -- Balance from journal entries
    COALESCE((
      SELECT SUM(
        CASE 
          -- Assets and Expenses: Debit increases, Credit decreases
          WHEN accounts.account_type IN ('asset', 'expense') THEN 
            jel.debit_amount - jel.credit_amount
          -- Liabilities, Equity, Revenue: Credit increases, Debit decreases
          ELSE 
            jel.credit_amount - jel.debit_amount
        END
      )
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id = accounts.id
        AND je.status = 'posted'
    ), 0)
  )
  WHERE id = affected_account_id;

  -- On UPDATE, also update the old account if account_id changed
  IF TG_OP = 'UPDATE' AND OLD.account_id != NEW.account_id THEN
    UPDATE accounts
    SET current_balance = (
      -- Opening balance from contact
      COALESCE((
        SELECT COALESCE(opening_balance, 0)
        FROM contacts
        WHERE customer_ledger_account_id = accounts.id
           OR supplier_ledger_account_id = accounts.id
        LIMIT 1
      ), 0)
      +
      -- Balance from journal entries
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN accounts.account_type IN ('asset', 'expense') THEN 
              jel.debit_amount - jel.credit_amount
            ELSE 
              jel.credit_amount - jel.debit_amount
          END
        )
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = accounts.id
          AND je.status = 'posted'
      ), 0)
    )
    WHERE id = OLD.account_id;
  END IF;

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate trigger
CREATE TRIGGER update_account_balance_on_post
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance();

-- Also create trigger to update account balance when journal entry status changes
CREATE OR REPLACE FUNCTION public.update_account_balance_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed to or from 'posted', recalculate all affected accounts
  IF (OLD.status != NEW.status) AND (OLD.status = 'posted' OR NEW.status = 'posted') THEN
    -- Update all accounts that have lines in this journal entry
    UPDATE accounts
    SET current_balance = (
      -- Opening balance from contact
      COALESCE((
        SELECT COALESCE(opening_balance, 0)
        FROM contacts
        WHERE customer_ledger_account_id = accounts.id
           OR supplier_ledger_account_id = accounts.id
        LIMIT 1
      ), 0)
      +
      -- Balance from journal entries
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN accounts.account_type IN ('asset', 'expense') THEN 
              jel.debit_amount - jel.credit_amount
            ELSE 
              jel.credit_amount - jel.debit_amount
          END
        )
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = accounts.id
          AND je.status = 'posted'
      ), 0)
    )
    WHERE id IN (
      SELECT DISTINCT account_id 
      FROM journal_entry_lines 
      WHERE journal_entry_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for journal entry status changes
DROP TRIGGER IF EXISTS update_account_balance_on_status_change ON public.journal_entries;
CREATE TRIGGER update_account_balance_on_status_change
  AFTER UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_account_balance_on_status_change();

-- Recalculate all account balances to fix any existing discrepancies
UPDATE accounts
SET current_balance = (
  -- Opening balance from contact
  COALESCE((
    SELECT COALESCE(opening_balance, 0)
    FROM contacts
    WHERE customer_ledger_account_id = accounts.id
       OR supplier_ledger_account_id = accounts.id
    LIMIT 1
  ), 0)
  +
  -- Balance from journal entries
  COALESCE((
    SELECT SUM(
      CASE 
        WHEN accounts.account_type IN ('asset', 'expense') THEN 
          jel.debit_amount - jel.credit_amount
        ELSE 
          jel.credit_amount - jel.debit_amount
      END
    )
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE jel.account_id = accounts.id
      AND je.status = 'posted'
  ), 0)
);