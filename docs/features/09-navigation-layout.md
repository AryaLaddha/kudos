# Navigation & Layout

All authenticated app pages share a common layout with a fixed sidebar on desktop and a slide-out drawer on mobile.

---

## Layout structure

```
src/app/(app)/layout.tsx       ← protected layout wrapper
  ├── AppSidebar               ← sidebar / mobile drawer
  └── <main>                   ← page content (feed, give, leaderboard, profile)
```

The `(app)` route group applies the shared layout to: `/feed`, `/give`, `/leaderboard`, and `/profile/[id]`. Auth pages (`/auth/*`) and the admin panel (`/admin`) use their own separate layouts.

---

## AppSidebar

A client component (`src/components/app/AppSidebar.tsx`) that receives `user` (Supabase auth user) and `profile` (the app Profile row) as props from the server layout.

### What it shows
1. **Logo** — "Kudos" wordmark with indigo Sparkles icon.
2. **Points balance card** — shows `profile.points_balance` (earned) and `profile.monthly_allowance` (remaining giving budget this month) in an indigo panel.
3. **Navigation links** — Feed, Give Kudos, Leaderboard (using `LayoutDashboard`, `Heart`, `Trophy` icons).
4. **My Profile** — navigates to `/profile/[user.id]`.
5. **User footer** — avatar, display name, email, and a sign-out button.

### Active state
The current route is highlighted with `bg-indigo-50 text-indigo-700`. The active check uses `pathname === item.href` for exact matches, and `pathname.startsWith("/profile")` for the profile link.

### Navigation with loading state
Nav buttons use `useTransition` + `router.push()` instead of `<Link>` so a spinner (`Loader2`) can be shown on the active item while the page transition is in progress.

---

## Mobile layout

On screens narrower than `md` (768px):

- The sidebar is **hidden** (`-translate-x-full`) and replaced by a fixed top header bar (height 56px) showing a hamburger menu and the logo.
- Tapping the hamburger sets `mobileOpen = true`, sliding the sidebar in from the left (`translate-x-0`).
- A semi-transparent backdrop covers the page; tapping it closes the drawer.
- Any nav item click also closes the drawer (`setMobileOpen(false)`).

The main content area has `pt-14` on mobile to account for the fixed top header bar.

---

## Sign out

The sign-out button in the user footer calls `supabase.auth.signOut()` then `router.push("/")` to return to the landing page. A loading spinner is shown while signing out.

---

## Route protection

Route protection is handled by middleware, not the layout. See [01-authentication.md](./01-authentication.md). The layout assumes the user is already authenticated when it renders.

---

## Key files

| File | Role |
|------|------|
| `src/app/(app)/layout.tsx` | Protected layout — fetches user + profile, renders `AppSidebar` + `<main>` |
| `src/components/app/AppSidebar.tsx` | Sidebar UI, mobile drawer, nav, sign-out |
| `src/middleware.ts` | Redirects unauthenticated requests before the layout ever renders |

---

## Notable details

- The layout fetches `user` (from `supabase.auth.getUser()`) and `profile` (from the `profiles` table) on the server and passes them as props to `AppSidebar`. This means the sidebar always has up-to-date points data on page load.
- The sidebar width is fixed at `w-60` (240px). The main content area is `flex-1` to fill the remaining space.
- Tailwind's `md:` breakpoint is used throughout — desktop gets the always-visible sidebar, mobile gets the drawer.
- The `AppSidebar` is a client component only because it needs `usePathname`, `useRouter`, `useState`, and `useTransition`. The layout wrapper itself is a server component.
