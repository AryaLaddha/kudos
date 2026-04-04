-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add status column to sprints
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.sprints
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'completed'));

-- Back-fill any existing rows that were inserted before this column existed
UPDATE public.sprints SET status = 'active' WHERE status IS NULL;
