import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: adminCheck, error: adminError } = await supabase.rpc('verify_admin_access', {
      p_user_id: user.id
    });

    if (adminError || !adminCheck) {
      throw new Error('Admin access required');
    }

    const { pdfText, storeId } = await req.json();

    if (!pdfText || !storeId) {
      throw new Error('Missing required fields: pdfText and storeId');
    }

    console.log('Processing PDF text for store:', storeId);

    // Use AI to extract product information from PDF text
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('Lovable AI key not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction assistant specialized in extracting product information from invoices, price lists, inventory sheets, and product catalogs.

Extract ALL product information you can find from the provided text and return ONLY a valid JSON array.

Each product object should have these fields:
- name (string, required): The product name or description
- barcode (string, optional): Product barcode, SKU, product code, or item number
- stock_quantity (number, optional): Stock quantity, available quantity, or inventory count
- cost_price (number, optional): Unit price, cost, price per item (extract just the number, no currency symbols)

Look for:
- Product lists, item descriptions, article names
- Codes like "Code:", "SKU:", "Ref:", "Item #:", or numbers near product names
- Quantities like "Qty:", "Stock:", "Available:", or numbers followed by units
- Prices like "Price:", "Cost:", "Unit price:", or currency amounts

Be flexible with formats - products might be in tables, lists, or paragraphs.
If you see multiple products, extract them all.
Return ONLY the JSON array, no markdown code blocks, no explanations.
If you truly cannot find ANY products, return an empty array [].`
          },
          {
            role: 'user',
            content: `Extract all product information from this text:\n\n${pdfText}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('Failed to extract product information from PDF');
    }

    const aiResult = await aiResponse.json();
    const extractedText = aiResult.choices[0]?.message?.content || '[]';
    
    console.log('AI extracted data:', extractedText);

    // Clean and parse the AI response
    let extractedProducts = [];
    try {
      const cleanedText = extractedText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
      extractedProducts = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Could not extract structured product data from PDF');
    }

    if (!Array.isArray(extractedProducts) || extractedProducts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No products found in PDF',
          updated: 0,
          notFound: 0,
          notFoundProducts: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${extractedProducts.length} products from PDF`);

    // Fetch all products for the store once
    const { data: allProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name')
      .eq('store_id', storeId);

    if (fetchError || !allProducts) {
      throw new Error('Failed to fetch products from database');
    }

    // Function to calculate string similarity (0-1)
    const calculateSimilarity = (str1: string, str2: string): number => {
      const s1 = str1.toLowerCase().trim();
      const s2 = str2.toLowerCase().trim();
      
      if (s1 === s2) return 1;
      
      const longer = s1.length > s2.length ? s1 : s2;
      const shorter = s1.length > s2.length ? s2 : s1;
      
      if (longer.length === 0) return 1.0;
      
      // Levenshtein distance
      const costs: number[] = [];
      for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else if (j > 0) {
            let newValue = costs[j - 1];
            if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
        if (i > 0) costs[shorter.length] = lastValue;
      }
      
      const distance = costs[shorter.length];
      return (longer.length - distance) / longer.length;
    };

    let updatedCount = 0;
    const notFoundProducts: string[] = [];

    // Process each extracted product
    for (const product of extractedProducts) {
      if (!product.name) continue;

      const productName = product.name.trim();

      // Find best matching product with 90% similarity
      let bestMatch: { id: string; name: string } | null = null;
      let bestSimilarity = 0;

      for (const dbProduct of allProducts) {
        const similarity = calculateSimilarity(productName, dbProduct.name);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = dbProduct;
        }
      }

      // Only update if similarity is >= 90%
      if (!bestMatch || bestSimilarity < 0.9) {
        console.log(`Product not found or low similarity (${(bestSimilarity * 100).toFixed(1)}%): ${productName}`);
        notFoundProducts.push(productName);
        continue;
      }

      console.log(`Matched "${productName}" to "${bestMatch.name}" (${(bestSimilarity * 100).toFixed(1)}% similarity)`);

      // Build update object with only provided fields
      const updateData: any = {};
      
      if (product.barcode !== undefined && product.barcode !== null && product.barcode !== '') {
        updateData.barcode = String(product.barcode);
      }
      
      if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
        const stock = Number(product.stock_quantity);
        if (!isNaN(stock)) {
          updateData.stock_quantity = stock;
        }
      }
      
      if (product.cost_price !== undefined && product.cost_price !== null) {
        const cost = Number(product.cost_price);
        if (!isNaN(cost)) {
          updateData.cost_price = cost;
        }
      }

      // Only update if we have at least one field to update
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', bestMatch.id);

        if (updateError) {
          console.error(`Failed to update product ${productName}:`, updateError);
          notFoundProducts.push(productName);
        } else {
          updatedCount++;
          console.log(`Updated product: ${productName}`);
        }
      }
    }

    // Log the import
    await supabase.from('import_logs').insert({
      user_id: user.id,
      store_id: storeId,
      import_type: 'pdf_update',
      status: 'completed',
      total_products: extractedProducts.length,
      successful_imports: updatedCount,
      failed_imports: notFoundProducts.length,
    });

    console.log(`Update completed: ${updatedCount} updated, ${notFoundProducts.length} not found`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully updated ${updatedCount} products from PDF`,
        updated: updatedCount,
        notFound: notFoundProducts.length,
        notFoundProducts: notFoundProducts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in update-products-pdf:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        updated: 0,
        notFound: 0,
        notFoundProducts: []
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
