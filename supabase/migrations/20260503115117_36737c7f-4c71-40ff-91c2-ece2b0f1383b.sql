
CREATE TABLE public.pos_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pos chat" ON public.pos_chat_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send pos chat" ON public.pos_chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete pos chat" ON public.pos_chat_messages FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_chat_messages;
ALTER TABLE public.pos_chat_messages REPLICA IDENTITY FULL;

CREATE INDEX idx_pos_chat_messages_created_at ON public.pos_chat_messages(created_at DESC);
