REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.products FROM anon;
REVOKE SELECT (cost_price, wholesale_price, vip_price) ON public.product_variants FROM anon;