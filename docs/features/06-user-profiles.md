# User Profiles

Each user has a profile page at `/profile/[id]` showing their stats, a "Known for" hashtag summary, and their full kudos history split into Received / Given tabs.

---

## User flow

1. User clicks a name on a recognition card (feed or leaderboard) → navigates to `/profile/[id]`.
2. Profile header shows:
   - Avatar (initials fallback), full name, job title, department badge
   - 3 stat counters: points balance, kudos received count, kudos given count
   - "Known for" section — top hashtags from recognitions they've received (up to 5)
   - "Give Kudos" button (hidden on your own profile)
3. Two tabs below the header: **Kudos received** and **Kudos given** (with counts).
4. Active tab shows a paginated list of `RecognitionCard` components (10 per page).
5. Pagination links preserve the active tab: `?tab=received&page=2`.

---

## How it works

The profile page is a **Server Component**.

### Data fetching
All queries run on the server:

1. Loads the profile row by `id` param. Returns 404 (`notFound()`) if not found.
2. Parallel count queries:
   - `recognitions WHERE receiver_id = id` → `receivedCount`
   - `recognitions WHERE giver_id = id` → `givenCount`
3. Paginated recognitions for the active tab (10 per page), with full joins (giver, receiver, reactions, comments + their users).
4. Resolves `receiver_ids` arrays into full profiles (same pattern as the feed).
5. Fetches up to 100 received recognitions to compute top hashtags (not paginated — just `hashtags` column).

### "Known for" hashtags
After fetching up to 100 received recognitions:
- Flattens all `hashtags` arrays into one list.
- Counts frequency of each tag.
- Sorts descending by count, takes the top 5.
- Renders them as indigo badge pills.

### Tab system
Tab state is driven by the `?tab=` query param (`received` or `given`). Both tab links are standard `<a>` (Next.js `<Link>`) tags — no client-side state needed. Active tab uses `bg-white shadow-sm` styling; inactive uses muted text.

### Pagination
10 posts per page. `buildHref` returns `?tab=received&page=N` (or `given`) so pagination always preserves the active tab.

### Own profile vs. other
`isOwn = user.id === id`. On your own profile the "Give Kudos" button is hidden (you can't give yourself kudos).

---

## Key files

| File | Role |
|------|------|
| `src/app/(app)/profile/[id]/page.tsx` | Server Component — all data fetching and rendering |
| `src/components/app/RecognitionCard.tsx` | Renders each recognition in the history list |
| `src/components/app/Pagination.tsx` | Pagination UI |

---

## Data involved

**Reads:**
- `profiles` — the profile being viewed + receiver profiles for multi-recipient posts
- `recognitions` — count queries for stats + paginated history + hashtag aggregation
- `reactions` — loaded as part of recognition joins
- `comments` — loaded as part of recognition joins (with user profiles)

---

## Notable details

- The `points_balance` shown on the profile is the **all-time cumulative** total points earned — it never resets, even when monthly allowances reset.
- The `monthly_allowance` counter shown in the sidebar is the **giving budget** remaining this month — separate from `points_balance`.
- The hashtag aggregation queries up to 100 received recognitions. For very prolific recipients this may not cover all posts, but top tags from 100 posts is a reasonable approximation.
- The profile page uses `export const dynamic = "force-dynamic"` — no caching, always fresh data.
- Profile pages are accessible to anyone in the same organization (enforced by RLS on the `profiles` table scoping reads to `org_id = get_my_org_id()`).
