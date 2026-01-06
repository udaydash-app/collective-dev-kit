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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No valid token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with anon key to verify user token
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the JWT token and get user claims
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Token verification failed:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = claimsData.claims.sub;
    console.log('Authenticated user:', callerUserId);

    // Create service role client for admin operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the calling user has admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUserId)
      .single();

    if (roleError || !roleData || roleData.role !== 'admin') {
      console.error('Admin access denied for user:', callerUserId, 'Role:', roleData?.role);
      return new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin access verified for user:', callerUserId);

    const { action, full_name, pin, user_id, is_active, role } = await req.json();

    console.log('Managing POS user:', action, full_name, 'role:', role);

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

      // Handle auth user creation/update if PIN was changed
      if (pin) {
        const authEmail = `pos-${posUser.id}@pos.globalmarket.app`
        const authPassword = `PIN${pin.padStart(6, '0')}`

        if (posUser.user_id) {
          // Update existing auth user password
          const { error: passwordError } = await supabaseClient.auth.admin.updateUserById(
            posUser.user_id,
            { password: authPassword }
          )

          if (passwordError) {
            console.error('Failed to update auth password:', passwordError)
            throw new Error('Failed to update login credentials: ' + passwordError.message)
          }
        } else {
          // user_id is null, try to find existing auth user or create new one
          // First try to get existing user by email
          const { data: { users }, error: listError } = await supabaseClient.auth.admin.listUsers()
          
          if (listError) throw listError

          const existingAuthUser = users.find(u => u.email === authEmail)

          if (existingAuthUser) {
            // Found existing auth user, update password and link it
            const { error: passwordError } = await supabaseClient.auth.admin.updateUserById(
              existingAuthUser.id,
              { password: authPassword }
            )

            if (passwordError) throw passwordError

            // Update pos_users with the user_id
            const { error: linkError } = await supabaseClient
              .from('pos_users')
              .update({ user_id: existingAuthUser.id })
              .eq('id', posUser.id)

            if (linkError) throw linkError

            posUser.user_id = existingAuthUser.id
          } else {
            // Create new auth user
            const { data: authData, error: createError } = await supabaseClient.auth.admin.createUser({
              email: authEmail,
              password: authPassword,
              email_confirm: true,
              user_metadata: {
                full_name: full_name,
              }
            })

            if (createError) throw createError

            // Update pos_users with the new user_id
            const { error: linkError } = await supabaseClient
              .from('pos_users')
              .update({ user_id: authData.user.id })
              .eq('id', posUser.id)

            if (linkError) throw linkError

            posUser.user_id = authData.user.id
          }
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
