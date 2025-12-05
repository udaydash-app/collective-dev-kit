-- Fix chat_conversations RLS to allow anonymous guest chat creation
-- Drop all existing INSERT policies first
DROP POLICY IF EXISTS "Users can create own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Admins and cashiers can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can create own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anonymous guests can create conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anonymous guests can view guest conversations" ON public.chat_conversations;

-- Allow authenticated users to create their own conversations
CREATE POLICY "Authenticated users can create own conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Allow anonymous guests to create conversations (with guest details, no user_id)
CREATE POLICY "Anonymous guests can create conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (auth.uid() IS NULL AND user_id IS NULL AND customer_name IS NOT NULL AND customer_phone IS NOT NULL);

-- Authenticated users can view their own conversations
CREATE POLICY "Users can view own conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Anonymous guests can view guest conversations (for localStorage persistence)
CREATE POLICY "Anonymous guests can view guest conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (auth.uid() IS NULL AND user_id IS NULL);