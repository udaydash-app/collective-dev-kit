import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderConfirmationRequest {
  orderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId }: OrderConfirmationRequest = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          quantity,
          unit_price,
          products (name)
        ),
        addresses (address_line1, city, state, zip_code),
        stores (name)
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', order.user_id)
      .single();

    // Send confirmation email
    const emailResponse = await resend.emails.send({
      from: "Global Market <orders@yourdomain.com>",
      to: [profile?.full_name || "customer@example.com"],
      subject: `Order Confirmation - ${order.order_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #22C55E;">Order Confirmed! 🎉</h1>
          <p>Hi ${profile?.full_name || 'there'},</p>
          <p>Thank you for your order from ${order.stores.name}!</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">Order Details</h2>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            <p><strong>Total:</strong> $${order.total}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Delivery Date:</strong> ${order.delivery_date || 'TBD'}</p>
          </div>

          <h3>Items Ordered:</h3>
          <ul>
            ${order.order_items.map((item: any) => `
              <li>${item.products.name} - Qty: ${item.quantity} - $${item.unit_price}</li>
            `).join('')}
          </ul>

          <h3>Delivery Address:</h3>
          <p>
            ${order.addresses.address_line1}<br>
            ${order.addresses.city}, ${order.addresses.state} ${order.addresses.zip_code}
          </p>

          ${order.delivery_instructions ? `
            <p><strong>Delivery Instructions:</strong> ${order.delivery_instructions}</p>
          ` : ''}

          <p style="margin-top: 30px;">
            Track your order at: 
            <a href="https://yourdomain.com/order/${order.id}">View Order Status</a>
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p style="color: #666; font-size: 12px;">
            Questions? Contact us at support@globalgrocery.com
          </p>
        </div>
      `,
    });

    console.log("Order confirmation email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending order confirmation:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
