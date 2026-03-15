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
-- COMMENTS  (comments + optional point tips on recognitions)
-- ============================================================
create table if not exists comments (
  id              uuid primary key default gen_random_uuid(),
  recognition_id  uuid not null references recognitions(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  message         text not null,
  points_tip      int not null default 0,
  created_at      timestamptz not null default now()
);

alter table comments enable row level security;

create policy "org members can read comments" on comments
  for select using (
    exists (
      select 1 from recognitions r
      where r.id = recognition_id and r.org_id = get_my_org_id()
    )
  );

create policy "users can insert own comments" on comments
  for insert with check (user_id = auth.uid());

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

-- No trigger needed — send_multi_recognition RPC handles all point logic directly.

-- ============================================================
-- MONTHLY ALLOWANCE RESET
-- Resets every user's giving budget back to 200 on the 1st of each month.
-- Earned points_balance is never touched — it accumulates forever.
-- ============================================================
create extension if not exists pg_cron;

create or replace function reset_monthly_allowances()
returns void language plpgsql security definer
as $$
begin
  update profiles set monthly_allowance = 200;
end;
$$;

-- Runs at midnight UTC on the 1st of every month
select cron.schedule(
  'reset-monthly-allowances',
  '0 0 1 * *',
  'select reset_monthly_allowances()'
);

-- ============================================================
-- SEND MULTI RECOGNITION RPC
-- Handles everything: validates allowance, inserts recognitions,
-- updates points, and writes audit log. No trigger dependency.
-- ============================================================
create or replace function send_multi_recognition(
  p_org_id    uuid,
  p_receivers uuid[],
  p_messages  text[],
  p_points    int,
  p_hashtags  text[]
)
returns void language plpgsql security definer
as $$
declare
  total_cost   int;
  rec_id       uuid;
  i            int;
begin
  total_cost := p_points * array_length(p_receivers, 1);

  -- Guard: giver must have enough monthly allowance
  if (select monthly_allowance from profiles where id = auth.uid()) < total_cost then
    raise exception 'insufficient_points';
  end if;

  -- Deduct full cost from giver's monthly giving budget in one shot
  update profiles
    set monthly_allowance = monthly_allowance - total_cost
  where id = auth.uid();

  for i in 1 .. array_length(p_receivers, 1) loop
    -- Insert recognition
    insert into recognitions (org_id, giver_id, receiver_id, message, points, hashtags)
    values (p_org_id, auth.uid(), p_receivers[i], p_messages[i], p_points, p_hashtags)
    returning id into rec_id;

    -- Credit receiver's earned balance
    update profiles
      set points_balance = points_balance + p_points
    where id = p_receivers[i];

    -- Audit: given
    insert into point_transactions (org_id, user_id, recognition_id, amount, kind)
    values (p_org_id, auth.uid(), rec_id, -p_points, 'given');

    -- Audit: received
    insert into point_transactions (org_id, user_id, recognition_id, amount, kind)
    values (p_org_id, p_receivers[i], rec_id, p_points, 'received');
  end loop;
end;
$$;

-- ============================================================
-- POST COMMENT RPC
-- Inserts comment, handles optional point tip (same logic as recognitions),
-- returns full comment row with user data so the UI can update immediately.
-- ============================================================
create or replace function post_comment(
  p_recognition_id uuid,
  p_message        text,
  p_points_tip     int default 0
)
returns json language plpgsql security definer
as $$
declare
  v_comment_id  uuid;
  v_org_id      uuid;
  v_receiver_id uuid;
  v_result      json;
begin
  -- Get org and recognition receiver
  select org_id, receiver_id into v_org_id, v_receiver_id
  from recognitions where id = p_recognition_id;

  -- Handle tip: deduct from commenter's monthly allowance, credit receiver
  if p_points_tip > 0 then
    if (select monthly_allowance from profiles where id = auth.uid()) < p_points_tip then
      raise exception 'insufficient_points';
    end if;

    update profiles set monthly_allowance = monthly_allowance - p_points_tip
    where id = auth.uid();

    update profiles set points_balance = points_balance + p_points_tip
    where id = v_receiver_id;

    insert into point_transactions (org_id, user_id, recognition_id, amount, kind)
    values (v_org_id, auth.uid(), p_recognition_id, -p_points_tip, 'given');

    insert into point_transactions (org_id, user_id, recognition_id, amount, kind)
    values (v_org_id, v_receiver_id, p_recognition_id, p_points_tip, 'received');
  end if;

  -- Insert the comment
  insert into comments (recognition_id, user_id, message, points_tip)
  values (p_recognition_id, auth.uid(), p_message, p_points_tip)
  returning id into v_comment_id;

  -- Return comment + author profile so UI updates immediately
  select json_build_object(
    'id',             c.id,
    'recognition_id', c.recognition_id,
    'user_id',        c.user_id,
    'message',        c.message,
    'points_tip',     c.points_tip,
    'created_at',     c.created_at,
    'user', json_build_object(
      'id',         p.id,
      'full_name',  p.full_name,
      'avatar_url', p.avatar_url
    )
  ) into v_result
  from comments c
  join profiles p on p.id = c.user_id
  where c.id = v_comment_id;

  return v_result;
end;
$$;

-- ============================================================
-- SEED DATA (demo org + users — optional for testing)
-- ============================================================
-- INSERT INTO organizations (name, slug) VALUES ('Acme Corp', 'acme-corp');
