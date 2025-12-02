-- Drop the incorrect policies
DROP POLICY IF EXISTS "Admins can delete chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can delete conversations" ON chat_conversations;

-- Create correct DELETE policies using has_role function
CREATE POLICY "Admins can delete chat messages"
ON chat_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete conversations"
ON chat_conversations
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also add for cashiers
CREATE POLICY "Cashiers can delete chat messages"
ON chat_messages
FOR DELETE
USING (has_role(auth.uid(), 'cashier'::app_role));

CREATE POLICY "Cashiers can delete conversations"
ON chat_conversations
FOR DELETE
USING (has_role(auth.uid(), 'cashier'::app_role));