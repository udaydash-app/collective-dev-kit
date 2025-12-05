-- Fix chat_conversations RLS policies to prevent unauthorized access to customer data
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_conversations;

-- Create strict policies: Users can ONLY view their own conversations
CREATE POLICY "Users can view own conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

-- Admins can view all conversations
CREATE POLICY "Admins can view all conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Cashiers can view all conversations (for support purposes)
CREATE POLICY "Cashiers can view all conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (has_role(auth.uid(), 'cashier'::app_role));

-- Users can create their own conversations (authenticated only)
CREATE POLICY "Authenticated users can create own conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
);

-- Guest conversations (user_id is NULL) can only be created via edge function or admin
CREATE POLICY "Admins can create guest conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Cashiers can create conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'cashier'::app_role));

-- Admins can update all conversations
CREATE POLICY "Admins can update all conversations" 
ON public.chat_conversations 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Cashiers can update conversations
CREATE POLICY "Cashiers can update conversations" 
ON public.chat_conversations 
FOR UPDATE 
USING (has_role(auth.uid(), 'cashier'::app_role));