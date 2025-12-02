-- Add customer_phone column to chat_conversations
ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS customer_phone text;

-- Update RLS policies to allow anonymous users to create conversations and send messages
DROP POLICY IF EXISTS "Users can create their own conversations" ON chat_conversations;
CREATE POLICY "Users can create conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND user_id IS NULL)
  );

DROP POLICY IF EXISTS "Users can view their own conversations" ON chat_conversations;
CREATE POLICY "Users can view conversations"
  ON chat_conversations FOR SELECT
  USING (
    (auth.uid() = user_id) OR 
    (auth.uid() IS NULL AND user_id IS NULL) OR
    (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
  );

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON chat_messages;
CREATE POLICY "Users can send messages"
  ON chat_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations 
      WHERE (user_id = auth.uid()) OR 
            (user_id IS NULL) OR
            (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
    )
  );

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
CREATE POLICY "Users can view messages"
  ON chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM chat_conversations 
      WHERE (user_id = auth.uid()) OR 
            (user_id IS NULL) OR
            (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
    )
  );