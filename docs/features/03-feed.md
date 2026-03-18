# Recognition Feed

The main app view — a reverse-chronological list of kudos posts scoped to the user's organization, with pagination.

---

## User flow

1. After login, user lands on `/feed`.
2. They see a list of recognition cards — who gave kudos to whom, the message, points, hashtags, reactions, and a comment count.
3. Older posts are accessed via Previous / Next pagination (20 per page).
4. Clicking "Give Kudos" (top-right button) navigates to `/give`.
5. Clicking a name on a card navigates to that person's profile.

### Demo mode
If the organization has no recognitions yet (or no org is assigned), the feed shows 3 hard-coded sample posts and a "Demo mode" banner. Reactions and comments are disabled on demo cards.

---

## How it works

The feed page is a **Server Component** — all data is fetched on the server before the page renders.

### Data fetching
1. Loads the current user's profile to get their `org_id`.
2. Counts total recognitions in the org (for pagination math).
3. Fetches one page of recognitions (20 rows, newest first) with all related data joined in a single query:
   - `giver` profile (via `recognitions_giver_id_fkey`)
   - `receiver` profile (via `recognitions_receiver_id_fkey`)
   - all `reactions` on each recognition
   - all `comments` on each recognition, with each comment's `user` profile
4. Collects all `receiver_ids` arrays from the returned recognitions, fetches those profiles in a second query, and attaches a `receivers` array to each recognition for multi-recipient display.

### Multi-recipient display
A single recognition can have multiple receivers (stored as a `receiver_ids` UUID array on the row). The feed page resolves those IDs to full profiles and passes them to `RecognitionCard` as `receivers: Profile[]`. If `receivers` is populated, the card shows all names; otherwise it falls back to the single `receiver` profile.

### Pagination
- 20 posts per page (`PER_PAGE = 20`).
- Page number comes from the `?page=` query param.
- `totalPages = ceil(totalCount / 20)`.
- The `Pagination` component renders Previous / Next links as `<a>` tags pointing to `?page=N`.

### Demo mode logic
```
isEmpty = no recognitions returned (DB empty or no org)
feed    = isEmpty ? demoRecognitions : recognitionsWithReceivers
```
Demo recognitions are defined inline in the page file with fixed UUIDs prefixed `demo-`. The `RecognitionCard` component checks for this prefix to disable interactive features (reactions, comments, profile links).

---

## Key files

| File | Role |
|------|------|
| `src/app/(app)/feed/page.tsx` | Server Component — fetches data, renders feed |
| `src/components/app/RecognitionCard.tsx` | Client Component — renders each kudos card with reactions/comments |
| `src/components/app/Pagination.tsx` | Reusable Previous/Next pagination UI |

---

## Data involved

**Reads:**
- `profiles` — current user's profile + all receiver profiles for multi-recipient posts
- `recognitions` — paginated, org-scoped, with joins to giver/receiver/reactions/comments

---

## Notable details

- The page is marked `export const dynamic = "force-dynamic"` — it is never cached, always SSR on every request. This ensures the latest reactions and comments always appear.
- The feed is org-scoped via `eq("org_id", profile.org_id)` — users only ever see their own organization's posts.
- Comments are loaded as part of the recognition query (not lazily). The card shows the 2 most recent; a "View all N comments" button opens a modal for the rest.
- The point value shown on a card header badge (`+N pts`) is `recognition.points × max(receivers.length, 1)` — the total points distributed, not the per-person amount.
