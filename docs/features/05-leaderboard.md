# Leaderboard

A monthly ranking of the most-recognised people in the organization, sorted by total points received (recognition points + comment tips) since the first of the current month.

---

## User flow

1. User navigates to `/leaderboard` via the sidebar.
2. They see a ranked list of teammates, showing:
   - Rank position (1st, 2nd, 3rd get gold/silver/bronze styling with Trophy/Medal icons; 4th+ show a number)
   - Avatar, name, job title
   - Total points received this month
   - Number of recognitions received this month
3. If no one has received any recognition this month, an empty state is shown.

---

## How it works

The leaderboard page is a **Server Component** — data is computed fresh on every request.

### Data fetching
Two parallel queries are made for the current calendar month (from midnight on the 1st):

1. **Recognitions**: All `recognitions` in the org since month start, selecting `id`, `receiver_ids`, and `points`.
2. **Comment tips**: All `comments` with `points_tip > 0` on recognitions in the org since month start, with the recognition's `receiver_ids` joined in.

### Score aggregation (in-memory, in JS)
After fetching, the page:
1. Collects all unique `receiver_ids` across all recognitions.
2. Fetches those profiles in a single query (name, avatar, job title).
3. Iterates over recognitions — for each receiver in `receiver_ids`, adds `points` and increments the recognition count in a `Map`.
4. Iterates over tip comments — for each receiver in the tip's recognition's `receiver_ids`, adds the `points_tip` to their total.
5. Converts the map to an array and sorts descending by total points.

### Rank styling
```
1st — amber background, gold badge, Trophy icon
2nd — slate background, silver badge, Medal icon
3rd — orange background, bronze badge, Medal icon
4th+ — white background, grey number badge
```

### Month label
The header shows the current month and year (e.g. "Most recognised this month · March 2026") using a `MONTH_NAMES` array indexed by `new Date().getMonth()`.

---

## Key files

| File | Role |
|------|------|
| `src/app/(app)/leaderboard/page.tsx` | Server Component — all aggregation logic |

---

## Data involved

**Reads:**
- `recognitions` — filtered by `org_id` and `created_at >= monthStart`
- `comments` — filtered by `points_tip > 0` and joined to org via `recognitions`
- `profiles` — names, avatars, titles for all receivers

---

## Notable details

- The leaderboard is **not stored** — it's computed on-the-fly from raw recognition and comment data each time the page loads. There is no cached or materialized leaderboard table.
- Scores include **comment tips** on top of recognition points. A person who received a lot of tips will rank higher than someone with just raw recognition points.
- The `points_balance` column on `profiles` is a cumulative all-time total — the leaderboard does **not** use it. It queries `recognitions` and `comments` directly and filters to the current month.
- All score aggregation happens in JavaScript on the server after two DB queries, not in SQL. This keeps the query simple but means performance degrades if an org has very large volumes of monthly data.
- If a user was removed from the org (profile deleted), their `receiver_id` entries will have no matching profile — the code skips them silently via `if (!profile) continue`.
- There is no monthly snapshot stored — the leaderboard resets automatically because the date filter moves forward each month.
