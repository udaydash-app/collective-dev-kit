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

  const startTime = Date.now();
  let logStatus = 'success';
  let errorMessage = null;
  let productsImported = 0;

  try {
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify admin role
    const { data: isAdmin, error: roleError } = await supabase
      .rpc('verify_admin_access', { p_user_id: user.id })
      .single();

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { url, storeId } = await req.json();
    console.log('Importing products from:', url);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

IMPORTANT: If price is not found or is 0, set price to 0 (it can be updated later by admin). Extract up to 20 products. Match products to the closest available category.`
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
      price: typeof p.price === 'number' ? p.price : 0, // Default to 0 if price is missing
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

    productsImported = insertedProducts?.length || 0;
    const executionTime = Date.now() - startTime;

    // Log successful import
    await supabase.from('import_logs').insert({
      url,
      store_id: storeId,
      status: logStatus,
      products_imported: productsImported,
      execution_time_ms: executionTime,
    });

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
    logStatus = 'error';
    errorMessage = error instanceof Error ? error.message : "Import failed";
    const executionTime = Date.now() - startTime;

    // Log failed import - need to re-parse body
    try {
      const bodyText = await req.text();
      const { url: errorUrl, storeId: errorStoreId } = JSON.parse(bodyText);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('import_logs').insert({
        url: errorUrl,
        store_id: errorStoreId,
        status: logStatus,
        products_imported: 0,
        error_message: errorMessage,
        execution_time_ms: executionTime,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Import failed",
      details: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
