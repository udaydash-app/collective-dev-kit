-- Enable RLS on realtime.messages to authorize channel topic subscriptions
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior policy with same name to make migration idempotent
DROP POLICY IF EXISTS "Authorize realtime topic access" ON realtime.messages;

CREATE POLICY "Authorize realtime topic access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    -- Staff-only topics: require admin or cashier role
    WHEN realtime.topic() LIKE 'pos_%'
      OR realtime.topic() LIKE 'pos-%'
      OR realtime.topic() LIKE 'cash_%'
      OR realtime.topic() LIKE 'restaurant_%'
      OR realtime.topic() LIKE 'walkie_%'
      OR realtime.topic() LIKE 'staff_%'
      OR realtime.topic() LIKE 'orders_admin%'
      THEN public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    ELSE true
  END
);

DROP POLICY IF EXISTS "Authorize realtime topic broadcast" ON realtime.messages;

CREATE POLICY "Authorize realtime topic broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'pos_%'
      OR realtime.topic() LIKE 'pos-%'
      OR realtime.topic() LIKE 'cash_%'
      OR realtime.topic() LIKE 'restaurant_%'
      OR realtime.topic() LIKE 'walkie_%'
      OR realtime.topic() LIKE 'staff_%'
      OR realtime.topic() LIKE 'orders_admin%'
      THEN public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'cashier'::public.app_role)
    ELSE true
  END
);
