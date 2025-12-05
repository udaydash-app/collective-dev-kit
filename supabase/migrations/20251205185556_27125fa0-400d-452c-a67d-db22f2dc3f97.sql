-- Fix chat_messages RLS to allow anonymous guest messages
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.chat_messages;
DROP POLICY IF EXISTS "Anonymous guests can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anonymous guests can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins and cashiers can view all messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admins and cashiers can send messages" ON public.chat_messages;

-- Authenticated users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations" 
ON public.chat_messages 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM chat_conversations c 
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  )
);

-- Authenticated users can send messages to their conversations
CREATE POLICY "Users can send messages to their conversations" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM chat_conversations c 
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  )
);

-- Anonymous guests can view messages in guest conversations
CREATE POLICY "Anonymous guests can view messages" 
ON public.chat_messages 
FOR SELECT 
USING (
  auth.uid() IS NULL AND 
  EXISTS (
    SELECT 1 FROM chat_conversations c 
    WHERE c.id = conversation_id AND c.user_id IS NULL
  )
);

-- Anonymous guests can send messages to guest conversations
CREATE POLICY "Anonymous guests can send messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NULL AND 
  EXISTS (
    SELECT 1 FROM chat_conversations c 
    WHERE c.id = conversation_id AND c.user_id IS NULL
  )
);

-- Admins and cashiers can view all messages
CREATE POLICY "Admins and cashiers can view all messages" 
ON public.chat_messages 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));

-- Admins and cashiers can send messages to any conversation
CREATE POLICY "Admins and cashiers can send messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));

-- Admins and cashiers can update messages (mark as read)
CREATE POLICY "Admins and cashiers can update messages" 
ON public.chat_messages 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'cashier'::app_role));