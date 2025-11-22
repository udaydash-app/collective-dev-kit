import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find and merge duplicate variants (same product + barcode)
    const { data: variants, error: fetchError } = await supabaseClient
      .from('product_variants')
      .select('id, product_id, barcode, label, price, stock_quantity, unit, cost_price')
      .not('barcode', 'is', null)
      .order('product_id, barcode, created_at')

    if (fetchError) throw fetchError

    const merged: string[] = []
    const deleted: string[] = []
    const groups = new Map<string, any[]>()

    // Group variants by product_id + barcode
    for (const variant of variants || []) {
      const key = `${variant.product_id}-${variant.barcode}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(variant)
    }

    // Process each group of duplicates
    for (const [key, group] of groups) {
      if (group.length <= 1) continue // No duplicates

      // Keep the first variant (oldest)
      const keepVariant = group[0]
      const duplicates = group.slice(1)

      console.log(`Found ${group.length} duplicates for ${key}:`, group.map(v => v.id))

      // Sum up stock quantities and merge inventory layers
      let totalStock = keepVariant.stock_quantity || 0
      for (const dup of duplicates) {
        totalStock += dup.stock_quantity || 0

        // Transfer inventory layers
        await supabaseClient
          .from('inventory_layers')
          .update({ variant_id: keepVariant.id })
          .eq('variant_id', dup.id)

        // Update references in other tables
        await supabaseClient
          .from('purchase_items')
          .update({ variant_id: keepVariant.id })
          .eq('variant_id', dup.id)

        await supabaseClient
          .from('cart_items')
          .update({ variant_id: keepVariant.id })
          .eq('variant_id', dup.id)

        await supabaseClient
          .from('order_items')
          .update({ variant_id: null }) // Can't update order items, just clear reference
          .eq('product_id', dup.product_id)

        deleted.push(dup.id)
      }

      // Update kept variant with merged stock
      await supabaseClient
        .from('product_variants')
        .update({ stock_quantity: totalStock })
        .eq('id', keepVariant.id)

      // Delete duplicates
      await supabaseClient
        .from('product_variants')
        .delete()
        .in('id', duplicates.map(d => d.id))

      merged.push(key)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        merged: merged.length,
        deleted: deleted.length,
        details: merged 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
