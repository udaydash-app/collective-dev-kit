import { supabase } from '@/integrations/supabase/client';

export interface PublicBranding {
  company_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
}

// Shop name/logo/icon for screens shown before sign-in. Full settings rows are
// staff-only, so public screens use the get_public_branding lookup. The LAN
// database may not have that lookup yet, so fall back to a direct read there.
export async function fetchPublicBranding(): Promise<PublicBranding | null> {
  const { data, error } = await (supabase as any).rpc('get_public_branding');
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data;
    return row ?? null;
  }
  const { data: direct } = await supabase
    .from('settings')
    .select('company_name, logo_url, favicon_url')
    .limit(1)
    .maybeSingle();
  return (direct as PublicBranding) ?? null;
}
