import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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

    const { products, storeId } = await req.json();
    console.log('Importing products from Excel:', products.length, 'rows');

    // Get categories for matching
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('is_active', true);

    const categoryMap = categories?.reduce((acc, cat) => {
      acc[cat.name.toLowerCase()] = cat.id;
      return acc;
    }, {} as Record<string, string>) || {};

    // Get suppliers for matching
    const { data: suppliers } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('is_supplier', true);

    const supplierMap = suppliers?.reduce((acc, sup) => {
      acc[sup.name.toLowerCase()] = sup.id;
      return acc;
    }, {} as Record<string, string>) || {};

    // Process each product row
    const productsToInsert = products.map((row: any) => {
      // Handle different possible column names (case-insensitive)
      const getName = () => {
        return row.name || row.Name || row.NAME || 
               row['Product Name'] || row['product name'] || '';
      };
      
      const getDescription = () => {
        return row.description || row.Description || row.DESCRIPTION || 
               row.desc || row.Desc || null;
      };
      
      const getPrice = () => {
        const priceValue = row.price || row.Price || row.PRICE || 
                          row.cost || row.Cost || 0;
        return typeof priceValue === 'number' ? priceValue : parseFloat(priceValue) || 0;
      };
      
      const getUnit = () => {
        return row.unit || row.Unit || row.UNIT || 
               row.measure || row.Measure || 'each';
      };
      
      const getCategory = () => {
        return row.category || row.Category || row.CATEGORY || 
               row.cat || row.Cat || null;
      };
      
      const getSupplier = () => {
        return row.supplier || row.Supplier || row.SUPPLIER || 
               row.vendor || row.Vendor || null;
      };
      
      const getAvailability = () => {
        const availValue = row.availability || row.Availability || row.AVAILABILITY || 
                          row.is_available || row['Is Available'] || row.available || true;
        if (typeof availValue === 'boolean') return availValue;
        if (typeof availValue === 'string') {
          const lower = availValue.toLowerCase();
          return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'available';
        }
        return true;
      };
      
      const getStockQuantity = () => {
        const stockValue = row.stock_quantity || row['Stock Quantity'] || 
                          row.stock || row.Stock || row.quantity || row.Quantity || 0;
        return typeof stockValue === 'number' ? stockValue : parseInt(stockValue) || 0;
      };

      const categoryName = getCategory();
      const categoryId = categoryName ? categoryMap[categoryName.toLowerCase()] : null;
      
      const supplierName = getSupplier();
      const supplierId = supplierName ? supplierMap[supplierName.toLowerCase()] : null;

      return {
        name: getName(),
        description: getDescription(),
        price: getPrice(),
        unit: getUnit(),
        category_id: categoryId,
        supplier_id: supplierId,
        store_id: storeId,
        stock_quantity: getStockQuantity(),
        is_available: getAvailability(),
      };
    }).filter((p: any) => p.name); // Only include rows with a name

    if (productsToInsert.length === 0) {
      throw new Error('No valid products found in Excel file. Please check column names.');
    }

    // Insert products
    const { data: insertedProducts, error } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select();

    if (error) throw error;

    productsImported = insertedProducts?.length || 0;
    const executionTime = Date.now() - startTime;

    // Log successful import
    await supabase.from('import_logs').insert({
      url: 'excel-upload',
      store_id: storeId,
      status: logStatus,
      products_imported: productsImported,
      execution_time_ms: executionTime,
    });

    console.log('Inserted products:', productsImported);

    return new Response(JSON.stringify({ 
      success: true, 
      count: productsImported,
      products: insertedProducts 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Excel import error:', error);
    logStatus = 'error';
    errorMessage = error instanceof Error ? error.message : "Import failed";
    const executionTime = Date.now() - startTime;

    // Log failed import
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('import_logs').insert({
        url: 'excel-upload',
        store_id: null,
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