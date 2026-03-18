# Comments & Reactions

Users can react to any recognition with emoji and leave comments. Comments optionally include a point tip that transfers points from the commenter's monthly allowance to the recognition's recipient(s).

---

## Reactions

### User flow
- Each recognition card shows 5 emoji options: ❤️ 🙌 🚀 🎉 💯
- Emojis with at least one reaction show as a filled pill with a count. Unreacted emojis show as faint dashed outlines.
- Clicking an emoji you haven't reacted with **adds** your reaction (highlighted in indigo).
- Clicking an emoji you've already reacted with **removes** it (toggle).

### How it works
- Reactions are stored one row per `(recognition_id, user_id, emoji)` with a unique constraint — one reaction per emoji per user per recognition.
- **Add**: `INSERT INTO reactions` then optimistically appends the new row to local state.
- **Remove**: `DELETE FROM reactions WHERE recognition_id = ... AND user_id = ... AND emoji = ...` then filters from local state.
- No RPC needed — direct table operations with RLS.
- Demo cards (`id` starts with `demo-`) skip the toggle logic entirely.

---

## Comments

### User flow
1. User clicks the "Comment" button at the bottom-right of a card.
2. A textarea appears inline below the card.
3. User types a message. Optionally appends `+10` anywhere to tip the recipient 10 points.
4. A preview line shows "Tipping Alice 10 pts" if a tip is detected.
5. Press Enter (or click the Send button) to submit.
6. The comment appears immediately above the form (optimistic update).
7. If the recognition has more than 2 comments, a "View all N comments" link opens a **modal** showing the full thread and a pinned comment form at the bottom.

### How it works

#### Comment tip parsing (`parseCommentTip`)
Scans the comment text for the first `+N` pattern. Extracts the integer and strips it from the stored message:
- Input: `"Great work! +10"`
- Stored message: `"Great work!"`
- Tip: `10`

#### Submission
Calls the `post_comment` Postgres RPC with:
- `p_recognition_id` — the recognition being commented on
- `p_message` — cleaned message (tip stripped)
- `p_points_tip` — integer tip amount (0 if none)

The RPC atomically:
1. Validates the commenter has enough `monthly_allowance` for the tip.
2. Deducts the tip from the commenter's `monthly_allowance`.
3. Credits the tip to the receiver's `points_balance`.
4. Writes two `point_transactions` rows (audit trail).
5. Inserts the comment row.
6. Returns the full comment JSON with the commenter's profile attached.

#### Optimistic UI
The returned comment JSON is immediately prepended to local state, so the comment appears without a page reload. The commenter's profile (name, avatar) is attached client-side from a pre-fetched profile. If the comment included a tip, the sidebar `monthly_allowance` display updates via `router.refresh()`.

#### Multi-recipient tip cost
For a recognition with multiple receivers, tipping affects **each receiver**. The client shows:
- "Tipping Alice & Bob 10 pts each (20 pts total)"
- The `totalTip = tip × receivers.length` is validated against `userAllowance` client-side before calling the RPC.
- **Note**: the current RPC (`post_comment`) only credits the single `receiver_id` column — multi-receiver tip crediting is handled client-side for display but the RPC uses the legacy single `receiver_id`.

#### Comments modal
When a recognition has more than 2 comments, a "View all N comments" button opens a fullscreen modal:
- Shows the full recognition message at the top.
- Scrollable list of all comments.
- Pinned comment form at the bottom (same form as the inline version).
- Clicking the backdrop closes the modal.
- Body scroll is locked while the modal is open.

---

## Key files

| File | Role |
|------|------|
| `src/components/app/RecognitionCard.tsx` | All reaction + comment logic lives here |
| `supabase/schema.sql` → `post_comment()` | RPC for atomic comment + tip handling |

---

## Data involved

**Reads:**
- `profiles` — fetches current user's `monthly_allowance`, `full_name`, `avatar_url` on card mount

**Writes:**
- `reactions` — direct insert/delete (no RPC)
- `post_comment()` RPC → writes to `comments`, `profiles`, `point_transactions`

---

## Notable details

- Comments are sorted **newest first** in local state (most recent at top).
- The card only shows the **2 most recent** comments inline; the rest are behind the modal.
- If `comment.user` is missing on a comment (e.g. profile deleted), the display falls back to `"Someone"`.
- The comment form uses Enter (without Shift) to submit — Shift+Enter inserts a newline.
- Reactions are fully optimistic — the UI updates before the DB confirms. If the DB call fails, the UI may be out of sync until the next page load (no rollback currently).
