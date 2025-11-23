-- Create backup_logs table to track backup history
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL CHECK (backup_type IN ('manual', 'automatic', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  tables_backed_up TEXT[] DEFAULT '{}',
  records_count JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id),
  backup_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON public.backup_logs(status);
CREATE INDEX IF NOT EXISTS idx_backup_logs_created_at ON public.backup_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- Admin users can view all backup logs
CREATE POLICY "Admin users can view backup logs"
  ON public.backup_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admin users can create backup logs
CREATE POLICY "Admin users can create backup logs"
  ON public.backup_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create backup_settings table
CREATE TABLE IF NOT EXISTS public.backup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_backup_enabled BOOLEAN DEFAULT false,
  backup_frequency_hours INTEGER DEFAULT 24,
  last_backup_at TIMESTAMPTZ,
  next_backup_at TIMESTAMPTZ,
  tables_to_backup TEXT[] DEFAULT ARRAY[
    'products',
    'product_variants',
    'categories',
    'contacts',
    'purchases',
    'purchase_items',
    'pos_transactions',
    'orders',
    'inventory_layers',
    'stock_adjustments'
  ],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one settings record should exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_settings_singleton ON public.backup_settings((id IS NOT NULL));

-- Insert default settings
INSERT INTO public.backup_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

-- Admin users can view settings
CREATE POLICY "Admin users can view backup settings"
  ON public.backup_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Admin users can update settings
CREATE POLICY "Admin users can update backup settings"
  ON public.backup_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add trigger to update updated_at
CREATE TRIGGER update_backup_settings_updated_at
  BEFORE UPDATE ON public.backup_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();