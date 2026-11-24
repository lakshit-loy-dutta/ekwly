# Ekwly — Database Schema, Views, Triggers & RLS Model

> **Source of Truth:** Verified against live export `supabase-complete-audit.sql` and baseline migration `supabase/migrations/20261123111109_remote_schema.sql`.

---

## 1. Tables & Constraints (`public` Schema)

| Table             | Primary Key            | Key Foreign Keys & Cascades                                                                              | Constraints & Replica Identity                                                                                                                                                                                                                                    |
| :---------------- | :--------------------- | :------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`profiles`**    | `id` (`uuid`)          | `id -> auth.users(id) ON DELETE CASCADE`                                                                 | Columns: `name`, `avatar_url`, `upi_id`, `phone`, `email`, `ai_scans_used` (0), `pro_expires_at`, `last_scan_reset`, timestamps                                                                                                                                   |
| **`sessions`**    | `id` (`text`)          | `host_id -> auth.users(id) ON DELETE CASCADE` _(target Stage 2: `ON DELETE SET NULL`)_                   | Columns: `name`, `venue_name`, `pin`, `status` (default `'draft'`), `is_sc_applicable`, `service_charge_rate`, `sc_tax_preset_id`, `discount_type`, `discount_value`, `discount_mode` (default `'post-tax'`), `post_tax_discount_type`, `post_tax_discount_value` |
| **`tax_presets`** | `id` (`uuid`)          | `session_id -> sessions(id) ON DELETE CASCADE`                                                           | `CHECK (rate >= 0 AND rate <= 100)`; `REPLICA IDENTITY FULL`                                                                                                                                                                                                      |
| **`items`**       | `id` (`uuid`)          | `session_id -> sessions(id) ON DELETE CASCADE`; `tax_preset_id -> tax_presets(id) ON DELETE SET NULL`    | `CHECK (qty > 0)`, `CHECK (price >= 0)`; `REPLICA IDENTITY FULL`                                                                                                                                                                                                  |
| **`members`**     | `id` (`uuid`)          | `session_id -> sessions(id) ON DELETE CASCADE`; `user_id -> profiles(id) ON DELETE SET NULL`             | `paid_amount` default `0`; `REPLICA IDENTITY FULL`                                                                                                                                                                                                                |
| **`claims`**      | `(item_id, member_id)` | `item_id -> items(id) CASCADE`; `member_id -> members(id) CASCADE`; `session_id -> sessions(id) CASCADE` | `value` (`text`, stores decimals or fractions like `'1/3'`); `REPLICA IDENTITY FULL`                                                                                                                                                                              |
| **`ledger`**      | `id` (`uuid`)          | `session_id -> sessions(id) CASCADE`; `creditor_id`/`debtor_id -> profiles(id) SET NULL`                 | `CHECK (amount >= 0)`, `settled` default `false`, fallback name columns                                                                                                                                                                                           |
| **`connections`** | `(user_id, friend_id)` | `user_id`/`friend_id -> auth.users(id) CASCADE`                                                          | Unique unordered pair index `idx_connections_unique_pair`                                                                                                                                                                                                         |
| **`venues`**      | `id` (`uuid`)          | None                                                                                                     | Unique `name` and unique `normalized_name`, `service_charge_rate`, `tax_presets` (`jsonb`), `times_used`                                                                                                                                                          |

---

## 2. Views (`security_invoker = true`, `anon` Revoked)

- **`public.global_ledger`:** Aggregates unsettled (`settled = false`) `public.ledger` rows grouped by `(debtor_id, creditor_id)` with `COALESCE(profile.name, fallback_name)` resolution.
- **`public.personal_analytics`:** Unions settled debtor ledger amounts with locked-session net payer spend (`GREATEST(0, paid_amount - sum(creditor ledger))`), grouped by `(user_id, venue_name)`.

---

## 3. Functions, Triggers & Extensions

- **Extensions:** `pg_trgm` (in `public`), `pgcrypto`, `uuid-ossp`, `pg_stat_statements` (in `extensions`), `supabase_vault` (in `vault`).
- **Triggers:**
  - `on_auth_user_created` (`AFTER INSERT ON auth.users`) -> `handle_new_user()` (auto-creates `profiles` row).
  - `trigger_lock_guard_items`, `trigger_lock_guard_claims`, `trigger_lock_guard_tax_presets` (`BEFORE INSERT/UPDATE/DELETE`) -> `enforce_session_lock_integrity()` (blocks edits when `sessions.status = 'locked'`).
  - `trigger_harvest_venue` (`AFTER UPDATE ON sessions`) -> `harvest_venue_data()` (upserts venue tax/SC rules into `venues` when transitioning to `'locked'`).
  - `trigger_protect_profile_billing` (`BEFORE UPDATE ON profiles`) -> `protect_profile_billing_columns()` (**bypassable via `last_scan_reset` — fixed in Stage 1 `AUD-03`**).
  - DDL Event Trigger `ensure_rls` -> `rls_auto_enable()`.
- **RPC Functions (`SECURITY DEFINER`, `search_path = 'public'`):**
  - `verify_session_pin(p_session_id, p_pin)`
  - `search_venues(search_term)` & `search_venue_items(p_venue_name, p_search_term)`
  - `delete_user_account()` (revoked from `PUBLIC`/`anon`, granted to `authenticated`)
  - `prune_stale_data()` (**over-granted to `authenticated` — fixed in Stage 1 `AUD-04`**)

---

## 4. Indexes (18 Current) & Realtime Publication

- **Current Indexes:** `idx_claims_session_id`, `idx_connections_friend_id`, `idx_connections_unique_pair`, `idx_items_name_trgm` (GIN), `idx_items_session_id`, `idx_items_tax_preset_id`, `idx_ledger_creditor_unsettled`, `idx_ledger_debtor_unsettled`, `idx_ledger_debtor_settled`, `idx_ledger_session_id`, `idx_members_session_id`, `idx_members_user_id`, `idx_profiles_name_trgm` (GIN), `idx_sessions_host_id` _(redundant with `idx_sessions_host_created`)_, `idx_sessions_host_created`, `idx_sessions_venue_name`, `idx_tax_presets_session_id`, `idx_venues_name_trgm` (GIN).
- **Planned Additions (Stage 5 — `AUD-13`):** Add `idx_claims_member_id` and functional index on `LOWER(trim(sessions.venue_name))`; drop redundant `idx_sessions_host_id`.
- **Realtime Publication (`supabase_realtime`):** Exported schema includes only `public.connections` and `public.profiles`. Missing all 6 session tables (`sessions`, `items`, `members`, `claims`, `tax_presets`, `ledger`) — fixed in Stage 1 (`AUD-05`).

---

## 5. RLS Posture (Current vs. Stage 2 Target)

| Table                       | Current Exported Policy Risk                                                                                                 | Stage 2 Target Policy                                                                                                                                         |
| :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`sessions`**              | `SELECT USING (true)` exposes all rooms + plaintext `pin`; `UPDATE` permits `host_id IS NULL` without auth check (`AUD-02`). | Isolate `pin` into `session_secrets`; scope `SELECT` to `host_id = auth.uid()` or `is_session_participant(id)`; disallow `host_id IS NULL`.                   |
| **`items` / `tax_presets`** | `SELECT USING (true)` exposes all rooms (`AUD-02`).                                                                          | Scope `SELECT` to `is_session_participant(session_id)`; retain host-only mutation + lock trigger.                                                             |
| **`members` / `claims`**    | `SELECT USING (true)`; any authenticated/anon user can insert members or mutate any room's claims (`AUD-02`).                | Scope `SELECT` and `claims` mutation strictly to `is_session_participant(session_id)`; restrict `members` writes to host (plus self-claim/self-leave).        |
| **`ledger`**                | `SELECT USING (auth.uid() IS NOT NULL)` exposes all users' debts; debtors can update `amount` (`AUD-02`).                    | Scope `SELECT` to `creditor_id = auth.uid() OR debtor_id = auth.uid() OR is_host`; lock immutable columns (`amount`, `creditor_id`, `debtor_id`) via trigger. |
| **`profiles`**              | `SELECT USING (auth.uid() IS NOT NULL)` exposes `email`, `phone`, `upi_id` globally (`AUD-02`).                              | Restrict direct `SELECT` to `id = auth.uid()`; expose a column-safe view/RPC for search, connections, and co-diners.                                          |
| **Table Grants**            | `GRANT ALL` grants `TRUNCATE`/`TRIGGER`/`REFERENCES` to `anon`/`authenticated` (`AUD-11`).                                   | Revoke `TRUNCATE`, `TRIGGER`, `REFERENCES`, `MAINTAIN` from `anon` and `authenticated` (Stage 1).                                                             |
