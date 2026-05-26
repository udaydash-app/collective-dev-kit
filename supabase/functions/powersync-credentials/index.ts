import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns PowerSync connection credentials to the client.
// Token + URL are stored as Lovable Cloud secrets so they never ship in the bundle.
Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const endpoint = Deno.env.get("POWERSYNC_URL");
  const token = Deno.env.get("POWERSYNC_DEV_TOKEN");

  if (!endpoint || !token) {
    return new Response(
      JSON.stringify({ error: "POWERSYNC_URL or POWERSYNC_DEV_TOKEN not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ endpoint, token, expiresAt: null }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});