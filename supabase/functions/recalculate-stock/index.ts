import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'products'; // 'products' or 'variants'

    console.log(`Starting stock recalculation for: ${mode}`);

    let result;
    if (mode === 'products') {
      const { data, error } = await supabaseAdmin.rpc('recalculate_products_stock');
      if (error) throw new Error(error.message);
      result = { mode, updated: data };
    } else if (mode === 'variants') {
      const { data, error } = await supabaseAdmin.rpc('recalculate_variants_stock');
      if (error) throw new Error(error.message);
      result = { mode, updated: data };
    } else {
      throw new Error('Invalid mode. Use "products" or "variants"');
    }

    console.log('Result:', JSON.stringify(result));

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
