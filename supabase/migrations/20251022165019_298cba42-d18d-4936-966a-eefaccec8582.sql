
-- Grant INSERT permission to anon role for guest orders
GRANT INSERT ON public.orders TO anon;

-- Also grant INSERT on order_items for the order items insertion
GRANT INSERT ON public.order_items TO anon;

-- Grant SELECT on stores so guest users can fetch store info
GRANT SELECT ON public.stores TO anon;

-- Grant SELECT on products so guests can see product details in their cart
GRANT SELECT ON public.products TO anon;
