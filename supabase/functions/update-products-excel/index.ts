import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin access
    const { data: hasAdmin } = await supabase.rpc('verify_admin_access', {
      p_user_id: user.id
    });

    if (!hasAdmin) {
      throw new Error('Admin access required');
    }

    const { products, storeId } = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      throw new Error('No products provided');
    }

    if (!storeId) {
      throw new Error('Store ID is required');
    }

    console.log(`Processing ${products.length} products for update`);

    let updatedCount = 0;
    const notFoundProducts: string[] = [];

    // Process each product
    for (const product of products) {
      const nameValue = product.name || product.Name;
      const name = nameValue ? String(nameValue).trim() : null;
      
      if (!name) {
        console.log('Skipping product without name');
        continue;
      }

      // Find existing product by name (case-insensitive) and store
      const { data: existingProducts, error: findError } = await supabase
        .from('products')
        .select('id')
        .eq('store_id', storeId)
        .ilike('name', name)
        .limit(1);

      if (findError) {
        console.error(`Error finding product "${name}":`, findError);
        notFoundProducts.push(name);
        continue;
      }

      if (!existingProducts || existingProducts.length === 0) {
        console.log(`Product not found: "${name}"`);
        notFoundProducts.push(name);
        continue;
      }

      const productId = existingProducts[0].id;

      // Build update object with only provided fields
      const updateData: any = {};
      
      // Handle different column name formats (case-insensitive, with/without underscores)
      const barcode = product.barcode || product.Barcode;
      const stockQty = product.stock_quantity || product.Stock_quantity || product.Stock_Quantity || product['Stock_quantity'];
      const costPrice = product.cost_price || product.Cost_price || product.Cost_Price || product['Cost_Price'];
      
      if (barcode !== undefined && barcode !== null && barcode !== '') {
        updateData.barcode = String(barcode).trim();
      }
      
      if (stockQty !== undefined && stockQty !== null && stockQty !== '') {
        const stockQtyNum = Number(stockQty);
        if (!isNaN(stockQtyNum)) {
          updateData.stock_quantity = Math.max(0, Math.floor(stockQtyNum));
        }
      }
      
      if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
        const costPriceNum = Number(costPrice);
        if (!isNaN(costPriceNum) && costPriceNum >= 0) {
          updateData.cost_price = costPriceNum;
        }
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', productId);

        if (updateError) {
          console.error(`Error updating product "${name}":`, updateError);
          notFoundProducts.push(name);
        } else {
          console.log(`Updated product: "${name}"`);
          updatedCount++;
        }
      } else {
        console.log(`No valid data to update for: "${name}"`);
      }
    }

    const executionTime = Date.now() - startTime;

    // Log the import
    await supabase.from('import_logs').insert({
      url: 'excel-update',
      store_id: storeId,
      status: updatedCount > 0 ? 'success' : 'partial',
      products_imported: updatedCount,
      execution_time_ms: executionTime,
      error_message: notFoundProducts.length > 0 
        ? `${notFoundProducts.length} products not found: ${notFoundProducts.slice(0, 5).join(', ')}${notFoundProducts.length > 5 ? '...' : ''}`
        : null
    });

    return new Response(
      JSON.stringify({
        success: true,
        updatedCount,
        notFoundCount: notFoundProducts.length,
        notFoundProducts,
        executionTime
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error updating products:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
