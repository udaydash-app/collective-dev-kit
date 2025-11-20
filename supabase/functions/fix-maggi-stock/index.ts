import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find MAGGI MASALA POUCH product
    const { data: product, error: findError } = await supabaseClient
      .from('products')
      .select('id, name, stock_quantity')
      .ilike('name', '%maggi masala pouch%')
      .single()

    if (findError) throw findError

    // Get sum of inventory layers
    const { data: layers, error: layersError } = await supabaseClient
      .from('inventory_layers')
      .select('quantity_remaining')
      .eq('product_id', product.id)

    if (layersError) throw layersError

    const correctStock = layers?.reduce((sum, layer) => sum + (layer.quantity_remaining || 0), 0) || 0

    console.log(`Product: ${product.name}`)
    console.log(`Current stock: ${product.stock_quantity}`)
    console.log(`Correct stock from layers: ${correctStock}`)

    // Update product stock using raw SQL to bypass any triggers
    const { error: updateError } = await supabaseClient.rpc('exec_sql', {
      sql: `UPDATE products SET stock_quantity = ${correctStock}, updated_at = NOW() WHERE id = '${product.id}'`
    })

    if (updateError) {
      // Fallback to regular update
      const { error: fallbackError } = await supabaseClient
        .from('products')
        .update({ stock_quantity: correctStock })
        .eq('id', product.id)
      
      if (fallbackError) throw fallbackError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        productName: product.name,
        oldStock: product.stock_quantity,
        newStock: correctStock 
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
