-- POS To-Do / Reminders
CREATE TABLE IF NOT EXISTS public.pos_todos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  remind_at TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by_pos_user UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pos todos"
  ON public.pos_todos FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert pos todos"
  ON public.pos_todos FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update pos todos"
  ON public.pos_todos FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete pos todos"
  ON public.pos_todos FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_pos_todos_completed ON public.pos_todos(is_completed, remind_at);
CREATE INDEX IF NOT EXISTS idx_pos_todos_created_at ON public.pos_todos(created_at DESC);

CREATE TRIGGER update_pos_todos_updated_at
  BEFORE UPDATE ON public.pos_todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();