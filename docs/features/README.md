# Kudos — Feature Documentation

Kudos is a team recognition SaaS app where employees give points-based shoutouts to teammates, react and comment on kudos, and compete on a monthly leaderboard.

**Stack**: Next.js 16 · React 19 · Supabase (Postgres + Auth + RLS) · Tailwind CSS · TypeScript

---

## Features

| File | What it covers |
|------|---------------|
| [01-authentication.md](./01-authentication.md) | Login, session management, route protection, password reset |
| [02-give-kudos.md](./02-give-kudos.md) | Sending recognition — @mentions, points syntax, hashtags, multi-recipient |
| [03-feed.md](./03-feed.md) | Recognition feed, pagination, demo mode |
| [04-comments-reactions.md](./04-comments-reactions.md) | Comments with point tips, emoji reactions, all-comments modal |
| [05-leaderboard.md](./05-leaderboard.md) | Monthly rankings aggregated from recognitions + tips |
| [06-user-profiles.md](./06-user-profiles.md) | Profile page — stats, kudos history tabs, "known for" hashtags |
| [07-admin-dashboard.md](./07-admin-dashboard.md) | Command Center — Org Analytics, Leaderboards, ROI, Health |
| [08-points-system.md](./08-points-system.md) | Scoring mechanics — Kudos Allowance vs. Sprint Performance |
| [09-navigation-layout.md](./09-navigation-layout.md) | Sidebar, mobile header, routing, sign-out |
| [10-database-schema.md](./10-database-schema.md) | All tables, RLS policies, triggers, and RPC functions |
| [11-sprint-management.md](./11-sprint-management.md) | Admin SOP — Creating sprints, allocations, and scoring |

---

## Quick orientation

- All app pages live under `src/app/(app)/` and require authentication.
- Auth pages are at `src/app/auth/`.
- The admin panel is at `src/app/admin/` — only users with `is_admin = true` can access it.
- Point operations are handled atomically inside Postgres RPC functions (`send_multi_recognition`, `post_comment`), never client-side.
- Each organization's data is isolated via Row Level Security policies scoped by `org_id`.
