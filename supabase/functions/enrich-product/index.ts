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

  try {
    const { productId, productName } = await req.json();
    console.log('Starting enrichment for product:', productName, 'ID:', productId);

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!supabaseUrl || !supabaseKey || !lovableApiKey) {
      console.error('Missing environment variables');
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate description using Lovable AI with timeout
    console.log('Generating description with AI...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
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
              content: 'You are a product description writer for a grocery e-commerce platform. Write concise, appealing product descriptions (2-3 sentences) that highlight key features and benefits. Focus on quality, freshness, and value.'
            },
            {
              role: 'user',
              content: `Write a product description for: ${productName}`
            }
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI response error:', aiResponse.status, errorText);
        throw new Error(`AI API returned ${aiResponse.status}: ${errorText}`);
      }

      const aiData = await aiResponse.json();
      const description = aiData.choices?.[0]?.message?.content?.trim() || null;
      console.log('Generated description:', description ? 'Success' : 'No description returned');

      // Search for image on Unsplash
      console.log('Searching for product image...');
      let imageUrl = null;
      
      try {
        const imageController = new AbortController();
        const imageTimeoutId = setTimeout(() => imageController.abort(), 5000); // 5 second timeout
        
        const unsplashResponse = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(productName)}&per_page=1&orientation=squarish`,
          {
            headers: {
              'Authorization': 'Client-ID 5K_OOvNKE9Kbb3kaqXHlJgLjKKMIkJKkp1FINRvUflk'
            },
            signal: imageController.signal,
          }
        );

        clearTimeout(imageTimeoutId);

        if (unsplashResponse.ok) {
          const unsplashData = await unsplashResponse.json();
          if (unsplashData.results && unsplashData.results.length > 0) {
            imageUrl = unsplashData.results[0].urls.regular;
            console.log('Found image:', imageUrl);
          } else {
            console.log('No images found on Unsplash for:', productName);
          }
        } else {
          console.log('Unsplash API error:', unsplashResponse.status);
        }
      } catch (imageError) {
        console.error('Error fetching image:', imageError);
        // Continue without image if search fails
      }

      // Update product in database
      const updates: any = {};
      if (description) updates.description = description;
      if (imageUrl) updates.image_url = imageUrl;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('products')
          .update(updates)
          .eq('id', productId);

        if (updateError) {
          console.error('Database update error:', updateError);
          throw updateError;
        }

        console.log('Product updated successfully with:', Object.keys(updates).join(', '));
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          description,
          imageUrl,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );

    } catch (aiError) {
      clearTimeout(timeoutId);
      if (aiError instanceof Error && aiError.name === 'AbortError') {
        console.error('AI request timed out');
        throw new Error('Request timed out');
      }
      throw aiError;
    }

  } catch (error) {
    console.error('Error enriching product:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to enrich product',
        details: error instanceof Error ? error.stack : undefined,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});