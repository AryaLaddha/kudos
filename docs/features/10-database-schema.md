# Database Schema

Kudos uses a Supabase (Postgres) database with Row Level Security on every table. All multi-step data mutations are handled by RPC functions to guarantee atomicity.

Schema file: `supabase/schema.sql`

---

## Tables

### `organizations`
Multi-tenant anchor. Each company is one org.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | Auto-generated |
| `name` | text | Display name (e.g. "Acme Corp") |
| `slug` | text UNIQUE | URL-safe identifier |
| `monthly_allowance` | int | Default 100 — org-level default (not currently used by app logic, profiles have their own) |
| `created_at` | timestamptz | |

---

### `profiles`
One row per user, extends `auth.users` 1-to-1.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK → `auth.users(id)`, cascades on delete |
| `org_id` | uuid | FK → `organizations(id)`, nullable (user may not be in an org yet) |
| `full_name` | text | Display name |
| `avatar_url` | text | Optional profile photo URL |
| `department` | text | Optional e.g. "Engineering" |
| `job_title` | text | Optional e.g. "Lead Engineer" |
| `monthly_allowance` | int | Points remaining to give this month (resets to 200 on 1st) |
| `points_balance` | int | Cumulative points earned all-time (never resets) |
| `is_admin` | boolean | Platform-level admin flag |
| `created_at` | timestamptz | |

**Auto-created** by `handle_new_user()` trigger when a new `auth.users` row is inserted.

---

### `recognitions`
One row per kudos post. For multi-recipient posts, one row per recipient is inserted (same message, same points).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `org_id` | uuid | FK → `organizations` |
| `giver_id` | uuid | FK → `profiles` |
| `receiver_id` | uuid | FK → `profiles` (legacy single-receiver column) |
| `receiver_ids` | uuid[] | Array of all recipient IDs for multi-receiver posts |
| `message` | text | The recognition text (points stripped out) |
| `points` | int | Per-recipient point value. Check: `1 ≤ points ≤ 100` |
| `hashtags` | text[] | Up to 3 tags e.g. `{teamwork,shipping}` |
| `created_at` | timestamptz | |

---

### `comments`
Comments on a recognition, with optional point tip.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `recognition_id` | uuid | FK → `recognitions`, cascades |
| `user_id` | uuid | FK → `profiles` (commenter) |
| `message` | text | Comment text (tip stripped) |
| `points_tip` | int | Tip amount (0 = no tip) |
| `created_at` | timestamptz | |

---

### `reactions`
Emoji reactions. One row per `(recognition, user, emoji)` — enforced by a unique constraint.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `recognition_id` | uuid | FK → `recognitions`, cascades |
| `user_id` | uuid | FK → `profiles`, cascades |
| `emoji` | text | One of: ❤️ 🙌 🚀 🎉 💯 |
| `created_at` | timestamptz | |
| UNIQUE | `(recognition_id, user_id, emoji)` | Prevents duplicate reactions |

---

### `point_transactions`
Full audit log of every point movement. Never modified after insert.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `org_id` | uuid | |
| `user_id` | uuid | Who the transaction belongs to |
| `recognition_id` | uuid | Nullable (null for monthly resets) |
| `amount` | int | Positive = received, Negative = given |
| `kind` | text | `given` / `received` / `monthly_reset` |
| `created_at` | timestamptz | |

---

## Row Level Security (RLS)

All tables have RLS enabled. The helper function `get_my_org_id()` returns the caller's `org_id` from `profiles`.

| Table | Policy | Rule |
|-------|--------|------|
| `organizations` | org members can read | `id = get_my_org_id()` |
| `profiles` | org members can read profiles | `org_id = get_my_org_id()` |
| `profiles` | owner can update own profile | `id = auth.uid()` |
| `profiles` | service role can insert | `true` (for trigger) |
| `recognitions` | org members can read | `org_id = get_my_org_id()` |
| `recognitions` | org members can give | `org_id = get_my_org_id() AND giver_id = auth.uid() AND giver_id <> receiver_id` |
| `reactions` | org members can read | via JOIN to recognitions where `org_id = get_my_org_id()` |
| `reactions` | users can manage own | `user_id = auth.uid()` |
| `comments` | org members can read | via JOIN to recognitions where `org_id = get_my_org_id()` |
| `comments` | users can insert own | `user_id = auth.uid()` |
| `point_transactions` | users can read own | `user_id = auth.uid()` |

---

## Triggers

### `on_auth_user_created`
Fires after every `INSERT` on `auth.users`. Calls `handle_new_user()` which inserts a `profiles` row with `full_name` and `avatar_url` from the user's signup metadata.

---

## RPC Functions

### `send_multi_recognition(p_org_id, p_receivers[], p_message, p_points, p_hashtags)`
Atomically sends kudos to one or more recipients.
1. Computes `total_cost = p_points × len(p_receivers)`.
2. Validates giver has enough `monthly_allowance` — raises `insufficient_points` if not.
3. Deducts `total_cost` from giver's `monthly_allowance`.
4. For each receiver: inserts `recognitions` row, increments receiver's `points_balance`, writes two `point_transactions` rows.

`SECURITY DEFINER` — runs with elevated privileges for the point updates.

---

### `post_comment(p_recognition_id, p_message, p_points_tip)`
Inserts a comment with an optional point tip.
1. If `p_points_tip > 0`: validates allowance, deducts from commenter, credits receiver, writes audit rows.
2. Inserts `comments` row.
3. Returns the comment JSON with commenter's profile attached (for immediate UI update).

`SECURITY DEFINER` — returns `json`.

---

### `reset_monthly_allowances()`
Sets `monthly_allowance = 200` for all profiles. Scheduled via `pg_cron` at `0 0 1 * *` (midnight UTC, 1st of every month).

---

### `get_admin_dashboard_stats()`
Returns one row per organization with: `org_id`, `org_name`, `slug`, `total_users`, `active_users_30d`, `price_per_seat`, `mrr`.

`SECURITY DEFINER` — bypasses RLS to read across all orgs. Used only by the admin dashboard.

---

### `admin_set_price_per_seat(p_org_id, p_price_per_seat)`
Updates `organizations.price_per_seat` for a given org. Used by the admin OrgTable inline editor.

`SECURITY DEFINER` — restricted to admin callers.

---

### `get_my_org_id()`
Helper function used inside RLS policies. Returns the `org_id` of the currently authenticated user. Declared `STABLE` (result is consistent within a transaction).

```sql
select org_id from profiles where id = auth.uid()
```
