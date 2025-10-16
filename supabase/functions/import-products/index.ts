import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, storeId } = await req.json();
    console.log('Importing products from:', url);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the website content
    const websiteResponse = await fetch(url);
    const html = await websiteResponse.text();
    
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const textContent = doc?.body?.textContent || '';

    // Get categories for context
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true);

    const categoryList = categories?.map(c => `${c.name} (${c.id})`).join(', ') || '';

    // Use AI to extract product information
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `You are a product data extraction assistant. Extract product information from the provided website content and return it as a JSON array. Available categories: ${categoryList}

Return ONLY a valid JSON array with this exact structure:
[
  {
    "name": "Product Name",
    "description": "Brief description",
    "price": 9.99,
    "unit": "each or lb or kg",
    "category_name": "matching category name from the list",
    "image_url": "product image URL if found"
  }
]

Extract up to 20 products. Be accurate with prices and match products to the closest available category.` 
          },
          { role: "user", content: `Extract products from this content:\n\n${textContent.slice(0, 8000)}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let productsText = aiData.choices[0].message.content;
    
    // Clean up the response to get valid JSON
    productsText = productsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extractedProducts = JSON.parse(productsText);

    console.log('Extracted products:', extractedProducts.length);

    // Match categories and insert products
    const categoryMap = categories?.reduce((acc, cat) => {
      acc[cat.name.toLowerCase()] = cat.id;
      return acc;
    }, {} as Record<string, string>) || {};

    const productsToInsert = extractedProducts.map((p: any) => ({
      name: p.name,
      description: p.description,
      price: p.price,
      unit: p.unit || 'each',
      category_id: categoryMap[p.category_name?.toLowerCase()] || null,
      store_id: storeId,
      image_url: p.image_url,
      is_available: true,
    }));

    const { data: insertedProducts, error } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select();

    if (error) throw error;

    console.log('Inserted products:', insertedProducts?.length);

    return new Response(JSON.stringify({ 
      success: true, 
      count: insertedProducts?.length || 0,
      products: insertedProducts 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Import failed",
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
