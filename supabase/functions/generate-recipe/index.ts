import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { menu_item_name, description, ingredients, servings } = await req.json();
    if (!menu_item_name) {
      return new Response(JSON.stringify({ error: 'menu_item_name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!KEY) throw new Error('LOVABLE_API_KEY not configured');

    const ingList = (ingredients || []).map((i: any) => `- ${i.name} (unit: ${i.unit})`).join('\n');
    const sys = `You are a professional chef. Given a menu item and a list of available ingredients in the restaurant's pantry, return realistic quantities of those ingredients required to prepare ONE serving. Use ONLY ingredients from the provided list. Quantities must be in the unit shown for each ingredient. If an ingredient is clearly not needed, omit it. Be precise and realistic for restaurant portions.`;
    const user = `Menu item: ${menu_item_name}\n${description ? `Description: ${description}\n` : ''}Servings to compute: ${servings || 1}\n\nAvailable ingredients:\n${ingList || '(none)'}\n\nReturn the recipe ingredients.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'set_recipe',
            description: 'Return the recipe ingredients required for one serving.',
            parameters: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ingredient_name: { type: 'string', description: 'Must match an available ingredient name exactly.' },
                      quantity: { type: 'number' },
                    },
                    required: ['ingredient_name', 'quantity'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['items'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'set_recipe' } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      if (resp.status === 429) return new Response(JSON.stringify({ error: 'Rate limit, try again later.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: 'Lovable AI credits exhausted.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      console.error('AI error', resp.status, t);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : { items: [] };
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('generate-recipe error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});