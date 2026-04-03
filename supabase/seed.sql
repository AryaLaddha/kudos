-- ============================================================
-- RESET & SEED: Scape Organisation
-- Run this in the Supabase SQL Editor (requires postgres access)
-- Default password for all users: Welcome123!
-- ============================================================

-- 1. Wipe all transactional data (FK-safe order)
DELETE FROM point_transactions;
DELETE FROM reactions;
DELETE FROM comments;
DELETE FROM recognitions;
DELETE FROM profiles;
DELETE FROM auth.users;
DELETE FROM organizations;

-- 2. Create Scape organisation
INSERT INTO organizations (id, name, slug, monthly_allowance)
VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Scape', 'scape', 200);

-- 3. Create auth users (trigger handle_new_user auto-creates profiles with full_name)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'abigail.zamora@innovior.com.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Abigail Zamora"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'angelica.chavez@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Angelica Chavez"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'aniket.kushwaha@innovior.com.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Aniket Kushwaha"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'apurva.gaur@innovior.com.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Apurva Gaur"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'arya.laddha@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Arya Laddha"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Czyrene.Paguio@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Czyrene Paguio"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Devendra.Singh@innovior.com.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Devendra Singh"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Kim.Edar@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Kim Edar"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Michelle.Lamboso@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Jan Michelle Lamboso"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Izza.Diadio@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Johnna Izza Diadio"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Lara.Gatchalian@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Lara Gatchalian"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Leon.Shi@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Leon Shi"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Mithun.Srindhar@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Mithun Srindhar"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Nicka.Jacinto@innovior.com.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Nicka Jacinto"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Noah.Kawi@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Noah Kawi"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Santosh.Hazari@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Santosh Hazari"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'Paulene.Pascual@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Paulene Pascual"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(), 'authenticated', 'authenticated',
    'rachelle.brade@scape.com.au.invalid',
    crypt('Welcome123!', gen_salt('bf')),
    now(), '{"full_name":"Rachelle Brade"}'::jsonb,
    '{"provider":"email","providers":["email"]}'::jsonb,
    now(), now(), '', '', '', ''
  );

-- 4. Assign all newly created profiles to the Scape org
UPDATE profiles
SET org_id = 'aaaaaaaa-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- 5. Set org admins
UPDATE profiles
SET is_admin = true
WHERE id IN (
  SELECT p.id FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE au.email IN (
    'angelica.chavez@scape.com.au.invalid',
    'rachelle.brade@scape.com.au.invalid'
  )
);

-- ============================================================
-- Verification queries (run these to confirm):
-- SELECT count(*) FROM organizations;          -- expect: 1
-- SELECT count(*) FROM profiles;               -- expect: 18
-- SELECT count(*) FROM auth.users;             -- expect: 18
-- SELECT count(*) FROM recognitions;           -- expect: 0
-- SELECT full_name, monthly_allowance, points_balance, is_admin FROM profiles ORDER BY full_name;
-- ============================================================
