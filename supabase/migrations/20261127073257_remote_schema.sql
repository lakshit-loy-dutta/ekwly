SET local check_function_bodies = off;

DROP FUNCTION "public"."import_splitwise_balances"(text, jsonb);

DROP FUNCTION "public"."replace_session_ledger"(text, jsonb);

DROP FUNCTION "public"."replace_session_tax_presets"(text, jsonb);

DROP FUNCTION "public"."unlock_session_room"(text);

CREATE OR REPLACE FUNCTION public.consume_ai_scan_quota (
  p_user_id       uuid,
  p_monthly_limit integer DEFAULT 3
)
  RETURNS TABLE (
    allowed    boolean,
    is_pro     boolean,
    scans_used integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_scans_used integer;
  v_last_reset timestamptz;
  v_pro_expires_at timestamptz;
  v_now timestamptz := now();
  v_rolled_over boolean;
BEGIN
  SELECT p.ai_scans_used, p.last_scan_reset, p.pro_expires_at
  INTO v_scans_used, v_last_reset, v_pro_expires_at
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found.';
  END IF;

  v_scans_used := COALESCE(v_scans_used, 0);

  v_rolled_over := (
    EXTRACT(YEAR FROM timezone('UTC', v_now)) > EXTRACT(YEAR FROM timezone('UTC', COALESCE(v_last_reset, to_timestamp(0))))
    OR (
      EXTRACT(YEAR FROM timezone('UTC', v_now)) = EXTRACT(YEAR FROM timezone('UTC', COALESCE(v_last_reset, to_timestamp(0))))
      AND EXTRACT(MONTH FROM timezone('UTC', v_now)) > EXTRACT(MONTH FROM timezone('UTC', COALESCE(v_last_reset, to_timestamp(0))))
    )
  );

  IF v_rolled_over THEN
    v_scans_used := 0;
  END IF;

  IF v_pro_expires_at IS NOT NULL AND v_pro_expires_at > v_now THEN
    IF v_rolled_over THEN
      UPDATE public.profiles
      SET ai_scans_used = 0, last_scan_reset = v_now
      WHERE id = p_user_id;
    END IF;
    RETURN QUERY SELECT true, true, v_scans_used;
    RETURN;
  END IF;

  IF v_scans_used >= p_monthly_limit THEN
    IF v_rolled_over THEN
      UPDATE public.profiles
      SET ai_scans_used = 0, last_scan_reset = v_now
      WHERE id = p_user_id;
    END IF;
    RETURN QUERY SELECT false, false, v_scans_used;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    ai_scans_used = v_scans_used + 1,
    last_scan_reset = CASE WHEN v_rolled_over THEN v_now ELSE COALESCE(last_scan_reset, v_now) END
  WHERE id = p_user_id;

  RETURN QUERY SELECT true, false, v_scans_used + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_session_room (
  p_id   text,
  p_pin  text,
  p_name text DEFAULT NULL::text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_host_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create a session.';
  END IF;

  INSERT INTO public.sessions (id, name, status, host_id, discount_mode)
  VALUES (p_id, NULLIF(trim(COALESCE(p_name, '')), ''), 'draft', v_uid, 'pre-tax')
  ON CONFLICT (id) DO NOTHING;

  -- Only initialize secrets/defaults if caller owns the room
  IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = p_id AND host_id = v_uid) THEN
    RAISE EXCEPTION 'Session already exists and is owned by another host.';
  END IF;

  INSERT INTO public.session_secrets (session_id, pin)
  VALUES (p_id, COALESCE(NULLIF(trim(p_pin), ''), '0000'))
  ON CONFLICT (session_id) DO NOTHING;

  INSERT INTO public.session_participants (session_id, user_id, role)
  VALUES (p_id, v_uid, 'host')
  ON CONFLICT (session_id, user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.members WHERE session_id = p_id AND user_id = v_uid) THEN
    SELECT COALESCE(NULLIF(split_part(trim(p.name), ' ', 1), ''), 'Host')
    INTO v_host_name
    FROM public.profiles p
    WHERE p.id = v_uid;

    INSERT INTO public.members (session_id, name, user_id, paid_amount)
    VALUES (p_id, COALESCE(v_host_name, 'Host'), v_uid, 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tax_presets WHERE session_id = p_id) THEN
    INSERT INTO public.tax_presets (session_id, name, rate, split) VALUES
      (p_id, 'Food GST', 5, true),
      (p_id, 'Alcohol VAT', 6, false),
      (p_id, 'Exempt', 0, false);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user_account()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  -- Deleting from auth.users automatically triggers ON DELETE CASCADE 
  -- for their public.profiles row and associated connections.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_session_lock_integrity()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_session_id text;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_session_id := OLD.session_id;
  ELSE
    v_session_id := NEW.session_id;
  END IF;

  SELECT s.status INTO v_status
  FROM public.sessions s
  WHERE s.id = v_session_id;

  IF v_status = 'locked' THEN
    RAISE EXCEPTION 'This bill is locked. Unlock the room before modifying items, taxes, or claims.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enroll_linked_member()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.session_participants (session_id, user_id, role)
    VALUES (NEW.session_id, NEW.user_id, 'member')
    ON CONFLICT (session_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enroll_session_host()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  IF NEW.host_id IS NOT NULL THEN
    INSERT INTO public.session_participants (session_id, user_id, role)
    VALUES (NEW.id, NEW.host_id, 'host')
    ON CONFLICT (session_id, user_id) DO UPDATE SET role = 'host';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_host_session_pin (
  p_session_id text
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT ss.pin
  FROM public.session_secrets ss
  JOIN public.sessions s ON s.id = ss.session_id
  WHERE ss.session_id = p_session_id
    AND s.host_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_display_name (
  p_user_id uuid
)
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT p.name FROM public.profiles p WHERE p.id = p_user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_related_profiles (
  p_user_ids uuid[]
)
  RETURNS TABLE (
    id         uuid,
    name       text,
    avatar_url text,
    upi_id     text
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.avatar_url, p.upi_id
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids)
    AND (
      p.id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.connections c
        WHERE (c.user_id = v_uid AND c.friend_id = p.id)
           OR (c.friend_id = v_uid AND c.user_id = p.id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.session_participants sp1
        JOIN public.session_participants sp2 ON sp1.session_id = sp2.session_id
        WHERE sp1.user_id = v_uid AND sp2.user_id = p.id
      )
      OR EXISTS (
        SELECT 1 FROM public.ledger l
        WHERE (l.creditor_id = v_uid AND l.debtor_id = p.id)
           OR (l.debtor_id = v_uid AND l.creditor_id = p.id)
      )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Guest ' || substr(NEW.id::text, 1, 5)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.harvest_venue_data()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_presets jsonb;
BEGIN
  IF NEW.status = 'locked' AND OLD.status != 'locked' AND NEW.venue_name IS NOT NULL AND trim(NEW.venue_name) != '' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'rate', rate, 'split', split)), '[]'::jsonb)
    INTO v_presets
    FROM public.tax_presets
    WHERE session_id = NEW.id;

    INSERT INTO public.venues (name, normalized_name, service_charge_rate, tax_presets)
    VALUES (
      trim(NEW.venue_name),
      LOWER(REGEXP_REPLACE(NEW.venue_name, '[^a-zA-Z0-9]', '', 'g')),
      COALESCE(NEW.service_charge_rate, 0),
      v_presets
    )
    ON CONFLICT (normalized_name) DO UPDATE
    SET
      name = CASE
        WHEN NEW.venue_name ~ '[A-Z'']' AND venues.name !~ '[A-Z'']' THEN trim(NEW.venue_name)
        ELSE venues.name
      END,
      service_charge_rate = COALESCE(EXCLUDED.service_charge_rate, venues.service_charge_rate),
      tax_presets = CASE
        WHEN jsonb_array_length(EXCLUDED.tax_presets) > 0 THEN EXCLUDED.tax_presets
        ELSE venues.tax_presets
      END,
      times_used = venues.times_used + 1,
      last_updated_at = now();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_session_host (
  p_session_id text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = p_session_id
      AND s.host_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_session_participant (
  p_session_id text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = p_session_id AND s.host_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = p_session_id AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.session_id = p_session_id AND m.user_id = auth.uid()
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.join_session_with_pin (
  p_session_id text,
  p_pin        text DEFAULT NULL::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_valid boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Returning hosts and already-enrolled participants can re-enter without PIN
  IF public.is_session_participant(p_session_id) THEN
    RETURN true;
  END IF;

  IF p_pin IS NULL OR trim(p_pin) = '' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.session_secrets ss
    WHERE ss.session_id = p_session_id AND ss.pin = trim(p_pin)
  ) INTO v_valid;

  IF v_valid THEN
    INSERT INTO public.session_participants (session_id, user_id, role)
    VALUES (p_session_id, v_uid, 'member')
    ON CONFLICT (session_id, user_id) DO NOTHING;
  END IF;

  RETURN v_valid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_ledger_immutable_columns()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_jwt_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND v_jwt_role <> 'service_role' THEN
    IF NEW.session_id IS DISTINCT FROM OLD.session_id
       OR NEW.creditor_id IS DISTINCT FROM OLD.creditor_id
       OR NEW.debtor_id IS DISTINCT FROM OLD.debtor_id
       OR NEW.creditor_fallback_name IS DISTINCT FROM OLD.creditor_fallback_name
       OR NEW.debtor_fallback_name IS DISTINCT FROM OLD.debtor_fallback_name
       OR NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'Ledger amounts and counterparties are immutable; only settled status can be updated.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_member_payment_columns()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_jwt_role text := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND v_jwt_role <> 'service_role'
     AND NOT public.is_session_host(OLD.session_id) THEN
    IF NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
      RAISE EXCEPTION 'Only the room host can update cashier payment amounts.';
    END IF;
    IF NEW.session_id IS DISTINCT FROM OLD.session_id THEN
      RAISE EXCEPTION 'Cannot move member between sessions.';
    END IF;
    IF OLD.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cannot reassign an already-claimed member slot.';
    END IF;
    IF OLD.user_id IS NULL AND NEW.user_id IS NOT NULL AND NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'You can only claim a guest slot for yourself.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_profile_billing_columns()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_jwt_role text;
BEGIN
  v_jwt_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');

  IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND v_jwt_role <> 'service_role' THEN
    IF NEW.pro_expires_at IS DISTINCT FROM OLD.pro_expires_at THEN
      RAISE EXCEPTION 'Unauthorized modification of subscription status.';
    END IF;
    IF NEW.ai_scans_used IS DISTINCT FROM OLD.ai_scans_used
       OR NEW.last_scan_reset IS DISTINCT FROM OLD.last_scan_reset THEN
      RAISE EXCEPTION 'Unauthorized modification of scan quota.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prune_stale_data()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  -- 1. Remove accidental zero/empty claim rows
  DELETE FROM public.claims WHERE trim(value) = '' OR trim(value) = '0';

  -- 2. Delete abandoned draft sessions older than 30 days that have no ledger entries
  DELETE FROM public.sessions s
  WHERE s.status = 'draft'
    AND s.created_at < (now() - INTERVAL '30 days')
    AND NOT EXISTS (SELECT 1 FROM public.ledger l WHERE l.session_id = s.id);

  -- 3. Purge abandoned anonymous auth.users older than 30 days with no sessions or ledger rows
  DELETE FROM auth.users u
  WHERE u.is_anonymous = true
    AND u.created_at < (now() - INTERVAL '30 days')
    AND NOT EXISTS (SELECT 1 FROM public.sessions s WHERE s.host_id = u.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.ledger l
      WHERE l.creditor_id = u.id OR l.debtor_id = u.id
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.refund_ai_scan_quota (
  p_user_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  UPDATE public.profiles
  SET ai_scans_used = GREATEST(0, COALESCE(ai_scans_used, 0) - 1)
  WHERE id = p_user_id
    AND (pro_expires_at IS NULL OR pro_expires_at <= now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_public_profiles (
  p_query text
)
  RETURNS TABLE (
    id         uuid,
    name       text,
    avatar_url text
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_clean text := trim(COALESCE(p_query, ''));
BEGIN
  IF auth.uid() IS NULL OR length(v_clean) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.avatar_url
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND p.name IS NOT NULL
    AND p.name !~* '^Guest\s+[0-9a-f]{5}$'
    AND (p.name % v_clean OR p.name ILIKE '%' || v_clean || '%')
  ORDER BY similarity(p.name, v_clean) DESC, p.name ASC
  LIMIT 8;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_venue_items (
  p_venue_name  text,
  p_search_term text
)
  RETURNS TABLE (
    name  text,
    price numeric
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  RETURN QUERY
  SELECT i.name, i.price
  FROM public.items i
  JOIN public.sessions s ON i.session_id = s.id
  WHERE s.status = 'locked'
    AND LOWER(trim(s.venue_name)) = LOWER(trim(p_venue_name))
    AND (i.name % p_search_term OR i.name ILIKE '%' || p_search_term || '%')
  GROUP BY i.name, i.price
  ORDER BY COUNT(*) DESC, i.name ASC
  LIMIT 5;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_venues (
  search_term text
)
  RETURNS TABLE (
    id                  uuid,
    name                text,
    service_charge_rate numeric,
    tax_presets         jsonb,
    similarity          real
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.name,
    v.service_charge_rate,
    v.tax_presets,
    similarity(v.name, search_term) as similarity
  FROM public.venues v
  -- Match if it's similar OR if it contains the substring (handles short typos)
  WHERE v.name % search_term OR v.name ILIKE '%' || search_term || '%'
  ORDER BY similarity DESC, v.times_used DESC
  LIMIT 5;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_session_pin (
  p_session_id text,
  p_pin        text
)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  SELECT public.join_session_with_pin(p_session_id, p_pin);
$function$;

