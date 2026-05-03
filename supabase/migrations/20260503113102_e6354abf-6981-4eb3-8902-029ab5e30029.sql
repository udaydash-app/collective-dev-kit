CREATE TABLE public.pos_sticky_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'yellow',
  author_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_sticky_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sticky notes"
  ON public.pos_sticky_notes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert sticky notes"
  ON public.pos_sticky_notes FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update sticky notes"
  ON public.pos_sticky_notes FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated can delete sticky notes"
  ON public.pos_sticky_notes FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER update_pos_sticky_notes_updated_at
  BEFORE UPDATE ON public.pos_sticky_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_sticky_notes;
ALTER TABLE public.pos_sticky_notes REPLICA IDENTITY FULL;