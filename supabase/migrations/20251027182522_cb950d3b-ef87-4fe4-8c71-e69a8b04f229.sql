-- Add opening_balance column to contacts table
ALTER TABLE contacts
ADD COLUMN opening_balance numeric DEFAULT 0;

-- Add comment to explain the field
COMMENT ON COLUMN contacts.opening_balance IS 'Opening balance for the contact - positive for amounts owed to us (customer), negative for amounts we owe (supplier)';

-- Create index for better query performance
CREATE INDEX idx_contacts_opening_balance ON contacts(opening_balance) WHERE opening_balance != 0;