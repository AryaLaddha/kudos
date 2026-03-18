# Give Kudos

The core feature of the app. A user writes a free-form message that @mentions one or more teammates and includes a `+N` point value, then submits to send recognition.

---

## User flow

1. User clicks "Give Kudos" (button in sidebar or feed header) → navigates to `/give`.
2. User types a message in the textarea, for example:
   ```
   Thanks @alice for shipping that critical fix! Great work @bob. +20
   ```
3. As they type `@`, an autocomplete dropdown appears showing matching teammates by first name.
4. Selecting a name from the dropdown inserts it into the message.
5. A **Recipients** preview panel appears below the textarea showing each @mentioned person, their +N points, and the total cost.
6. The user optionally adds up to 3 hashtags (type or click suggestions).
7. Clicks "Send Kudos" → the form calls the `send_multi_recognition` RPC.
8. On success, a toast appears ("🎉 Kudos sent to Alice & Bob!") and the user is redirected to `/feed`.

---

## How it works

### Message parsing (`parseMessage`)
On every keystroke the message is parsed to extract:
- **Recipients**: All `@FirstName` mentions that match a teammate's first name. Case-insensitive, deduped.
- **Points**: The first `+N` in the message (only one allowed). Values of 0 or missing block submission.
- **Clean message**: The original text with all `+N` patterns stripped out — this is what gets stored in the database.

### @mention autocomplete (`detectMention`)
Detects when the cursor is directly after an `@` followed by letters. Filters teammates (up to 5 results) by first name prefix, shows a dropdown. Selecting inserts `@FirstName ` and moves the cursor after the space. Pressing Escape closes the dropdown.

### Points & cost calculation
- `effectivePoints` = parsed `+N` value from the message.
- `totalCost` = `effectivePoints × number of recipients`.
- The user's current `monthly_allowance` is shown in the sidebar. If `totalCost > allowance`, the send button is disabled and a red warning shows.

### Submission
Calls the `send_multi_recognition` Postgres RPC with:
- `p_org_id` — the giver's organization
- `p_receivers` — array of recipient profile UUIDs
- `p_message` — the cleaned message (same for all recipients)
- `p_points` — integer point value per recipient
- `p_hashtags` — array of hashtag strings

The RPC handles all point logic atomically in the database (see [08-points-system.md](./08-points-system.md)).

### Validation (client-side)
Before calling the RPC the form checks:
- At least one recipient @mentioned
- Message is at least 5 characters (after cleaning)
- Exactly one `+N` in the message
- `+N` value > 0
- `totalCost ≤ monthly_allowance`

The RPC also validates allowance server-side and raises `insufficient_points` if it fails there.

### Hashtags
- Max 3 hashtags per recognition.
- Can be typed manually (press Enter or click Add) or picked from 8 preset suggestions: `teamwork`, `innovation`, `leadership`, `shipping`, `mentorship`, `client-success`, `above-and-beyond`, `problem-solving`.
- Characters are lowercased and sanitized (alphanumeric + hyphens only).

---

## Key files

| File | Role |
|------|------|
| `src/app/(app)/give/page.tsx` | The entire Give Kudos page (client component) |
| `supabase/schema.sql` → `send_multi_recognition()` | RPC that atomically processes the recognition |

---

## Data involved

**Reads:**
- `profiles` — loads current user's allowance + all teammates in the same org (up to 50)

**Writes (via RPC):**
- `recognitions` — one row per recipient
- `profiles.monthly_allowance` — decremented for the giver
- `profiles.points_balance` — incremented for each recipient
- `point_transactions` — two rows per recipient (one `given`, one `received`)

---

## Notable details

- The same message and point value is sent to all recipients in a single RPC call — not one call per person.
- The `+N` syntax is stripped from the stored message. The database only stores the clean text and a separate `points` integer column.
- Teammate autocomplete loads up to 50 profiles from the same org at page mount (not on each keystroke).
- After successful submission, the page navigates to `/feed` via `window.location.href` (full navigation, not client-side) to force a fresh feed load with updated points.
- The giver cannot send kudos to themselves — enforced by an RLS policy on the `recognitions` table (`giver_id <> receiver_id`).
