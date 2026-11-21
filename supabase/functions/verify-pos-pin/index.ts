import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

// PIN login check. The database PIN lookup is server-only; this function is the
// single public entry point and returns only the identity matching the PIN.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';
    if (pin.length < 4 || pin.length > 32) return json({ users: [] });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const { data, error } = await admin.rpc('verify_pin', { input_pin: pin });
    if (error) {
      console.error('verify_pin failed:', error.message);
      return json({ error: 'PIN check failed' }, 500);
    }

    const users = (data ?? []).map((u: any) => ({
      pos_user_id: u.pos_user_id,
      user_id: u.user_id,
      full_name: u.full_name,
    }));
    return json({ users });
  } catch (e) {
    console.error('verify-pos-pin error:', (e as Error).message);
    return json({ error: 'PIN check failed' }, 500);
  }
});
