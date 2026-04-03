-- Sprints tables and RLS policies

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id text references public.orgs(id),
  name text not null,
  created_at timestamp with time zone default now()
);

-- Note: Since the admin dashboard is generally isolated by organization,
-- we ensure everything has an org_id column or link
CREATE TABLE IF NOT EXISTS public.sprints (
  id uuid primary key default gen_random_uuid(),
  org_id text references public.orgs(id) not null,
  name text not null,
  start_date date,
  end_date date,
  columns jsonb default '{"won": [], "deducted": []}'::jsonb, 
  created_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS public.sprint_participants (
  id uuid primary key default gen_random_uuid(),
  sprint_id uuid references public.sprints(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  base_points numeric default 20,
  scores jsonb default '{}'::jsonb,
  project_allocations jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  UNIQUE(sprint_id, user_id)
);

-- Setting RLS Policies
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_participants ENABLE ROW LEVEL SECURITY;

-- We want to check if the user is an admin for the organization.
-- RLS: Only admins can view, update, interact with SPRINTS.
-- Other users have ZERO visibility.

-- Projects policies (Admins completely manage)
CREATE POLICY "Admins manage projects" ON public.projects
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
      AND profiles.org_id = projects.org_id
    )
  );

-- Sprints policies (Admins completely manage)
CREATE POLICY "Admins manage sprints" ON public.sprints
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.is_admin = true
      AND profiles.org_id = sprints.org_id
    )
  );

-- Sprint Participants policies (Admins completely manage)
CREATE POLICY "Admins manage sprint_participants" ON public.sprint_participants
  AS PERMISSIVE FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sprints
      JOIN public.profiles ON profiles.org_id = sprints.org_id
      WHERE sprints.id = sprint_participants.sprint_id
      AND profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
