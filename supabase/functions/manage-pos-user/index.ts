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

    const { action, full_name, pin, user_id, is_active, role } = await req.json()

    console.log('Managing POS user:', action, full_name, 'role:', role)

    if (action === 'create') {
      // Hash the PIN using pgcrypto
      const { data: hashedPin, error: hashError } = await supabaseClient
        .rpc('crypt_pin', { input_pin: pin })

      if (hashError) throw hashError

      const { data: newUser, error } = await supabaseClient
        .from('pos_users')
        .insert([{
          full_name,
          pin_hash: hashedPin,
        }])
        .select()
        .single()

      if (error) throw error

      // Create auth user and assign role
      const authEmail = `pos-${newUser.id}@pos.globalmarket.app`
      const authPassword = `PIN${pin.padStart(6, '0')}`
      
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email: authEmail,
        password: authPassword,
        email_confirm: true,
        user_metadata: {
          full_name: full_name,
        }
      })

      if (authError) {
        console.error('Auth user creation failed:', authError)
        throw authError
      }

      // Update pos_users with user_id
      const { error: updateError } = await supabaseClient
        .from('pos_users')
        .update({ user_id: authData.user.id })
        .eq('id', newUser.id)

      if (updateError) throw updateError

      // Assign role
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: role || 'cashier'
        })

      if (roleError) throw roleError

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

      const { data: posUser, error } = await supabaseClient
        .from('pos_users')
        .update(updateData)
        .eq('id', user_id)
        .select()
        .single()

      if (error) throw error

      // Update auth user password if PIN was changed and user_id exists
      if (pin && posUser.user_id) {
        const authPassword = `PIN${pin.padStart(6, '0')}`
        
        const { error: passwordError } = await supabaseClient.auth.admin.updateUserById(
          posUser.user_id,
          { password: authPassword }
        )

        if (passwordError) {
          console.error('Failed to update auth password:', passwordError)
          throw new Error('Failed to update login credentials: ' + passwordError.message)
        }
      }

      // Update role if user_id exists and role is provided
      if (posUser.user_id && role) {
        // Check if role exists
        const { data: existingRole } = await supabaseClient
          .from('user_roles')
          .select('*')
          .eq('user_id', posUser.user_id)
          .maybeSingle()

        if (existingRole) {
          // Update existing role
          const { error: roleError } = await supabaseClient
            .from('user_roles')
            .update({ role })
            .eq('user_id', posUser.user_id)

          if (roleError) throw roleError
        } else {
          // Insert new role
          const { error: roleError } = await supabaseClient
            .from('user_roles')
            .insert({ user_id: posUser.user_id, role })

          if (roleError) throw roleError
        }
      }

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
