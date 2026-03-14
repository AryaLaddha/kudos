-- ============================================================
-- Kudos — Supabase Database Schema
-- Run this in your Supabase project's SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- ORGANIZATIONS  (multi-tenant)
-- ============================================================
create table if not exists organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text unique not null,
  monthly_allowance int not null default 100,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- PROFILES  (extends auth.users 1-to-1)
-- ============================================================
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  org_id          uuid references organizations(id) on delete cascade,
  full_name       text not null default '',
  avatar_url      text,
  department      text,
  job_title       text,
  monthly_allowance int not null default 100,
  points_balance  int not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- RECOGNITIONS  (the kudos posts)
-- ============================================================
create table if not exists recognitions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  giver_id        uuid not null references profiles(id) on delete cascade,
  receiver_id     uuid not null references profiles(id) on delete cascade,
  message         text not null,
  points          int not null check (points > 0 and points <= 100),
  hashtags        text[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- ============================================================
-- REACTIONS  (emoji reactions on recognitions)
-- ============================================================
create table if not exists reactions (
  id              uuid primary key default gen_random_uuid(),
  recognition_id  uuid not null references recognitions(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  emoji           text not null,
  created_at      timestamptz not null default now(),
  unique(recognition_id, user_id, emoji)
);

-- ============================================================
-- POINT TRANSACTIONS  (full audit log)
-- ============================================================
create table if not exists point_transactions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  recognition_id  uuid references recognitions(id) on delete set null,
  amount          int not null,  -- positive = received, negative = given
  kind            text not null check (kind in ('given','received','monthly_reset')),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table organizations     enable row level security;
alter table profiles          enable row level security;
alter table recognitions      enable row level security;
alter table reactions         enable row level security;
alter table point_transactions enable row level security;

-- Helper: get the caller's org_id
create or replace function get_my_org_id()
returns uuid language sql stable
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Organizations: members can read their own org
create policy "org members can read" on organizations
  for select using (id = get_my_org_id());

-- Profiles: members of same org can read; owner can update
create policy "org members can read profiles" on profiles
  for select using (org_id = get_my_org_id());

create policy "owner can update own profile" on profiles
  for update using (id = auth.uid());

create policy "service role can insert profiles" on profiles
  for insert with check (true);

-- Recognitions: org-scoped read; authenticated users can insert
create policy "org members can read recognitions" on recognitions
  for select using (org_id = get_my_org_id());

create policy "org members can give recognitions" on recognitions
  for insert with check (
    org_id = get_my_org_id() and
    giver_id = auth.uid() and
    giver_id <> receiver_id
  );

-- Reactions: org-scoped read; authenticated users can manage their own
create policy "org members can read reactions" on reactions
  for select using (
    exists (
      select 1 from recognitions r
      where r.id = recognition_id and r.org_id = get_my_org_id()
    )
  );

create policy "users can manage own reactions" on reactions
  for all using (user_id = auth.uid());

-- Point transactions: users can read own transactions
create policy "users can read own transactions" on point_transactions
  for select using (user_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer
as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Deduct points from giver + credit receiver when recognition is created
create or replace function handle_recognition_points()
returns trigger language plpgsql security definer
as $$
begin
  -- Deduct from giver
  update profiles set points_balance = points_balance - new.points
  where id = new.giver_id;

  -- Credit receiver
  update profiles set points_balance = points_balance + new.points
  where id = new.receiver_id;

  -- Audit log: debit
  insert into point_transactions (org_id, user_id, recognition_id, amount, kind)
  values (new.org_id, new.giver_id, new.id, -new.points, 'given');

  -- Audit log: credit
  insert into point_transactions (org_id, user_id, recognition_id, amount, kind)
  values (new.org_id, new.receiver_id, new.id, new.points, 'received');

  return new;
end;
$$;

create or replace trigger on_recognition_created
  after insert on recognitions
  for each row execute procedure handle_recognition_points();

-- ============================================================
-- SEED DATA (demo org + users — optional for testing)
-- ============================================================
-- INSERT INTO organizations (name, slug) VALUES ('Acme Corp', 'acme-corp');
