# Ekwly — Database Schema, Views, Triggers & RLS Model

> **Source of Truth:** Verified against live export `4-supabase-audit.sql` (Post-Stage 2, November 25, 2026).

---

## 1. Tables & Constraints (`public` Schema)

| Table                      | Primary Key             | Key Foreign Keys & Cascades                                                       | Constraints & Replica Identity                                                                                      |
| :------------------------- | :---------------------- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **`profiles`**             | `id` (`uuid`)           | `id -> auth.users(id) ON DELETE CASCADE`                                          | Billing/quota columns locked to `service_role` by `trigger_protect_profile_billing`                                 |
| **`sessions`**             | `id` (`text`)           | `host_id -> auth.users(id) ON DELETE SET NULL`                                    | Preserves shared rooms/ledgers when a host deletes their account; plaintext `pin` cleared                           |
| **`session_participants`** | `(session_id, user_id)` | `session_id -> sessions(id) CASCADE`; `user_id -> auth.users(id) CASCADE`         | `role CHECK IN ('host', 'member')`; indexed on `user_id`; governs room-scoped RLS                                   |
| **`session_secrets`**      | `session_id` (`text`)   | `session_id -> sessions(id) ON DELETE CASCADE`                                    | Stores room `pin`; readable/writable strictly by room host or `SECURITY DEFINER` RPCs                               |
| **`tax_presets`**          | `id` (`uuid`)           | `session_id -> sessions(id) ON DELETE CASCADE`                                    | `CHECK (rate >= 0 AND rate <= 100)`; `REPLICA IDENTITY FULL`                                                        |
| **`items`**                | `id` (`uuid`)           | `session_id -> sessions(id) CASCADE`; `tax_preset_id -> tax_presets(id) SET NULL` | `CHECK (qty > 0)`, `CHECK (price >= 0)`; `REPLICA IDENTITY FULL`                                                    |
| **`members`**              | `id` (`uuid`)           | `session_id -> sessions(id) CASCADE`; `user_id -> profiles(id) SET NULL`          | `paid_amount` protected by `trigger_protect_member_payment`; `REPLICA IDENTITY FULL`                                |
| **`claims`**               | `(item_id, member_id)`  | `item_id`, `member_id`, `session_id` `ON DELETE CASCADE`                          | `REPLICA IDENTITY FULL`                                                                                             |
| **`ledger`**               | `id` (`uuid`)           | `session_id CASCADE`; `creditor_id`/`debtor_id SET NULL`                          | `CHECK (amount >= 0)`; amounts/counterparties locked by `trigger_protect_ledger_immutable`; `REPLICA IDENTITY FULL` |
| **`connections`**          | `(user_id, friend_id)`  | `user_id`/`friend_id -> auth.users(id) CASCADE`                                   | Unique unordered pair index `idx_connections_unique_pair`                                                           |
| **`venues`**               | `id` (`uuid`)           | None                                                                              | Unique `normalized_name` (redundant `venues_name_key` removed)                                                      |
| **`payment_events`**       | `id` (`uuid`)           | `user_id -> profiles(id) ON DELETE SET NULL`                                      | `UNIQUE(provider_payment_id)`, `CHECK (amount_paise > 0)`; `service_role` only                                      |

---

## 2. Views (`security_invoker = true`, `anon` Revoked)

- **`public.global_ledger`:** Aggregates unsettled (`settled = false`) `public.ledger` rows using `public.get_profile_display_name(uuid)` + fallback names while preserving `security_invoker = true`.
- **`public.personal_analytics`:** Unions settled debtor ledger spend with locked-session net payer spend per `(user_id, venue_name)`.

---

## 3. Functions, RPCs & Triggers (`SET search_path TO 'public'`)

- **Authorization & Room Lifecycle RPCs (`authenticated` + `service_role`):**
  - `create_session_room(p_id, p_pin, p_name)` — atomic session, secret, host participant, host member, and default tax presets creation.
  - `join_session_with_pin(p_session_id, p_pin)` (and alias `verify_session_pin`) — re-admits enrolled participants or verifies `session_secrets.pin` and enrolls caller.
  - `get_host_session_pin(p_session_id)` — returns PIN strictly if `host_id = auth.uid()`.
  - `is_session_host(p_session_id)` & `is_session_participant(p_session_id)` — non-recursive RLS helper predicates.
- **Safe Profile & Discovery RPCs (`authenticated` + `service_role`):**
  - `search_public_profiles(p_query)` — returns `(id, name, avatar_url)` only (never `upi_id`, `email`, or `phone`).
  - `get_related_profiles(p_user_ids)` — returns `(id, name, avatar_url, upi_id)` strictly for self, friends, shared-room participants, or ledger counterparties.
  - `get_profile_display_name(p_user_id)` — display-name resolver for `global_ledger`.
  - `search_venues(search_term)` & `search_venue_items(p_venue_name, p_search_term)` (locked rooms only, `authenticated` only).
- **Privileged `service_role`-Only RPCs (`PUBLIC`/`anon`/`authenticated` Revoked):**
  - `consume_ai_scan_quota(p_user_id, p_monthly_limit)` (`FOR UPDATE` row-locked monthly reset & increment) and `refund_ai_scan_quota(p_user_id)`.
  - `prune_stale_data()` (scheduled server-side via `pg_cron`).
- **Triggers:** `on_auth_user_created`, `trigger_enroll_session_host`, `trigger_enroll_linked_member`, `trigger_harvest_venue`, `trigger_lock_guard_{items,claims,tax_presets}`, `trigger_protect_profile_billing`, `trigger_protect_ledger_immutable`, `trigger_protect_member_payment`, and DDL event trigger `ensure_rls`.

---

## 4. RLS, Least-Privilege Grants & Realtime Publication

- **RLS Enforcement:** All 12 public tables enforce RLS. `anon` has zero table-level privileges on user/session tables (anonymous guests operate under Supabase's `authenticated` role with `is_anonymous = true`). `TRUNCATE`, `TRIGGER`, `REFERENCES`, and `MAINTAIN` are revoked from `anon` and `authenticated`.
- **Realtime Publication (`supabase_realtime`):** All 8 live tables are published — `sessions`, `items`, `members`, `claims`, `tax_presets`, `ledger`, `connections`, and `profiles`.
