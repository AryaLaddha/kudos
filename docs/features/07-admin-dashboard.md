# Admin Dashboard

An internal-only panel at `/admin` for monitoring all organizations on the platform and editing per-seat pricing. Uses a dark theme to distinguish it from the main app.

---

## User flow

1. An admin user navigates to `/admin`.
2. If not logged in → redirect to `/admin/login`.
3. If logged in but `is_admin = false` → redirect to `/admin/login`.
4. Dashboard renders with:
   - **Summary stat cards** at the top: total orgs, total users, active users (30 days), total MRR.
   - **Organisations table** below — one row per org with: name, slug, total users, active users, MRR, and a clickable £/seat price cell.
5. Admin clicks a £/seat cell in the table → it becomes an inline editable input.
6. Admin types a new price and presses Enter or clicks away → calls `admin_set_price_per_seat` RPC → price updates in place.
7. Admin can click "← App" in the header to return to `/feed`, or sign out.

---

## How it works

### Auth check (server-side)
The page is a **Server Component**. On every load it:
1. Calls `supabase.auth.getUser()` — redirects to `/admin/login` if no session.
2. Queries `profiles WHERE id = user.id` and checks `is_admin = true` — redirects if false.

### Org stats (`get_admin_dashboard_stats` RPC)
A single RPC call returns one row per organization with:
- `org_id`, `org_name`, `slug`
- `total_users` — count of all profiles in the org
- `active_users_30d` — users who gave or received a recognition in the last 30 days
- `mrr` — `price_per_seat × active_users_30d`
- `price_per_seat` — current pricing for the org

The RPC is defined as `SECURITY DEFINER` so it can read across all orgs regardless of RLS.

### Summary cards
Four stat cards are computed from the org rows in JS:
- **Organisations**: `orgs.length`
- **Total users**: sum of `total_users`
- **Active (30 days)**: sum of `active_users_30d`, with `% of users` sub-label
- **Total MRR**: sum of `mrr`, formatted as GBP (e.g. `£1,200`)

### Org table (`OrgTable` component)
A client component (`src/components/admin/OrgTable.tsx`). Receives the `orgs` array as props.
- Renders a table with a row per org.
- The `£/seat` column is an inline editable cell — clicking it renders an `<input>` pre-filled with the current price.
- On save (Enter or blur), calls `admin_set_price_per_seat(org_id, new_price)` RPC.
- Updates local state optimistically so the table reflects the new price immediately.

---

## Key files

| File | Role |
|------|------|
| `src/app/admin/page.tsx` | Server Component — auth check, data fetch, summary cards |
| `src/app/admin/login/page.tsx` | Admin login page |
| `src/app/admin/layout.tsx` | Admin layout wrapper |
| `src/components/admin/OrgTable.tsx` | Client Component — org table with inline price editing |
| `supabase/schema.sql` → `get_admin_dashboard_stats()` | RPC for cross-org stats |
| `supabase/schema.sql` → `admin_set_price_per_seat()` | RPC for updating pricing |

---

## Data involved

**Reads (via RPC):**
- All `organizations` — name, slug, pricing
- All `profiles` — user counts per org
- `recognitions` — used to compute `active_users_30d`

**Writes (via RPC):**
- `organizations.price_per_seat` — updated when admin saves a new price

---

## Notable details

- Admin access is controlled purely by the `is_admin` boolean on the `profiles` table — there is no separate admin user table or role.
- The `get_admin_dashboard_stats` RPC bypasses RLS (it's `SECURITY DEFINER`) so it can aggregate data across all orgs. Regular users calling it directly would get nothing — the function is restricted by checking the caller's `is_admin` flag internally (or via policy).
- The admin dashboard has a **dark theme** (`bg-slate-950`, `text-white`) to make it visually distinct from the regular app.
- MRR is calculated as `price_per_seat × active_users_30d` — it counts active seats, not total seats.
- The `← App` link in the admin header simply links to `/feed` for quick context-switching.
- There is no pagination on the org table — all orgs load at once. This is acceptable at small scale.
