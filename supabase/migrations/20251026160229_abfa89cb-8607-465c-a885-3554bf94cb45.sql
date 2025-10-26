-- Allow cashiers to manage contacts for POS operations
-- Cashiers need to be able to add/update customer and supplier information

CREATE POLICY "Cashiers can insert contacts"
ON contacts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can update contacts"
ON contacts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can delete contacts"
ON contacts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'cashier'::app_role));