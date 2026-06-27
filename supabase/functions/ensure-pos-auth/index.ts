import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pos_user_id, pin } = await req.json();
    if (!pos_user_id || !pin || String(pin).length < 4) {
      return new Response(JSON.stringify({ error: 'Invalid PIN session' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: verifiedUsers, error: verifyError } = await supabaseAdmin.rpc('verify_pin', {
      input_pin: String(pin),
    });

    if (verifyError) throw verifyError;

    const posUser = (verifiedUsers ?? []).find((user: any) => user.pos_user_id === pos_user_id);
    if (!posUser) {
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Backfill offline_pin_hash so installed/offline clients (which ship a
    // snapshot of pos_users) can verify this PIN without a prior online login
    // on that device. Safe to overwrite — value is deterministic per (id, pin).
    try {
      const encoded = new TextEncoder().encode(`global-market-pos:${posUser.pos_user_id}:${String(pin)}`);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      const offlinePinHash = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      await supabaseAdmin
        .from('pos_users')
        .update({ offline_pin_hash: offlinePinHash })
        .eq('id', posUser.pos_user_id);
    } catch (e) {
      console.error('Failed to backfill offline_pin_hash:', e);
    }

    const fullName = posUser.full_name || 'POS User';
    const isAdminUser = fullName.trim().toLowerCase() === 'admin';
    const fallbackEmail = isAdminUser ? 'uday.dash@gmail.com' : `pos-${posUser.pos_user_id}@pos.globalmarket.app`;
    const authPassword = `PIN${String(pin).padStart(6, '0')}`;

    let authUserId = posUser.user_id as string | null;
    let authEmail = fallbackEmail;

    if (authUserId) {
      const { data: existingById, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(authUserId);
      if (getUserError || !existingById?.user) {
        authUserId = null;
      } else {
        authEmail = existingById.user.email || fallbackEmail;
        const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: authPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (updatePasswordError) throw updatePasswordError;
      }
    }

    if (!authUserId) {
      const { data: listedUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;

      const existingByEmail = listedUsers.users.find((user) => user.email?.toLowerCase() === fallbackEmail.toLowerCase());
      if (existingByEmail) {
        authUserId = existingByEmail.id;
        authEmail = existingByEmail.email || fallbackEmail;
        const { error: updateExistingError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: authPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (updateExistingError) throw updateExistingError;
      } else {
        const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: fallbackEmail,
          password: authPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        });
        if (createError) throw createError;
        authUserId = createdUser.user.id;
        authEmail = createdUser.user.email || fallbackEmail;
      }

      const { error: linkError } = await supabaseAdmin
        .from('pos_users')
        .update({ user_id: authUserId })
        .eq('id', posUser.pos_user_id);
      if (linkError) throw linkError;
    }

    const role = isAdminUser ? 'admin' : 'cashier';
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: authUserId, role }, { onConflict: 'user_id,role' });
    if (roleError) throw roleError;

    return new Response(JSON.stringify({ success: true, auth_email: authEmail, auth_user_id: authUserId, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('ensure-pos-auth error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unable to prepare POS login' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});