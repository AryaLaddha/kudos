# Points & Performance System

Kudos uses two distinct scoring systems: **Social Recognition** (peer-to-peer) and **Sprint Performance** (admin-to-team). 

---

## 🏗️ 1. Social Recognition (Cultural Kudos)

Governed by a monthly budget, this system encourages peer-to-peer appreciation.

| Concept | Rule |
|---------|------|
| **Monthly Allowance** | Every user gets **200 points** to give away. Resets on the 1st of every month. |
| **Points Balance** | The cumulative sum of all recognition a user has received. This is the user's "Lifetime Score." |
| **Giving Limit** | Users cannot give more than their current allowance. |
| **Tipping** | Users can "tip" someone's existing recognition via comments (deducts from allowance). |

---

## 🏁 2. Sprint Performance (Performance Points)

This system is managed by Admins via the **Sprint Tracker** and drives the core analytics in the Admin Dashboard.

### **The Sprint Score Formula**
For every sprint, a participant's net performance is calculated as:
`Base Points + Wins - Deductions = Sprint Net`

*   **Base Points**: A fixed amount (e.g., 20 or 50) given to everyone for participation.
*   **Wins (+)**: Points awarded for "Extra Mile," "Recognition," or "Other" impact items.
*   **Deductions (-)**: Points removed for "Bugs," "Absences," "Comms Issues," or "Subtasks status."

### **Project Allocation & Effort**
Each participant has their effort distributed across projects (e.g., 60% on Project A, 40% on Project B). 
*   **Normalization**: The UI enforces that total allocation cannot exceed 100%.
*   **ROI Logic**: Performance wins are distributed proportionally to a user's project allocation to calculate **Project Efficiency (ROI)**.

---

## 🎯 3. Practice & Growth Tracker

Separate from Sprints, the **Goals** system tracks professional achievements.

*   **Categories**: Learning & Certification, Productivity, Practice Growth, etc.
*   **Point Values**: Predetermined (e.g., 50 pts for a Certification, 5 pts for a Trailhead badge).
*   **Verification**: Logs include a description of the achievement for audit purposes.

---

## 📁 Key Technical Files

| Role | Files |
|------|-------|
| **Allowance Reset** | `supabase/schema.sql` → `reset_monthly_allowances()` |
| **Recognition Logic** | `supabase/schema.sql` → `send_multi_recognition()` |
| **Sprint Management** | `src/app/(app)/sprints/actions.ts` |
| **Goals Definitions** | `src/lib/goals.ts` |

---

## 🔄 Resets & Persistence

*   **Monthly Allowance**: Resets to 200 on the 1st of every month via `pg_cron`.
*   **Sprint Points**: Never reset. They accumulate to form the **All-Time Sprint Leaderboard**.
*   **Goal Points**: Persistent and cumulative. 
