# Authentication

Kudos uses Supabase Auth (email + password) to identify users. Sessions are managed via cookies; every protected route is guarded by Next.js middleware.

---

## User flow

1. User visits any app URL (e.g. `/feed`).
2. Middleware checks for a valid Supabase session cookie.
3. If no session → redirect to `/auth/login`.
4. User enters email + password and submits the form.
5. Supabase validates credentials and sets a session cookie.
6. Middleware now allows the request through; user lands on `/feed`.
7. If the user visits an auth page while already logged in → redirect to `/feed` (except `/auth/reset-password`, which is always accessible).

### Password reset flow
1. User clicks "Forgot password?" on the login page.
2. Enters their email at `/auth/forgot-password`.
3. Supabase emails a reset link containing a one-time token.
4. Token resolves to `/auth/reset-password` where the user sets a new password.
5. `/auth/callback/route.ts` is the OAuth/magic-link callback handler — it exchanges the code for a session and redirects to `/feed`.

---

## How it works

### Middleware (`src/middleware.ts`)
Runs on every request (excluding static files and images). It:
- Creates a Supabase server client that reads cookies from the request.
- Calls `supabase.auth.getUser()` to validate the session.
- **Unauthenticated + protected route** → redirect to `/auth/login`.
- **Authenticated + auth page** (not `/auth/reset-password`) → redirect to `/feed`.
- Public pages: `/` (landing) and anything under `/auth/`.

### Supabase clients
Two separate clients exist:
- `src/lib/supabase/client.ts` — Browser client, used in `"use client"` components. Reads/writes cookies via the browser.
- `src/lib/supabase/server.ts` — Server client, used in Server Components and API routes. Reads cookies from the incoming request.

### New user profile creation
When a new user signs up, a Postgres trigger (`on_auth_user_created`) fires automatically and inserts a row into the `profiles` table. The trigger copies `full_name` and `avatar_url` from the user's auth metadata.

### Admin auth
Admin access is separate from user auth. The admin dashboard (`/admin`) checks that `profiles.is_admin = true` for the logged-in user. Non-admins are redirected to `/admin/login`.

---

## Key files

| File | Role |
|------|------|
| `src/middleware.ts` | Route protection — runs on every request |
| `src/app/auth/login/page.tsx` | Login form UI |
| `src/app/auth/forgot-password/page.tsx` | Forgot password form |
| `src/app/auth/reset-password/page.tsx` | Password reset form |
| `src/app/auth/callback/route.ts` | OAuth / magic-link callback handler |
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server-side Supabase client |

---

## Data involved

- `auth.users` — Supabase-managed auth table (email, hashed password, metadata).
- `profiles` — App-level user data (name, org, points). Created automatically on signup via trigger.

---

## Notable details

- The middleware must refresh the session cookie on every request so it doesn't expire mid-session — the `setAll` cookie handler in the middleware does this transparently.
- There is no OAuth provider (Google, GitHub, etc.) wired up — only email/password.
- The `/auth/signup` route simply redirects to `/auth/login` — account creation happens via the login page or is handled externally.
