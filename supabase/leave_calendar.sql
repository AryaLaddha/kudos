-- ============================================================
-- Leave Calendar
-- A shared, org-wide calendar of who is on leave and when.
-- Visible to every member of the org; each user manages only
-- their own leave entries.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS leaves (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- One of the known types, or 'custom' (label held in custom_label).
  leave_type   text NOT NULL CHECK (leave_type IN ('annual','sick','public_holiday','emergency','custom')),
  custom_label text,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- end must not precede start
  CONSTRAINT leaves_date_order CHECK (end_date >= start_date),
  -- a custom leave must carry a label
  CONSTRAINT leaves_custom_label CHECK (leave_type <> 'custom' OR (custom_label IS NOT NULL AND length(btrim(custom_label)) > 0))
);

-- Org-scoped, date-range queries drive every calendar fetch.
CREATE INDEX IF NOT EXISTS idx_leaves_org_dates
  ON leaves (org_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_leaves_user_id
  ON leaves (user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;

-- Everyone in the org can see the whole org's leave calendar.
CREATE POLICY "org members can read leaves" ON leaves
  FOR SELECT USING (org_id = get_my_org_id());

-- A user may add leave only for themselves, within their own org.
CREATE POLICY "users can insert own leave" ON leaves
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    org_id = get_my_org_id()
  );

-- A user may update only their own leave.
CREATE POLICY "users can update own leave" ON leaves
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND org_id = get_my_org_id());

-- A user may delete only their own leave. Admins may delete any in their org.
CREATE POLICY "users can delete own leave" ON leaves
  FOR DELETE USING (
    user_id = auth.uid() OR (
      org_id = get_my_org_id() AND
      (SELECT is_admin FROM profiles WHERE id = auth.uid() LIMIT 1)
    )
  );
