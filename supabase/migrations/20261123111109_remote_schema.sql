SET local check_function_bodies = off;

CREATE EXTENSION "pg_trgm" SCHEMA "public";

CREATE TABLE "public"."claims" (
  "session_id" text NOT NULL,
  "item_id"    uuid NOT NULL,
  "member_id"  uuid NOT NULL,
  "value"      text NOT NULL,
  CONSTRAINT "claims_pkey" PRIMARY KEY (item_id, member_id)
);

ALTER TABLE "public"."claims"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."claims"
  REPLICA IDENTITY FULL;

CREATE TABLE "public"."connections" (
  "user_id"    uuid                     NOT NULL,
  "friend_id"  uuid                     NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "connections_pkey" PRIMARY KEY (user_id, friend_id)
);

ALTER TABLE "public"."connections"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."items" (
  "id"             uuid    NOT NULL DEFAULT gen_random_uuid(),
  "session_id"     text    NOT NULL,
  "name"           text    NOT NULL,
  "qty"            numeric NOT NULL,
  "price"          numeric NOT NULL,
  "tax_preset_id"  uuid,
  "apply_sc"       boolean DEFAULT true,
  "apply_discount" boolean DEFAULT true,
  "discount_type"  text    DEFAULT 'none'::text,
  "discount_value" numeric DEFAULT 0,
  CONSTRAINT "items_pkey" PRIMARY KEY (id),
  CONSTRAINT "items_price_nonnegative" CHECK ((price >= (0)::numeric)),
  CONSTRAINT "items_qty_positive" CHECK ((qty > (0)::numeric))
);

ALTER TABLE "public"."items"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."items"
  REPLICA IDENTITY FULL;

CREATE TABLE "public"."ledger" (
  "id"                     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "session_id"             text                     NOT NULL,
  "creditor_id"            uuid,
  "debtor_id"              uuid,
  "creditor_fallback_name" text,
  "debtor_fallback_name"   text,
  "amount"                 numeric                  NOT NULL,
  "settled"                boolean                  DEFAULT false,
  "created_at"             timestamp with time zone DEFAULT now(),
  CONSTRAINT "ledger_amount_nonnegative" CHECK ((amount >= (0)::numeric)),
  CONSTRAINT "ledger_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."ledger"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."members" (
  "id"          uuid    NOT NULL DEFAULT gen_random_uuid(),
  "session_id"  text    NOT NULL,
  "name"        text    NOT NULL,
  "user_id"     uuid,
  "paid_amount" numeric DEFAULT 0,
  CONSTRAINT "members_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."members"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."members"
  REPLICA IDENTITY FULL;

CREATE TABLE "public"."profiles" (
  "id"              uuid                     NOT NULL,
  "name"            text,
  "avatar_url"      text,
  "created_at"      timestamp with time zone DEFAULT now(),
  "upi_id"          text,
  "updated_at"      timestamp with time zone DEFAULT now(),
  "phone"           text,
  "email"           text,
  "ai_scans_used"   integer                  DEFAULT 0,
  "pro_expires_at"  timestamp with time zone,
  "last_scan_reset" timestamp with time zone DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sessions" (
  "id"                      text                     NOT NULL,
  "status"                  text                     DEFAULT 'draft'::text,
  "pin"                     text,
  "host_id"                 uuid,
  "is_sc_applicable"        boolean                  DEFAULT false,
  "service_charge_rate"     numeric                  DEFAULT 0,
  "sc_tax_preset_id"        text,
  "discount_type"           text                     DEFAULT 'none'::text,
  "discount_value"          numeric,
  "discount_mode"           text                     DEFAULT 'post-tax'::text,
  "venue_name"              text,
  "created_at"              timestamp with time zone DEFAULT now(),
  "name"                    text,
  "post_tax_discount_type"  text                     DEFAULT 'none'::text,
  "post_tax_discount_value" numeric                  DEFAULT 0,
  CONSTRAINT "sessions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tax_presets" (
  "id"         uuid    NOT NULL DEFAULT gen_random_uuid(),
  "session_id" text    NOT NULL,
  "name"       text    NOT NULL,
  "rate"       numeric NOT NULL,
  "split"      boolean DEFAULT true,
  CONSTRAINT "tax_presets_pkey" PRIMARY KEY (id),
  CONSTRAINT "tax_presets_rate_valid" CHECK (((rate >= (0)::numeric) AND (rate <= (100)::numeric)))
);

ALTER TABLE "public"."tax_presets"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tax_presets"
  REPLICA IDENTITY FULL;

CREATE TABLE "public"."venues" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                text                     NOT NULL,
  "normalized_name"     text                     NOT NULL,
  "service_charge_rate" numeric                  DEFAULT 0,
  "tax_presets"         jsonb                    DEFAULT '[]'::jsonb,
  "times_used"          integer                  DEFAULT 1,
  "last_updated_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "venues_name_key" UNIQUE (name),
  CONSTRAINT "venues_normalized_name_key" UNIQUE (normalized_name),
  CONSTRAINT "venues_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."venues"
  ENABLE ROW LEVEL SECURITY;

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

REVOKE ALL ON FUNCTION "public"."delete_user_account"() FROM PUBLIC, "anon";

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
BEGIN
  -- Only allow service_role (Edge Functions / Admin SQL) to modify pro_expires_at
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' != 'service_role' THEN
    IF NEW.pro_expires_at IS DISTINCT FROM OLD.pro_expires_at THEN
      RAISE EXCEPTION 'Unauthorized modification of subscription status.';
    END IF;
    -- Prevent client from decrementing ai_scans_used unless month rolled over
    IF NEW.ai_scans_used < OLD.ai_scans_used AND
       EXTRACT(MONTH FROM now()) = EXTRACT(MONTH FROM OLD.last_scan_reset) AND
       EXTRACT(YEAR FROM now()) = EXTRACT(YEAR FROM OLD.last_scan_reset) THEN
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

REVOKE ALL ON FUNCTION "public"."prune_stale_data"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
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
  WHERE LOWER(trim(s.venue_name)) = LOWER(trim(p_venue_name))
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

ALTER TABLE "public"."connections"
  ADD CONSTRAINT "connections_friend_id_fkey" FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."connections"
  ADD CONSTRAINT "connections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."claims"
  ADD CONSTRAINT "claims_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE CASCADE;

ALTER TABLE "public"."claims"
  ADD CONSTRAINT "claims_member_id_fkey" FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."ledger"
  ADD CONSTRAINT "ledger_creditor_id_fkey" FOREIGN KEY (creditor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."ledger"
  ADD CONSTRAINT "ledger_debtor_id_fkey" FOREIGN KEY (debtor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."members"
  ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_host_id_fkey" FOREIGN KEY (host_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."claims"
  ADD CONSTRAINT "claims_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."items"
  ADD CONSTRAINT "items_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."ledger"
  ADD CONSTRAINT "ledger_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."members"
  ADD CONSTRAINT "members_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

ALTER TABLE "public"."items"
  ADD CONSTRAINT "items_tax_preset_id_fkey" FOREIGN KEY (tax_preset_id) REFERENCES public.tax_presets(id) ON DELETE SET NULL;

ALTER TABLE "public"."tax_presets"
  ADD CONSTRAINT "tax_presets_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;

CREATE VIEW "public"."global_ledger" WITH (security_invoker=true) AS  SELECT l.debtor_id,
    COALESCE(dp.name, l.debtor_fallback_name) AS debtor_name,
    l.creditor_id,
    COALESCE(cp.name, l.creditor_fallback_name) AS creditor_name,
    sum(l.amount) AS total_owed
   FROM ((public.ledger l
     LEFT JOIN public.profiles dp ON ((l.debtor_id = dp.id)))
     LEFT JOIN public.profiles cp ON ((l.creditor_id = cp.id)))
  WHERE (l.settled = false)
  GROUP BY l.debtor_id, dp.name, l.debtor_fallback_name, l.creditor_id, cp.name, l.creditor_fallback_name;

REVOKE ALL ON TABLE "public"."global_ledger" FROM "anon";

CREATE VIEW "public"."personal_analytics" WITH (security_invoker=true) AS  WITH user_venue_spend AS (
         SELECT l.debtor_id AS user_id,
            COALESCE(NULLIF(TRIM(BOTH FROM s.venue_name), ''::text), s.name, 'Dining Session'::text) AS venue_name,
            s.id AS session_id,
            l.amount AS spent
           FROM (public.ledger l
             JOIN public.sessions s ON ((l.session_id = s.id)))
          WHERE ((l.settled = true) AND (l.debtor_id IS NOT NULL))
        UNION ALL
         SELECT m.user_id,
            COALESCE(NULLIF(TRIM(BOTH FROM s.venue_name), ''::text), s.name, 'Dining Session'::text) AS venue_name,
            s.id AS session_id,
            GREATEST((0)::numeric, (m.paid_amount - COALESCE(( SELECT sum(l2.amount) AS sum
                   FROM public.ledger l2
                  WHERE ((l2.session_id = s.id) AND (l2.creditor_id = m.user_id))), (0)::numeric))) AS spent
           FROM (public.members m
             JOIN public.sessions s ON ((m.session_id = s.id)))
          WHERE ((s.status = 'locked'::text) AND (m.user_id IS NOT NULL) AND (m.paid_amount > (0)::numeric))
        )
 SELECT user_id,
    venue_name,
    count(DISTINCT session_id) AS visits,
    sum(spent) AS total_spent
   FROM user_venue_spend
  WHERE (spent > (0)::numeric)
  GROUP BY user_id, venue_name;

REVOKE ALL ON TABLE "public"."personal_analytics" FROM "anon";

CREATE INDEX idx_claims_session_id ON public.claims USING btree (session_id);

CREATE INDEX idx_connections_friend_id ON public.connections USING btree (friend_id);

CREATE UNIQUE INDEX idx_connections_unique_pair ON public.connections USING btree (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));

CREATE INDEX idx_items_name_trgm ON public.items USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_items_session_id ON public.items USING btree (session_id);

CREATE INDEX idx_items_tax_preset_id ON public.items USING btree (tax_preset_id);

CREATE INDEX idx_ledger_creditor_unsettled ON public.ledger USING btree (creditor_id)
  WHERE (settled = false);

CREATE INDEX idx_ledger_debtor_settled ON public.ledger USING btree (debtor_id)
  WHERE (settled = true);

CREATE INDEX idx_ledger_debtor_unsettled ON public.ledger USING btree (debtor_id)
  WHERE (settled = false);

CREATE INDEX idx_ledger_session_id ON public.ledger USING btree (session_id);

CREATE INDEX idx_members_session_id ON public.members USING btree (session_id);

CREATE INDEX idx_members_user_id ON public.members USING btree (user_id)
  WHERE (user_id IS NOT NULL);

CREATE INDEX idx_profiles_name_trgm ON public.profiles USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_sessions_host_created ON public.sessions USING btree (host_id, created_at DESC);

CREATE INDEX idx_sessions_host_id ON public.sessions USING btree (host_id);

CREATE INDEX idx_sessions_venue_name ON public.sessions USING btree (venue_name);

CREATE INDEX idx_tax_presets_session_id ON public.tax_presets USING btree (session_id);

CREATE INDEX idx_venues_name_trgm ON public.venues USING gin (name public.gin_trgm_ops);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trigger_lock_guard_claims
  BEFORE INSERT OR DELETE OR UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_lock_integrity();

CREATE TRIGGER trigger_lock_guard_items
  BEFORE INSERT OR DELETE OR UPDATE ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_lock_integrity();

CREATE TRIGGER trigger_protect_profile_billing
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_billing_columns();

CREATE TRIGGER trigger_harvest_venue
  AFTER UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.harvest_venue_data();

CREATE TRIGGER trigger_lock_guard_tax_presets
  BEFORE INSERT OR DELETE OR UPDATE ON public.tax_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_lock_integrity();

CREATE POLICY "Claims Mutate" ON "public"."claims"
  FOR ALL
  TO PUBLIC
  USING ((auth.uid() IS NOT NULL))
  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Claims Select" ON "public"."claims"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Create connections" ON "public"."connections"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((auth.uid() = user_id) OR (auth.uid() = friend_id)));

CREATE POLICY "Delete own connections" ON "public"."connections"
  FOR DELETE
  TO PUBLIC
  USING (((auth.uid() = user_id) OR (auth.uid() = friend_id)));

CREATE POLICY "View own connections" ON "public"."connections"
  FOR SELECT
  TO PUBLIC
  USING (((auth.uid() = user_id) OR (auth.uid() = friend_id)));

CREATE POLICY "Items Host Mutate" ON "public"."items"
  FOR ALL
  TO PUBLIC
  USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = items.session_id) AND ((s.host_id IS NULL) OR (s.host_id = auth.uid())))))))
  WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = items.session_id) AND ((s.host_id IS NULL) OR (s.host_id = auth.uid())))))));

CREATE POLICY "Items Select" ON "public"."items"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Ledger Host Delete" ON "public"."ledger"
  FOR DELETE
  TO PUBLIC
  USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = ledger.session_id) AND (s.host_id = auth.uid()))))));

CREATE POLICY "Ledger Host Insert" ON "public"."ledger"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = ledger.session_id) AND ((s.host_id IS NULL) OR (s.host_id = auth.uid())))))));

CREATE POLICY "Ledger Participant Update" ON "public"."ledger"
  FOR UPDATE
  TO PUBLIC
  USING (((auth.uid() IS NOT NULL) AND ((creditor_id = auth.uid()) OR (debtor_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = ledger.session_id) AND (s.host_id = auth.uid())))))));

CREATE POLICY "Ledger Select" ON "public"."ledger"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() IS NOT NULL));

CREATE POLICY "Members Delete" ON "public"."members"
  FOR DELETE
  TO PUBLIC
  USING (((auth.uid() IS NOT NULL) AND ((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = members.session_id) AND (s.host_id = auth.uid())))))));

CREATE POLICY "Members Insert" ON "public"."members"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Members Select" ON "public"."members"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Members Update" ON "public"."members"
  FOR UPDATE
  TO PUBLIC
  USING (((auth.uid() IS NOT NULL) AND ((user_id IS NULL) OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = members.session_id) AND (s.host_id = auth.uid())))))));

CREATE POLICY "Authenticated Basic Profile Read" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() IS NOT NULL));

CREATE POLICY "Users can insert their own profile" ON "public"."profiles"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can update their own profile" ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "Sessions Delete Host Only" ON "public"."sessions"
  FOR DELETE
  TO PUBLIC
  USING ((host_id = auth.uid()));

CREATE POLICY "Sessions Insert" ON "public"."sessions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (((auth.uid() IS NOT NULL) AND ((host_id IS NULL) OR (host_id = auth.uid()))));

CREATE POLICY "Sessions Select" ON "public"."sessions"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Sessions Update Host Only" ON "public"."sessions"
  FOR UPDATE
  TO PUBLIC
  USING (((host_id IS NULL) OR (host_id = auth.uid())))
  WITH CHECK (((host_id IS NULL) OR (host_id = auth.uid())));

CREATE POLICY "Tax Presets Host Mutate" ON "public"."tax_presets"
  FOR ALL
  TO PUBLIC
  USING (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = tax_presets.session_id) AND ((s.host_id IS NULL) OR (s.host_id = auth.uid())))))))
  WITH CHECK (((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE ((s.id = tax_presets.session_id) AND ((s.host_id IS NULL) OR (s.host_id = auth.uid())))))));

CREATE POLICY "Tax Presets Select" ON "public"."tax_presets"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Venues are viewable by everyone" ON "public"."venues"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."connections";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."profiles";

COMMENT ON EXTENSION "pg_trgm" IS 'text similarity measurement and index searching based on trigrams';

GRANT EXECUTE ON FUNCTION "public"."delete_user_account"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_user_account"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_user_account"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_user_account"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."enforce_session_lock_integrity"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."enforce_session_lock_integrity"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_session_lock_integrity"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."enforce_session_lock_integrity"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."harvest_venue_data"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."harvest_venue_data"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."harvest_venue_data"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."harvest_venue_data"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."protect_profile_billing_columns"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."protect_profile_billing_columns"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."protect_profile_billing_columns"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."protect_profile_billing_columns"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."prune_stale_data"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."prune_stale_data"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."prune_stale_data"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."prune_stale_data"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."search_venue_items"(text, text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."search_venue_items"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_venue_items"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_venue_items"(text, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."search_venues"(text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."search_venues"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_venues"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."search_venues"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_session_pin"(text, text) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."verify_session_pin"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."verify_session_pin"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."verify_session_pin"(text, text) TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."claims" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."claims" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."claims" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."claims" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."connections" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."connections" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."connections" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."connections" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."items" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."items" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ledger" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."ledger" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ledger" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."ledger" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."members" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."members" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."members" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."members" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tax_presets" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."tax_presets" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tax_presets" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tax_presets" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."venues" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."venues" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."venues" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."venues" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."global_ledger" TO "authenticated";

REVOKE ALL ON TABLE "public"."global_ledger" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."global_ledger" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."global_ledger" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."personal_analytics" TO "authenticated";

REVOKE ALL ON TABLE "public"."personal_analytics" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."personal_analytics" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."personal_analytics" TO "service_role";

