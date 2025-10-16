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
    console.log('Enriching product:', productName, 'with ID:', productId);

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

      // Get better search keywords using AI
      console.log('Generating search keywords for product image...');
      let imageUrl = null;
      
      try {
        // First, use AI to get better search keywords
        const keywordResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: 'You are a product categorization expert. Given a product name, return only 2-3 simple search keywords that would find relevant product photos. Keep it short and generic (e.g., "chocolate bar", "baby cream", "rice bag").'
              },
              {
                role: 'user',
                content: `Product: ${productName}\n\nReturn only the search keywords, nothing else.`
              }
            ],
          }),
        });

        let searchKeywords = productName;
        if (keywordResponse.ok) {
          const keywordData = await keywordResponse.json();
          searchKeywords = keywordData.choices?.[0]?.message?.content?.trim() || productName;
          console.log('Search keywords generated:', searchKeywords);
        }

        // Now search Google Custom Search with better keywords
        const googleSearchApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
        const googleCseId = Deno.env.get('GOOGLE_SEARCH_CSE_ID');
        
        if (!googleSearchApiKey || !googleCseId) {
          console.log('Google Search API not configured, skipping image search');
        } else {
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleSearchApiKey}&cx=${googleCseId}&q=${encodeURIComponent(searchKeywords)}&searchType=image&num=5&imgSize=medium`;
          
          const searchResponse = await fetch(searchUrl);

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const items = searchData.items || [];
            
            if (items.length > 0) {
              // Try to download the first available image
              for (const item of items) {
                try {
                  const imageDownloadResponse = await fetch(item.link, {
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                  });
                  
                  if (imageDownloadResponse.ok) {
                    const imageBlob = await imageDownloadResponse.arrayBuffer();
                    const contentType = imageDownloadResponse.headers.get('content-type') || 'image/jpeg';
                    const extension = contentType.includes('png') ? 'png' : 'jpg';
                    const fileName = `${productId}-${Date.now()}.${extension}`;
                    
                    const { data: uploadData, error: uploadError } = await supabase.storage
                      .from('product-images')
                      .upload(fileName, imageBlob, {
                        contentType,
                        upsert: false
                      });

                    if (!uploadError && uploadData) {
                      const { data: { publicUrl } } = supabase.storage
                        .from('product-images')
                        .getPublicUrl(uploadData.path);
                      
                      imageUrl = publicUrl;
                      console.log('Downloaded and uploaded image from Google:', imageUrl);
                      break; // Successfully got an image, stop trying
                    }
                  }
                } catch (downloadError) {
                  console.log('Failed to download image, trying next:', downloadError);
                  continue; // Try next image
                }
              }
              
              if (!imageUrl) {
                console.log('Could not download any images from Google search results');
              }
            } else {
              console.log('No images found on Google for:', searchKeywords);
            }
          } else {
            const errorText = await searchResponse.text();
            console.log('Google Search API error:', searchResponse.status, errorText);
          }
        }
      } catch (imageError) {
        console.error('Error searching/downloading image:', imageError);
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