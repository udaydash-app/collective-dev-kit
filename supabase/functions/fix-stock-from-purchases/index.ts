import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body for optional threshold
    let threshold = 10
    try {
      const body = await req.json()
      if (body.threshold) threshold = body.threshold
    } catch {
      // Use default threshold
    }

    console.log('Starting stock recalculation with threshold:', threshold)

    // Get all purchase items grouped
    const { data: purchaseItems, error: purchaseError } = await supabaseClient
      .from('purchase_items')
      .select('product_id, variant_id, quantity')

    if (purchaseError) {
      console.error('Purchase items error:', purchaseError)
      throw purchaseError
    }

    // Build purchase totals map
    const purchaseMap = new Map<string, number>()
    for (const item of purchaseItems || []) {
      const key = `${item.product_id}-${item.variant_id || 'null'}`
      purchaseMap.set(key, (purchaseMap.get(key) || 0) + item.quantity)
    }
    console.log('Purchase map size:', purchaseMap.size)

    // Get all transactions and calculate sales
    const { data: transactions, error: transError } = await supabaseClient
      .from('pos_transactions')
      .select('items')

    if (transError) {
      console.error('Transactions error:', transError)
      throw transError
    }

    const salesMap = new Map<string, number>()
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    
    for (const trans of transactions || []) {
      const items = trans.items as any[]
      for (const item of items || []) {
        const productId = item.productId
        if (!productId || !uuidRegex.test(productId)) continue
        
        const variantId = item.variantId || 'null'
        const key = `${productId}-${variantId}`
        salesMap.set(key, (salesMap.get(key) || 0) + (item.quantity || 0))
      }
    }
    console.log('Sales map size:', salesMap.size)

    // Get all products
    const { data: products, error: productError } = await supabaseClient
      .from('products')
      .select('id, name, stock_quantity')

    if (productError) {
      console.error('Products error:', productError)
      throw productError
    }

    // Fix products with significant difference
    const fixes: any[] = []
    for (const product of products || []) {
      const key = `${product.id}-null`
      const purchased = purchaseMap.get(key) || 0
      const sold = salesMap.get(key) || 0
      const expected = purchased - sold
      const current = product.stock_quantity || 0
      const diff = Math.abs(current - expected)

      if (diff > threshold) {
        fixes.push({
          id: product.id,
          name: product.name,
          current,
          expected,
          diff
        })

        const { error } = await supabaseClient
          .from('products')
          .update({ stock_quantity: expected, updated_at: new Date().toISOString() })
          .eq('id', product.id)

        if (error) {
          console.error('Failed to update product:', product.id, error)
        }
      }
    }
    console.log('Products fixed:', fixes.length)

    // Get all variants
    const { data: variants, error: variantError } = await supabaseClient
      .from('product_variants')
      .select('id, product_id, label, stock_quantity')

    if (variantError) {
      console.error('Variants error:', variantError)
      throw variantError
    }

    const variantFixes: any[] = []
    for (const variant of variants || []) {
      const key = `${variant.product_id}-${variant.id}`
      const purchased = purchaseMap.get(key) || 0
      const sold = salesMap.get(key) || 0
      const expected = purchased - sold
      const current = variant.stock_quantity || 0
      const diff = Math.abs(current - expected)

      if (diff > threshold) {
        variantFixes.push({
          id: variant.id,
          label: variant.label,
          current,
          expected,
          diff
        })

        const { error } = await supabaseClient
          .from('product_variants')
          .update({ stock_quantity: expected, updated_at: new Date().toISOString() })
          .eq('id', variant.id)

        if (error) {
          console.error('Failed to update variant:', variant.id, error)
        }
      }
    }
    console.log('Variants fixed:', variantFixes.length)

    return new Response(
      JSON.stringify({
        success: true,
        productsFixed: fixes.length,
        variantsFixed: variantFixes.length,
        threshold,
        products: fixes.slice(0, 50), // Limit response size
        variants: variantFixes.slice(0, 50)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})