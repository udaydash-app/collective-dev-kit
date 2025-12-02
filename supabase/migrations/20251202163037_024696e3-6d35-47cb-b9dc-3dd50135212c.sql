-- Add DELETE policy for chat_messages (admins)
CREATE POLICY "Admins can delete chat messages"
ON chat_messages
FOR DELETE
USING (
  auth.uid() IN (
    SELECT profiles.id FROM profiles WHERE profiles.role = 'admin'
  )
);

-- Add DELETE policy for chat_conversations (admins)
CREATE POLICY "Admins can delete conversations"
ON chat_conversations
FOR DELETE
USING (
  auth.uid() IN (
    SELECT profiles.id FROM profiles WHERE profiles.role = 'admin'
  )
);