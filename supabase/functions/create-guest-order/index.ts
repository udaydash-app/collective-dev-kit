import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiting (resets on function cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // Max 5 orders per minute per IP
const MAX_ORDER_VALUE = 50000; // Maximum order value limit
const MAX_ITEMS_PER_ORDER = 50; // Maximum items per order

function getClientIP(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    // First request or window expired
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  entry.count++;
  return false;
}

// Input validation helpers
function validateGuestInfo(guestInfo: any): { valid: boolean; error?: string } {
  if (!guestInfo || typeof guestInfo !== 'object') {
    return { valid: false, error: 'Guest information is required' };
  }
  
  const { name, phone, area } = guestInfo;
  
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
    return { valid: false, error: 'Valid name is required (2-100 characters)' };
  }
  
  if (!phone || typeof phone !== 'string' || phone.trim().length < 7 || phone.length > 20) {
    return { valid: false, error: 'Valid phone number is required (7-20 characters)' };
  }
  
  // Basic phone validation - allow digits, spaces, dashes, plus, parentheses
  const phoneRegex = /^[\d\s\-+()]+$/;
  if (!phoneRegex.test(phone)) {
    return { valid: false, error: 'Phone number contains invalid characters' };
  }
  
  if (!area || typeof area !== 'string' || area.trim().length < 2 || area.length > 200) {
    return { valid: false, error: 'Valid delivery area is required (2-200 characters)' };
  }
  
  return { valid: true };
}

function validateCartItems(cartItems: any): { valid: boolean; error?: string } {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return { valid: false, error: 'Cart items are required' };
  }
  
  if (cartItems.length > MAX_ITEMS_PER_ORDER) {
    return { valid: false, error: `Maximum ${MAX_ITEMS_PER_ORDER} items per order` };
  }
  
  for (let i = 0; i < cartItems.length; i++) {
    const item = cartItems[i];
    
    if (!item.product_id || typeof item.product_id !== 'string') {
      return { valid: false, error: `Invalid product_id at item ${i + 1}` };
    }
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(item.product_id)) {
      return { valid: false, error: `Invalid product_id format at item ${i + 1}` };
    }
    
    if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 1000) {
      return { valid: false, error: `Invalid quantity at item ${i + 1} (must be 1-1000)` };
    }
    
    if (typeof item.price !== 'number' || item.price < 0 || item.price > 100000) {
      return { valid: false, error: `Invalid price at item ${i + 1}` };
    }
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  
  // Rate limiting check
  if (isRateLimited(clientIP)) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Too many orders. Please wait a moment before trying again.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS (required for guest orders)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      guestInfo, 
      cartItems, 
      subtotal 
    } = await req.json();

    // Validate guest info
    const guestValidation = validateGuestInfo(guestInfo);
    if (!guestValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: guestValidation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate cart items
    const cartValidation = validateCartItems(cartItems);
    if (!cartValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: cartValidation.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate subtotal
    if (typeof subtotal !== 'number' || subtotal <= 0 || subtotal > MAX_ORDER_VALUE) {
      return new Response(
        JSON.stringify({ success: false, error: `Order value must be between 0 and ${MAX_ORDER_VALUE}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Calculate expected subtotal to prevent tampering
    const calculatedSubtotal = cartItems.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0
    );
    
    // Allow small floating point differences
    if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
      console.warn('Subtotal mismatch detected:', { provided: subtotal, calculated: calculatedSubtotal, ip: clientIP });
      return new Response(
        JSON.stringify({ success: false, error: 'Order total mismatch. Please refresh and try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Creating guest order:', { 
      guestName: guestInfo.name, 
      itemCount: cartItems.length, 
      subtotal,
      ip: clientIP 
    });

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

    // Sanitize guest info for storage (basic XSS prevention)
    const sanitizedName = guestInfo.name.trim().replace(/[<>]/g, '');
    const sanitizedPhone = guestInfo.phone.trim().replace(/[<>]/g, '');
    const sanitizedArea = guestInfo.area.trim().replace(/[<>]/g, '');
    const sanitizedInstructions = guestInfo.instructions 
      ? guestInfo.instructions.trim().replace(/[<>]/g, '').substring(0, 500) 
      : '';

    // Create order (bypasses RLS with service role - required for guest checkout)
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
        delivery_instructions: `Guest Order - Name: ${sanitizedName}, Phone: ${sanitizedPhone}, Area: ${sanitizedArea}${sanitizedInstructions ? ', Instructions: ' + sanitizedInstructions : ''}`
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

    console.log('Guest order created successfully:', { orderId: order.id, orderNumber, ip: clientIP });

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
