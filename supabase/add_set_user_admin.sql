-- ============================================================
-- ADMIN RPC: SET USER ADMIN STATUS
-- Uses inline subqueries instead of DECLARE variables to avoid
-- Supabase SQL editor semicolon-splitting issues.
-- ============================================================
create or replace function set_user_admin(
  p_user_id uuid,
  p_is_admin boolean
)
returns void language plpgsql security definer
as $$
begin
  -- Only admins may call this
  if not (select is_admin from profiles where id = auth.uid()) then
    raise exception 'unauthorized';
  end if;

  -- Prevent cross-org escalation
  if (select org_id from profiles where id = auth.uid()) <>
     (select org_id from profiles where id = p_user_id) then
    raise exception 'org_mismatch';
  end if;

  -- Prevent demoting yourself
  if p_user_id = auth.uid() and not p_is_admin then
    raise exception 'cannot_demote_self';
  end if;

  update profiles set is_admin = p_is_admin where id = p_user_id;
end;
$$;
