import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuoteItem {
  itemId: string;
  cartons: number;
  pieces: number;
  price: number;
  currency: string;
  weight: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { shareToken, items, isDraft } = await req.json();

    if (!shareToken || !items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing quote submission for token:', shareToken);

    // Validate the purchase order exists and is still valid
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select('id, status, valid_until')
      .eq('share_token', shareToken)
      .single();

    if (poError || !po) {
      console.error('Purchase order not found:', poError);
      return new Response(
        JSON.stringify({ error: 'Invalid purchase order token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if PO is expired
    if (po.valid_until && new Date(po.valid_until) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Purchase order has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already converted or cancelled (but allow drafts for quote_received status)
    if (po.status === 'converted' || po.status === 'cancelled') {
      return new Response(
        JSON.stringify({ error: 'Purchase order is no longer active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate final submission has at least one price (skip for drafts)
    if (!isDraft && !items.some((item: QuoteItem) => item.price > 0)) {
      return new Response(
        JSON.stringify({ error: 'At least one item must have a price for final submission' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete existing responses for this PO
    await supabase
      .from('purchase_order_responses')
      .delete()
      .eq('purchase_order_id', po.id);

    // Insert new responses
    const responses = items.map((item: QuoteItem) => ({
      purchase_order_id: po.id,
      item_id: item.itemId,
      cartons: item.cartons || 0,
      pieces: item.pieces || 0,
      price: item.price,
      currency: item.currency || 'USD',
      weight: item.weight || 0,
    }));

    const { error: insertError } = await supabase
      .from('purchase_order_responses')
      .insert(responses);

    if (insertError) {
      console.error('Error inserting responses:', insertError);
      throw insertError;
    }

    // Update PO status to quote_received only for final submission
    if (!isDraft) {
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({ status: 'quote_received', updated_at: new Date().toISOString() })
        .eq('id', po.id);

      if (updateError) {
        console.error('Error updating PO status:', updateError);
        throw updateError;
      }
    }

    console.log(isDraft ? 'Draft saved successfully for PO:' : 'Quote submitted successfully for PO:', po.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isDraft ? 'Draft saved successfully' : 'Quote submitted successfully' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing quote:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});