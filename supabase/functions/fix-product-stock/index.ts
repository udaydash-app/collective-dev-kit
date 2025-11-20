import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { productId } = await req.json()

    if (!productId) {
      return new Response(
        JSON.stringify({ error: 'Product ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get sum of inventory layers
    const { data: layers, error: layersError } = await supabaseClient
      .from('inventory_layers')
      .select('quantity_remaining')
      .eq('product_id', productId)

    if (layersError) throw layersError

    const correctStock = layers?.reduce((sum, layer) => sum + (layer.quantity_remaining || 0), 0) || 0

    // Update product stock using service role to bypass RLS and triggers
    const { error: updateError } = await supabaseClient
      .from('products')
      .update({ stock_quantity: correctStock })
      .eq('id', productId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true, correctStock }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
