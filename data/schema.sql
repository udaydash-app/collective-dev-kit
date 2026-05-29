--
-- PostgreSQL database dump
--



-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: account_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_type AS ENUM (
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'moderator',
    'user',
    'cashier'
);


--
-- Name: price_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.price_tier AS ENUM (
    'retail',
    'wholesale',
    'vip'
);


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: add_stock_from_purchase(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_stock_from_purchase() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  item record;
BEGIN
  -- Loop through purchase items and add stock
  FOR item IN 
    SELECT product_id, variant_id, quantity
    FROM purchase_items
    WHERE purchase_id = NEW.id
  LOOP
    IF item.variant_id IS NOT NULL THEN
      -- Update variant stock
      UPDATE product_variants
      SET stock_quantity = COALESCE(stock_quantity, 0) + item.quantity
      WHERE id = item.variant_id;
    ELSE
      -- Update product stock
      UPDATE products
      SET stock_quantity = COALESCE(stock_quantity, 0) + item.quantity
      WHERE id = item.product_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;


--
-- Name: calculate_order_total(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_order_total(p_user_id uuid, p_delivery_fee numeric DEFAULT 0, p_tax_rate numeric DEFAULT 0) RETURNS TABLE(subtotal numeric, delivery_fee numeric, tax numeric, total numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_subtotal numeric;
BEGIN
  -- Calculate subtotal from actual product prices in user's cart
  SELECT COALESCE(SUM(p.price * ci.quantity), 0)
  INTO v_subtotal
  FROM cart_items ci
  JOIN products p ON p.id = ci.product_id
  WHERE ci.user_id = p_user_id
    AND p.is_available = true;
  
  -- Return calculated totals
  RETURN QUERY SELECT 
    v_subtotal,
    p_delivery_fee,
    ROUND(v_subtotal * p_tax_rate, 2),
    ROUND(v_subtotal + p_delivery_fee + (v_subtotal * p_tax_rate), 2);
END;
$$;


--
-- Name: create_adjustment_layer(uuid, uuid, numeric, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_adjustment_layer(p_product_id uuid, p_variant_id uuid, p_quantity numeric, p_unit_cost numeric, p_adjustment_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_layer_id uuid;
BEGIN
  -- Create new inventory layer for the adjustment
  INSERT INTO inventory_layers (
    product_id,
    variant_id,
    purchase_id,
    purchase_item_id,
    quantity_purchased,
    quantity_remaining,
    unit_cost,
    purchased_at
  ) VALUES (
    p_product_id,
    p_variant_id,
    NULL,
    NULL,
    p_quantity,
    p_quantity,
    p_unit_cost,
    NOW()
  ) RETURNING id INTO v_layer_id;

  -- Update stock adjustment record with layer reference
  IF p_adjustment_id IS NOT NULL THEN
    UPDATE stock_adjustments
    SET inventory_layer_id = v_layer_id,
        unit_cost = p_unit_cost,
        total_value = p_quantity * p_unit_cost
    WHERE id = p_adjustment_id;
  END IF;

  RETURN v_layer_id;
END;
$$;


--
-- Name: FUNCTION create_adjustment_layer(p_product_id uuid, p_variant_id uuid, p_quantity numeric, p_unit_cost numeric, p_adjustment_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_adjustment_layer(p_product_id uuid, p_variant_id uuid, p_quantity numeric, p_unit_cost numeric, p_adjustment_id uuid) IS 'Creates a new inventory layer for stock increases during adjustments';


--
-- Name: create_cash_register_closing_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_cash_register_closing_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
  v_close_ref TEXT;
BEGIN
  -- Only fire when session is being closed
  IF NEW.status != 'closed' OR OLD.status = 'closed' THEN
    RETURN NEW;
  END IF;

  IF NEW.closing_cash IS NULL OR NEW.closing_cash <= 0 THEN
    RETURN NEW;
  END IF;

  -- Get Cash account (571)
  SELECT id INTO v_cash_account_id
  FROM accounts
  WHERE account_code = '571' AND is_active = true
  LIMIT 1;

  -- Get Cash In Hand account (5711)
  SELECT id INTO v_owner_cash_account_id
  FROM accounts
  WHERE account_code = '5711' AND is_active = true
  LIMIT 1;

  IF v_cash_account_id IS NULL OR v_owner_cash_account_id IS NULL THEN
    RAISE WARNING 'Required accounts (571, 5711) not found for cash register closing';
    RETURN NEW;
  END IF;

  v_close_ref := 'REG-CLOSE-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));

  -- Delete any existing closing entry for this session (idempotent)
  DELETE FROM journal_entries WHERE reference = v_close_ref;

  -- Entry: Physical cash transfer (closing_cash)
  INSERT INTO journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    status,
    posted_at,
    created_by,
    posted_by
  ) VALUES (
    'Cash Register Closing - Session ' || NEW.id,
    DATE(COALESCE(NEW.closed_at, now())),
    v_close_ref,
    NEW.closing_cash,
    NEW.closing_cash,
    'posted',
    COALESCE(NEW.closed_at, now()),
    NEW.cashier_id,
    NEW.cashier_id
  ) RETURNING id INTO v_journal_entry_id;

  -- Debit: Cash In Hand (5711)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Cash collected from register', NEW.closing_cash, 0);

  -- Credit: Cash (571)
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_cash_account_id, 'Register closing cash', 0, NEW.closing_cash);

  RETURN NEW;
END;
$$;


--
-- Name: create_cash_register_opening_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_cash_register_opening_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cash_account_id UUID;
  v_owner_cash_account_id UUID;
  v_journal_entry_id UUID;
  v_ref TEXT;
  v_auth_user_id UUID;
BEGIN
  IF NEW.opening_cash IS NULL OR NEW.opening_cash <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_owner_cash_account_id FROM accounts WHERE account_code = '5711' AND is_active = true LIMIT 1;

  IF v_cash_account_id IS NULL OR v_owner_cash_account_id IS NULL THEN
    RAISE WARNING 'Required accounts (571, 5711) not found for cash register opening';
    RETURN NEW;
  END IF;

  v_ref := 'REG-OPEN-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 8));
  v_auth_user_id := public.resolve_auth_user_id(NEW.cashier_id);

  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, posted_at, created_by, posted_by)
  VALUES ('Cash Register Opening - Session ' || NEW.id, DATE(NEW.opened_at), v_ref, NEW.opening_cash, NEW.opening_cash, 'posted', NEW.opened_at, v_auth_user_id, v_auth_user_id)
  RETURNING id INTO v_journal_entry_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_cash_account_id, 'Cash placed in register', NEW.opening_cash, 0);

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_owner_cash_account_id, 'Owner cash to register', 0, NEW.opening_cash);

  RETURN NEW;
END;
$$;


--
-- Name: create_contact_ledger_accounts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_contact_ledger_accounts() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ar_parent_id UUID;
  v_ap_parent_id UUID;
  v_equity_account_id UUID;
  v_customer_account_id UUID;
  v_supplier_account_id UUID;
  v_journal_entry_id UUID;
  v_customer_code TEXT;
  v_supplier_code TEXT;
  v_existing_customer_account UUID;
  v_existing_supplier_account UUID;
BEGIN
  -- Get parent accounts using SYSCOHADA codes
  SELECT id INTO v_ar_parent_id FROM accounts WHERE account_code = '411' LIMIT 1;
  SELECT id INTO v_ap_parent_id FROM accounts WHERE account_code = '401' LIMIT 1;
  SELECT id INTO v_equity_account_id FROM accounts WHERE account_code = '101' LIMIT 1;

  -- Handle UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Check if is_customer flag changed from false to true (or if customer_ledger_account_id is still null)
    IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NULL THEN
      -- Check if account already exists
      SELECT id INTO v_existing_customer_account
      FROM accounts
      WHERE parent_account_id = v_ar_parent_id
        AND account_name = NEW.name || ' (Customer)'
      LIMIT 1;

      IF v_existing_customer_account IS NOT NULL THEN
        NEW.customer_ledger_account_id = v_existing_customer_account;
      ELSE
        -- Get next customer account code using SYSCOHADA 411X format
        SELECT get_next_customer_account_code() INTO v_customer_code;
        
        INSERT INTO accounts (
          account_code, account_name, account_type, parent_account_id,
          description, is_active
        ) VALUES (
          v_customer_code, NEW.name || ' (Customer)', 'asset', v_ar_parent_id,
          'Customer ledger for ' || NEW.name, true
        ) RETURNING id INTO v_customer_account_id;
        
        NEW.customer_ledger_account_id = v_customer_account_id;
      END IF;
    END IF;

    -- Check if is_supplier flag changed from false to true (or if supplier_ledger_account_id is still null)
    IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NULL THEN
      -- Check if account already exists
      SELECT id INTO v_existing_supplier_account
      FROM accounts
      WHERE parent_account_id = v_ap_parent_id
        AND account_name = NEW.name || ' (Supplier)'
      LIMIT 1;

      IF v_existing_supplier_account IS NOT NULL THEN
        NEW.supplier_ledger_account_id = v_existing_supplier_account;
      ELSE
        -- Get next supplier account code using SYSCOHADA 401X format
        SELECT get_next_supplier_account_code() INTO v_supplier_code;
        
        INSERT INTO accounts (
          account_code, account_name, account_type, parent_account_id,
          description, is_active
        ) VALUES (
          v_supplier_code, NEW.name || ' (Supplier)', 'liability', v_ap_parent_id,
          'Supplier ledger for ' || NEW.name, true
        ) RETURNING id INTO v_supplier_account_id;
        
        NEW.supplier_ledger_account_id = v_supplier_account_id;
      END IF;
    END IF;

    -- Handle opening balance changes (existing logic)
    IF OLD.opening_balance IS DISTINCT FROM NEW.opening_balance THEN
      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance > 0 THEN
        -- Delete old opening balance entries
        DELETE FROM journal_entries 
        WHERE (reference LIKE 'OB-CUST-%' OR reference LIKE 'OB-SUPP-%')
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND (account_id = NEW.customer_ledger_account_id OR account_id = NEW.supplier_ledger_account_id)
          );

        -- Create customer receivable entry only
        IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NOT NULL THEN
          INSERT INTO journal_entries (
            description, entry_date, reference, total_debit, total_credit,
            status, created_by, posted_by, posted_at
          ) VALUES (
            'Opening Balance - ' || NEW.name, CURRENT_DATE,
            'OB-CUST-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
            NEW.opening_balance, NEW.opening_balance,
            'posted', auth.uid(), auth.uid(), NOW()
          ) RETURNING id INTO v_journal_entry_id;

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, NEW.customer_ledger_account_id, 'Opening balance receivable', NEW.opening_balance, 0);

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - customer receivable', 0, NEW.opening_balance);
        END IF;

      ELSIF NEW.opening_balance IS NOT NULL AND NEW.opening_balance < 0 THEN
        -- Delete old opening balance entries
        DELETE FROM journal_entries 
        WHERE (reference LIKE 'OB-CUST-%' OR reference LIKE 'OB-SUPP-%')
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND (account_id = NEW.customer_ledger_account_id OR account_id = NEW.supplier_ledger_account_id)
          );

        -- Create supplier payable entry only
        IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NOT NULL THEN
          INSERT INTO journal_entries (
            description, entry_date, reference, total_debit, total_credit,
            status, created_by, posted_by, posted_at
          ) VALUES (
            'Opening Balance - ' || NEW.name, CURRENT_DATE,
            'OB-SUPP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
            ABS(NEW.opening_balance), ABS(NEW.opening_balance),
            'posted', auth.uid(), auth.uid(), NOW()
          ) RETURNING id INTO v_journal_entry_id;

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - supplier payable', ABS(NEW.opening_balance), 0);

          INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
          VALUES (v_journal_entry_id, NEW.supplier_ledger_account_id, 'Opening balance payable', 0, ABS(NEW.opening_balance));
        END IF;

      ELSE
        -- Zero or null opening balance: delete all opening balance entries
        DELETE FROM journal_entries 
        WHERE (reference LIKE 'OB-CUST-%' OR reference LIKE 'OB-SUPP-%')
          AND (description = 'Opening Balance - ' || OLD.name OR description = 'Opening Balance - ' || NEW.name)
          AND EXISTS (
            SELECT 1 FROM journal_entry_lines 
            WHERE journal_entry_id = journal_entries.id 
              AND (account_id = NEW.customer_ledger_account_id OR account_id = NEW.supplier_ledger_account_id)
          );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Handle INSERT operations
  IF NEW.is_customer = true AND NEW.customer_ledger_account_id IS NULL THEN
    SELECT id INTO v_existing_customer_account
    FROM accounts
    WHERE parent_account_id = v_ar_parent_id
      AND account_name = NEW.name || ' (Customer)'
    LIMIT 1;

    IF v_existing_customer_account IS NOT NULL THEN
      NEW.customer_ledger_account_id = v_existing_customer_account;
    ELSE
      SELECT get_next_customer_account_code() INTO v_customer_code;
      
      INSERT INTO accounts (
        account_code, account_name, account_type, parent_account_id,
        description, is_active
      ) VALUES (
        v_customer_code, NEW.name || ' (Customer)', 'asset', v_ar_parent_id,
        'Customer ledger for ' || NEW.name, true
      ) RETURNING id INTO v_customer_account_id;
      
      NEW.customer_ledger_account_id = v_customer_account_id;

      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance > 0 THEN
        INSERT INTO journal_entries (
          description, entry_date, reference, total_debit, total_credit,
          status, created_by, posted_by, posted_at
        ) VALUES (
          'Opening Balance - ' || NEW.name, CURRENT_DATE,
          'OB-CUST-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
          NEW.opening_balance, NEW.opening_balance,
          'posted', auth.uid(), auth.uid(), NOW()
        ) RETURNING id INTO v_journal_entry_id;

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_customer_account_id, 'Opening balance receivable', NEW.opening_balance, 0);

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - customer receivable', 0, NEW.opening_balance);
      END IF;
    END IF;
  END IF;

  IF NEW.is_supplier = true AND NEW.supplier_ledger_account_id IS NULL THEN
    SELECT id INTO v_existing_supplier_account
    FROM accounts
    WHERE parent_account_id = v_ap_parent_id
      AND account_name = NEW.name || ' (Supplier)'
    LIMIT 1;

    IF v_existing_supplier_account IS NOT NULL THEN
      NEW.supplier_ledger_account_id = v_existing_supplier_account;
    ELSE
      SELECT get_next_supplier_account_code() INTO v_supplier_code;
      
      INSERT INTO accounts (
        account_code, account_name, account_type, parent_account_id,
        description, is_active
      ) VALUES (
        v_supplier_code, NEW.name || ' (Supplier)', 'liability', v_ap_parent_id,
        'Supplier ledger for ' || NEW.name, true
      ) RETURNING id INTO v_supplier_account_id;
      
      NEW.supplier_ledger_account_id = v_supplier_account_id;

      IF NEW.opening_balance IS NOT NULL AND NEW.opening_balance < 0 THEN
        INSERT INTO journal_entries (
          description, entry_date, reference, total_debit, total_credit,
          status, created_by, posted_by, posted_at
        ) VALUES (
          'Opening Balance - ' || NEW.name, CURRENT_DATE,
          'OB-SUPP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 8)),
          ABS(NEW.opening_balance), ABS(NEW.opening_balance),
          'posted', auth.uid(), auth.uid(), NOW()
        ) RETURNING id INTO v_journal_entry_id;

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_equity_account_id, 'Opening balance - supplier payable', ABS(NEW.opening_balance), 0);

        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_supplier_account_id, 'Opening balance payable', 0, ABS(NEW.opening_balance));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: create_expense_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_expense_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_journal_entry_id UUID;
  v_expense_account_id UUID;
  v_payment_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
BEGIN
  -- Handle DELETE - remove the associated journal entry
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.journal_entries
    WHERE reference = 'EXP-' || OLD.id::text;
    RETURN OLD;
  END IF;

  -- Handle UPDATE - delete old journal entry first
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.journal_entries
    WHERE reference = 'EXP-' || OLD.id::text;
  END IF;

  -- Use the ledger account selected on the expense when provided.
  IF NEW.account_id IS NOT NULL THEN
    SELECT id INTO v_expense_account_id
    FROM public.accounts
    WHERE id = NEW.account_id
      AND is_active = true
    LIMIT 1;
  END IF;

  -- Otherwise determine expense account based on category.
  IF v_expense_account_id IS NULL THEN
    SELECT id INTO v_expense_account_id
    FROM public.accounts
    WHERE account_type = 'expense'
      AND is_active = true
      AND (
        account_name ILIKE '%' || NEW.category || '%'
        OR account_code LIKE '6%'
      )
    ORDER BY
      CASE WHEN account_name ILIKE '%' || NEW.category || '%' THEN 0 ELSE 1 END,
      account_code
    LIMIT 1;
  END IF;

  -- Fallback to any expense account if none found.
  IF v_expense_account_id IS NULL THEN
    SELECT id INTO v_expense_account_id
    FROM public.accounts
    WHERE account_type = 'expense'
      AND is_active = true
    ORDER BY account_code
    LIMIT 1;
  END IF;

  IF v_expense_account_id IS NULL THEN
    RAISE WARNING 'No expense account found, skipping journal entry for expense %', NEW.id;
    RETURN NEW;
  END IF;

  -- Get payment account IDs using SYSCOHADA codes.
  SELECT id INTO v_cash_account_id FROM public.accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM public.accounts WHERE account_code = '521' AND is_active = true LIMIT 1;

  CASE NEW.payment_method
    WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
    WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'card' THEN v_payment_account_id := v_mobile_money_account_id;
    WHEN 'credit' THEN v_payment_account_id := v_mobile_money_account_id;
    ELSE v_payment_account_id := v_cash_account_id;
  END CASE;

  IF v_payment_account_id IS NULL THEN
    RAISE WARNING 'No payment account found for method %, skipping journal entry', NEW.payment_method;
    RETURN NEW;
  END IF;

  INSERT INTO public.journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    transaction_amount,
    status,
    created_by,
    posted_by,
    posted_at
  ) VALUES (
    'Dépense - ' || NEW.category || ': ' || NEW.description,
    NEW.expense_date::date,
    'EXP-' || NEW.id::text,
    NEW.amount,
    NEW.amount,
    NEW.amount,
    'posted',
    NEW.created_by,
    NEW.created_by,
    NOW()
  ) RETURNING id INTO v_journal_entry_id;

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_expense_account_id, NEW.category || ' - ' || NEW.description, NEW.amount, 0);

  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (
    v_journal_entry_id,
    v_payment_account_id,
    CASE NEW.payment_method
      WHEN 'cash' THEN 'Paiement espèces'
      WHEN 'mobile_money' THEN 'Paiement Mobile Money'
      WHEN 'card' THEN 'Paiement carte'
      WHEN 'credit' THEN 'Paiement crédit'
      ELSE 'Paiement - ' || NEW.payment_method
    END,
    0,
    NEW.amount
  );

  RETURN NEW;
END;
$$;


--
-- Name: create_payment_receipt_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_payment_receipt_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_je_id uuid;
  v_customer_account_id uuid;
  v_payment_account_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.receipt_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE journal_entries SET entry_date = NEW.payment_date, description = 'Payment Receipt - ' || NEW.receipt_number, total_debit = NEW.amount, total_credit = NEW.amount, updated_at = now()
    WHERE reference = OLD.receipt_number RETURNING id INTO v_je_id;

    IF v_je_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_account_id FROM contacts WHERE id = NEW.contact_id;
      
      -- Use account codes instead of names
      SELECT id INTO v_payment_account_id FROM accounts 
      WHERE account_code = CASE NEW.payment_method 
        WHEN 'cash' THEN '571' 
        WHEN 'card' THEN '521' 
        WHEN 'mobile_money' THEN '521' 
        ELSE '571' 
      END 
      LIMIT 1;

      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Payment method: ' || NEW.payment_method);
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Customer payment');
    END IF;
    RETURN NEW;
  END IF;

  SELECT customer_ledger_account_id INTO v_customer_account_id FROM contacts WHERE id = NEW.contact_id;
  IF v_customer_account_id IS NULL THEN RAISE EXCEPTION 'Customer ledger account not found for contact %', NEW.contact_id; END IF;

  -- Use account codes instead of names
  SELECT id INTO v_payment_account_id FROM accounts 
  WHERE account_code = CASE NEW.payment_method 
    WHEN 'cash' THEN '571' 
    WHEN 'card' THEN '521' 
    WHEN 'mobile_money' THEN '521' 
    ELSE '571' 
  END 
  LIMIT 1;

  IF v_payment_account_id IS NULL THEN RAISE EXCEPTION 'Payment account not found for method %', NEW.payment_method; END IF;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (NEW.payment_date, 'Payment Receipt - ' || NEW.receipt_number, NEW.receipt_number, NEW.amount, NEW.amount, 'posted', now(), NEW.received_by, NEW.received_by)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, NEW.amount, 0, 'Payment method: ' || NEW.payment_method);
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_customer_account_id, 0, NEW.amount, 'Customer payment');

  RETURN NEW;
END;
$$;


--
-- Name: create_purchase_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_purchase_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_inventory_account_id UUID;
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_payable_account_id UUID;
  v_supplier_ledger_id UUID;
  v_customs_account_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_total_local_charges NUMERIC := 0;
  v_cif_amount NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Always re-create journal entry on update to capture item changes (local charges etc.)
    DELETE FROM journal_entries WHERE reference = OLD.purchase_number AND description LIKE 'Achat - %';
  END IF;

  -- Get account IDs
  SELECT id INTO v_inventory_account_id FROM accounts WHERE account_code = '31' LIMIT 1;
  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
  SELECT id INTO v_payable_account_id FROM accounts WHERE account_code = '401' LIMIT 1;
  SELECT id INTO v_customs_account_id FROM accounts WHERE account_code = '6584' LIMIT 1;

  SELECT supplier_ledger_account_id INTO v_supplier_ledger_id 
  FROM contacts WHERE name = NEW.supplier_name AND is_supplier = true LIMIT 1;

  -- Calculate total local charges from purchase items
  SELECT COALESCE(SUM(COALESCE(local_charges, 0) * quantity), 0)
  INTO v_total_local_charges
  FROM purchase_items WHERE purchase_id = NEW.id;

  v_cif_amount := NEW.total_amount - v_total_local_charges;

  -- Create journal entry
  INSERT INTO journal_entries (description, entry_date, reference, total_debit, total_credit, status, created_by, posted_by, posted_at)
  VALUES ('Achat - ' || NEW.purchase_number, CURRENT_DATE, NEW.purchase_number, NEW.total_amount, NEW.total_amount, 'posted', NEW.purchased_by, NEW.purchased_by, NOW())
  RETURNING id INTO v_journal_entry_id;

  -- Debit Inventory for full amount
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
  VALUES (v_journal_entry_id, v_inventory_account_id, 'Achat marchandises - ' || NEW.supplier_name, NEW.total_amount, 0);

  -- Credit Customs Clearance for local charges (if any)
  IF v_total_local_charges > 0 AND v_customs_account_id IS NOT NULL THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_customs_account_id, 'Customs/Local charges - ' || NEW.purchase_number, 0, v_total_local_charges);
  END IF;

  -- Credit supplier/payment for CIF amount
  IF TG_OP = 'INSERT' AND NEW.payment_status = 'paid' THEN
    IF NEW.payment_method IN ('mobile_money', 'card', 'bank_transfer') THEN
      v_payment_account_id := COALESCE(v_mobile_money_account_id, v_payable_account_id);
    ELSE
      v_payment_account_id := COALESCE(v_cash_account_id, v_payable_account_id);
    END IF;

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_payment_account_id, 'Paiement - ' || NEW.payment_method, 0, v_cif_amount);
  ELSE
    v_payment_account_id := COALESCE(v_supplier_ledger_id, v_payable_account_id);

    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
    VALUES (v_journal_entry_id, v_payment_account_id, 'Fournisseur - ' || NEW.supplier_name, 0, v_cif_amount);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: create_supplier_payment_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_supplier_payment_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_je_id uuid;
  v_supplier_account_id uuid;
  v_payment_account_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.payment_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE journal_entries SET entry_date = NEW.payment_date, description = 'Supplier Payment - ' || NEW.payment_number, total_debit = NEW.amount, total_credit = NEW.amount, updated_at = now()
    WHERE reference = OLD.payment_number RETURNING id INTO v_je_id;

    IF v_je_id IS NOT NULL THEN
      SELECT supplier_ledger_account_id INTO v_supplier_account_id FROM contacts WHERE id = NEW.contact_id;
      
      -- Use account codes instead of names
      SELECT id INTO v_payment_account_id FROM accounts 
      WHERE account_code = CASE NEW.payment_method 
        WHEN 'cash' THEN '571' 
        WHEN 'card' THEN '521' 
        WHEN 'mobile_money' THEN '521' 
        ELSE '571' 
      END 
      LIMIT 1;

      DELETE FROM journal_entry_lines WHERE journal_entry_id = v_je_id;
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Supplier payment');
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Payment method: ' || NEW.payment_method);
    END IF;
    RETURN NEW;
  END IF;

  SELECT supplier_ledger_account_id INTO v_supplier_account_id FROM contacts WHERE id = NEW.contact_id;
  IF v_supplier_account_id IS NULL THEN RAISE EXCEPTION 'Supplier ledger account not found for contact %', NEW.contact_id; END IF;

  -- Use account codes instead of names
  SELECT id INTO v_payment_account_id FROM accounts 
  WHERE account_code = CASE NEW.payment_method 
    WHEN 'cash' THEN '571' 
    WHEN 'card' THEN '521' 
    WHEN 'mobile_money' THEN '521' 
    ELSE '571' 
  END 
  LIMIT 1;

  IF v_payment_account_id IS NULL THEN RAISE EXCEPTION 'Payment account not found for method %', NEW.payment_method; END IF;

  INSERT INTO journal_entries (entry_date, description, reference, total_debit, total_credit, status, posted_at, posted_by, created_by)
  VALUES (NEW.payment_date, 'Supplier Payment - ' || NEW.payment_number, NEW.payment_number, NEW.amount, NEW.amount, 'posted', now(), NEW.paid_by, NEW.paid_by)
  RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_supplier_account_id, NEW.amount, 0, 'Supplier payment');
  INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description) VALUES (v_je_id, v_payment_account_id, 0, NEW.amount, 'Payment method: ' || NEW.payment_method);

  RETURN NEW;
END;
$$;


--
-- Name: crypt_pin(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.crypt_pin(input_pin text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN extensions.crypt(input_pin, extensions.gen_salt('bf'));
END;
$$;


--
-- Name: decrement_product_stock(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_product_stock(p_product_id uuid, p_quantity integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = GREATEST(0, stock_quantity - p_quantity),
    updated_at = now()
  WHERE id = p_product_id;
END;
$$;


--
-- Name: decrement_variant_stock(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_variant_stock(p_variant_id uuid, p_quantity integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE product_variants
  SET 
    stock_quantity = GREATEST(0, stock_quantity - p_quantity),
    updated_at = now()
  WHERE id = p_variant_id;
END;
$$;


--
-- Name: deduct_stock_fifo(uuid, uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_stock_fifo(p_product_id uuid, p_variant_id uuid, p_quantity numeric) RETURNS TABLE(layer_id uuid, quantity_used numeric, unit_cost numeric, total_cogs numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_remaining_qty NUMERIC := p_quantity;
  v_layer RECORD;
  v_qty_to_deduct NUMERIC;
  v_layer_id UUID;
  v_quantity_used NUMERIC;
  v_unit_cost NUMERIC;
  v_total_cogs NUMERIC;
BEGIN
  -- Get layers in FIFO order (oldest first)
  FOR v_layer IN 
    SELECT il.id, il.quantity_remaining, il.unit_cost
    FROM inventory_layers il
    WHERE il.product_id = p_product_id
      AND (p_variant_id IS NULL AND il.variant_id IS NULL OR il.variant_id = p_variant_id)
      AND il.quantity_remaining > 0
    ORDER BY il.purchased_at ASC, il.created_at ASC
    FOR UPDATE
  LOOP
    -- Calculate how much to deduct from this layer
    v_qty_to_deduct := LEAST(v_layer.quantity_remaining, v_remaining_qty);
    
    -- Assign to local variables first
    v_layer_id := v_layer.id;
    v_quantity_used := v_qty_to_deduct;
    v_unit_cost := v_layer.unit_cost;
    v_total_cogs := v_qty_to_deduct * v_layer.unit_cost;
    
    -- Return this layer's COGS contribution
    layer_id := v_layer_id;
    quantity_used := v_quantity_used;
    unit_cost := v_unit_cost;
    total_cogs := v_total_cogs;
    RETURN NEXT;
    
    -- Update the layer
    UPDATE inventory_layers
    SET quantity_remaining = quantity_remaining - v_qty_to_deduct,
        updated_at = NOW()
    WHERE id = v_layer.id;
    
    -- Reduce remaining quantity needed
    v_remaining_qty := v_remaining_qty - v_qty_to_deduct;
    
    -- Exit if we've deducted enough
    EXIT WHEN v_remaining_qty <= 0;
  END LOOP;
  
  -- Check if we couldn't deduct the full quantity
  IF v_remaining_qty > 0 THEN
    RAISE EXCEPTION 'Insufficient inventory layers for product %. Short by % units.', 
      p_product_id, v_remaining_qty;
  END IF;
  
  RETURN;
END;
$$;


--
-- Name: deduct_stock_on_order_delivered(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_stock_on_order_delivered() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only fire when status changes TO 'delivered'
  IF (TG_OP = 'UPDATE' AND NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered')) THEN
    -- Deduct stock for each order item
    FOR item IN
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE products
      SET stock_quantity = stock_quantity - item.quantity,
          updated_at = now()
      WHERE id = item.product_id;
    END LOOP;
  END IF;

  -- Restore stock if status changes FROM 'delivered' to something else (e.g. cancelled)
  IF (TG_OP = 'UPDATE' AND OLD.status = 'delivered' AND NEW.status IS DISTINCT FROM 'delivered') THEN
    FOR item IN
      SELECT oi.product_id, oi.quantity
      FROM order_items oi
      WHERE oi.order_id = NEW.id
    LOOP
      UPDATE products
      SET stock_quantity = stock_quantity + item.quantity,
          updated_at = now()
      WHERE id = item.product_id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: deduct_stock_on_purchase_item_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_stock_on_purchase_item_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Deduct stock when purchase item is deleted
  IF OLD.variant_id IS NOT NULL THEN
    -- Deduct from variant stock
    UPDATE product_variants
    SET stock_quantity = COALESCE(stock_quantity, 0) - OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.variant_id;
  ELSE
    -- Deduct from product stock
    UPDATE products
    SET stock_quantity = COALESCE(stock_quantity, 0) - OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;
  END IF;

  -- Delete associated inventory layer
  DELETE FROM inventory_layers
  WHERE purchase_item_id = OLD.id;

  RETURN OLD;
END;
$$;


--
-- Name: deduct_stock_simple(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_stock_simple() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.gm_apply_stock_for_pos_items(NEW.items, -1);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.gm_apply_stock_for_pos_items(OLD.items, 1);
    PERFORM public.gm_apply_stock_for_pos_items(NEW.items, -1);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: delete_order_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_order_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM journal_entries WHERE reference = OLD.order_number;
  RETURN OLD;
END;
$$;


--
-- Name: delete_pos_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_pos_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
  RETURN OLD;
END;
$$;


--
-- Name: find_similar_products(uuid, text, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_similar_products(p_store_id uuid, p_search_name text, p_similarity_threshold double precision DEFAULT 0.3) RETURNS TABLE(id uuid, name text, similarity double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    similarity(p.name, p_search_name) as similarity
  FROM products p
  WHERE p.store_id = p_store_id
    AND similarity(p.name, p_search_name) >= p_similarity_threshold
  ORDER BY similarity(p.name, p_search_name) DESC
  LIMIT 1;
END;
$$;


--
-- Name: generate_order_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_order_number() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN 'ORD-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10));
END;
$$;


--
-- Name: generate_quotation_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_quotation_number() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN 'QT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    customer_name text,
    customer_email text,
    status text DEFAULT 'open'::text,
    last_message_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    customer_phone text,
    guest_session_token uuid,
    CONSTRAINT chat_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);

ALTER TABLE ONLY public.chat_conversations REPLICA IDENTITY FULL;


--
-- Name: get_guest_conversation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_guest_conversation(p_conversation_id uuid, p_session_token uuid) RETURNS SETOF public.chat_conversations
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT *
  FROM public.chat_conversations
  WHERE id = p_conversation_id
    AND user_id IS NULL
    AND guest_session_token = p_session_token
  LIMIT 1;
$$;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_type text NOT NULL,
    sender_id uuid,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['customer'::text, 'admin'::text])))
);

ALTER TABLE ONLY public.chat_messages REPLICA IDENTITY FULL;


--
-- Name: get_guest_messages(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_guest_messages(p_conversation_id uuid, p_session_token uuid) RETURNS SETOF public.chat_messages
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT m.*
  FROM public.chat_messages m
  JOIN public.chat_conversations c ON c.id = m.conversation_id
  WHERE m.conversation_id = p_conversation_id
    AND c.user_id IS NULL
    AND c.guest_session_token = p_session_token
  ORDER BY m.created_at ASC;
$$;


--
-- Name: get_modern_dashboard_data(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_modern_dashboard_data(input_pos_user_id uuid, input_pin text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  verified_name text;
  since_ts timestamptz := date_trunc('day', now() - interval '13 days');
  result jsonb;
BEGIN
  SELECT pu.full_name
  INTO verified_name
  FROM public.pos_users pu
  WHERE pu.id = input_pos_user_id
    AND pu.pin_hash = crypt(input_pin, pu.pin_hash)
    AND pu.is_active = true;

  IF verified_name IS NULL THEN
    RAISE EXCEPTION 'Invalid POS session';
  END IF;

  IF lower(trim(verified_name)) <> 'admin' THEN
    RAISE EXCEPTION 'Admin PIN required';
  END IF;

  SELECT jsonb_build_object(
    'pos_transactions', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT id, transaction_number, total, subtotal, discount, tax, payment_method, created_at, items, cashier_id
        FROM public.pos_transactions
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 500
      ) t
    ), '[]'::jsonb),
    'orders', COALESCE((
      SELECT jsonb_agg(to_jsonb(o) ORDER BY o.created_at DESC)
      FROM (
        SELECT id, order_number, total, status, payment_status, created_at
        FROM public.orders
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 200
      ) o
    ), '[]'::jsonb),
    'purchases', COALESCE((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC)
      FROM (
        SELECT id, purchase_number, supplier_name, total_amount, created_at
        FROM public.purchases
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 50
      ) p
    ), '[]'::jsonb),
    'expenses', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC)
      FROM (
        SELECT id, description, category, amount, expense_date, created_at
        FROM public.expenses
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 50
      ) e
    ), '[]'::jsonb),
    'journal_entries', COALESCE((
      SELECT jsonb_agg(to_jsonb(j) ORDER BY j.created_at DESC)
      FROM (
        SELECT id, entry_number, reference, description, entry_date, status, created_at
        FROM public.journal_entries
        WHERE created_at >= since_ts
        ORDER BY created_at DESC
        LIMIT 50
      ) j
    ), '[]'::jsonb),
    'accounts', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.account_code ASC)
      FROM (
        SELECT id, account_code, account_name, account_type, current_balance
        FROM public.accounts
        WHERE is_active = true
        ORDER BY account_code ASC
        LIMIT 500
      ) a
    ), '[]'::jsonb),
    'pos_users', COALESCE((
      SELECT jsonb_agg(to_jsonb(u) ORDER BY u.full_name ASC)
      FROM (
        SELECT id, full_name, is_active
        FROM public.pos_users
      ) u
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'products', (SELECT count(*) FROM public.products),
      'contacts', (SELECT count(*) FROM public.contacts),
      'lowStock', (SELECT count(*) FROM public.products WHERE stock_quantity <= 5)
    )
  ) INTO result;

  RETURN result;
END;
$$;


--
-- Name: get_next_customer_account_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_customer_account_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(account_code FROM 4)::INTEGER), 0) INTO max_num
  FROM accounts
  WHERE account_code ~ '^411[0-9]+$';
  
  RETURN '411' || (max_num + 1);
END;
$_$;


--
-- Name: get_next_supplier_account_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_supplier_account_code() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  max_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(account_code FROM 4)::INTEGER), 0) INTO max_num
  FROM accounts
  WHERE account_code ~ '^401[0-9]+$';
  
  RETURN '401' || (max_num + 1);
END;
$_$;


--
-- Name: purchase_order_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    item_id uuid NOT NULL,
    cartons integer DEFAULT 0,
    bags integer DEFAULT 0,
    pieces integer DEFAULT 0,
    weight numeric DEFAULT 0,
    weight_unit text DEFAULT 'kg'::text,
    price numeric NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    notes text,
    submitted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_order_responses_weight_unit_check CHECK ((weight_unit = ANY (ARRAY['kg'::text, 'lb'::text, 'g'::text, 'ton'::text])))
);


--
-- Name: get_po_responses_by_share_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_po_responses_by_share_token(_token text) RETURNS SETOF public.purchase_order_responses
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.*
  FROM public.purchase_order_responses r
  JOIN public.purchase_orders po ON po.id = r.purchase_order_id
  WHERE po.share_token = _token;
END;
$$;


--
-- Name: get_purchase_order_by_share_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_purchase_order_by_share_token(_token text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  result jsonb;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'order', to_jsonb(po.*),
    'items', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(poi.*)
        || jsonb_build_object(
          'products', to_jsonb(p.*),
          'product_variants', to_jsonb(pv.*)
        )
      )
      FROM public.purchase_order_items poi
      LEFT JOIN public.products p ON p.id = poi.product_id
      LEFT JOIN public.product_variants pv ON pv.id = poi.variant_id
      WHERE poi.purchase_order_id = po.id
    ), '[]'::jsonb)
  )
  INTO result
  FROM public.purchase_orders po
  WHERE po.share_token = _token;

  RETURN result;
END;
$$;


--
-- Name: get_suggested_adjustment_cost(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_suggested_adjustment_cost(p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid) RETURNS TABLE(last_purchase_cost numeric, weighted_avg_cost numeric, next_fifo_cost numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Last purchase cost
    (SELECT unit_cost 
     FROM inventory_layers 
     WHERE product_id = p_product_id 
       AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
     ORDER BY purchased_at DESC 
     LIMIT 1),
    
    -- Weighted average cost
    (SELECT COALESCE(
       SUM(quantity_remaining * unit_cost) / NULLIF(SUM(quantity_remaining), 0),
       0
     )
     FROM inventory_layers
     WHERE product_id = p_product_id
       AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
       AND quantity_remaining > 0),
    
    -- Next FIFO cost (oldest layer)
    (SELECT unit_cost
     FROM inventory_layers
     WHERE product_id = p_product_id
       AND (p_variant_id IS NULL AND variant_id IS NULL OR variant_id = p_variant_id)
       AND quantity_remaining > 0
     ORDER BY purchased_at ASC, created_at ASC
     LIMIT 1);
END;
$$;


--
-- Name: FUNCTION get_suggested_adjustment_cost(p_product_id uuid, p_variant_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_suggested_adjustment_cost(p_product_id uuid, p_variant_id uuid) IS 'Returns suggested costs (last purchase, weighted average, next FIFO) for adjustment';


--
-- Name: get_top_credit_customers(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_credit_customers(limit_count integer DEFAULT 10) RETURNS TABLE(id uuid, name text, phone text, email text, balance numeric, customer_balance numeric, supplier_balance numeric, customer_ledger_account_id uuid, supplier_ledger_account_id uuid, is_customer boolean, is_supplier boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    CASE 
      WHEN c.supplier_ledger_account_id IS NOT NULL THEN 
        COALESCE(ca.current_balance, 0) - COALESCE(sa.current_balance, 0)
      ELSE 
        COALESCE(ca.current_balance, 0)
    END as balance,
    COALESCE(ca.current_balance, 0) as customer_balance,
    COALESCE(sa.current_balance, 0) as supplier_balance,
    c.customer_ledger_account_id,
    c.supplier_ledger_account_id,
    c.is_customer,
    c.is_supplier
  FROM contacts c
  LEFT JOIN accounts ca ON ca.id = c.customer_ledger_account_id
  LEFT JOIN accounts sa ON sa.id = c.supplier_ledger_account_id
  WHERE c.is_customer = true
    AND c.customer_ledger_account_id IS NOT NULL
    AND COALESCE(ca.current_balance, 0) > 0
  ORDER BY balance DESC
  LIMIT limit_count;
END;
$$;


--
-- Name: gm_adjust_order_item_stock(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gm_adjust_order_item_stock(p_product_id uuid, p_quantity numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = COALESCE(stock_quantity, 0) + p_quantity,
      updated_at = now()
  WHERE id = p_product_id;
END;
$$;


--
-- Name: gm_apply_stock_for_pos_items(jsonb, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gm_apply_stock_for_pos_items(p_items jsonb, p_multiplier numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_item jsonb;
  v_component jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item->'comboItems') = 'array' AND jsonb_array_length(v_item->'comboItems') > 0 THEN
      FOR v_component IN SELECT value FROM jsonb_array_elements(v_item->'comboItems')
      LOOP
        PERFORM public.gm_apply_stock_json_item(v_component, p_multiplier);
      END LOOP;
    ELSE
      PERFORM public.gm_apply_stock_json_item(v_item, p_multiplier);
    END IF;
  END LOOP;
END;
$$;


--
-- Name: gm_apply_stock_json_item(jsonb, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gm_apply_stock_json_item(p_item jsonb, p_multiplier numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_product_id text;
  v_variant_id text;
  v_quantity numeric;
BEGIN
  v_product_id := COALESCE(p_item->>'productId', p_item->>'product_id');
  v_variant_id := COALESCE(p_item->>'variantId', p_item->>'variant_id');
  v_quantity := COALESCE(NULLIF(p_item->>'quantity', '')::numeric, 0) * p_multiplier;

  IF v_product_id IS NULL OR v_product_id = '' OR v_product_id = 'cart-discount' OR v_quantity = 0 THEN
    RETURN;
  END IF;

  IF v_variant_id IS NOT NULL AND v_variant_id <> '' THEN
    UPDATE public.product_variants
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
    WHERE id = v_variant_id::uuid;
  ELSE
    UPDATE public.products
    SET stock_quantity = COALESCE(stock_quantity, 0) + v_quantity,
        updated_at = now()
    WHERE id = v_product_id::uuid;
  END IF;
END;
$$;


--
-- Name: gm_reconcile_delivered_order_item_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gm_reconcile_delivered_order_item_stock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old_delivered boolean := false;
  v_new_delivered boolean := false;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT status = 'delivered' INTO v_old_delivered
    FROM public.orders
    WHERE id = OLD.order_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT status = 'delivered' INTO v_new_delivered
    FROM public.orders
    WHERE id = NEW.order_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_new_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(NEW.product_id, -NEW.quantity);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_old_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(OLD.product_id, OLD.quantity);
    END IF;
    IF v_new_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(NEW.product_id, -NEW.quantity);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_old_delivered THEN
      PERFORM public.gm_adjust_order_item_stock(OLD.product_id, OLD.quantity);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


--
-- Name: gm_restore_stock_on_delivered_order_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gm_restore_stock_on_delivered_order_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_item record;
BEGIN
  IF OLD.status = 'delivered' THEN
    FOR v_item IN
      SELECT product_id, quantity
      FROM public.order_items
      WHERE order_id = OLD.id
    LOOP
      PERFORM public.gm_adjust_order_item_stock(v_item.product_id, v_item.quantity);
    END LOOP;
  END IF;

  RETURN OLD;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;


--
-- Name: handle_online_order_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_online_order_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_sales_account_id UUID;
  v_tax_account_id UUID;
  v_ar_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
BEGIN
  -- Handle DELETE: Remove journal entry when order is deleted
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.order_number;
    RETURN OLD;
  END IF;

  -- Handle UPDATE: Create or update journal entry when payment_status is 'paid'
  IF TG_OP = 'UPDATE' AND NEW.payment_status = 'paid' THEN
    
    -- Delete existing journal entry if it exists
    DELETE FROM journal_entries WHERE reference = NEW.order_number;

    -- Get account IDs using SYSCOHADA codes
    SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
    SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' LIMIT 1;
    SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' LIMIT 1;
    SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '4431' LIMIT 1;
    SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' LIMIT 1;

    -- Get customer ledger account if customer_id is set
    IF NEW.customer_id IS NOT NULL THEN
      SELECT customer_ledger_account_id INTO v_customer_ledger_id 
      FROM contacts 
      WHERE id = NEW.customer_id;
    END IF;

    -- Create journal entry
    INSERT INTO journal_entries (
      description, 
      entry_date, 
      reference, 
      total_debit, 
      total_credit, 
      transaction_amount,
      status, 
      posted_at
    ) VALUES (
      'Vente en ligne - ' || NEW.order_number,
      CURRENT_DATE,
      NEW.order_number,
      NEW.total,
      NEW.total,
      NEW.total,
      'posted',
      NOW()
    ) RETURNING id INTO v_journal_entry_id;

    -- Determine payment account based on payment method
    CASE NEW.payment_method
      WHEN 'cash' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'mobile_money' THEN v_payment_account_id := v_mobile_money_account_id;
      WHEN 'card' THEN v_payment_account_id := v_cash_account_id;
      WHEN 'credit' THEN v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
      ELSE v_payment_account_id := v_cash_account_id;
    END CASE;

    -- Debit: Payment account
    IF v_payment_account_id IS NOT NULL AND NEW.total > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_payment_account_id,
        CASE WHEN NEW.payment_method = 'credit' THEN 'Vente à crédit' ELSE 'Paiement reçu - ' || COALESCE(NEW.payment_method, 'espèces') END,
        NEW.total, 0);
    END IF;

    -- Credit: Sales revenue
    IF NEW.subtotal > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, NEW.subtotal);
    END IF;

    -- Credit: Tax (if any)
    IF NEW.tax > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'TVA collectée', 0, NEW.tax);
    END IF;

  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: handle_pos_journal_entry(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_pos_journal_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cash_account_id UUID;
  v_mobile_money_account_id UUID;
  v_sales_account_id UUID;
  v_discount_account_id UUID;
  v_tax_account_id UUID;
  v_ar_account_id UUID;
  v_customer_ledger_id UUID;
  v_journal_entry_id UUID;
  v_payment_account_id UUID;
  v_payment RECORD;
  v_payment_details JSONB;
  v_total_amount NUMERIC;
  v_sales_amount NUMERIC;
  v_discount_amount NUMERIC;
  v_tax_amount NUMERIC;
  v_is_refund BOOLEAN;
  v_abs_total NUMERIC;
  v_auth_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM journal_entries WHERE reference = OLD.transaction_number;
  END IF;

  SELECT id INTO v_cash_account_id FROM accounts WHERE account_code = '571' AND is_active = true LIMIT 1;
  SELECT id INTO v_mobile_money_account_id FROM accounts WHERE account_code = '521' AND is_active = true LIMIT 1;
  SELECT id INTO v_sales_account_id FROM accounts WHERE account_code = '701' AND is_active = true LIMIT 1;
  SELECT id INTO v_discount_account_id FROM accounts WHERE account_code = '709' AND is_active = true LIMIT 1;
  SELECT id INTO v_tax_account_id FROM accounts WHERE account_code = '4471' AND is_active = true LIMIT 1;
  SELECT id INTO v_ar_account_id FROM accounts WHERE account_code = '411' AND is_active = true LIMIT 1;

  IF NEW.customer_id IS NOT NULL THEN
    SELECT customer_ledger_account_id INTO v_customer_ledger_id FROM contacts WHERE id = NEW.customer_id;
  END IF;

  v_total_amount := COALESCE(NEW.total, 0);
  v_is_refund := v_total_amount < 0;
  v_abs_total := ABS(v_total_amount);
  v_discount_amount := ABS(COALESCE(NEW.discount, 0));
  v_tax_amount := ABS(COALESCE(NEW.tax, 0));
  v_sales_amount := ABS(COALESCE(NEW.subtotal, 0)) + v_discount_amount;

  -- Resolve cashier_id (may be a pos_users.id from offline) to a valid auth.users.id
  v_auth_user_id := public.resolve_auth_user_id(NEW.cashier_id);

  INSERT INTO journal_entries (
    description, entry_date, reference, total_debit, total_credit,
    transaction_amount, status, created_by, posted_by, posted_at
  ) VALUES (
    CASE WHEN v_is_refund THEN 'Remboursement POS - ' ELSE 'Vente POS - ' END || NEW.transaction_number,
    CURRENT_DATE, NEW.transaction_number,
    v_abs_total + v_discount_amount, v_abs_total + v_discount_amount,
    v_total_amount, 'posted', v_auth_user_id, v_auth_user_id, NOW()
  ) RETURNING id INTO v_journal_entry_id;

  v_payment_details := COALESCE(NEW.payment_details::JSONB, '[]'::JSONB);

  IF jsonb_array_length(v_payment_details) > 0 THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payment_details)
    LOOP
      DECLARE
        v_method TEXT := COALESCE(v_payment.value->>'method', 'cash');
        v_amount NUMERIC := ABS(COALESCE((v_payment.value->>'amount')::NUMERIC, 0));
      BEGIN
        IF v_amount > 0 THEN
          IF v_method = 'mobile_money' THEN
            v_payment_account_id := v_mobile_money_account_id;
          ELSIF v_method = 'credit' THEN
            v_payment_account_id := COALESCE(v_customer_ledger_id, v_ar_account_id);
          ELSE
            v_payment_account_id := v_cash_account_id;
          END IF;

          IF v_payment_account_id IS NOT NULL THEN
            IF v_is_refund THEN
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
              VALUES (v_journal_entry_id, v_payment_account_id,
                CASE v_method WHEN 'cash' THEN 'Remboursement espèces' WHEN 'mobile_money' THEN 'Remboursement Mobile Money' WHEN 'credit' THEN 'Réduction crédit client' ELSE 'Remboursement - ' || v_method END,
                0, v_amount);
            ELSE
              INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
              VALUES (v_journal_entry_id, v_payment_account_id,
                CASE v_method WHEN 'cash' THEN 'Encaissement espèces' WHEN 'mobile_money' THEN 'Encaissement Mobile Money' WHEN 'credit' THEN 'Vente à crédit' ELSE 'Encaissement - ' || v_method END,
                v_amount, 0);
            END IF;
          END IF;
        END IF;
      END;
    END LOOP;
  ELSE
    IF v_abs_total > 0 AND v_cash_account_id IS NOT NULL THEN
      IF v_is_refund THEN
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_cash_account_id, 'Remboursement espèces', 0, v_abs_total);
      ELSE
        INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
        VALUES (v_journal_entry_id, v_cash_account_id, 'Encaissement espèces', v_abs_total, 0);
      END IF;
    END IF;
  END IF;

  IF v_sales_amount > 0 AND v_sales_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Annulation vente', v_sales_amount, 0);
    ELSE
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_sales_account_id, 'Ventes de marchandises', 0, v_sales_amount);
    END IF;
  END IF;

  IF v_discount_amount > 0 AND v_discount_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Annulation remise', 0, v_discount_amount);
    ELSE
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_discount_account_id, 'Remises accordées', v_discount_amount, 0);
    END IF;
  END IF;

  IF v_tax_amount > 0 AND v_tax_account_id IS NOT NULL THEN
    IF v_is_refund THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Annulation timbre', v_tax_amount, 0);
    ELSE
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount)
      VALUES (v_journal_entry_id, v_tax_account_id, 'Timbre fiscal', 0, v_tax_amount);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: mark_guest_messages_read(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_guest_messages_read(p_conversation_id uuid, p_session_token uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_conversations
    WHERE id = p_conversation_id
      AND user_id IS NULL
      AND guest_session_token = p_session_token
  ) THEN
    RAISE EXCEPTION 'Invalid conversation or session token';
  END IF;

  UPDATE public.chat_messages
  SET is_read = true
  WHERE conversation_id = p_conversation_id
    AND sender_type = 'admin'
    AND is_read = false;
END;
$$;


--
-- Name: recalculate_all_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_all_stock() RETURNS TABLE(updated_products integer, updated_variants integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_products_updated integer := 0;
  v_variants_updated integer := 0;
BEGIN
  -- Recalculate product-level stock
  WITH calculations AS (
    SELECT 
      p.id,
      COALESCE((
        SELECT SUM(pi.quantity) FROM purchase_items pi
        WHERE pi.product_id = p.id AND pi.variant_id IS NULL
      ), 0)
      -
      COALESCE((
        SELECT SUM((item->>'quantity')::numeric)
        FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'productId')::text = p.id::text
          AND item->>'productId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (item->>'variantId' IS NULL OR item->>'variantId' = '')
      ), 0)
      +
      COALESCE((
        SELECT SUM(sa.quantity_change) FROM stock_adjustments sa
        WHERE sa.product_id = p.id AND sa.variant_id IS NULL
      ), 0) AS new_stock
    FROM products p
    WHERE EXISTS (
        SELECT 1 FROM purchase_items pi WHERE pi.product_id = p.id AND pi.variant_id IS NULL
      ) OR EXISTS (
        SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'productId')::text = p.id::text
          AND item->>'productId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (item->>'variantId' IS NULL OR item->>'variantId' = '')
      )
  )
  UPDATE products p
  SET stock_quantity = c.new_stock, updated_at = NOW()
  FROM calculations c
  WHERE p.id = c.id AND p.stock_quantity IS DISTINCT FROM c.new_stock;
  
  GET DIAGNOSTICS v_products_updated = ROW_COUNT;

  -- Recalculate variant-level stock
  WITH variant_calculations AS (
    SELECT
      pv.id,
      COALESCE((
        SELECT SUM(pi.quantity) FROM purchase_items pi WHERE pi.variant_id = pv.id
      ), 0)
      -
      COALESCE((
        SELECT SUM((item->>'quantity')::numeric)
        FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'variantId')::text = pv.id::text
          AND item->>'variantId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ), 0)
      +
      COALESCE((
        SELECT SUM(sa.quantity_change) FROM stock_adjustments sa WHERE sa.variant_id = pv.id
      ), 0) AS new_stock
    FROM product_variants pv
    WHERE EXISTS (
        SELECT 1 FROM purchase_items pi WHERE pi.variant_id = pv.id
      ) OR EXISTS (
        SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'variantId')::text = pv.id::text
          AND item->>'variantId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  )
  UPDATE product_variants pv
  SET stock_quantity = vc.new_stock, updated_at = NOW()
  FROM variant_calculations vc
  WHERE pv.id = vc.id AND pv.stock_quantity IS DISTINCT FROM vc.new_stock;
  
  GET DIAGNOSTICS v_variants_updated = ROW_COUNT;

  RETURN QUERY SELECT v_products_updated, v_variants_updated;
END;
$_$;


--
-- Name: recalculate_products_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_products_stock() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH calculations AS (
    SELECT 
      p.id,
      COALESCE((
        SELECT SUM(pi.quantity) FROM purchase_items pi
        WHERE pi.product_id = p.id AND pi.variant_id IS NULL
      ), 0)
      -
      COALESCE((
        SELECT SUM((item->>'quantity')::numeric)
        FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'productId')::text = p.id::text
          AND item->>'productId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (item->>'variantId' IS NULL OR item->>'variantId' = '')
      ), 0)
      +
      COALESCE((
        SELECT SUM(sa.quantity_change) FROM stock_adjustments sa
        WHERE sa.product_id = p.id AND sa.variant_id IS NULL
      ), 0) AS new_stock
    FROM products p
    WHERE EXISTS (
        SELECT 1 FROM purchase_items pi WHERE pi.product_id = p.id AND pi.variant_id IS NULL
      ) OR EXISTS (
        SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'productId')::text = p.id::text
          AND item->>'productId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          AND (item->>'variantId' IS NULL OR item->>'variantId' = '')
      )
  )
  UPDATE products p
  SET stock_quantity = c.new_stock, updated_at = NOW()
  FROM calculations c
  WHERE p.id = c.id AND p.stock_quantity IS DISTINCT FROM c.new_stock;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$_$;


--
-- Name: recalculate_variants_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_variants_stock() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH variant_calculations AS (
    SELECT
      pv.id,
      COALESCE((
        SELECT SUM(pi.quantity) FROM purchase_items pi WHERE pi.variant_id = pv.id
      ), 0)
      -
      COALESCE((
        SELECT SUM((item->>'quantity')::numeric)
        FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'variantId')::text = pv.id::text
          AND item->>'variantId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ), 0)
      +
      COALESCE((
        SELECT SUM(sa.quantity_change) FROM stock_adjustments sa WHERE sa.variant_id = pv.id
      ), 0) AS new_stock
    FROM product_variants pv
    WHERE EXISTS (
        SELECT 1 FROM purchase_items pi WHERE pi.variant_id = pv.id
      ) OR EXISTS (
        SELECT 1 FROM pos_transactions pt, jsonb_array_elements(pt.items) as item
        WHERE (item->>'variantId')::text = pv.id::text
          AND item->>'variantId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
  )
  UPDATE product_variants pv
  SET stock_quantity = vc.new_stock, updated_at = NOW()
  FROM variant_calculations vc
  WHERE pv.id = vc.id AND pv.stock_quantity IS DISTINCT FROM vc.new_stock;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$_$;


--
-- Name: resolve_auth_user_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_auth_user_id(p_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN p_id IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN p_id
    ELSE (SELECT user_id FROM public.pos_users WHERE id = p_id LIMIT 1)
  END;
$$;


--
-- Name: restore_stock_on_transaction_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.restore_stock_on_transaction_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.gm_apply_stock_for_pos_items(OLD.items, 1);
  RETURN OLD;
END;
$$;


--
-- Name: reverse_transaction_journal_entries(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_transaction_journal_entries(p_reference text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Delete all journal entry lines for this reference
  DELETE FROM journal_entry_lines jel
  USING journal_entries je
  WHERE jel.journal_entry_id = je.id
    AND je.reference = p_reference;
  
  -- Delete the journal entries themselves
  DELETE FROM journal_entries
  WHERE reference = p_reference;
END;
$$;


--
-- Name: send_guest_message(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_guest_message(p_conversation_id uuid, p_session_token uuid, p_message text) RETURNS public.chat_messages
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_conv_id uuid;
  v_message public.chat_messages;
BEGIN
  SELECT id INTO v_conv_id
  FROM public.chat_conversations
  WHERE id = p_conversation_id
    AND user_id IS NULL
    AND guest_session_token = p_session_token;

  IF v_conv_id IS NULL THEN
    RAISE EXCEPTION 'Invalid conversation or session token';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  INSERT INTO public.chat_messages (
    conversation_id, sender_type, sender_id, message
  ) VALUES (
    v_conv_id, 'customer', NULL, p_message
  )
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$$;


--
-- Name: sync_product_local_charges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_product_local_charges() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update the product's local_charges with the value from the purchase item
  UPDATE products
  SET local_charges = NEW.local_charges,
      updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;


--
-- Name: update_account_balance(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_account_balance() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  affected_account_id uuid;
BEGIN
  -- On DELETE, use OLD record
  -- On INSERT or UPDATE, use NEW record
  IF TG_OP = 'DELETE' THEN
    affected_account_id := OLD.account_id;
  ELSE
    affected_account_id := NEW.account_id;
  END IF;

  -- Update the account balance based on account type
  -- Include opening balance from contacts table
  UPDATE accounts
  SET current_balance = (
    -- Opening balance from contact (if this account is linked to a contact)
    COALESCE((
      SELECT COALESCE(opening_balance, 0)
      FROM contacts
      WHERE customer_ledger_account_id = accounts.id
         OR supplier_ledger_account_id = accounts.id
      LIMIT 1
    ), 0)
    +
    -- Balance from journal entries
    COALESCE((
      SELECT SUM(
        CASE 
          -- Assets and Expenses: Debit increases, Credit decreases
          WHEN accounts.account_type IN ('asset', 'expense') THEN 
            jel.debit_amount - jel.credit_amount
          -- Liabilities, Equity, Revenue: Credit increases, Debit decreases
          ELSE 
            jel.credit_amount - jel.debit_amount
        END
      )
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id = accounts.id
        AND je.status = 'posted'
    ), 0)
  )
  WHERE id = affected_account_id;

  -- On UPDATE, also update the old account if account_id changed
  IF TG_OP = 'UPDATE' AND OLD.account_id != NEW.account_id THEN
    UPDATE accounts
    SET current_balance = (
      -- Opening balance from contact
      COALESCE((
        SELECT COALESCE(opening_balance, 0)
        FROM contacts
        WHERE customer_ledger_account_id = accounts.id
           OR supplier_ledger_account_id = accounts.id
        LIMIT 1
      ), 0)
      +
      -- Balance from journal entries
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN accounts.account_type IN ('asset', 'expense') THEN 
              jel.debit_amount - jel.credit_amount
            ELSE 
              jel.credit_amount - jel.debit_amount
          END
        )
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = accounts.id
          AND je.status = 'posted'
      ), 0)
    )
    WHERE id = OLD.account_id;
  END IF;

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


--
-- Name: update_account_balance_on_status_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_account_balance_on_status_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- If status changed to or from 'posted', recalculate all affected accounts
  IF (OLD.status != NEW.status) AND (OLD.status = 'posted' OR NEW.status = 'posted') THEN
    -- Update all accounts that have lines in this journal entry
    UPDATE accounts
    SET current_balance = (
      -- Opening balance from contact
      COALESCE((
        SELECT COALESCE(opening_balance, 0)
        FROM contacts
        WHERE customer_ledger_account_id = accounts.id
           OR supplier_ledger_account_id = accounts.id
        LIMIT 1
      ), 0)
      +
      -- Balance from journal entries
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN accounts.account_type IN ('asset', 'expense') THEN 
              jel.debit_amount - jel.credit_amount
            ELSE 
              jel.credit_amount - jel.debit_amount
          END
        )
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = accounts.id
          AND je.status = 'posted'
      ), 0)
    )
    WHERE id IN (
      SELECT DISTINCT account_id 
      FROM journal_entry_lines 
      WHERE journal_entry_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE chat_conversations
  SET last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_online_availability_by_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_online_availability_by_stock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update is_available_online based on stock_quantity
  IF NEW.stock_quantity IS NOT NULL THEN
    IF NEW.stock_quantity <= 0 THEN
      NEW.is_available_online := false;
    ELSIF NEW.stock_quantity > 0 AND (OLD.stock_quantity IS NULL OR OLD.stock_quantity <= 0) THEN
      -- Only set to true if it was previously out of stock
      NEW.is_available_online := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_product_supplier(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_product_supplier() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_supplier_id uuid;
BEGIN
  -- Get supplier ID from the purchase
  SELECT c.id INTO v_supplier_id
  FROM purchases p
  JOIN contacts c ON c.name = p.supplier_name AND c.is_supplier = true
  WHERE p.id = NEW.purchase_id;
  
  -- Update the product's supplier
  IF v_supplier_id IS NOT NULL THEN
    UPDATE products
    SET supplier_id = v_supplier_id,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_purchase_payment_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_purchase_payment_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  purchase_total numeric;
  total_paid numeric;
  payment_methods jsonb;
  unique_methods text[];
  payment_method_display text;
BEGIN
  -- Only process if purchase_id is set
  IF NEW.purchase_id IS NOT NULL THEN
    -- Get the total amount of the purchase
    SELECT total_amount INTO purchase_total
    FROM purchases
    WHERE id = NEW.purchase_id;
    
    -- Calculate total paid for this purchase
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM supplier_payments
    WHERE purchase_id = NEW.purchase_id;
    
    -- Get payment details array (method and amount for each payment)
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'method', payment_method,
          'amount', amount
        ) ORDER BY payment_date
      ),
      '[]'::jsonb
    ) INTO payment_methods
    FROM supplier_payments
    WHERE purchase_id = NEW.purchase_id;
    
    -- Get unique payment methods for display
    SELECT array_agg(DISTINCT payment_method ORDER BY payment_method)
    INTO unique_methods
    FROM supplier_payments
    WHERE purchase_id = NEW.purchase_id;
    
    -- Determine payment method display text
    IF array_length(unique_methods, 1) IS NULL THEN
      payment_method_display := NULL;
    ELSIF array_length(unique_methods, 1) = 1 THEN
      payment_method_display := unique_methods[1];
    ELSE
      payment_method_display := 'Multiple';
    END IF;
    
    -- Update purchase payment status, amount_paid, payment_method, and payment_details
    UPDATE purchases
    SET 
      amount_paid = total_paid,
      payment_status = CASE
        WHEN total_paid >= purchase_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partial'
        ELSE 'pending'
      END,
      payment_method = COALESCE(payment_method_display, payment_method),
      payment_details = payment_methods,
      updated_at = now()
    WHERE id = NEW.purchase_id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_purchase_payment_status_on_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_purchase_payment_status_on_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  purchase_total numeric;
  total_paid numeric;
  payment_methods jsonb;
  unique_methods text[];
  payment_method_display text;
BEGIN
  -- Only process if purchase_id was set
  IF OLD.purchase_id IS NOT NULL THEN
    -- Get the total amount of the purchase
    SELECT total_amount INTO purchase_total
    FROM purchases
    WHERE id = OLD.purchase_id;
    
    -- Calculate total paid for this purchase (excluding the deleted payment)
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM supplier_payments
    WHERE purchase_id = OLD.purchase_id;
    
    -- Get payment details array (excluding deleted payment)
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'method', payment_method,
          'amount', amount
        ) ORDER BY payment_date
      ),
      '[]'::jsonb
    ) INTO payment_methods
    FROM supplier_payments
    WHERE purchase_id = OLD.purchase_id;
    
    -- Get unique payment methods for display
    SELECT array_agg(DISTINCT payment_method ORDER BY payment_method)
    INTO unique_methods
    FROM supplier_payments
    WHERE purchase_id = OLD.purchase_id;
    
    -- Determine payment method display text
    IF array_length(unique_methods, 1) IS NULL THEN
      -- No payments left, get original payment method from purchase
      SELECT payment_method INTO payment_method_display
      FROM purchases
      WHERE id = OLD.purchase_id;
    ELSIF array_length(unique_methods, 1) = 1 THEN
      payment_method_display := unique_methods[1];
    ELSE
      payment_method_display := 'Multiple';
    END IF;
    
    -- Update purchase payment status, amount_paid, payment_method, and payment_details
    UPDATE purchases
    SET 
      amount_paid = total_paid,
      payment_status = CASE
        WHEN total_paid >= purchase_total THEN 'paid'
        WHEN total_paid > 0 THEN 'partial'
        ELSE 'pending'
      END,
      payment_method = payment_method_display,
      payment_details = payment_methods,
      updated_at = now()
    WHERE id = OLD.purchase_id;
  END IF;
  
  RETURN OLD;
END;
$$;


--
-- Name: update_stock_on_purchase(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_stock_on_purchase() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update product stock and cost if no variant
  IF NEW.variant_id IS NULL THEN
    UPDATE products
    SET stock_quantity = stock_quantity + NEW.quantity,
        cost_price = NEW.unit_cost,  -- Fixed: was unit_price, should be unit_cost
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    -- Create inventory layer for FIFO with correct purchase_id link
    INSERT INTO inventory_layers (
      product_id,
      variant_id,
      purchase_id,
      purchase_item_id,
      quantity_purchased,
      quantity_remaining,
      unit_cost,
      purchased_at
    ) VALUES (
      NEW.product_id,
      NULL,
      NEW.purchase_id,
      NEW.id,
      NEW.quantity,
      NEW.quantity,
      NEW.unit_cost,
      NOW()
    );
  ELSE
    -- Update variant stock AND cost_price
    UPDATE product_variants
    SET stock_quantity = stock_quantity + NEW.quantity,
        cost_price = NEW.unit_cost,  -- Added: update variant cost_price
        updated_at = NOW()
    WHERE id = NEW.variant_id;
    
    -- Create inventory layer for variant
    INSERT INTO inventory_layers (
      product_id,
      variant_id,
      purchase_id,
      purchase_item_id,
      quantity_purchased,
      quantity_remaining,
      unit_cost,
      purchased_at
    ) VALUES (
      NEW.product_id,
      NEW.variant_id,
      NEW.purchase_id,
      NEW.id,
      NEW.quantity,
      NEW.quantity,
      NEW.unit_cost,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_stock_on_purchase_item_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_stock_on_purchase_item_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Add stock when purchase item is inserted
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE product_variants
    SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity,
        cost_price = NEW.unit_cost,
        updated_at = NOW()
    WHERE id = NEW.variant_id;
  ELSE
    UPDATE products
    SET stock_quantity = COALESCE(stock_quantity, 0) + NEW.quantity,
        cost_price = NEW.unit_cost,
        updated_at = NOW()
    WHERE id = NEW.product_id;
  END IF;
  
  -- Create inventory layer for FIFO tracking
  INSERT INTO inventory_layers (
    product_id, variant_id, purchase_id, purchase_item_id,
    quantity_purchased, quantity_remaining, unit_cost, purchased_at
  ) VALUES (
    NEW.product_id, NEW.variant_id, NEW.purchase_id, NEW.id,
    NEW.quantity, NEW.quantity, NEW.unit_cost, NOW()
  );
  
  RETURN NEW;
END;
$$;


--
-- Name: update_stock_on_purchase_item_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_stock_on_purchase_item_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  qty_diff numeric;
BEGIN
  qty_diff := NEW.quantity - OLD.quantity;
  
  -- Only adjust if quantity changed
  IF qty_diff != 0 THEN
    IF NEW.variant_id IS NOT NULL THEN
      UPDATE product_variants
      SET stock_quantity = COALESCE(stock_quantity, 0) + qty_diff,
          cost_price = NEW.unit_cost,
          updated_at = NOW()
      WHERE id = NEW.variant_id;
    ELSE
      UPDATE products
      SET stock_quantity = COALESCE(stock_quantity, 0) + qty_diff,
          cost_price = NEW.unit_cost,
          updated_at = NOW()
      WHERE id = NEW.product_id;
    END IF;
    
    -- Update inventory layer
    UPDATE inventory_layers
    SET quantity_purchased = NEW.quantity,
        quantity_remaining = quantity_remaining + qty_diff,
        unit_cost = NEW.unit_cost,
        updated_at = NOW()
    WHERE purchase_item_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: verify_admin_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_admin_access(p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT has_role(p_user_id, 'admin'::app_role);
$$;


--
-- Name: verify_pin(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_pin(input_pin text) RETURNS TABLE(pos_user_id uuid, user_id uuid, full_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN QUERY
  SELECT pu.id as pos_user_id, pu.user_id, pu.full_name
  FROM pos_users pu
  WHERE pu.pin_hash = extensions.crypt(input_pin, pu.pin_hash)
    AND pu.is_active = true;
END;
$$;


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_code text NOT NULL,
    account_name text NOT NULL,
    account_type public.account_type NOT NULL,
    parent_account_id uuid,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    current_balance numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    opening_balance numeric DEFAULT 0
);


--
-- Name: COLUMN accounts.opening_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.accounts.opening_balance IS 'Starting balance for the account at the beginning of accounting period';


--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    state text NOT NULL,
    zip_code text NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    event_data jsonb,
    page_url text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_active boolean DEFAULT true,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone NOT NULL,
    background_color text DEFAULT '#22C55E'::text,
    text_color text DEFAULT '#FFFFFF'::text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    background_image_url text,
    title_font_size text DEFAULT 'text-xl'::text,
    title_font_weight text DEFAULT 'font-bold'::text,
    message_font_size text DEFAULT 'text-base'::text,
    message_font_weight text DEFAULT 'font-normal'::text
);


--
-- Name: backup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_type text NOT NULL,
    status text NOT NULL,
    tables_backed_up text[] DEFAULT '{}'::text[],
    records_count jsonb DEFAULT '{}'::jsonb,
    error_message text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    triggered_by uuid,
    backup_size_bytes bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT backup_logs_backup_type_check CHECK ((backup_type = ANY (ARRAY['manual'::text, 'automatic'::text, 'scheduled'::text]))),
    CONSTRAINT backup_logs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: backup_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auto_backup_enabled boolean DEFAULT false,
    backup_frequency_hours integer DEFAULT 24,
    last_backup_at timestamp with time zone,
    next_backup_at timestamp with time zone,
    tables_to_backup text[] DEFAULT ARRAY['products'::text, 'product_variants'::text, 'categories'::text, 'contacts'::text, 'purchases'::text, 'purchase_items'::text, 'pos_transactions'::text, 'orders'::text, 'inventory_layers'::text, 'stock_adjustments'::text],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bogo_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bogo_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    buy_product_id uuid,
    buy_variant_id uuid,
    buy_quantity integer DEFAULT 1 NOT NULL,
    get_product_id uuid,
    get_variant_id uuid,
    get_quantity integer DEFAULT 1 NOT NULL,
    get_discount_percentage integer DEFAULT 100 NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    max_uses_per_transaction integer,
    max_total_uses integer,
    current_uses integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bogo_offers_buy_quantity_check CHECK ((buy_quantity > 0)),
    CONSTRAINT bogo_offers_check CHECK (((buy_product_id IS NOT NULL) OR (buy_variant_id IS NOT NULL))),
    CONSTRAINT bogo_offers_check1 CHECK (((get_product_id IS NOT NULL) OR (get_variant_id IS NOT NULL))),
    CONSTRAINT bogo_offers_get_discount_percentage_check CHECK (((get_discount_percentage >= 0) AND (get_discount_percentage <= 100))),
    CONSTRAINT bogo_offers_get_quantity_check CHECK ((get_quantity > 0))
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    variant_id uuid,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: cash_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    cashier_id uuid NOT NULL,
    opening_cash numeric DEFAULT 0 NOT NULL,
    closing_cash numeric,
    expected_cash numeric,
    cash_difference numeric,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    notes text,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cash_sessions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: COLUMN cash_sessions.cashier_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cash_sessions.cashier_id IS 'References pos_users.id (not auth.users.id)';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    image_url text,
    parent_id uuid,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cloud_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloud_backups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_name text NOT NULL,
    backup_size bigint DEFAULT 0 NOT NULL,
    table_count integer DEFAULT 0 NOT NULL,
    record_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cloud_backups_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: TABLE cloud_backups; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cloud_backups IS 'Stores cloud backup metadata and full database snapshots for disaster recovery';


--
-- Name: combo_offer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combo_offer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    combo_offer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: combo_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.combo_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    combo_price numeric NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text,
    phone text,
    contact_person text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip_code text,
    country text,
    tax_id text,
    is_customer boolean DEFAULT false NOT NULL,
    is_supplier boolean DEFAULT false NOT NULL,
    credit_limit numeric,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    opening_balance numeric DEFAULT 0,
    customer_ledger_account_id uuid,
    supplier_ledger_account_id uuid,
    price_tier public.price_tier DEFAULT 'retail'::public.price_tier,
    custom_price_tier_id uuid,
    discount_percentage numeric DEFAULT 0,
    supplier_opening_balance numeric DEFAULT 0,
    CONSTRAINT contacts_must_be_customer_or_supplier CHECK (((is_customer = true) OR (is_supplier = true)))
);


--
-- Name: COLUMN contacts.opening_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.opening_balance IS 'Opening balance for the contact - positive for amounts owed to us (customer), negative for amounts we owe (supplier)';


--
-- Name: COLUMN contacts.price_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.price_tier IS 'Customer price tier: retail (default), wholesale, or vip';


--
-- Name: COLUMN contacts.discount_percentage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.discount_percentage IS 'Cart-wide discount percentage for this customer';


--
-- Name: COLUMN contacts.supplier_opening_balance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.contacts.supplier_opening_balance IS 'Opening balance for supplier accounts (separate from customer opening balance)';


--
-- Name: custom_price_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_price_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: custom_tier_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_tier_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier_id uuid NOT NULL,
    product_id uuid NOT NULL,
    price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customer_product_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_product_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    product_id uuid NOT NULL,
    price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    payment_method text NOT NULL,
    receipt_url text,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_id uuid,
    account_id uuid,
    paid_from_account_id uuid
);


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: import_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    store_id uuid,
    status text NOT NULL,
    products_imported integer DEFAULT 0,
    error_message text,
    execution_time_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_layers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    purchase_id uuid,
    purchase_item_id uuid,
    quantity_purchased numeric NOT NULL,
    quantity_remaining numeric NOT NULL,
    unit_cost numeric NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_layers_quantity_purchased_check CHECK ((quantity_purchased > (0)::numeric)),
    CONSTRAINT inventory_layers_quantity_remaining_check CHECK ((quantity_remaining >= (0)::numeric)),
    CONSTRAINT inventory_layers_unit_cost_check CHECK ((unit_cost >= (0)::numeric)),
    CONSTRAINT valid_remaining_qty CHECK ((quantity_remaining <= quantity_purchased))
);


--
-- Name: TABLE inventory_layers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.inventory_layers IS 'Historical table - no longer used for active FIFO tracking. Kept for historical purchase cost data only.';


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_number text DEFAULT ('JE-'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 10))) NOT NULL,
    entry_date date DEFAULT CURRENT_DATE NOT NULL,
    reference text,
    description text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    total_debit numeric DEFAULT 0 NOT NULL,
    total_credit numeric DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    posted_at timestamp with time zone,
    posted_by uuid,
    transaction_amount numeric,
    CONSTRAINT journal_entries_balanced CHECK (((total_debit = total_credit) OR (status = 'draft'::text)))
);


--
-- Name: journal_entry_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    description text,
    debit_amount numeric DEFAULT 0 NOT NULL,
    credit_amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT journal_lines_debit_or_credit CHECK ((((debit_amount > (0)::numeric) AND (credit_amount = (0)::numeric)) OR ((credit_amount > (0)::numeric) AND (debit_amount = (0)::numeric))))
);


--
-- Name: multi_product_bogo_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.multi_product_bogo_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid,
    product_id uuid,
    variant_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: multi_product_bogo_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.multi_product_bogo_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    discount_percentage numeric DEFAULT 50 NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    max_uses_per_transaction integer,
    max_total_uses integer,
    current_uses integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    image_url text,
    discount_percentage integer,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    link_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_number text NOT NULL,
    user_id uuid,
    store_id uuid NOT NULL,
    address_id uuid,
    payment_method_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0 NOT NULL,
    tax numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    delivery_instructions text,
    delivery_time_slot text,
    delivery_date date,
    stripe_payment_intent_id text,
    payment_status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    payment_method text,
    customer_id uuid,
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'out_for_delivery'::text, 'delivered'::text, 'cancelled'::text])))
);

ALTER TABLE ONLY public.orders REPLICA IDENTITY FULL;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    label text NOT NULL,
    last_four text,
    expiry_month integer,
    expiry_year integer,
    is_default boolean DEFAULT false,
    stripe_payment_method_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_methods_type_check CHECK ((type = ANY (ARRAY['store_credit'::text, 'cash_on_delivery'::text, 'wave_money'::text, 'orange_money'::text])))
);


--
-- Name: payment_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receipt_number text DEFAULT ('PMT-'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 10))) NOT NULL,
    contact_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_method text NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    reference text,
    notes text,
    received_by uuid,
    store_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_receipts_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_receipts_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'mobile_money'::text, 'bank_transfer'::text, 'cheque'::text])))
);


--
-- Name: pos_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_name text,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pos_chat_messages REPLICA IDENTITY FULL;


--
-- Name: pos_sticky_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_sticky_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    color text DEFAULT 'yellow'::text NOT NULL,
    author_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.pos_sticky_notes REPLICA IDENTITY FULL;


--
-- Name: pos_todos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_todos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    notes text,
    remind_at timestamp with time zone,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_by_pos_user uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pos_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_number text DEFAULT ('POS-'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 10))) NOT NULL,
    store_id uuid NOT NULL,
    cashier_id uuid NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tax numeric(10,2) DEFAULT 0 NOT NULL,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    payment_method text NOT NULL,
    payment_details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    customer_id uuid,
    amount_paid numeric DEFAULT 0,
    metadata jsonb
);


--
-- Name: pos_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    pin_hash text NOT NULL,
    full_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    unit text NOT NULL,
    price numeric NOT NULL,
    stock_quantity integer DEFAULT 0,
    is_available boolean DEFAULT true,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    quantity numeric,
    label text,
    cost_price numeric,
    barcode text,
    wholesale_price numeric,
    vip_price numeric,
    CONSTRAINT product_variants_price_check CHECK ((price >= (0)::numeric))
);

ALTER TABLE ONLY public.product_variants REPLICA IDENTITY FULL;


--
-- Name: COLUMN product_variants.cost_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.cost_price IS 'Cost price of the variant for profit calculation';


--
-- Name: COLUMN product_variants.barcode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.barcode IS 'Barcode specific to this variant';


--
-- Name: COLUMN product_variants.wholesale_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.wholesale_price IS 'Wholesale price for wholesale customers';


--
-- Name: COLUMN product_variants.vip_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.product_variants.vip_price IS 'VIP price for VIP customers';


--
-- Name: production_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_id uuid NOT NULL,
    product_id uuid,
    variant_id uuid,
    quantity numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_output_product_or_variant CHECK ((((product_id IS NOT NULL) AND (variant_id IS NULL)) OR ((product_id IS NULL) AND (variant_id IS NOT NULL))))
);


--
-- Name: productions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    production_number text DEFAULT ('PROD-'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 8))) NOT NULL,
    production_date date DEFAULT CURRENT_DATE NOT NULL,
    source_product_id uuid,
    source_variant_id uuid,
    source_quantity numeric NOT NULL,
    notes text,
    status text DEFAULT 'completed'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_source_product_or_variant CHECK ((((source_product_id IS NOT NULL) AND (source_variant_id IS NULL)) OR ((source_product_id IS NULL) AND (source_variant_id IS NOT NULL))))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    store_id uuid NOT NULL,
    category_id uuid,
    name text NOT NULL,
    description text,
    price numeric(10,2) DEFAULT 0,
    original_price numeric(10,2),
    unit text NOT NULL,
    image_url text,
    images text[],
    nutritional_info jsonb,
    stock_quantity integer DEFAULT 0,
    is_available boolean DEFAULT false,
    is_featured boolean DEFAULT false,
    tags text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    barcode text,
    cost_price numeric,
    wholesale_price numeric,
    vip_price numeric,
    supplier_id uuid,
    is_available_online boolean DEFAULT true,
    local_charges numeric DEFAULT 0
);

ALTER TABLE ONLY public.products REPLICA IDENTITY FULL;


--
-- Name: COLUMN products.cost_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.cost_price IS 'Cost price of the product for profit calculation';


--
-- Name: COLUMN products.wholesale_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.wholesale_price IS 'Wholesale price for wholesale customers';


--
-- Name: COLUMN products.vip_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.products.vip_price IS 'VIP price for VIP customers';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'user'::text,
    language text DEFAULT 'en'::text,
    region text,
    currency text
);


--
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    quantity integer NOT NULL,
    unit_cost numeric(10,2) NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    local_charges numeric DEFAULT 0,
    CONSTRAINT purchase_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: purchase_order_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_charges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    charge_type text NOT NULL,
    description text,
    amount numeric NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_order_charges_charge_type_check CHECK ((charge_type = ANY (ARRAY['freight'::text, 'clearing'::text, 'customs'::text, 'handling'::text, 'other'::text])))
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    product_name text NOT NULL,
    variant_name text,
    requested_quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_number text DEFAULT ('PO-'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 10))) NOT NULL,
    store_id uuid NOT NULL,
    supplier_id uuid,
    supplier_name text NOT NULL,
    supplier_email text,
    supplier_phone text,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    share_token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex'::text),
    valid_until date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'quote_received'::text, 'accepted'::text, 'converted'::text, 'cancelled'::text])))
);


--
-- Name: purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    purchase_number text DEFAULT ('PUR-'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 10))) NOT NULL,
    store_id uuid NOT NULL,
    supplier_name text NOT NULL,
    supplier_contact text,
    total_amount numeric(10,2) DEFAULT 0 NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    notes text,
    purchased_by uuid NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    payment_details jsonb DEFAULT '[]'::jsonb,
    amount_paid numeric DEFAULT 0
);


--
-- Name: COLUMN purchases.payment_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.purchases.payment_details IS 'Array of payment objects: [{"method": "cash", "amount": 100}, {"method": "card", "amount": 50}]';


--
-- Name: quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_number text NOT NULL,
    contact_id uuid,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    tax numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    valid_until date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quotations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'converted'::text])))
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name text DEFAULT 'Global Market'::text NOT NULL,
    company_email text,
    company_phone text,
    company_address text,
    logo_url text,
    favicon_url text,
    primary_color text DEFAULT '#22C55E'::text,
    secondary_color text DEFAULT '#1E293B'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    region text DEFAULT 'Côte d''Ivoire'::text,
    language text DEFAULT 'en'::text,
    currency text DEFAULT 'XOF'::text
);


--
-- Name: special_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.special_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    threshold_amount numeric NOT NULL,
    discount_percentage numeric NOT NULL,
    match_mode text DEFAULT 'equals'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    store_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT special_offers_discount_percentage_check CHECK (((discount_percentage > (0)::numeric) AND (discount_percentage <= (100)::numeric))),
    CONSTRAINT special_offers_match_mode_check CHECK ((match_mode = ANY (ARRAY['equals'::text, 'gte'::text]))),
    CONSTRAINT special_offers_threshold_amount_check CHECK ((threshold_amount > (0)::numeric))
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    variant_id uuid,
    store_id uuid NOT NULL,
    adjustment_type text NOT NULL,
    quantity_change integer NOT NULL,
    reason text,
    adjusted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    inventory_layer_id uuid,
    unit_cost numeric DEFAULT 0,
    total_value numeric DEFAULT 0,
    cogs_amount numeric DEFAULT 0,
    cost_source text DEFAULT 'manual'::text,
    journal_entry_id uuid,
    CONSTRAINT stock_adjustments_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['manual'::text, 'sale'::text, 'purchase'::text, 'damage'::text, 'return'::text])))
);


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    address text NOT NULL,
    city text NOT NULL,
    state text,
    zip_code text,
    phone text,
    hours text,
    image_url text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supplier_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payment_number text DEFAULT ('SPM-'::text || upper(SUBSTRING(md5((random())::text) FROM 1 FOR 10))) NOT NULL,
    contact_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_method text NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    reference text,
    notes text,
    paid_by uuid,
    store_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    purchase_id uuid,
    CONSTRAINT supplier_payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT supplier_payments_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'mobile_money'::text, 'bank_transfer'::text, 'cheque'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: wishlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: accounts accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_account_code_key UNIQUE (account_code);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: backup_logs backup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_logs
    ADD CONSTRAINT backup_logs_pkey PRIMARY KEY (id);


--
-- Name: backup_settings backup_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_settings
    ADD CONSTRAINT backup_settings_pkey PRIMARY KEY (id);


--
-- Name: bogo_offers bogo_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bogo_offers
    ADD CONSTRAINT bogo_offers_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: cash_sessions cash_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: cloud_backups cloud_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloud_backups
    ADD CONSTRAINT cloud_backups_pkey PRIMARY KEY (id);


--
-- Name: combo_offer_items combo_offer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_offer_items
    ADD CONSTRAINT combo_offer_items_pkey PRIMARY KEY (id);


--
-- Name: combo_offers combo_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_offers
    ADD CONSTRAINT combo_offers_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: custom_price_tiers custom_price_tiers_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_price_tiers
    ADD CONSTRAINT custom_price_tiers_name_key UNIQUE (name);


--
-- Name: custom_price_tiers custom_price_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_price_tiers
    ADD CONSTRAINT custom_price_tiers_pkey PRIMARY KEY (id);


--
-- Name: custom_tier_prices custom_tier_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_tier_prices
    ADD CONSTRAINT custom_tier_prices_pkey PRIMARY KEY (id);


--
-- Name: custom_tier_prices custom_tier_prices_tier_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_tier_prices
    ADD CONSTRAINT custom_tier_prices_tier_id_product_id_key UNIQUE (tier_id, product_id);


--
-- Name: customer_product_prices customer_product_prices_customer_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_prices
    ADD CONSTRAINT customer_product_prices_customer_id_product_id_key UNIQUE (customer_id, product_id);


--
-- Name: customer_product_prices customer_product_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_prices
    ADD CONSTRAINT customer_product_prices_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: favorites favorites_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: import_logs import_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_logs
    ADD CONSTRAINT import_logs_pkey PRIMARY KEY (id);


--
-- Name: inventory_layers inventory_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_layers
    ADD CONSTRAINT inventory_layers_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_entry_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_entry_number_key UNIQUE (entry_number);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_lines journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);


--
-- Name: multi_product_bogo_items multi_product_bogo_items_offer_id_product_id_variant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_bogo_items
    ADD CONSTRAINT multi_product_bogo_items_offer_id_product_id_variant_id_key UNIQUE (offer_id, product_id, variant_id);


--
-- Name: multi_product_bogo_items multi_product_bogo_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_bogo_items
    ADD CONSTRAINT multi_product_bogo_items_pkey PRIMARY KEY (id);


--
-- Name: multi_product_bogo_offers multi_product_bogo_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_bogo_offers
    ADD CONSTRAINT multi_product_bogo_offers_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_receipts payment_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_receipts
    ADD CONSTRAINT payment_receipts_pkey PRIMARY KEY (id);


--
-- Name: payment_receipts payment_receipts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_receipts
    ADD CONSTRAINT payment_receipts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: pos_chat_messages pos_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_chat_messages
    ADD CONSTRAINT pos_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: pos_sticky_notes pos_sticky_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sticky_notes
    ADD CONSTRAINT pos_sticky_notes_pkey PRIMARY KEY (id);


--
-- Name: pos_todos pos_todos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_todos
    ADD CONSTRAINT pos_todos_pkey PRIMARY KEY (id);


--
-- Name: pos_transactions pos_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_transactions
    ADD CONSTRAINT pos_transactions_pkey PRIMARY KEY (id);


--
-- Name: pos_transactions pos_transactions_transaction_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_transactions
    ADD CONSTRAINT pos_transactions_transaction_number_key UNIQUE (transaction_number);


--
-- Name: pos_users pos_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_users
    ADD CONSTRAINT pos_users_pkey PRIMARY KEY (id);


--
-- Name: pos_users pos_users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_users
    ADD CONSTRAINT pos_users_user_id_key UNIQUE (user_id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: production_outputs production_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT production_outputs_pkey PRIMARY KEY (id);


--
-- Name: productions productions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productions
    ADD CONSTRAINT productions_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_charges purchase_order_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_charges
    ADD CONSTRAINT purchase_order_charges_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_responses purchase_order_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_responses
    ADD CONSTRAINT purchase_order_responses_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: purchase_orders purchase_orders_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_share_token_key UNIQUE (share_token);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_purchase_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_purchase_number_key UNIQUE (purchase_number);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: special_offers special_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_offers
    ADD CONSTRAINT special_offers_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: supplier_payments supplier_payments_payment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: supplier_payments supplier_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: wishlist wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_pkey PRIMARY KEY (id);


--
-- Name: wishlist wishlist_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: idx_accounts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_code ON public.accounts USING btree (account_code);


--
-- Name: idx_accounts_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_parent ON public.accounts USING btree (parent_account_id);


--
-- Name: idx_accounts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_type ON public.accounts USING btree (account_type);


--
-- Name: idx_analytics_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events USING btree (created_at DESC);


--
-- Name: idx_analytics_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_event_type ON public.analytics_events USING btree (event_type);


--
-- Name: idx_backup_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_logs_created_at ON public.backup_logs USING btree (created_at DESC);


--
-- Name: idx_backup_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_logs_status ON public.backup_logs USING btree (status);


--
-- Name: idx_backup_settings_singleton; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_backup_settings_singleton ON public.backup_settings USING btree (((id IS NOT NULL)));


--
-- Name: idx_bogo_offers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bogo_offers_active ON public.bogo_offers USING btree (is_active, start_date, end_date);


--
-- Name: idx_bogo_offers_buy_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bogo_offers_buy_product ON public.bogo_offers USING btree (buy_product_id);


--
-- Name: idx_bogo_offers_buy_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bogo_offers_buy_variant ON public.bogo_offers USING btree (buy_variant_id);


--
-- Name: idx_cart_items_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_user_id ON public.cart_items USING btree (user_id);


--
-- Name: idx_cart_items_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_items_variant_id ON public.cart_items USING btree (variant_id);


--
-- Name: idx_cash_sessions_cashier_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_sessions_cashier_status ON public.cash_sessions USING btree (cashier_id, status);


--
-- Name: idx_cash_sessions_store_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cash_sessions_store_status ON public.cash_sessions USING btree (store_id, status);


--
-- Name: idx_chat_conversations_guest_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversations_guest_token ON public.chat_conversations USING btree (guest_session_token) WHERE (guest_session_token IS NOT NULL);


--
-- Name: idx_chat_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversations_status ON public.chat_conversations USING btree (status);


--
-- Name: idx_chat_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conversations_user_id ON public.chat_conversations USING btree (user_id);


--
-- Name: idx_chat_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages USING btree (conversation_id);


--
-- Name: idx_chat_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_messages_created_at ON public.chat_messages USING btree (created_at);


--
-- Name: idx_cloud_backups_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cloud_backups_created_at ON public.cloud_backups USING btree (created_at DESC);


--
-- Name: idx_cloud_backups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cloud_backups_status ON public.cloud_backups USING btree (status);


--
-- Name: idx_combo_offer_items_combo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_combo_offer_items_combo ON public.combo_offer_items USING btree (combo_offer_id);


--
-- Name: idx_combo_offer_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_combo_offer_items_product ON public.combo_offer_items USING btree (product_id);


--
-- Name: idx_combo_offers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_combo_offers_active ON public.combo_offers USING btree (is_active);


--
-- Name: idx_contacts_custom_price_tier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_custom_price_tier_id ON public.contacts USING btree (custom_price_tier_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_is_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_is_customer ON public.contacts USING btree (is_customer) WHERE (is_customer = true);


--
-- Name: idx_contacts_is_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_is_supplier ON public.contacts USING btree (is_supplier) WHERE (is_supplier = true);


--
-- Name: idx_contacts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_name ON public.contacts USING btree (name);


--
-- Name: idx_contacts_opening_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_opening_balance ON public.contacts USING btree (opening_balance) WHERE (opening_balance <> (0)::numeric);


--
-- Name: idx_contacts_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_phone ON public.contacts USING btree (phone);


--
-- Name: idx_custom_tier_prices_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_tier_prices_product_id ON public.custom_tier_prices USING btree (product_id);


--
-- Name: idx_custom_tier_prices_tier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_tier_prices_tier_id ON public.custom_tier_prices USING btree (tier_id);


--
-- Name: idx_customer_product_prices_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_prices_customer_id ON public.customer_product_prices USING btree (customer_id);


--
-- Name: idx_customer_product_prices_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customer_product_prices_product_id ON public.customer_product_prices USING btree (product_id);


--
-- Name: idx_expenses_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_account_id ON public.expenses USING btree (account_id);


--
-- Name: idx_expenses_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_contact_id ON public.expenses USING btree (contact_id);


--
-- Name: idx_expenses_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_created_by ON public.expenses USING btree (created_by);


--
-- Name: idx_expenses_store_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_store_date ON public.expenses USING btree (store_id, expense_date);


--
-- Name: idx_favorites_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_favorites_user_id ON public.favorites USING btree (user_id);


--
-- Name: idx_import_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_logs_created_at ON public.import_logs USING btree (created_at DESC);


--
-- Name: idx_import_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_import_logs_status ON public.import_logs USING btree (status);


--
-- Name: idx_inventory_layers_fifo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_layers_fifo ON public.inventory_layers USING btree (product_id, purchased_at) WHERE ((quantity_remaining > (0)::numeric) AND (variant_id IS NULL));


--
-- Name: idx_inventory_layers_fifo_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_layers_fifo_lookup ON public.inventory_layers USING btree (product_id, variant_id, purchased_at, created_at) WHERE (quantity_remaining > (0)::numeric);


--
-- Name: idx_inventory_layers_fifo_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_layers_fifo_variant ON public.inventory_layers USING btree (variant_id, purchased_at) WHERE ((quantity_remaining > (0)::numeric) AND (variant_id IS NOT NULL));


--
-- Name: idx_inventory_layers_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_layers_product ON public.inventory_layers USING btree (product_id);


--
-- Name: idx_journal_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_date ON public.journal_entries USING btree (entry_date);


--
-- Name: idx_journal_entries_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_number ON public.journal_entries USING btree (entry_number);


--
-- Name: idx_journal_entries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_status ON public.journal_entries USING btree (status);


--
-- Name: idx_journal_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_account ON public.journal_entry_lines USING btree (account_id);


--
-- Name: idx_journal_lines_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_lines_entry ON public.journal_entry_lines USING btree (journal_entry_id);


--
-- Name: idx_multi_bogo_items_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multi_bogo_items_offer ON public.multi_product_bogo_items USING btree (offer_id);


--
-- Name: idx_multi_bogo_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multi_bogo_items_product ON public.multi_product_bogo_items USING btree (product_id);


--
-- Name: idx_multi_bogo_items_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multi_bogo_items_variant ON public.multi_product_bogo_items USING btree (variant_id);


--
-- Name: idx_multi_bogo_offers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_multi_bogo_offers_active ON public.multi_product_bogo_offers USING btree (is_active, start_date, end_date);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_updated_at ON public.orders USING btree (updated_at DESC);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_pos_chat_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_chat_messages_created_at ON public.pos_chat_messages USING btree (created_at DESC);


--
-- Name: idx_pos_todos_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_todos_completed ON public.pos_todos USING btree (is_completed, remind_at);


--
-- Name: idx_pos_todos_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_todos_created_at ON public.pos_todos USING btree (created_at DESC);


--
-- Name: idx_pos_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_transactions_created_at ON public.pos_transactions USING btree (created_at DESC);


--
-- Name: idx_product_variants_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_product_id ON public.product_variants USING btree (product_id);


--
-- Name: idx_production_outputs_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_outputs_product ON public.production_outputs USING btree (product_id);


--
-- Name: idx_production_outputs_production; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_outputs_production ON public.production_outputs USING btree (production_id);


--
-- Name: idx_production_outputs_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_production_outputs_variant ON public.production_outputs USING btree (variant_id);


--
-- Name: idx_productions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productions_date ON public.productions USING btree (production_date);


--
-- Name: idx_productions_source_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productions_source_product ON public.productions USING btree (source_product_id);


--
-- Name: idx_productions_source_variant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_productions_source_variant ON public.productions USING btree (source_variant_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_products_barcode ON public.products USING btree (barcode) WHERE (barcode IS NOT NULL);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_products_is_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_is_available ON public.products USING btree (is_available);


--
-- Name: idx_products_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_store_id ON public.products USING btree (store_id);


--
-- Name: idx_products_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_supplier_id ON public.products USING btree (supplier_id);


--
-- Name: idx_purchase_order_charges_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_charges_po_id ON public.purchase_order_charges USING btree (purchase_order_id);


--
-- Name: idx_purchase_order_items_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_items_po_id ON public.purchase_order_items USING btree (purchase_order_id);


--
-- Name: idx_purchase_order_responses_po_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_order_responses_po_id ON public.purchase_order_responses USING btree (purchase_order_id);


--
-- Name: idx_purchase_orders_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_share_token ON public.purchase_orders USING btree (share_token);


--
-- Name: idx_purchase_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_status ON public.purchase_orders USING btree (status);


--
-- Name: idx_purchase_orders_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_store_id ON public.purchase_orders USING btree (store_id);


--
-- Name: idx_purchase_orders_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_supplier_id ON public.purchase_orders USING btree (supplier_id);


--
-- Name: idx_purchases_payment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_payment_status ON public.purchases USING btree (payment_status);


--
-- Name: idx_purchases_store_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchases_store_date ON public.purchases USING btree (store_id, purchased_at);


--
-- Name: idx_quotations_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_contact_id ON public.quotations USING btree (contact_id);


--
-- Name: idx_quotations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_created_at ON public.quotations USING btree (created_at);


--
-- Name: idx_quotations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quotations_status ON public.quotations USING btree (status);


--
-- Name: idx_special_offers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_special_offers_active ON public.special_offers USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_stock_adjustments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_created_at ON public.stock_adjustments USING btree (created_at DESC);


--
-- Name: idx_stock_adjustments_layer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_layer ON public.stock_adjustments USING btree (inventory_layer_id);


--
-- Name: idx_stock_adjustments_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_product ON public.stock_adjustments USING btree (product_id);


--
-- Name: idx_stock_adjustments_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_product_id ON public.stock_adjustments USING btree (product_id);


--
-- Name: idx_stock_adjustments_store_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_store_id ON public.stock_adjustments USING btree (store_id);


--
-- Name: idx_supplier_payments_purchase_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supplier_payments_purchase_id ON public.supplier_payments USING btree (purchase_id);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_role ON public.user_roles USING btree (role);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_wishlist_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_product_id ON public.wishlist USING btree (product_id);


--
-- Name: idx_wishlist_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_user_id ON public.wishlist USING btree (user_id);


--
-- Name: contacts create_contact_ledger_accounts_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_contact_ledger_accounts_trigger BEFORE INSERT OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.create_contact_ledger_accounts();


--
-- Name: expenses create_expense_journal; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER create_expense_journal AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.create_expense_journal_entry();


--
-- Name: orders deduct_stock_on_order_delivered_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deduct_stock_on_order_delivered_trigger AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_order_delivered();


--
-- Name: purchase_items deduct_stock_on_purchase_item_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deduct_stock_on_purchase_item_delete_trigger BEFORE DELETE ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_purchase_item_delete();


--
-- Name: pos_transactions deduct_stock_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deduct_stock_trigger AFTER INSERT OR UPDATE OF items ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_simple();


--
-- Name: orders delete_order_journal_entry_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER delete_order_journal_entry_trigger AFTER DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.delete_order_journal_entry();


--
-- Name: pos_transactions delete_pos_journal_entry_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER delete_pos_journal_entry_trigger AFTER DELETE ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.delete_pos_journal_entry();


--
-- Name: order_items gm_reconcile_delivered_order_item_stock_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER gm_reconcile_delivered_order_item_stock_trigger AFTER INSERT OR DELETE OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.gm_reconcile_delivered_order_item_stock();


--
-- Name: orders gm_restore_stock_on_delivered_order_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER gm_restore_stock_on_delivered_order_delete_trigger BEFORE DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.gm_restore_stock_on_delivered_order_delete();


--
-- Name: orders handle_online_order_journal_entry_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_online_order_journal_entry_trigger AFTER DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_online_order_journal_entry();


--
-- Name: pos_transactions handle_pos_journal_entry_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_pos_journal_entry_trigger AFTER INSERT OR DELETE OR UPDATE ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.handle_pos_journal_entry();


--
-- Name: payment_receipts payment_receipt_journal_entry_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_receipt_journal_entry_trigger AFTER INSERT OR DELETE OR UPDATE ON public.payment_receipts FOR EACH ROW EXECUTE FUNCTION public.create_payment_receipt_journal_entry();


--
-- Name: supplier_payments post_supplier_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER post_supplier_payment AFTER INSERT ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.create_supplier_payment_journal_entry();


--
-- Name: purchases purchase_accounting_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER purchase_accounting_trigger AFTER INSERT OR DELETE OR UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.create_purchase_journal_entry();


--
-- Name: pos_transactions restore_stock_on_delete_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER restore_stock_on_delete_trigger AFTER DELETE ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_transaction_delete();


--
-- Name: cash_sessions trigger_cash_register_closing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cash_register_closing AFTER UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.create_cash_register_closing_entry();


--
-- Name: cash_sessions trigger_cash_register_opening; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cash_register_opening AFTER INSERT ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.create_cash_register_opening_entry();


--
-- Name: purchase_items trigger_sync_product_local_charges; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_product_local_charges AFTER INSERT OR UPDATE ON public.purchase_items FOR EACH ROW WHEN (((new.local_charges IS NOT NULL) AND (new.local_charges > (0)::numeric))) EXECUTE FUNCTION public.sync_product_local_charges();


--
-- Name: chat_messages trigger_update_conversation_last_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_last_message AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: supplier_payments trigger_update_purchase_payment_status_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_payment_status_delete AFTER DELETE ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.update_purchase_payment_status_on_delete();


--
-- Name: supplier_payments trigger_update_purchase_payment_status_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_payment_status_insert AFTER INSERT ON public.supplier_payments FOR EACH ROW EXECUTE FUNCTION public.update_purchase_payment_status();


--
-- Name: supplier_payments trigger_update_purchase_payment_status_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_purchase_payment_status_update AFTER UPDATE ON public.supplier_payments FOR EACH ROW WHEN (((old.purchase_id IS DISTINCT FROM new.purchase_id) OR (old.amount IS DISTINCT FROM new.amount) OR (old.payment_method IS DISTINCT FROM new.payment_method))) EXECUTE FUNCTION public.update_purchase_payment_status();


--
-- Name: journal_entry_lines update_account_balance_on_post; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_account_balance_on_post AFTER INSERT OR DELETE OR UPDATE ON public.journal_entry_lines FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();


--
-- Name: journal_entries update_account_balance_on_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_account_balance_on_status_change AFTER UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_on_status_change();


--
-- Name: accounts update_accounts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: addresses update_addresses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: announcements update_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: backup_settings update_backup_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_backup_settings_updated_at BEFORE UPDATE ON public.backup_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bogo_offers update_bogo_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bogo_offers_updated_at BEFORE UPDATE ON public.bogo_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cart_items update_cart_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cart_items_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cash_sessions update_cash_sessions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cash_sessions_updated_at BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: categories update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cloud_backups update_cloud_backups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_cloud_backups_updated_at BEFORE UPDATE ON public.cloud_backups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: combo_offers update_combo_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_combo_offers_updated_at BEFORE UPDATE ON public.combo_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custom_price_tiers update_custom_price_tiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_custom_price_tiers_updated_at BEFORE UPDATE ON public.custom_price_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: custom_tier_prices update_custom_tier_prices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_custom_tier_prices_updated_at BEFORE UPDATE ON public.custom_tier_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customer_product_prices update_customer_product_prices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customer_product_prices_updated_at BEFORE UPDATE ON public.customer_product_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: expenses update_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: journal_entries update_journal_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: multi_product_bogo_offers update_multi_product_bogo_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_multi_product_bogo_offers_updated_at BEFORE UPDATE ON public.multi_product_bogo_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: offers update_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payment_methods update_payment_methods_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON public.payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pos_sticky_notes update_pos_sticky_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pos_sticky_notes_updated_at BEFORE UPDATE ON public.pos_sticky_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pos_todos update_pos_todos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pos_todos_updated_at BEFORE UPDATE ON public.pos_todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: pos_transactions update_pos_transactions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pos_transactions_updated_at BEFORE UPDATE ON public.pos_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_product_online_availability_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_online_availability_trigger BEFORE UPDATE OF stock_quantity ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_online_availability_by_stock();


--
-- Name: purchase_items update_product_supplier_on_purchase; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_supplier_on_purchase AFTER INSERT ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.update_product_supplier();


--
-- Name: product_variants update_product_variants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchases update_purchases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: quotations update_quotations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: settings update_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: special_offers update_special_offers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_special_offers_updated_at BEFORE UPDATE ON public.special_offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_items update_stock_on_purchase_item_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stock_on_purchase_item_update_trigger BEFORE UPDATE ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_purchase_item_update();


--
-- Name: purchase_items update_stock_on_purchase_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stock_on_purchase_trigger AFTER INSERT ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_purchase();


--
-- Name: stores update_stores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: accounts accounts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: accounts accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.accounts(id);


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: analytics_events analytics_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: backup_logs backup_logs_triggered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: bogo_offers bogo_offers_buy_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bogo_offers
    ADD CONSTRAINT bogo_offers_buy_product_id_fkey FOREIGN KEY (buy_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: bogo_offers bogo_offers_buy_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bogo_offers
    ADD CONSTRAINT bogo_offers_buy_variant_id_fkey FOREIGN KEY (buy_variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: bogo_offers bogo_offers_get_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bogo_offers
    ADD CONSTRAINT bogo_offers_get_product_id_fkey FOREIGN KEY (get_product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: bogo_offers bogo_offers_get_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bogo_offers
    ADD CONSTRAINT bogo_offers_get_variant_id_fkey FOREIGN KEY (get_variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: cart_items cart_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: cash_sessions cash_sessions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_sessions
    ADD CONSTRAINT cash_sessions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: cloud_backups cloud_backups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: combo_offer_items combo_offer_items_combo_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_offer_items
    ADD CONSTRAINT combo_offer_items_combo_offer_id_fkey FOREIGN KEY (combo_offer_id) REFERENCES public.combo_offers(id) ON DELETE CASCADE;


--
-- Name: combo_offer_items combo_offer_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_offer_items
    ADD CONSTRAINT combo_offer_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: combo_offer_items combo_offer_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.combo_offer_items
    ADD CONSTRAINT combo_offer_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: contacts contacts_custom_price_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_custom_price_tier_id_fkey FOREIGN KEY (custom_price_tier_id) REFERENCES public.custom_price_tiers(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_customer_ledger_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_customer_ledger_account_id_fkey FOREIGN KEY (customer_ledger_account_id) REFERENCES public.accounts(id);


--
-- Name: contacts contacts_supplier_ledger_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_supplier_ledger_account_id_fkey FOREIGN KEY (supplier_ledger_account_id) REFERENCES public.accounts(id);


--
-- Name: custom_tier_prices custom_tier_prices_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_tier_prices
    ADD CONSTRAINT custom_tier_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: custom_tier_prices custom_tier_prices_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_tier_prices
    ADD CONSTRAINT custom_tier_prices_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.custom_price_tiers(id) ON DELETE CASCADE;


--
-- Name: customer_product_prices customer_product_prices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_prices
    ADD CONSTRAINT customer_product_prices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: customer_product_prices customer_product_prices_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_product_prices
    ADD CONSTRAINT customer_product_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_paid_from_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_paid_from_account_id_fkey FOREIGN KEY (paid_from_account_id) REFERENCES public.accounts(id);


--
-- Name: expenses expenses_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: favorites favorites_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: import_logs import_logs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_logs
    ADD CONSTRAINT import_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE SET NULL;


--
-- Name: inventory_layers inventory_layers_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_layers
    ADD CONSTRAINT inventory_layers_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_layers inventory_layers_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_layers
    ADD CONSTRAINT inventory_layers_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


--
-- Name: inventory_layers inventory_layers_purchase_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_layers
    ADD CONSTRAINT inventory_layers_purchase_item_id_fkey FOREIGN KEY (purchase_item_id) REFERENCES public.purchase_items(id) ON DELETE SET NULL;


--
-- Name: inventory_layers inventory_layers_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_layers
    ADD CONSTRAINT inventory_layers_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: journal_entries journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: journal_entries journal_entries_posted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: journal_entry_lines journal_entry_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: journal_entry_lines journal_entry_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: multi_product_bogo_items multi_product_bogo_items_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_bogo_items
    ADD CONSTRAINT multi_product_bogo_items_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.multi_product_bogo_offers(id) ON DELETE CASCADE;


--
-- Name: multi_product_bogo_items multi_product_bogo_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_bogo_items
    ADD CONSTRAINT multi_product_bogo_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: multi_product_bogo_items multi_product_bogo_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.multi_product_bogo_items
    ADD CONSTRAINT multi_product_bogo_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: orders orders_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE RESTRICT;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.contacts(id);


--
-- Name: orders orders_payment_method_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE RESTRICT;


--
-- Name: orders orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE RESTRICT;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: payment_methods payment_methods_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: payment_receipts payment_receipts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_receipts
    ADD CONSTRAINT payment_receipts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: payment_receipts payment_receipts_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: payment_receipts payment_receipts_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_receipts
    ADD CONSTRAINT payment_receipts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: pos_transactions pos_transactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_transactions
    ADD CONSTRAINT pos_transactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.contacts(id);


--
-- Name: pos_transactions pos_transactions_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_transactions
    ADD CONSTRAINT pos_transactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: pos_users pos_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: production_outputs production_outputs_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT production_outputs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: production_outputs production_outputs_production_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT production_outputs_production_id_fkey FOREIGN KEY (production_id) REFERENCES public.productions(id) ON DELETE CASCADE;


--
-- Name: production_outputs production_outputs_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_outputs
    ADD CONSTRAINT production_outputs_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: productions productions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: productions productions_source_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productions
    ADD CONSTRAINT productions_source_product_id_fkey FOREIGN KEY (source_product_id) REFERENCES public.products(id);


--
-- Name: productions productions_source_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productions
    ADD CONSTRAINT productions_source_variant_id_fkey FOREIGN KEY (source_variant_id) REFERENCES public.product_variants(id);


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products products_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.contacts(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: purchase_items purchase_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE;


--
-- Name: purchase_items purchase_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);


--
-- Name: purchase_order_charges purchase_order_charges_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_charges
    ADD CONSTRAINT purchase_order_charges_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: purchase_order_responses purchase_order_responses_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_responses
    ADD CONSTRAINT purchase_order_responses_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.purchase_order_items(id) ON DELETE CASCADE;


--
-- Name: purchase_order_responses purchase_order_responses_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_responses
    ADD CONSTRAINT purchase_order_responses_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: purchases purchases_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: quotations quotations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: quotations quotations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: stock_adjustments stock_adjustments_adjusted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: stock_adjustments stock_adjustments_inventory_layer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_inventory_layer_id_fkey FOREIGN KEY (inventory_layer_id) REFERENCES public.inventory_layers(id);


--
-- Name: stock_adjustments stock_adjustments_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: stock_adjustments stock_adjustments_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: stock_adjustments stock_adjustments_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE CASCADE;


--
-- Name: supplier_payments supplier_payments_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: supplier_payments supplier_payments_paid_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: supplier_payments supplier_payments_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE SET NULL;


--
-- Name: supplier_payments supplier_payments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payments
    ADD CONSTRAINT supplier_payments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: wishlist wishlist_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlist wishlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--


--
-- Name: order_items Admin order items allowed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin order items allowed" ON public.order_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: backup_logs Admin users can create backup logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin users can create backup logs" ON public.backup_logs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: backup_settings Admin users can update backup settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin users can update backup settings" ON public.backup_settings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: backup_logs Admin users can view backup logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin users can view backup logs" ON public.backup_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: backup_settings Admin users can view backup settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin users can view backup settings" ON public.backup_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: chat_messages Admins and cashiers can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and cashiers can send messages" ON public.chat_messages FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: chat_messages Admins and cashiers can update messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and cashiers can update messages" ON public.chat_messages FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: chat_messages Admins and cashiers can view all messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and cashiers can view all messages" ON public.chat_messages FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: cloud_backups Admins can create backups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create backups" ON public.cloud_backups FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: chat_conversations Admins can create guest conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create guest conversations" ON public.chat_conversations FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_charges Admins can delete PO charges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete PO charges" ON public.purchase_order_charges FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_items Admins can delete PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete PO items" ON public.purchase_order_items FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: accounts Admins can delete accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete accounts" ON public.accounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: addresses Admins can delete all addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete all addresses" ON public.addresses FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: announcements Admins can delete announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete announcements" ON public.announcements FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_transactions Admins can delete any pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete any pos transactions" ON public.pos_transactions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cloud_backups Admins can delete backups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete backups" ON public.cloud_backups FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: bogo_offers Admins can delete bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete bogo offers" ON public.bogo_offers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Admins can delete categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_messages Admins can delete chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete chat messages" ON public.chat_messages FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offer_items Admins can delete combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete combo offer items" ON public.combo_offer_items FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offers Admins can delete combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete combo offers" ON public.combo_offers FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contacts Admins can delete contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_conversations Admins can delete conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete conversations" ON public.chat_conversations FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_price_tiers Admins can delete custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete custom price tiers" ON public.custom_price_tiers FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_tier_prices Admins can delete custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete custom tier prices" ON public.custom_tier_prices FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: customer_product_prices Admins can delete customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete customer product prices" ON public.customer_product_prices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: expenses Admins can delete expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete expenses" ON public.expenses FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inventory_layers Admins can delete inventory layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete inventory layers" ON public.inventory_layers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entries Admins can delete journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete journal entries" ON public.journal_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entry_lines Admins can delete journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete journal entry lines" ON public.journal_entry_lines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: offers Admins can delete offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete offers" ON public.offers FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items Admins can delete order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete order items" ON public.order_items FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: orders Admins can delete orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: payment_receipts Admins can delete payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete payment receipts" ON public.payment_receipts FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_chat_messages Admins can delete pos chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete pos chat" ON public.pos_chat_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_users Admins can delete pos users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete pos users" ON public.pos_users FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_variants Admins can delete product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete product variants" ON public.product_variants FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: production_outputs Admins can delete production outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete production outputs" ON public.production_outputs FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: productions Admins can delete productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete productions" ON public.productions FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can delete products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: purchase_items Admins can delete purchase items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete purchase items" ON public.purchase_items FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_orders Admins can delete purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete purchase orders" ON public.purchase_orders FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchases Admins can delete purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete purchases" ON public.purchases FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: special_offers Admins can delete special offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete special offers" ON public.special_offers FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stock_adjustments Admins can delete stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete stock adjustments" ON public.stock_adjustments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: supplier_payments Admins can delete supplier payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete supplier payments" ON public.supplier_payments FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_charges Admins can insert PO charges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert PO charges" ON public.purchase_order_charges FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_items Admins can insert PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert PO items" ON public.purchase_order_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: accounts Admins can insert accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: addresses Admins can insert addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert addresses" ON public.addresses FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: announcements Admins can insert announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert announcements" ON public.announcements FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: bogo_offers Admins can insert bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert bogo offers" ON public.bogo_offers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cash_sessions Admins can insert cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert cash sessions" ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Admins can insert categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert categories" ON public.categories FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offer_items Admins can insert combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert combo offer items" ON public.combo_offer_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offers Admins can insert combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert combo offers" ON public.combo_offers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contacts Admins can insert contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_price_tiers Admins can insert custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert custom price tiers" ON public.custom_price_tiers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_tier_prices Admins can insert custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert custom tier prices" ON public.custom_tier_prices FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: customer_product_prices Admins can insert customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert customer product prices" ON public.customer_product_prices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: expenses Admins can insert expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert expenses" ON public.expenses FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: import_logs Admins can insert import logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert import logs" ON public.import_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inventory_layers Admins can insert inventory layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert inventory layers" ON public.inventory_layers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entries Admins can insert journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert journal entries" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entry_lines Admins can insert journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert journal entry lines" ON public.journal_entry_lines FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: offers Admins can insert offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert offers" ON public.offers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: payment_receipts Admins can insert payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert payment receipts" ON public.payment_receipts FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_transactions Admins can insert pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert pos transactions" ON public.pos_transactions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_users Admins can insert pos users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert pos users" ON public.pos_users FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_variants Admins can insert product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert product variants" ON public.product_variants FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: production_outputs Admins can insert production outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert production outputs" ON public.production_outputs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: productions Admins can insert productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert productions" ON public.productions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can insert products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: purchase_items Admins can insert purchase items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert purchase items" ON public.purchase_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_orders Admins can insert purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchases Admins can insert purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert purchases" ON public.purchases FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: settings Admins can insert settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert settings" ON public.settings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: special_offers Admins can insert special offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert special offers" ON public.special_offers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stock_adjustments Admins can insert stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert stock adjustments" ON public.stock_adjustments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: supplier_payments Admins can insert supplier payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert supplier payments" ON public.supplier_payments FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: addresses Admins can manage addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage addresses" ON public.addresses TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can manage all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage all roles" ON public.user_roles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: profiles Admins can manage profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage profiles" ON public.profiles TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_charges Admins can update PO charges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update PO charges" ON public.purchase_order_charges FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_items Admins can update PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update PO items" ON public.purchase_order_items FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: accounts Admins can update accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update accounts" ON public.accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: addresses Admins can update all addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all addresses" ON public.addresses FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_conversations Admins can update all conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all conversations" ON public.chat_conversations FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Admins can update all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all orders" ON public.orders FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: profiles Admins can update all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: announcements Admins can update announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update announcements" ON public.announcements FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cloud_backups Admins can update backups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update backups" ON public.cloud_backups FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: bogo_offers Admins can update bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update bogo offers" ON public.bogo_offers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cash_sessions Admins can update cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update cash sessions" ON public.cash_sessions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Admins can update categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offer_items Admins can update combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update combo offer items" ON public.combo_offer_items FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offers Admins can update combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update combo offers" ON public.combo_offers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contacts Admins can update contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_conversations Admins can update conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update conversations" ON public.chat_conversations FOR UPDATE USING ((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'admin'::text))));


--
-- Name: custom_price_tiers Admins can update custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update custom price tiers" ON public.custom_price_tiers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_tier_prices Admins can update custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update custom tier prices" ON public.custom_tier_prices FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: customer_product_prices Admins can update customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update customer product prices" ON public.customer_product_prices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: expenses Admins can update expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update expenses" ON public.expenses FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inventory_layers Admins can update inventory layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update inventory layers" ON public.inventory_layers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entries Admins can update journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update journal entries" ON public.journal_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entry_lines Admins can update journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update journal entry lines" ON public.journal_entry_lines FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: offers Admins can update offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update offers" ON public.offers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items Admins can update order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update order items" ON public.order_items FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: orders Admins can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'cashier'::public.app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'cashier'::public.app_role]))))));


--
-- Name: payment_receipts Admins can update payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update payment receipts" ON public.payment_receipts FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_transactions Admins can update pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update pos transactions" ON public.pos_transactions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_users Admins can update pos users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update pos users" ON public.pos_users FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_variants Admins can update product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update product variants" ON public.product_variants FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: production_outputs Admins can update production outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update production outputs" ON public.production_outputs FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: productions Admins can update productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update productions" ON public.productions FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can update products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: purchase_items Admins can update purchase items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update purchase items" ON public.purchase_items FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_orders Admins can update purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update purchase orders" ON public.purchase_orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchases Admins can update purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update purchases" ON public.purchases FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: settings Admins can update settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update settings" ON public.settings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: special_offers Admins can update special offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update special offers" ON public.special_offers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stock_adjustments Admins can update stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update stock adjustments" ON public.stock_adjustments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: supplier_payments Admins can update supplier payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update supplier payments" ON public.supplier_payments FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_charges Admins can view all PO charges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all PO charges" ON public.purchase_order_charges FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_items Admins can view all PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all PO items" ON public.purchase_order_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_order_responses Admins can view all PO responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all PO responses" ON public.purchase_order_responses FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: accounts Admins can view all accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all accounts" ON public.accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: addresses Admins can view all addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all addresses" ON public.addresses FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: analytics_events Admins can view all analytics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all analytics" ON public.analytics_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: announcements Admins can view all announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all announcements" ON public.announcements FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cloud_backups Admins can view all backups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all backups" ON public.cloud_backups FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: bogo_offers Admins can view all bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all bogo offers" ON public.bogo_offers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: cash_sessions Admins can view all cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all cash sessions" ON public.cash_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: categories Admins can view all categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all categories" ON public.categories FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offer_items Admins can view all combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all combo offer items" ON public.combo_offer_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: combo_offers Admins can view all combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all combo offers" ON public.combo_offers FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: contacts Admins can view all contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all contacts" ON public.contacts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_conversations Admins can view all conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all conversations" ON public.chat_conversations FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_price_tiers Admins can view all custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all custom price tiers" ON public.custom_price_tiers FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: custom_tier_prices Admins can view all custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all custom tier prices" ON public.custom_tier_prices FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: customer_product_prices Admins can view all customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all customer product prices" ON public.customer_product_prices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: expenses Admins can view all expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all expenses" ON public.expenses FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: inventory_layers Admins can view all inventory layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all inventory layers" ON public.inventory_layers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entries Admins can view all journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all journal entries" ON public.journal_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: journal_entry_lines Admins can view all journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all journal entry lines" ON public.journal_entry_lines FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: offers Admins can view all offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all offers" ON public.offers FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: order_items Admins can view all order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'cashier'::public.app_role]))))));


--
-- Name: orders Admins can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'cashier'::public.app_role]))))));


--
-- Name: payment_receipts Admins can view all payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all payment receipts" ON public.payment_receipts FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_transactions Admins can view all pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all pos transactions" ON public.pos_transactions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: pos_users Admins can view all pos users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all pos users" ON public.pos_users FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: product_variants Admins can view all product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all product variants" ON public.product_variants FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: production_outputs Admins can view all production outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all production outputs" ON public.production_outputs FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: productions Admins can view all productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all productions" ON public.productions FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: products Admins can view all products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all products" ON public.products FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_items Admins can view all purchase items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all purchase items" ON public.purchase_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchase_orders Admins can view all purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all purchase orders" ON public.purchase_orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: purchases Admins can view all purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all purchases" ON public.purchases FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: stock_adjustments Admins can view all stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all stock adjustments" ON public.stock_adjustments FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: supplier_payments Admins can view all supplier payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all supplier payments" ON public.supplier_payments FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: import_logs Admins can view import logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view import logs" ON public.import_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: settings Admins can view settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view settings" ON public.settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))));


--
-- Name: quotations Allow admin full access to quotations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin full access to quotations" ON public.quotations USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: orders Allow authenticated order creation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated order creation" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: orders Allow guest order creation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow guest order creation" ON public.orders FOR INSERT TO anon WITH CHECK (true);


--
-- Name: multi_product_bogo_items Allow read access to multi_product_bogo_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to multi_product_bogo_items" ON public.multi_product_bogo_items FOR SELECT USING (true);


--
-- Name: multi_product_bogo_offers Allow read access to multi_product_bogo_offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to multi_product_bogo_offers" ON public.multi_product_bogo_offers FOR SELECT USING (true);


--
-- Name: order_items Allow viewing order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow viewing order items" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND ((orders.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.user_roles
          WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role)))))))));


--
-- Name: announcements Anyone can view active announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active announcements" ON public.announcements FOR SELECT USING (((is_active = true) AND (start_date <= now()) AND (end_date >= now())));


--
-- Name: bogo_offers Anyone can view active bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active bogo offers" ON public.bogo_offers FOR SELECT USING (((is_active = true) AND (start_date <= now()) AND (end_date >= now()) AND ((max_total_uses IS NULL) OR (current_uses < max_total_uses))));


--
-- Name: categories Anyone can view active categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active categories" ON public.categories FOR SELECT USING ((is_active = true));


--
-- Name: combo_offer_items Anyone can view active combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active combo offer items" ON public.combo_offer_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.combo_offers
  WHERE ((combo_offers.id = combo_offer_items.combo_offer_id) AND (combo_offers.is_active = true)))));


--
-- Name: combo_offers Anyone can view active combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active combo offers" ON public.combo_offers FOR SELECT USING ((is_active = true));


--
-- Name: offers Anyone can view active offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active offers" ON public.offers FOR SELECT USING (((is_active = true) AND (start_date <= now()) AND (end_date >= now())));


--
-- Name: stores Anyone can view active stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active stores" ON public.stores FOR SELECT USING ((is_active = true));


--
-- Name: product_variants Anyone can view available product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view available product variants" ON public.product_variants FOR SELECT USING ((is_available = true));


--
-- Name: products Anyone can view available products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view available products" ON public.products FOR SELECT USING ((is_available = true));


--
-- Name: special_offers Anyone can view special offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view special offers" ON public.special_offers FOR SELECT USING (true);


--
-- Name: pos_sticky_notes Authenticated can delete sticky notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can delete sticky notes" ON public.pos_sticky_notes FOR DELETE TO authenticated USING (true);


--
-- Name: pos_sticky_notes Authenticated can insert sticky notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can insert sticky notes" ON public.pos_sticky_notes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: pos_sticky_notes Authenticated can update sticky notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can update sticky notes" ON public.pos_sticky_notes FOR UPDATE TO authenticated USING (true);


--
-- Name: pos_sticky_notes Authenticated can view sticky notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated can view sticky notes" ON public.pos_sticky_notes FOR SELECT TO authenticated USING (true);


--
-- Name: order_items Authenticated order items allowed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated order items allowed" ON public.order_items FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: orders Authenticated user orders allowed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated user orders allowed" ON public.orders FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_conversations Authenticated users can create own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create own conversations" ON public.chat_conversations FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));


--
-- Name: chat_conversations Cashiers can create conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can create conversations" ON public.chat_conversations FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: accounts Cashiers can delete accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete accounts" ON public.accounts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: addresses Cashiers can delete addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete addresses" ON public.addresses FOR DELETE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: announcements Cashiers can delete announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete announcements" ON public.announcements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: bogo_offers Cashiers can delete bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete bogo offers" ON public.bogo_offers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: categories Cashiers can delete categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: chat_messages Cashiers can delete chat messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete chat messages" ON public.chat_messages FOR DELETE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offer_items Cashiers can delete combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete combo offer items" ON public.combo_offer_items FOR DELETE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offers Cashiers can delete combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete combo offers" ON public.combo_offers FOR DELETE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: contacts Cashiers can delete contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: chat_conversations Cashiers can delete conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete conversations" ON public.chat_conversations FOR DELETE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_price_tiers Cashiers can delete custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete custom price tiers" ON public.custom_price_tiers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_tier_prices Cashiers can delete custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete custom tier prices" ON public.custom_tier_prices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: customer_product_prices Cashiers can delete customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete customer product prices" ON public.customer_product_prices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: expenses Cashiers can delete expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entries Cashiers can delete journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete journal entries" ON public.journal_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entry_lines Cashiers can delete journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete journal entry lines" ON public.journal_entry_lines FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: offers Cashiers can delete offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete offers" ON public.offers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: orders Cashiers can delete orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchases Cashiers can delete own purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete own purchases" ON public.purchases FOR DELETE USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (purchased_by = auth.uid())));


--
-- Name: payment_receipts Cashiers can delete payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete payment receipts" ON public.payment_receipts FOR DELETE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: product_variants Cashiers can delete product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete product variants" ON public.product_variants FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: products Cashiers can delete products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: stock_adjustments Cashiers can delete stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete stock adjustments" ON public.stock_adjustments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: supplier_payments Cashiers can delete supplier payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete supplier payments" ON public.supplier_payments FOR DELETE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: pos_transactions Cashiers can delete their own pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can delete their own pos transactions" ON public.pos_transactions FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (cashier_id = auth.uid())));


--
-- Name: purchase_order_charges Cashiers can insert PO charges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert PO charges" ON public.purchase_order_charges FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_order_items Cashiers can insert PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert PO items" ON public.purchase_order_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: accounts Cashiers can insert accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: addresses Cashiers can insert addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert addresses" ON public.addresses FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: announcements Cashiers can insert announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: bogo_offers Cashiers can insert bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert bogo offers" ON public.bogo_offers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: cash_sessions Cashiers can insert cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert cash sessions" ON public.cash_sessions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: categories Cashiers can insert categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offer_items Cashiers can insert combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert combo offer items" ON public.combo_offer_items FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offers Cashiers can insert combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert combo offers" ON public.combo_offers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: contacts Cashiers can insert contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_price_tiers Cashiers can insert custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert custom price tiers" ON public.custom_price_tiers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_tier_prices Cashiers can insert custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert custom tier prices" ON public.custom_tier_prices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: customer_product_prices Cashiers can insert customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert customer product prices" ON public.customer_product_prices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: expenses Cashiers can insert expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert expenses" ON public.expenses FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (created_by = auth.uid())));


--
-- Name: inventory_layers Cashiers can insert inventory layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert inventory layers" ON public.inventory_layers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entries Cashiers can insert journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert journal entries" ON public.journal_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entry_lines Cashiers can insert journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert journal entry lines" ON public.journal_entry_lines FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: offers Cashiers can insert offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert offers" ON public.offers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: payment_receipts Cashiers can insert payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert payment receipts" ON public.payment_receipts FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (received_by = auth.uid())));


--
-- Name: pos_transactions Cashiers can insert pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert pos transactions" ON public.pos_transactions FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (cashier_id = auth.uid())));


--
-- Name: product_variants Cashiers can insert product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert product variants" ON public.product_variants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: production_outputs Cashiers can insert production outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert production outputs" ON public.production_outputs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: productions Cashiers can insert productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert productions" ON public.productions FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: products Cashiers can insert products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_orders Cashiers can insert purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert purchase orders" ON public.purchase_orders FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchases Cashiers can insert purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert purchases" ON public.purchases FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (purchased_by = auth.uid())));


--
-- Name: stock_adjustments Cashiers can insert stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert stock adjustments" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: supplier_payments Cashiers can insert supplier payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can insert supplier payments" ON public.supplier_payments FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (paid_by = auth.uid())));


--
-- Name: purchase_order_charges Cashiers can update PO charges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update PO charges" ON public.purchase_order_charges FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_order_items Cashiers can update PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update PO items" ON public.purchase_order_items FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: accounts Cashiers can update accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update accounts" ON public.accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: addresses Cashiers can update addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update addresses" ON public.addresses FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: announcements Cashiers can update announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update announcements" ON public.announcements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: bogo_offers Cashiers can update bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update bogo offers" ON public.bogo_offers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: categories Cashiers can update categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offer_items Cashiers can update combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update combo offer items" ON public.combo_offer_items FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offers Cashiers can update combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update combo offers" ON public.combo_offers FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: contacts Cashiers can update contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update contacts" ON public.contacts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: chat_conversations Cashiers can update conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update conversations" ON public.chat_conversations FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_price_tiers Cashiers can update custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update custom price tiers" ON public.custom_price_tiers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_tier_prices Cashiers can update custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update custom tier prices" ON public.custom_tier_prices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: customer_product_prices Cashiers can update customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update customer product prices" ON public.customer_product_prices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: expenses Cashiers can update expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: inventory_layers Cashiers can update inventory layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update inventory layers" ON public.inventory_layers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entries Cashiers can update journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update journal entries" ON public.journal_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entry_lines Cashiers can update journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update journal entry lines" ON public.journal_entry_lines FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: offers Cashiers can update offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update offers" ON public.offers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: cash_sessions Cashiers can update open cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update open cash sessions" ON public.cash_sessions FOR UPDATE USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (status = 'open'::text)));


--
-- Name: orders Cashiers can update orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchases Cashiers can update own purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update own purchases" ON public.purchases FOR UPDATE USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (purchased_by = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (purchased_by = auth.uid())));


--
-- Name: payment_receipts Cashiers can update payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update payment receipts" ON public.payment_receipts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: product_variants Cashiers can update product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update product variants" ON public.product_variants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: production_outputs Cashiers can update production outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update production outputs" ON public.production_outputs FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: productions Cashiers can update productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update productions" ON public.productions FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: products Cashiers can update products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_orders Cashiers can update purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update purchase orders" ON public.purchase_orders FOR UPDATE USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: stock_adjustments Cashiers can update stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update stock adjustments" ON public.stock_adjustments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: pos_transactions Cashiers can update their own pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can update their own pos transactions" ON public.pos_transactions FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (cashier_id = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (cashier_id = auth.uid())));


--
-- Name: purchase_order_charges Cashiers can view PO charges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view PO charges" ON public.purchase_order_charges FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_order_items Cashiers can view PO items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view PO items" ON public.purchase_order_items FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_order_responses Cashiers can view PO responses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view PO responses" ON public.purchase_order_responses FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: accounts Cashiers can view accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view accounts" ON public.accounts FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: addresses Cashiers can view all addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view all addresses" ON public.addresses FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: cash_sessions Cashiers can view all cash sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view all cash sessions" ON public.cash_sessions FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: chat_conversations Cashiers can view all conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view all conversations" ON public.chat_conversations FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: orders Cashiers can view all orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: profiles Cashiers can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: product_variants Cashiers can view available product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view available product variants" ON public.product_variants FOR SELECT USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (is_available = true)));


--
-- Name: products Cashiers can view available products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view available products" ON public.products FOR SELECT USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (is_available = true)));


--
-- Name: bogo_offers Cashiers can view bogo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view bogo offers" ON public.bogo_offers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offer_items Cashiers can view combo offer items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view combo offer items" ON public.combo_offer_items FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: combo_offers Cashiers can view combo offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view combo offers" ON public.combo_offers FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: contacts Cashiers can view contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view contacts" ON public.contacts FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_price_tiers Cashiers can view custom price tiers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view custom price tiers" ON public.custom_price_tiers FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: custom_tier_prices Cashiers can view custom tier prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view custom tier prices" ON public.custom_tier_prices FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: customer_product_prices Cashiers can view customer product prices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view customer product prices" ON public.customer_product_prices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: expenses Cashiers can view expenses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view expenses" ON public.expenses FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: inventory_layers Cashiers can view inventory layers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view inventory layers" ON public.inventory_layers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entries Cashiers can view journal entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view journal entries" ON public.journal_entries FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: journal_entry_lines Cashiers can view journal entry lines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view journal entry lines" ON public.journal_entry_lines FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: pos_users Cashiers can view own pos user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view own pos user" ON public.pos_users FOR SELECT TO authenticated USING (((user_id = auth.uid()) AND public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: payment_receipts Cashiers can view payment receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view payment receipts" ON public.payment_receipts FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: product_variants Cashiers can view product variants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view product variants" ON public.product_variants FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: production_outputs Cashiers can view production outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view production outputs" ON public.production_outputs FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: productions Cashiers can view productions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view productions" ON public.productions FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: products Cashiers can view products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view products" ON public.products FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_items Cashiers can view purchase items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view purchase items" ON public.purchase_items FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchase_orders Cashiers can view purchase orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view purchase orders" ON public.purchase_orders FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: purchases Cashiers can view purchases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view purchases" ON public.purchases FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: stock_adjustments Cashiers can view stock adjustments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view stock adjustments" ON public.stock_adjustments FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: stores Cashiers can view stores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view stores" ON public.stores FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: supplier_payments Cashiers can view supplier payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view supplier payments" ON public.supplier_payments FOR SELECT USING (public.has_role(auth.uid(), 'cashier'::public.app_role));


--
-- Name: pos_transactions Cashiers can view their own pos transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cashiers can view their own pos transactions" ON public.pos_transactions FOR SELECT USING ((public.has_role(auth.uid(), 'cashier'::public.app_role) AND (cashier_id = auth.uid())));


--
-- Name: analytics_events Deny anonymous access to analytics_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to analytics_events" ON public.analytics_events FOR SELECT USING (false);


--
-- Name: cart_items Deny anonymous access to cart_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to cart_items" ON public.cart_items FOR SELECT TO anon USING (false);


--
-- Name: favorites Deny anonymous access to favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to favorites" ON public.favorites FOR SELECT TO anon USING (false);


--
-- Name: payment_methods Deny anonymous access to payment_methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny anonymous access to payment_methods" ON public.payment_methods FOR SELECT TO anon USING (false);


--
-- Name: order_items Guest order items allowed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guest order items allowed" ON public.order_items FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id IS NULL)))));


--
-- Name: orders Guest orders allowed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guest orders allowed" ON public.orders FOR INSERT WITH CHECK ((user_id IS NULL));


--
-- Name: chat_conversations Guests can create their own conversation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Guests can create their own conversation" ON public.chat_conversations FOR INSERT TO anon WITH CHECK (((auth.uid() IS NULL) AND (user_id IS NULL) AND (customer_name IS NOT NULL) AND (customer_phone IS NOT NULL) AND (guest_session_token IS NOT NULL)));


--
-- Name: settings Public can view basic settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view basic settings" ON public.settings FOR SELECT USING (true);


--
-- Name: pos_todos Staff can delete pos todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can delete pos todos" ON public.pos_todos FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: pos_todos Staff can insert pos todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can insert pos todos" ON public.pos_todos FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: multi_product_bogo_items Staff can manage multi_product_bogo_items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage multi_product_bogo_items" ON public.multi_product_bogo_items TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: multi_product_bogo_offers Staff can manage multi_product_bogo_offers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage multi_product_bogo_offers" ON public.multi_product_bogo_offers TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: pos_chat_messages Staff can read pos chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can read pos chat" ON public.pos_chat_messages FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: pos_chat_messages Staff can send pos chat; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can send pos chat" ON public.pos_chat_messages FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: pos_todos Staff can update pos todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can update pos todos" ON public.pos_todos FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: pos_todos Staff can view pos todos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can view pos todos" ON public.pos_todos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'cashier'::public.app_role)));


--
-- Name: favorites Users can add their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add their own favorites" ON public.favorites FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: cart_items Users can add to their own cart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add to their own cart" ON public.cart_items FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: wishlist Users can add to their wishlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add to their wishlist" ON public.wishlist FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: cart_items Users can delete from their own cart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete from their own cart" ON public.cart_items FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: addresses Users can delete their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own addresses" ON public.addresses FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: payment_methods Users can delete their own payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own payment methods" ON public.payment_methods FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: addresses Users can insert their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own addresses" ON public.addresses FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: payment_methods Users can insert their own payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own payment methods" ON public.payment_methods FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: wishlist Users can remove from their wishlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove from their wishlist" ON public.wishlist FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: favorites Users can remove their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can remove their own favorites" ON public.favorites FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: chat_messages Users can send messages to their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages to their conversations" ON public.chat_messages FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.chat_conversations c
  WHERE ((c.id = chat_messages.conversation_id) AND (c.user_id = auth.uid()))))));


--
-- Name: analytics_events Users can track their own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can track their own events" ON public.analytics_events FOR INSERT WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND (NOT (role IS DISTINCT FROM ( SELECT p.role
   FROM public.profiles p
  WHERE (p.id = auth.uid()))))));


--
-- Name: addresses Users can update their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own addresses" ON public.addresses FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: cart_items Users can update their own cart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own cart" ON public.cart_items FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: orders Users can update their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own orders" ON public.orders FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (status = ANY (ARRAY['pending'::text, 'confirmed'::text]))));


--
-- Name: payment_methods Users can update their own payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own payment methods" ON public.payment_methods FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: chat_messages Users can view messages in their conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages FOR SELECT USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.chat_conversations c
  WHERE ((c.id = chat_messages.conversation_id) AND (c.user_id = auth.uid()))))));


--
-- Name: chat_conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT USING (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: order_items Users can view their order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their order items" ON public.order_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.orders
  WHERE ((orders.id = order_items.order_id) AND (orders.user_id = auth.uid())))));


--
-- Name: orders Users can view their orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their orders" ON public.orders FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = 'admin'::public.app_role))))));


--
-- Name: addresses Users can view their own addresses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own addresses" ON public.addresses FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: cart_items Users can view their own cart; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own cart" ON public.cart_items FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: favorites Users can view their own favorites; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own favorites" ON public.favorites FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: orders Users can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: payment_methods Users can view their own payment methods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own payment methods" ON public.payment_methods FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: wishlist Users can view their own wishlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own wishlist" ON public.wishlist FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: bogo_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bogo_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

--
-- Name: cash_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: cloud_backups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cloud_backups ENABLE ROW LEVEL SECURITY;

--
-- Name: combo_offer_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.combo_offer_items ENABLE ROW LEVEL SECURITY;

--
-- Name: combo_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.combo_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_price_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_price_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: custom_tier_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.custom_tier_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_product_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_product_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: favorites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

--
-- Name: import_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_layers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_layers ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: journal_entry_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: multi_product_bogo_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.multi_product_bogo_items ENABLE ROW LEVEL SECURITY;

--
-- Name: multi_product_bogo_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.multi_product_bogo_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_methods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: pos_chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pos_chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: pos_sticky_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pos_sticky_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: pos_todos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pos_todos ENABLE ROW LEVEL SECURITY;

--
-- Name: pos_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: pos_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pos_users ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: production_outputs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_outputs ENABLE ROW LEVEL SECURITY;

--
-- Name: productions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_charges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_charges ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_order_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: quotations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: special_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: stock_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: stores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

--
-- Name: supplier_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



