-- ============================================================
-- Fix handle_new_user trigger so createUser() doesn't fail.
-- Sets org_id + full_name from user_metadata if present,
-- and wraps the insert in an exception handler so auth user
-- creation never rolls back due to a profile insert error.
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer
as $$
begin
  insert into profiles (id, full_name, avatar_url, org_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    (new.raw_user_meta_data->>'org_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Log but don't block auth user creation
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end;
$$;
