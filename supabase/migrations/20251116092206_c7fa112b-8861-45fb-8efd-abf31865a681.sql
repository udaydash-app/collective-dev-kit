-- Add supplier_opening_balance column to contacts table
ALTER TABLE contacts 
ADD COLUMN supplier_opening_balance NUMERIC DEFAULT 0;

COMMENT ON COLUMN contacts.supplier_opening_balance IS 'Opening balance for supplier accounts (separate from customer opening balance)';
