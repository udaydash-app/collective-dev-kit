import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { variantId, productId } = await req.json()

    if (!variantId && !productId) {
      return new Response(
        JSON.stringify({ error: 'Either variantId or productId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Delete inventory layers
    let query = supabaseClient.from('inventory_layers').delete()
    
    if (variantId) {
      query = query.eq('variant_id', variantId)
    } else if (productId) {
      query = query.eq('product_id', productId)
    }

    const { error: deleteError, count } = await query

    if (deleteError) throw deleteError

    // Update product/variant stock to 0
    if (variantId) {
      await supabaseClient
        .from('product_variants')
        .update({ stock_quantity: 0 })
        .eq('id', variantId)
    }

    if (productId) {
      await supabaseClient
        .from('products')
        .update({ stock_quantity: 0 })
        .eq('id', productId)
    }

    return new Response(
      JSON.stringify({ success: true, deletedLayers: count || 0 }),
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
