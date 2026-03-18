# Points System

The points system governs how recognition points are budgeted, spent, earned, and reset. All point mutations happen atomically inside Postgres RPC functions — never directly from the client.

---

## Two separate point counters per user

Each `profiles` row has two distinct point fields:

| Column | What it means | Resets? |
|--------|--------------|---------|
| `monthly_allowance` | Points you have left **to give** this month | Yes — resets to 200 on the 1st of every month |
| `points_balance` | Points you have **earned** (received) all-time | Never — accumulates forever |

These are completely independent. Giving away all your allowance does not affect your balance, and receiving lots of recognition does not affect your giving budget.

---

## Giving points (recognition)

When a user sends kudos via `/give`:

1. Client calls `send_multi_recognition(p_org_id, p_receivers[], p_message, p_points, p_hashtags)`.
2. RPC atomically:
   - Computes `total_cost = p_points × number of receivers`.
   - Checks giver's `monthly_allowance >= total_cost` — raises `insufficient_points` if not.
   - Deducts `total_cost` from giver's `monthly_allowance` in one update.
   - For each receiver:
     - Inserts a `recognitions` row.
     - Adds `p_points` to receiver's `points_balance`.
     - Inserts two `point_transactions` rows: one `kind = 'given'` for the giver (negative amount), one `kind = 'received'` for the receiver (positive amount).

**Point validation happens twice**: client-side (to disable the button and show warnings) and server-side (the RPC guard). The server is authoritative.

---

## Tipping points (comment tips)

When a user adds `+N` to a comment:

1. Client calls `post_comment(p_recognition_id, p_message, p_points_tip)`.
2. RPC atomically:
   - If `p_points_tip > 0`: validates `monthly_allowance >= p_points_tip`, deducts from commenter, credits receiver's `points_balance`, writes audit transactions.
   - Inserts the comment row.
   - Returns the full comment JSON for immediate UI update.

Tip points come from the **commenter's** monthly allowance, not from a pool.

---

## Monthly allowance reset

A `pg_cron` job runs at `00:00 UTC on the 1st of every month`:

```sql
select reset_monthly_allowances()
```

This function sets `monthly_allowance = 200` for **all** profiles in one UPDATE. It does not touch `points_balance`.

The sidebar always shows:
- `points_balance` — your earned total
- `monthly_allowance` — your remaining giving budget this month

---

## Audit trail

Every point movement writes to `point_transactions`:

| Field | Values |
|-------|--------|
| `user_id` | Who the transaction belongs to |
| `amount` | Positive = received, Negative = given |
| `kind` | `given` / `received` / `monthly_reset` |
| `recognition_id` | The recognition that caused it (nullable) |

This table is append-only — points are never deleted or modified here. RLS limits reads to the user's own transactions.

---

## Point constraints

- Min points per recognition: 1 (enforced by DB check: `points > 0`)
- Max points per recognition: 100 (enforced by DB check: `points <= 100`)
- Monthly giving allowance: 200 (reset value hard-coded in `reset_monthly_allowances()`)
- You cannot give yourself kudos (RLS: `giver_id <> receiver_id`)
- You cannot overdraft your allowance (RPC guard raises an error before any writes)

---

## Key files

| File | Role |
|------|------|
| `supabase/schema.sql` → `send_multi_recognition()` | Atomic give kudos — deducts allowance, credits receivers |
| `supabase/schema.sql` → `post_comment()` | Atomic comment + optional tip |
| `supabase/schema.sql` → `reset_monthly_allowances()` | Monthly cron reset |
| `src/app/(app)/give/page.tsx` | Client-side cost preview and validation |
| `src/components/app/RecognitionCard.tsx` | Client-side tip validation in comments |
| `src/components/app/AppSidebar.tsx` | Displays both `points_balance` and `monthly_allowance` |

---

## Data flow summary

```
User types "+20" and mentions @alice @bob
  → totalCost = 20 × 2 = 40 pts
  → send_multi_recognition(...)
      → giver.monthly_allowance -= 40
      → alice.points_balance    += 20   (+ audit row)
      → bob.points_balance      += 20   (+ audit row)
      → 2 recognition rows inserted
```

```
User comments "+10 nice work!" on alice's recognition
  → post_comment(...)
      → commenter.monthly_allowance -= 10
      → alice.points_balance        += 10  (+ audit row)
      → comment row inserted
      → returns comment JSON for instant UI display
```
