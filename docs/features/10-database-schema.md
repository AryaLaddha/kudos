# Database Schema

Kudos uses a Supabase (Postgres) database with Row Level Security on every table. All multi-step data mutations are handled by RPC functions or Server Actions to guarantee atomicity and org-isolation.

---

## 🏗️ Core Tables (Social & Org)

### `organizations`
Multi-tenant anchor. Each company is one org.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Display name (e.g. "Acme Corp") |
| `slug` | text UNIQUE | URL-safe identifier |

### `profiles`
One row per user, extends `auth.users` 1-to-1.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK → `auth.users(id)` |
| `org_id` | uuid | FK → `organizations` |
| `full_name` | text | Display name |
| `is_admin` | boolean | Org-level admin flag |
| `points_balance` | int | Cumulative Social points earned |

---

## 🏁 Sprint & Performance Tables

### `projects`
Structural units for resource allocation.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `org_id` | uuid | FK → `organizations` |
| `name` | text | Project name |

### `sprints`
Time-bound performance cycles.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `org_id` | uuid | FK → `organizations` |
| `name` | text | e.g., "Sprint 24 - April A" |
| `status` | text | `active` or `completed` |
| `columns` | jsonb | Metadata for scoring columns (Won/Deducted) |
| `start_date` | date | |
| `end_date` | date | |

### `sprint_participants`
The performance ledger for a user within a specific sprint.
| Column | Type | Notes |
|--------|------|-------|
| `sprint_id` | uuid | FK → `sprints` |
| `user_id` | uuid | FK → `profiles` |
| `base_points` | int | Fixed participation points |
| `scores` | jsonb | Key-value pairs for wins and deductions (e.g., `{ "bugs": -5, "recognition": 10 }`) |
| `project_allocations` | jsonb | Map of `projectId` to `percentage` (e.g., `{ "p1": 60, "p2": 40 }`) |
| **Unique** | `(sprint_id, user_id)` | Enforces one performance record per user per sprint. |

---

## 🎯 Achievement Tables

### `user_goals`
The log of professional achievements and growth.
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid | FK → `profiles` |
| `org_id` | uuid | FK → `organizations` |
| `goal_id` | text | Slug from `@/lib/goals.ts` (e.g., `learning_trailhead_badge`) |
| `status` | text | `aim` or `achieved` |
| `description` | text | User-provided audit text for the achievement |

---

## 🔓 Row Level Security (RLS)

All tables use `org_id` filtering. The helper function `get_my_org_id()` ensures users can only see data belonging to their own organization.

| Table | Access Level |
|-------|--------------|
| `sprints` | All org members can **Read**. Only `is_admin` can **Manage**. |
| `projects` | All org members can **Read**. Only `is_admin` can **Manage**. |
| `sprint_participants` | All org members can **Read**. Only `is_admin` can **Manage**. |
| `user_goals` | Users can **Manage** their own goals. Admins can **Read ALL** for auditing. |
