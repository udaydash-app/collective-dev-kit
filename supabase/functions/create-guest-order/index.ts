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
    
    // Use service role to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      guestInfo, 
      cartItems, 
      subtotal 
    } = await req.json();

    console.log('Creating guest order:', { guestInfo, itemCount: cartItems.length, subtotal });

    // Get active store
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (storeError || !store) {
      throw new Error('No active store found');
    }

    // Generate order number
    const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase();

    // Create order (bypasses RLS with service role)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        store_id: store.id,
        user_id: null, // Guest order
        subtotal: subtotal,
        total: subtotal,
        delivery_fee: 0,
        tax: 0,
        status: 'pending',
        payment_status: 'pending',
        delivery_instructions: `Guest Order - Name: ${guestInfo.name}, Phone: ${guestInfo.phone}, Area: ${guestInfo.area}${guestInfo.instructions ? ', Instructions: ' + guestInfo.instructions : ''}`
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw orderError;
    }

    // Create order items
    const orderItems = cartItems.map((item: any) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      // Try to clean up the order
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      throw itemsError;
    }

    console.log('Guest order created successfully:', order.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        order: order 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in create-guest-order:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
