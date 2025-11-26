import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple string similarity function (Dice coefficient)
function calculateSimilarity(str1: string, str2: string): number {
  const bigrams1 = new Set<string>();
  const bigrams2 = new Set<string>();
  
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2));
  }
  
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.add(str2.substring(i, i + 2));
  }
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
}

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

    // Fetch all products from the store at once for efficient matching
    const { data: allStoreProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, barcode')
      .eq('store_id', storeId);

    if (fetchError) {
      throw new Error(`Failed to fetch store products: ${fetchError.message}`);
    }

    if (!allStoreProducts || allStoreProducts.length === 0) {
      throw new Error('No products found in store');
    }

    console.log(`Loaded ${allStoreProducts.length} products from store`);

    // Create lookup maps for fast matching
    const idMap = new Map<string, string>(); // id -> product_id
    const barcodeMap = new Map<string, string>(); // barcode -> product_id
    const nameMap = new Map<string, { id: string; name: string }>(); // lowercase name -> product
    
    for (const product of allStoreProducts) {
      idMap.set(product.id, product.id);
      if (product.barcode) {
        barcodeMap.set(String(product.barcode).trim(), product.id);
      }
      nameMap.set(product.name.toLowerCase().trim(), { id: product.id, name: product.name });
    }

    let updatedCount = 0;
    const notFoundProducts: string[] = [];
    const updates: Array<{ id: string; data: any }> = [];

    // Process each product
    for (const product of products) {
      // Extract all possible field names (case insensitive)
      const getId = product['Product ID'] || product['product_id'] || product.id;
      const nameValue = product.name || product.Name || product['Product Name'];
      const name = nameValue ? String(nameValue).trim() : null;
      
      // Try to find by Product ID first (most reliable)
      let productId = null;
      
      if (getId) {
        const idStr = String(getId).trim();
        productId = idMap.get(idStr);
        if (productId) {
          console.log(`Found by ID: "${name || idStr}"`);
        }
      }

      // Extract barcode field
      const barcode = product.barcode || product.Barcode;
      
      // Try to find by barcode if not found by ID
      if (!productId && barcode !== undefined && barcode !== null && barcode !== '') {
        const barcodeStr = String(barcode).trim();
        productId = barcodeMap.get(barcodeStr);
        if (productId) {
          console.log(`Found by barcode: "${name}"`);
        }
      }
      
      // If not found by ID/barcode, try exact name match
      if (!productId && name) {
        const exactMatch = nameMap.get(name.toLowerCase());
        if (exactMatch) {
          productId = exactMatch.id;
          console.log(`Found by exact name: "${name}"`);
        }
      }

      // If still not found, try fuzzy matching with higher threshold
      if (!productId && name) {
        if (allStoreProducts.length > 5000) {
          console.log(`Skipping fuzzy match for "${name}" - store too large`);
          notFoundProducts.push(name);
          continue;
        }

        let bestMatch = null;
        let bestScore = 0;
        const nameLower = name.toLowerCase();
        const firstChars = nameLower.substring(0, 3);
        
        for (const [_, productInfo] of nameMap) {
          const productNameLower = productInfo.name.toLowerCase();
          if (!productNameLower.startsWith(firstChars[0])) continue;
          
          const score = calculateSimilarity(nameLower, productNameLower);
          if (score > bestScore && score >= 0.7) {
            bestScore = score;
            bestMatch = productInfo;
          }
        }
        
        if (bestMatch) {
          productId = bestMatch.id;
          console.log(`Found fuzzy match (${Math.round(bestScore * 100)}%): "${name}" -> "${bestMatch.name}"`);
        } else {
          console.log(`Not found: "${name}"`);
          notFoundProducts.push(name);
          continue;
        }
      }

      if (!productId) {
        notFoundProducts.push(name || 'Unknown');
        continue;
      }

      // Build update object with all supported fields
      const updateData: any = {};
      
      // Barcode
      if (barcode !== undefined && barcode !== null && barcode !== '') {
        updateData.barcode = String(barcode).trim();
      }
      
      // Stock quantity
      const stockQty = product.stock_quantity || product.Stock_quantity || product.Stock_Quantity || product['Stock Quantity'];
      if (stockQty !== undefined && stockQty !== null && stockQty !== '') {
        const stockQtyNum = Number(stockQty);
        if (!isNaN(stockQtyNum)) {
          updateData.stock_quantity = Math.max(0, Math.floor(stockQtyNum));
        }
      }
      
      // Cost price
      const costPrice = product.cost_price || product.Cost_price || product.Cost_Price || product['Cost Price'];
      if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
        const costPriceNum = Number(costPrice);
        if (!isNaN(costPriceNum) && costPriceNum >= 0) {
          updateData.cost_price = costPriceNum;
        }
      }

      // Retail price
      const retailPrice = product.price || product.Price || product['Retail Price'];
      if (retailPrice !== undefined && retailPrice !== null && retailPrice !== '') {
        const retailPriceNum = Number(retailPrice);
        if (!isNaN(retailPriceNum) && retailPriceNum >= 0) {
          updateData.price = retailPriceNum;
        }
      }

      // Wholesale price
      const wholesalePrice = product.wholesale_price || product.Wholesale_price || product.Wholesale_Price || product['Wholesale Price'];
      if (wholesalePrice !== undefined && wholesalePrice !== null && wholesalePrice !== '') {
        const wholesalePriceNum = Number(wholesalePrice);
        if (!isNaN(wholesalePriceNum) && wholesalePriceNum >= 0) {
          updateData.wholesale_price = wholesalePriceNum;
        }
      }

      // VIP price
      const vipPrice = product.vip_price || product.Vip_price || product.VIP_Price || product['VIP Price'];
      if (vipPrice !== undefined && vipPrice !== null && vipPrice !== '') {
        const vipPriceNum = Number(vipPrice);
        if (!isNaN(vipPriceNum) && vipPriceNum >= 0) {
          updateData.vip_price = vipPriceNum;
        }
      }

      // Unit
      const unit = product.unit || product.Unit;
      if (unit !== undefined && unit !== null && unit !== '') {
        updateData.unit = String(unit).trim();
      }

      // Description
      const description = product.description || product.Description;
      if (description !== undefined && description !== null && description !== '') {
        updateData.description = String(description).trim();
      }

      // Only queue update if there's something to update
      if (Object.keys(updateData).length > 0) {
        updates.push({ id: productId, data: updateData });
      }
    }

    // Batch update all products
    console.log(`Updating ${updates.length} products...`);
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('products')
        .update(update.data)
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating product:`, updateError);
      } else {
        updatedCount++;
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
