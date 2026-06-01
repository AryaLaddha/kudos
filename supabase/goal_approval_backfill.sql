-- ============================================================
-- Goal Approval — Backfill existing goals into the review queue
-- Run this AFTER goal_approval_migration.sql.
--
-- Puts goals created on/after a cutoff date back into the review
-- queue so they require admin approval. Adjust the cutoff below.
-- ============================================================

UPDATE user_goals
SET review_status   = 'review',
    rejection_reason = NULL,
    reviewed_at     = NULL,
    reviewed_by     = NULL
WHERE created_at >= '2026-06-01'      -- <-- change cutoff as needed
  AND review_status = 'approved';     -- leave already-rejected rows alone
