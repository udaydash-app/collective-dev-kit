-- 1) Add session token column
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS guest_session_token uuid;

-- Backfill existing guest rows so they remain accessible to their owners
UPDATE public.chat_conversations
SET guest_session_token = gen_random_uuid()
WHERE user_id IS NULL AND guest_session_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_guest_token
  ON public.chat_conversations (guest_session_token)
  WHERE guest_session_token IS NOT NULL;

-- 2) Drop the over-permissive anonymous SELECT policies
DROP POLICY IF EXISTS "Anonymous guests can view guest conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Anonymous guests can view messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anonymous guests can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Anonymous guests can create conversations" ON public.chat_conversations;

-- 3) Re-create anonymous INSERT policy on chat_conversations
-- Anonymous visitors may create a guest conversation only if they supply their
-- own session token, name and phone. They never see other rows.
CREATE POLICY "Guests can create their own conversation"
ON public.chat_conversations
FOR INSERT
TO anon
WITH CHECK (
  auth.uid() IS NULL
  AND user_id IS NULL
  AND customer_name IS NOT NULL
  AND customer_phone IS NOT NULL
  AND guest_session_token IS NOT NULL
);

-- 4) Helper: return a guest conversation only when the token matches
CREATE OR REPLACE FUNCTION public.get_guest_conversation(
  p_conversation_id uuid,
  p_session_token uuid
)
RETURNS SETOF public.chat_conversations
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.chat_conversations
  WHERE id = p_conversation_id
    AND user_id IS NULL
    AND guest_session_token = p_session_token
  LIMIT 1;
$$;

-- 5) Helper: list messages for a guest conversation when the token matches
CREATE OR REPLACE FUNCTION public.get_guest_messages(
  p_conversation_id uuid,
  p_session_token uuid
)
RETURNS SETOF public.chat_messages
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.*
  FROM public.chat_messages m
  JOIN public.chat_conversations c ON c.id = m.conversation_id
  WHERE m.conversation_id = p_conversation_id
    AND c.user_id IS NULL
    AND c.guest_session_token = p_session_token
  ORDER BY m.created_at ASC;
$$;

-- 6) Helper: insert a guest message after validating the token
CREATE OR REPLACE FUNCTION public.send_guest_message(
  p_conversation_id uuid,
  p_session_token uuid,
  p_message text
)
RETURNS public.chat_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
  v_message public.chat_messages;
BEGIN
  SELECT id INTO v_conv_id
  FROM public.chat_conversations
  WHERE id = p_conversation_id
    AND user_id IS NULL
    AND guest_session_token = p_session_token;

  IF v_conv_id IS NULL THEN
    RAISE EXCEPTION 'Invalid conversation or session token';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, sender_type, sender_id, message
  ) VALUES (
    v_conv_id, 'customer', NULL, p_message
  )
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$;

-- 7) Helper: mark admin messages as read for a guest
CREATE OR REPLACE FUNCTION public.mark_guest_messages_read(
  p_conversation_id uuid,
  p_session_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = p_conversation_id
      AND user_id IS NULL
      AND guest_session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid conversation or session token';
  END IF;

  UPDATE public.chat_messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND sender_type = 'admin'
    AND is_read = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_conversation(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_messages(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_guest_message(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_guest_messages_read(uuid, uuid) TO anon, authenticated;