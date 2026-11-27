-- ============================================================
-- Stage 3B: Atomic Multi-Step RPCs for Ledger Replacement,
-- Session Unlock, Tax Preset Remapping & Splitwise CSV Import
-- Closes: AUD-07 (atomic writes), AUD-29 (atomic CSV import)
-- ============================================================

-- 1. Atomically replace all ledger rows for a session (host-only)
CREATE OR REPLACE FUNCTION public.replace_session_ledger(
  p_session_id text,
  p_entries jsonb
)
  RETURNS SETOF public.ledger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_session_host(p_session_id) THEN
    RAISE EXCEPTION 'Only the room host can write settlement ledger entries.';
  END IF;

  DELETE FROM public.ledger WHERE session_id = p_session_id;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.ledger (
    session_id,
    creditor_id,
    creditor_fallback_name,
    debtor_id,
    debtor_fallback_name,
    amount,
    settled
  )
  SELECT
    p_session_id,
    NULLIF(entry->>'creditor_id', '')::uuid,
    COALESCE(NULLIF(trim(entry->>'creditor_fallback_name'), ''), 'Host'),
    NULLIF(entry->>'debtor_id', '')::uuid,
    COALESCE(NULLIF(trim(entry->>'debtor_fallback_name'), ''), 'Guest'),
    GREATEST(0, COALESCE((entry->>'amount')::numeric, 0)),
    false
  FROM jsonb_array_elements(p_entries) AS entry
  WHERE COALESCE((entry->>'amount')::numeric, 0) > 0
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_session_ledger(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_session_ledger(text, jsonb) TO authenticated, service_role;

-- 2. Atomically unlock a session and clear its draft settlement ledger (host-only)
CREATE OR REPLACE FUNCTION public.unlock_session_room(p_session_id text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_session_host(p_session_id) THEN
    RAISE EXCEPTION 'Only the room host can unlock this session.';
  END IF;

  UPDATE public.sessions SET status = 'draft' WHERE id = p_session_id;
  DELETE FROM public.ledger WHERE session_id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_session_room(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlock_session_room(text) TO authenticated, service_role;

-- 3. Atomically replace session tax presets AND remap existing items by closest rate (prevents ON DELETE SET NULL)
CREATE OR REPLACE FUNCTION public.replace_session_tax_presets(
  p_session_id text,
  p_presets jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_old_ids uuid[];
  v_status text;
BEGIN
  IF NOT public.is_session_host(p_session_id) THEN
    RAISE EXCEPTION 'Only the room host can replace tax brackets.';
  END IF;

  SELECT status INTO v_status FROM public.sessions WHERE id = p_session_id;
  IF v_status = 'locked' THEN
    RAISE EXCEPTION 'This bill is locked. Unlock the room before modifying taxes.';
  END IF;

  IF p_presets IS NULL OR jsonb_typeof(p_presets) <> 'array' OR jsonb_array_length(p_presets) = 0 THEN
    RAISE EXCEPTION 'At least one tax bracket is required.';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_old_ids
  FROM public.tax_presets
  WHERE session_id = p_session_id;

  -- Insert replacement presets first
  INSERT INTO public.tax_presets (id, session_id, name, rate, split)
  SELECT
    COALESCE(NULLIF(entry->>'id', '')::uuid, gen_random_uuid()),
    p_session_id,
    COALESCE(NULLIF(trim(entry->>'name'), ''), 'Tax'),
    LEAST(100, GREATEST(0, COALESCE((entry->>'rate')::numeric, 0))),
    COALESCE((entry->>'split')::boolean, true)
  FROM jsonb_array_elements(p_presets) AS entry;

  -- Remap any existing items from old presets to the closest-rate new preset
  IF array_length(v_old_ids, 1) IS NOT NULL THEN
    UPDATE public.items i
    SET tax_preset_id = (
      SELECT np.id
      FROM public.tax_presets np
      LEFT JOIN public.tax_presets op ON op.id = i.tax_preset_id
      WHERE np.session_id = p_session_id
        AND NOT (np.id = ANY(v_old_ids))
      ORDER BY ABS(np.rate - COALESCE(op.rate, 5)) ASC, np.name ASC
      LIMIT 1
    )
    WHERE i.session_id = p_session_id
      AND i.tax_preset_id = ANY(v_old_ids);

    DELETE FROM public.tax_presets
    WHERE session_id = p_session_id
      AND id = ANY(v_old_ids);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_session_tax_presets(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_session_tax_presets(text, jsonb) TO authenticated, service_role;

-- 4. Atomic Splitwise CSV import (prevents orphaned sessions if ledger insert fails)
CREATE OR REPLACE FUNCTION public.import_splitwise_balances(
  p_session_id text,
  p_entries jsonb
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to import Splitwise balances.';
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.sessions (id, name, venue_name, status, host_id, discount_mode)
  VALUES (p_session_id, 'Splitwise Import', 'Splitwise CSV Migration', 'locked', v_uid, 'pre-tax');

  INSERT INTO public.session_secrets (session_id, pin)
  VALUES (p_session_id, '0000')
  ON CONFLICT (session_id) DO NOTHING;

  INSERT INTO public.ledger (
    session_id,
    creditor_id,
    creditor_fallback_name,
    debtor_id,
    debtor_fallback_name,
    amount,
    settled
  )
  SELECT
    p_session_id,
    CASE WHEN (entry->>'direction') = 'owed_to_me' THEN v_uid ELSE NULL END,
    CASE
      WHEN (entry->>'direction') = 'owed_to_me' THEN COALESCE(NULLIF(trim(entry->>'self_name'), ''), 'Me')
      ELSE COALESCE(NULLIF(trim(entry->>'counterparty_name'), ''), 'Guest')
    END,
    CASE WHEN (entry->>'direction') = 'i_owe' THEN v_uid ELSE NULL END,
    CASE
      WHEN (entry->>'direction') = 'i_owe' THEN COALESCE(NULLIF(trim(entry->>'self_name'), ''), 'Me')
      ELSE COALESCE(NULLIF(trim(entry->>'counterparty_name'), ''), 'Guest')
    END,
    GREATEST(0, COALESCE((entry->>'amount')::numeric, 0)),
    false
  FROM jsonb_array_elements(p_entries) AS entry
  WHERE COALESCE((entry->>'amount')::numeric, 0) > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.import_splitwise_balances(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_splitwise_balances(text, jsonb) TO authenticated, service_role;