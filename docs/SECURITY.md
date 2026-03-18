# Security Reference

This document defines the security requirements for the Kudos application. When designing or building any new feature, check every section below and confirm your implementation satisfies it.

Think of this as a **checklist** — not just a description of what exists today, but the standard every feature must be held to.

---

## 1. Authentication

**What it means**: Only real, verified users can access the app.

### Requirements
- [ ] Every protected route must verify the session server-side before rendering — middleware is not optional
- [ ] Sessions must be stored in **HttpOnly cookies**, never in `localStorage` or `sessionStorage` (XSS cannot steal HttpOnly cookies)
- [ ] Session cookies must be refreshed on every request so they don't silently expire mid-use
- [ ] Password reset tokens must be single-use and expire (Supabase handles this)
- [ ] After sign-out, the session must be fully invalidated — not just the local cookie
- [ ] Failed login attempts must return a **generic error** ("Invalid credentials") — never reveal whether the email exists

### What we have
- `middleware.ts` — validates session on every request via `supabase.auth.getUser()`
- Supabase Auth manages session cookies as HttpOnly
- `setAll` in both `client.ts` and `server.ts` refreshes the cookie on every request

### What to watch for when adding features
- Never skip the middleware by adding a route outside the `(app)` group without understanding the consequences
- Never use `supabase.auth.getSession()` for auth checks — it reads from the cookie without server validation. Always use `getUser()` which hits the Supabase server

---

## 2. Authorisation

**What it means**: Authenticated users can only access data they are permitted to see or modify.

### Requirements
- [ ] Every database table must have RLS enabled
- [ ] Users must only see data from **their own organization** — no cross-org data leakage
- [ ] Users must only be able to **modify their own records** (e.g. only update your own profile)
- [ ] Privilege escalation must be impossible — a normal user cannot call admin-only functions
- [ ] The `is_admin` flag must be checked **server-side** on every admin page load, not just on initial login
- [ ] Write operations must validate ownership server-side, not just client-side

### What we have
- RLS on all 5 tables: `organizations`, `profiles`, `recognitions`, `comments`, `reactions`, `point_transactions`
- `get_my_org_id()` helper scopes all reads to the caller's org
- Admin dashboard re-checks `is_admin` on every server render
- `SECURITY DEFINER` RPCs for cross-org admin functions (`get_admin_dashboard_stats`)

### What to watch for when adding features
- Every new table must have RLS enabled from the start — it is off by default in Postgres
- Every new RPC that touches sensitive data should be `SECURITY DEFINER` and validate `auth.uid()` internally
- Never pass `org_id` as a client-supplied parameter to queries without also validating it matches `get_my_org_id()` — otherwise a user could query another org's data by changing the value
- Never gate sensitive UI behind a client-side `if (isAdmin)` check alone — always verify on the server

---

## 3. Data Isolation (Multi-tenancy)

**What it means**: Organizations are completely separated — one org can never see or affect another's data.

### Requirements
- [ ] Every table that contains org-scoped data must have an `org_id` column
- [ ] All reads must filter by `org_id = get_my_org_id()` via RLS
- [ ] All writes must validate `org_id = get_my_org_id()` via RLS insert check
- [ ] Cross-org admin queries must only be accessible to `is_admin = true` users via `SECURITY DEFINER` functions
- [ ] Joining tables must not create paths that bypass org isolation (e.g. joining `recognitions → profiles` must still stay within the org)

### What we have
- `get_my_org_id()` is used in all RLS policies
- `recognitions` insert policy checks `org_id = get_my_org_id()`
- `comments` are scoped via JOIN to `recognitions.org_id`

### What to watch for when adding features
- Any new feature that spans multiple tables needs its RLS policies carefully reviewed for join-based bypass
- If you add a feature that lets users reference users by ID (e.g. DMs), ensure the recipient is always validated to be in the same org

---

## 4. Input Validation

**What it means**: All data from the user must be treated as untrusted and validated before use.

### Requirements
- [ ] **Client-side validation** for UX (instant feedback)
- [ ] **Server-side / database-level validation** as the authoritative check (client-side alone is never enough)
- [ ] Numeric inputs must have min/max constraints enforced in the DB (`CHECK` constraints), not just the UI
- [ ] Text inputs must have reasonable length limits to prevent abuse
- [ ] Array inputs (hashtags) must enforce max count at the DB or RPC level
- [ ] Never trust client-supplied IDs (e.g. `org_id`, `giver_id`) — always derive them from the authenticated session server-side

### What we have
- `recognitions.points` has `CHECK (points > 0 AND points <= 100)` at the DB level
- `send_multi_recognition` validates allowance server-side
- `post_comment` validates tip allowance server-side
- Client-side: max 3 hashtags, min 5 char message, exactly one `+N`

### What to watch for when adding features
- Any new numeric field that represents money, points, or limits needs a DB-level `CHECK` constraint
- Never rely solely on `disabled` buttons or frontend guards — a user with browser devtools can bypass all of that
- If a user can supply free-text that gets stored and displayed to others, consider max length constraints to prevent abuse

---

## 5. Business Logic Integrity

**What it means**: Core business rules (points, balances, limits) cannot be circumvented by clever client behaviour.

### Requirements
- [ ] All point transactions must be **atomic** — partial writes must be impossible
- [ ] Point deduction and credit must happen in the same database transaction
- [ ] A user must never be able to spend more points than their `monthly_allowance`
- [ ] A user must never be able to give themselves kudos
- [ ] All financial/points logic must live in the database (RPC functions), not in client-side JavaScript
- [ ] Client-side cost previews are for UX only — the database is always the source of truth

### What we have
- `send_multi_recognition` and `post_comment` are atomic PLpgSQL functions — if any step fails, the whole transaction rolls back
- `SECURITY DEFINER` means these run as the function owner, not the caller, preventing privilege abuse
- RLS insert check: `giver_id <> receiver_id`
- Both RPCs check allowance before any write

### What to watch for when adding features
- Never move point logic into a Next.js API route or client component — it must stay in the DB
- If you add a new way to earn or spend points, it needs its own RPC with the same atomic guarantee
- Any new transaction must also write to `point_transactions` for the audit trail

---

## 6. Secret Management

**What it means**: Credentials and keys are never exposed to the browser or committed to source control.

### Requirements
- [ ] The Supabase **service role key** must never be in any `NEXT_PUBLIC_` variable — it would be exposed to the browser
- [ ] The Supabase **anon key** is safe to expose publicly (it is designed for this), but RLS must be correctly configured so it can't be abused
- [ ] All secrets must be in environment variables (`.env.local`), never hardcoded in source files
- [ ] `.env.local` must be in `.gitignore`
- [ ] Production secrets must be set in the deployment platform (Vercel env vars), never in committed files

### What we have
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to expose (anon key + RLS)
- Both `client.ts` and `server.ts` use env vars, not hardcoded values

### What to watch for when adding features
- If you need the service role key (e.g. for a server-only admin action), use it only in `server.ts` or a server action — never in a `"use client"` file
- If you add a third-party integration (Stripe, Slack, etc.), its secret key must be in a non-`NEXT_PUBLIC_` env var

---

## 7. Cross-Site Scripting (XSS)

**What it means**: Malicious scripts injected via user content must never execute in other users' browsers.

### Requirements
- [ ] All user-generated content rendered to the page must be **HTML-escaped** by default
- [ ] Never use `dangerouslySetInnerHTML` with user content
- [ ] Avatar URLs loaded from the database should only be rendered in `<img src>` — never executed
- [ ] Content Security Policy (CSP) headers should restrict which scripts can execute (not yet implemented — see gaps)

### What we have
- React escapes all string values rendered via JSX by default — `{recognition.message}` is always safe
- No use of `dangerouslySetInnerHTML` anywhere in the codebase

### What to watch for when adding features
- If you ever add rich text (markdown, HTML input), you must sanitize it with a library like `DOMPurify` before rendering
- Never concatenate user content into a string that gets passed to `dangerouslySetInnerHTML` or `eval`
- If rendering user-supplied URLs (e.g. for avatars or links), validate the scheme is `https://` — `javascript:` URLs are a classic XSS vector

---

## 8. Cross-Site Request Forgery (CSRF)

**What it means**: Malicious external sites must not be able to trigger actions on behalf of a logged-in user.

### Requirements
- [ ] State-mutating operations should not be triggerable by a simple GET request
- [ ] Forms that perform sensitive actions should use POST methods
- [ ] Supabase sessions use `SameSite` cookie attributes which provide baseline CSRF protection

### What we have
- Supabase Auth cookies are set with `SameSite=Lax` by default — this prevents cross-site POST requests from including the cookie
- The sign-out route is a POST form (`<form action="/auth/signout" method="post">`)

### What to watch for when adding features
- If you add custom API routes that mutate data, they should be POST/PUT/DELETE, never GET
- If you add webhooks that receive external POST requests, validate the webhook signature before acting on the payload

---

## 9. Sensitive Data Exposure

**What it means**: Private data (passwords, tokens, PII) must never be leaked in responses, logs, or URLs.

### Requirements
- [ ] Passwords are never stored — only Supabase's bcrypt hashes (handled by Supabase Auth)
- [ ] Session tokens must not appear in URLs (no `?token=` in redirects)
- [ ] Error messages shown to users must not reveal internal details (stack traces, SQL errors, table names)
- [ ] Server logs must not log full request bodies that may contain passwords
- [ ] `points_balance` and `monthly_allowance` of other users should only be visible in appropriate contexts (profile pages within same org)

### What we have
- Login errors display `error.message` from Supabase — these are already sanitized by Supabase (generic messages)
- RPC errors surface as `insufficient_points` — a controlled string, not a raw SQL error
- Auth callback uses query params (`?code=`) but this is Supabase's PKCE flow, not a raw session token

### What to watch for when adding features
- Never `console.log` the full Supabase error object in production — it may contain query details. Use `console.error(error.message)` instead
- If you add any admin APIs that return aggregate data, ensure individual user PII is not leaked in those responses
- Never include session tokens, user IDs, or email addresses in analytics events sent to third-party tools without user consent

---

## 10. Rate Limiting & Abuse Prevention

**What it means**: No single user should be able to flood the system or automate abuse.

### Requirements
- [ ] Login attempts should be rate-limited to prevent brute force (handled by Supabase Auth)
- [ ] Point-giving should be naturally rate-limited by the monthly allowance budget
- [ ] Bulk operations (e.g. sending kudos to 50 people at once) should have reasonable server-side limits
- [ ] Password reset emails should be rate-limited to prevent email flooding

### What we have
- Supabase Auth has built-in rate limiting on `signInWithPassword` and password reset emails
- `monthly_allowance` (200 pts/month) caps how many recognitions a user can send

### What to watch for when adding features
- If you add any endpoint that sends emails or notifications, it must have rate limiting
- The teammate autocomplete loads up to 50 profiles — if you increase this, consider pagination instead
- If you add any public-facing API (webhooks, integrations), add rate limiting at the route level

---

## 11. Dependency & Supply Chain Security

**What it means**: Third-party packages must not introduce vulnerabilities.

### Requirements
- [ ] Keep dependencies up to date — run `npm audit` regularly
- [ ] Pin major versions for critical security dependencies
- [ ] Review new dependencies before adding — prefer well-maintained, widely used packages
- [ ] Never install packages from untrusted or unofficial sources

### What we have
- Small, focused dependency tree: Next.js, Supabase, Tailwind, shadcn/ui, Lucide, Sonner
- No custom authentication library — using Supabase's battle-tested auth

### What to watch for when adding features
- Run `npm audit` before every release
- Avoid adding packages that require excessive permissions or make network calls at build time

---

## 12. Security Gaps

### Fixed
These issues were identified and resolved:

| Gap | Fix applied |
|-----|-------------|
| Login page showed raw Supabase error (account enumeration risk) | Normalized to `"Invalid email or password."` — `src/app/auth/login/page.tsx` |
| Auth callback `?next=` allowed open redirect to external URLs | Validated that `next` starts with `/` and not `//` — `src/app/auth/callback/route.ts` |
| Profile update RLS allowed user to set `is_admin = true` on own row | Added `WITH CHECK` locking `is_admin`, `org_id`, and point columns — `schema.sql` |
| `comments.points_tip` had no non-negative constraint | Added `CHECK (points_tip >= 0)` — `schema.sql` |
| `profiles.monthly_allowance` had no non-negative constraint | Added `CHECK (monthly_allowance >= 0)` — `schema.sql` |
| Client-supplied `p_org_id` not validated server-side in recognition RPC | Added `get_my_org_id()` check at RPC entry, raises `org_mismatch` — `schema.sql` |
| `post_comment` only credited single `receiver_id`, not all receivers | Updated RPC to loop over `receiver_ids` and credit each — `schema.sql` |
| `get_admin_dashboard_stats` and `admin_set_price_per_seat` RPCs missing | Both added with explicit `is_admin` guard raising `unauthorized` — `schema.sql` |
| Schema `send_multi_recognition` used `p_messages text[]` but client sent `p_message text` | Fixed RPC signature to `p_message text` (single message, broadcast to all) — `schema.sql` |
| `receiver_ids uuid[]` column missing from `recognitions` table | Added column; RPC populates it on every insert — `schema.sql` |
| `price_per_seat` column missing from `organizations` table | Added `price_per_seat numeric(10,2)` — `schema.sql` |
| `is_admin` column missing from `profiles` table in schema | Added `is_admin boolean not null default false` — `schema.sql` |

### Still Open
These gaps remain and should be addressed as the application matures:

| Gap | Risk | Recommended fix |
|-----|------|-----------------|
| No Content Security Policy (CSP) headers | Medium — reduces XSS blast radius if a future bug allows injection | Add CSP via `next.config.js` headers |
| No account lockout after N failed logins | Medium — brute force possible | Enable Supabase Auth captcha or rate-limiting add-on |
| No `Secure` / `HttpOnly` flags explicitly configured | Medium | Verify Supabase SSR cookie options in production |
| No audit log for admin actions (price edits, etc.) | Medium — no paper trail if misuse occurs | Add an `admin_audit_log` table; write to it inside admin RPCs |
| `monthly_allowance` reset value (200) hardcoded in the RPC | Low | Read from `organizations.monthly_allowance` per org |

---

## Quick Checklist — New Feature Review

Before merging any new feature, answer yes to all of these:

- [ ] Does every new database table have RLS enabled?
- [ ] Are all write operations validated server-side (not just client-side)?
- [ ] Does the feature respect org isolation — can it leak cross-org data?
- [ ] Is any business logic that touches points/money in the database, not the client?
- [ ] Are secrets in env vars, not hardcoded?
- [ ] Does user-supplied content get rendered safely (no `dangerouslySetInnerHTML`)?
- [ ] Does the feature add any new public routes that bypass middleware?
- [ ] Does the admin check happen server-side on every load?
- [ ] Are error messages shown to users generic enough to not leak internals?
- [ ] Has `npm audit` been run and any high/critical issues resolved?
