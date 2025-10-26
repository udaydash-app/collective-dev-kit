import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, full_name, pin, user_id, is_active } = await req.json()

    console.log('Managing POS user:', action, full_name)

    if (action === 'create') {
      // Hash the PIN using pgcrypto
      const { data: hashedPin, error: hashError } = await supabaseClient
        .rpc('crypt_pin', { input_pin: pin })

      if (hashError) throw hashError

      const { error } = await supabaseClient
        .from('pos_users')
        .insert([{
          full_name,
          pin_hash: hashedPin,
        }])

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, message: 'User created successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else if (action === 'update') {
      const updateData: any = { full_name, is_active }

      // Only update PIN if provided
      if (pin) {
        const { data: hashedPin, error: hashError } = await supabaseClient
          .rpc('crypt_pin', { input_pin: pin })

        if (hashError) throw hashError
        updateData.pin_hash = hashedPin
      }

      const { error } = await supabaseClient
        .from('pos_users')
        .update(updateData)
        .eq('id', user_id)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, message: 'User updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Invalid action')
  } catch (error) {
    console.error('Error managing POS user:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
