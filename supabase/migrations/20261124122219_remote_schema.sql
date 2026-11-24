SET local check_function_bodies = off;

REVOKE ALL ON FUNCTION "public"."prune_stale_data"() FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."search_venue_items"(text, text) FROM "anon";

ALTER TABLE "public"."venues"
  DROP CONSTRAINT "venues_name_key";

ALTER TABLE "public"."ledger"
  REPLICA IDENTITY FULL;

CREATE TABLE "public"."payment_events" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "provider"            text                     NOT NULL DEFAULT 'razorpay'::text,
  "provider_payment_id" text                     NOT NULL,
  "provider_order_id"   text,
  "user_id"             uuid,
  "plan_id"             text                     NOT NULL,
  "amount_paise"        integer                  NOT NULL,
  "currency"            text                     NOT NULL DEFAULT 'INR'::text,
  "event_type"          text                     NOT NULL,
  "processed_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "payment_events_amount_paise_check" CHECK ((amount_paise > 0)),
  CONSTRAINT "payment_events_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_events_provider_payment_id_key" UNIQUE (provider_payment_id)
);

ALTER TABLE "public"."payment_events"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."payment_events" FROM "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."consume_ai_scan_quota"(uuid, integer) FROM PUBLIC, "anon", "authenticated";

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

REVOKE ALL ON FUNCTION "public"."refund_ai_scan_quota"(uuid) FROM PUBLIC, "anon", "authenticated";

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
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sessions
    WHERE id = p_session_id AND pin = p_pin
  );
END;
$function$;

ALTER TABLE "public"."payment_events"
  ADD CONSTRAINT "payment_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."claims";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."items";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."ledger";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."members";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."sessions";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."tax_presets";

REVOKE ALL ON FUNCTION "public"."consume_ai_scan_quota"(uuid, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."consume_ai_scan_quota"(uuid, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."consume_ai_scan_quota"(uuid, integer) TO "service_role";

REVOKE ALL ON FUNCTION "public"."refund_ai_scan_quota"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."refund_ai_scan_quota"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."refund_ai_scan_quota"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."search_venue_items"(text, text) FROM PUBLIC;

REVOKE ALL ON TABLE "public"."claims" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."claims" TO "anon";

REVOKE ALL ON TABLE "public"."claims" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."claims" TO "authenticated";

REVOKE ALL ON TABLE "public"."connections" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."connections" TO "anon";

REVOKE ALL ON TABLE "public"."connections" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."connections" TO "authenticated";

REVOKE ALL ON TABLE "public"."items" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."items" TO "anon";

REVOKE ALL ON TABLE "public"."items" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."items" TO "authenticated";

REVOKE ALL ON TABLE "public"."ledger" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."ledger" TO "anon";

REVOKE ALL ON TABLE "public"."ledger" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."ledger" TO "authenticated";

REVOKE ALL ON TABLE "public"."members" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."members" TO "anon";

REVOKE ALL ON TABLE "public"."members" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."members" TO "authenticated";

REVOKE ALL ON TABLE "public"."payment_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_events" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."profiles" TO "anon";

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."sessions" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."sessions" TO "anon";

REVOKE ALL ON TABLE "public"."sessions" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."sessions" TO "authenticated";

REVOKE ALL ON TABLE "public"."tax_presets" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."tax_presets" TO "anon";

REVOKE ALL ON TABLE "public"."tax_presets" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."tax_presets" TO "authenticated";

REVOKE ALL ON TABLE "public"."venues" FROM "anon";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."venues" TO "anon";

REVOKE ALL ON TABLE "public"."venues" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."venues" TO "authenticated";

REVOKE ALL ON TABLE "public"."global_ledger" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."global_ledger" TO "authenticated";

REVOKE ALL ON TABLE "public"."personal_analytics" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."personal_analytics" TO "authenticated";

