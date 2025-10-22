-- Let's test if we can insert a guest order directly
-- This will help us understand if the policy is working

-- First, let's make sure there are no restrictive policies blocking us
-- Check for any restrictive policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname, permissive 
        FROM pg_policies 
        WHERE tablename = 'orders' AND cmd = 'INSERT'
    LOOP
        RAISE NOTICE 'Policy: %, Permissive: %', policy_record.policyname, policy_record.permissive;
    END LOOP;
END $$;

-- Now try a test insert as an anonymous user would
-- This simulates what happens in the app
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

-- Attempt to insert a test guest order
INSERT INTO orders (
    order_number, 
    store_id, 
    user_id,
    subtotal, 
    total, 
    delivery_fee, 
    tax, 
    status, 
    payment_status,
    delivery_instructions
) VALUES (
    'TEST-ORDER-1',
    '086e4c9f-c660-41fc-ab94-552393c13be8',
    NULL,
    100,
    100,
    0,
    0,
    'pending',
    'pending',
    'Test guest order'
);

-- Clean up test data
DELETE FROM orders WHERE order_number = 'TEST-ORDER-1';

RESET ROLE;