-- ============================================================
-- TEST DATA SEED — Scape Organisation
-- Run the ADD block in Supabase SQL Editor to insert data.
-- Run the ROLLBACK block at the bottom to cleanly remove it.
-- ============================================================

DO $$
DECLARE
  v_org_id  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';

  -- Profile IDs (resolved by full_name)
  v_abigail  uuid; v_angelica uuid; v_aniket   uuid;
  v_apurva   uuid; v_arya     uuid; v_czyrene  uuid;
  v_devendra uuid; v_kim      uuid; v_michelle uuid;
  v_izza     uuid; v_lara     uuid; v_leon     uuid;
  v_mithun   uuid; v_nicka    uuid; v_noah     uuid;
  v_santosh  uuid; v_paulene  uuid; v_rachelle uuid;

  -- Project IDs
  v_portal    uuid;
  v_sf_auto   uuid;
  v_migration uuid;
  v_service   uuid;

  -- Sprint ID
  v_sprint uuid;

BEGIN
  -- ── Resolve Profile IDs ──────────────────────────────────────
  SELECT id INTO v_abigail  FROM profiles WHERE full_name = 'Abigail Zamora'       AND org_id = v_org_id;
  SELECT id INTO v_angelica FROM profiles WHERE full_name = 'Angelica Chavez'      AND org_id = v_org_id;
  SELECT id INTO v_aniket   FROM profiles WHERE full_name = 'Aniket Kushwaha'      AND org_id = v_org_id;
  SELECT id INTO v_apurva   FROM profiles WHERE full_name = 'Apurva Gaur'          AND org_id = v_org_id;
  SELECT id INTO v_arya     FROM profiles WHERE full_name = 'Arya Laddha'          AND org_id = v_org_id;
  SELECT id INTO v_czyrene  FROM profiles WHERE full_name = 'Czyrene Paguio'       AND org_id = v_org_id;
  SELECT id INTO v_devendra FROM profiles WHERE full_name = 'Devendra Singh'       AND org_id = v_org_id;
  SELECT id INTO v_kim      FROM profiles WHERE full_name = 'Kim Edar'             AND org_id = v_org_id;
  SELECT id INTO v_michelle FROM profiles WHERE full_name = 'Jan Michelle Lamboso' AND org_id = v_org_id;
  SELECT id INTO v_izza     FROM profiles WHERE full_name = 'Johnna Izza Diadio'   AND org_id = v_org_id;
  SELECT id INTO v_lara     FROM profiles WHERE full_name = 'Lara Gatchalian'      AND org_id = v_org_id;
  SELECT id INTO v_leon     FROM profiles WHERE full_name = 'Leon Shi'             AND org_id = v_org_id;
  SELECT id INTO v_mithun   FROM profiles WHERE full_name = 'Mithun Srindhar'      AND org_id = v_org_id;
  SELECT id INTO v_nicka    FROM profiles WHERE full_name = 'Nicka Jacinto'        AND org_id = v_org_id;
  SELECT id INTO v_noah     FROM profiles WHERE full_name = 'Noah Kawi'            AND org_id = v_org_id;
  SELECT id INTO v_santosh  FROM profiles WHERE full_name = 'Santosh Hazari'       AND org_id = v_org_id;
  SELECT id INTO v_paulene  FROM profiles WHERE full_name = 'Paulene Pascual'      AND org_id = v_org_id;
  SELECT id INTO v_rachelle FROM profiles WHERE full_name = 'Rachelle Brade'       AND org_id = v_org_id;

  -- ── Projects ─────────────────────────────────────────────────
  INSERT INTO projects (org_id, name)
    VALUES (v_org_id, 'Customer Portal Redesign')  RETURNING id INTO v_portal;
  INSERT INTO projects (org_id, name)
    VALUES (v_org_id, 'Salesforce Automation')     RETURNING id INTO v_sf_auto;
  INSERT INTO projects (org_id, name)
    VALUES (v_org_id, 'Data Migration')            RETURNING id INTO v_migration;
  INSERT INTO projects (org_id, name)
    VALUES (v_org_id, 'Service Cloud Optimisation') RETURNING id INTO v_service;

  -- ── Sprint ───────────────────────────────────────────────────
  INSERT INTO sprints (org_id, name, start_date, end_date, columns)
  VALUES (
    v_org_id,
    'Q2 Sprint 1',
    '2026-04-01',
    '2026-04-30',
    '{"won":[{"id":"extra","name":"Extra Points"},{"id":"recognition","name":"Recognition"},{"id":"other_won","name":"Other"}],"deducted":[{"id":"subtasks","name":"Subtasks Status"},{"id":"bugs","name":"Bugs?"},{"id":"documentation","name":"Documentation"},{"id":"engagement","name":"Engagement"},{"id":"video_cam","name":"Video Cam"},{"id":"comms","name":"Comms"},{"id":"others","name":"Others"},{"id":"absences","name":"Absences"}]}'::jsonb
  ) RETURNING id INTO v_sprint;

  -- ── Sprint Participants with Project Allocations ──────────────
  -- project_allocations format: { "project_id": percentage }
  INSERT INTO sprint_participants (sprint_id, user_id, base_points, scores, project_allocations) VALUES
  (v_sprint, v_arya,     20, '{}', jsonb_build_object(v_portal::text, 60, v_sf_auto::text,   40)),
  (v_sprint, v_leon,     20, '{}', jsonb_build_object(v_portal::text, 30, v_sf_auto::text,   70)),
  (v_sprint, v_lara,     20, '{}', jsonb_build_object(v_migration::text, 100)),
  (v_sprint, v_noah,     20, '{}', jsonb_build_object(v_portal::text, 50, v_service::text,   50)),
  (v_sprint, v_kim,      20, '{}', jsonb_build_object(v_sf_auto::text, 20, v_service::text,  80)),
  (v_sprint, v_mithun,   20, '{}', jsonb_build_object(v_sf_auto::text, 60, v_migration::text,40)),
  (v_sprint, v_santosh,  20, '{}', jsonb_build_object(v_portal::text, 30, v_migration::text, 70)),
  (v_sprint, v_paulene,  20, '{}', jsonb_build_object(v_service::text, 100)),
  (v_sprint, v_czyrene,  20, '{}', jsonb_build_object(v_portal::text, 40, v_sf_auto::text,   60));

  -- ── Recognitions ─────────────────────────────────────────────
  -- Single-receiver recognitions
  INSERT INTO recognitions
    (org_id, giver_id, receiver_id, receiver_ids, message, points, hashtags, created_at)
  VALUES
    -- 1. Arya → Noah
    (v_org_id, v_arya,     v_noah,     ARRAY[v_noah],
     'Noah jumped in to debug a tricky Flow issue without being asked. Saved the team hours.',
     25, ARRAY['teamwork','delivery'],      now() - interval '12 days'),

    -- 2. Arya → Kim
    (v_org_id, v_arya,     v_kim,      ARRAY[v_kim],
     'Kim''s documentation this sprint has been outstanding — the whole team is benefiting.',
     20, ARRAY['quality','teamwork'],       now() - interval '10 days'),

    -- 3. Leon → Arya
    (v_org_id, v_leon,     v_arya,     ARRAY[v_arya],
     'Arya delivered the customer portal integration flawlessly on first deployment. Rare skill.',
     30, ARRAY['delivery','quality'],       now() - interval '8 days'),

    -- 4. Angelica → Arya
    (v_org_id, v_angelica, v_arya,     ARRAY[v_arya],
     'Arya''s sprint reporting has been detailed and on time every week. Brilliant consistency.',
     20, ARRAY['delivery'],                 now() - interval '6 days'),

    -- 5. Devendra → Arya
    (v_org_id, v_devendra, v_arya,     ARRAY[v_arya],
     'Arya''s sprint reporting keeps everyone aligned. Goes above and beyond every cycle.',
     15, ARRAY['delivery'],                 now() - interval '2 days'),

    -- 6. Mithun → Leon
    (v_org_id, v_mithun,   v_leon,     ARRAY[v_leon],
     'Leon built a reusable LWC component that''s already saved the team two full days of work.',
     25, ARRAY['innovation','efficiency'],  now() - interval '11 days'),

    -- 7. Johnna Izza → Leon
    (v_org_id, v_izza,     v_leon,     ARRAY[v_leon],
     'Leon''s post-impl review insights led to three actionable changes. Great leadership shown.',
     20, ARRAY['leadership','quality'],     now() - interval '4 days'),

    -- 8. Noah → Mithun
    (v_org_id, v_noah,     v_mithun,   ARRAY[v_mithun],
     'Mithun caught a critical bug before UAT and had it fixed same afternoon. Total lifesaver.',
     25, ARRAY['quality','delivery'],       now() - interval '9 days'),

    -- 10. Rachelle → Lara
    (v_org_id, v_rachelle, v_lara,     ARRAY[v_lara],
     'Lara onboarded our new team member seamlessly and kept sprints on track the whole time.',
     30, ARRAY['mentorship','leadership'],  now() - interval '7 days'),

    -- 12. Kim → Paulene
    (v_org_id, v_kim,      v_paulene,  ARRAY[v_paulene],
     'Paulene''s user stories are always crisp and well-reasoned — sprint planning is so much smoother.',
     15, ARRAY['quality','collaboration'],  now() - interval '13 days'),

    -- 13. Rachelle → Paulene
    (v_org_id, v_rachelle, v_paulene,  ARRAY[v_paulene],
     'Paulene consistently produces the clearest user stories on the team.',
     20, ARRAY['quality'],                 now() - interval '5 days'),

    -- 14. Lara → Czyrene
    (v_org_id, v_lara,     v_czyrene,  ARRAY[v_czyrene],
     'Czyrene proposed a process change that cut our deployment prep time in half. Massive win.',
     30, ARRAY['innovation','efficiency'], now() - interval '6 days'),

    -- 15. Leon → Czyrene
    (v_org_id, v_leon,     v_czyrene,  ARRAY[v_czyrene],
     'Czyrene''s process improvement doc is already being used as the team standard. Incredible initiative.',
     20, ARRAY['innovation'],              now() - interval '3 days'),

    -- 16. Santosh → Jan Michelle
    (v_org_id, v_santosh,  v_michelle, ARRAY[v_michelle],
     'Jan Michelle''s cross-team collaboration on the migration project was exceptional.',
     20, ARRAY['teamwork','collaboration'], now() - interval '10 days'),

    -- 17. Angelica → Jan Michelle
    (v_org_id, v_angelica, v_michelle, ARRAY[v_michelle],
     'Jan Michelle stepped up as sprint lead while I was out. Handled it like a complete pro.',
     25, ARRAY['leadership','teamwork'],   now() - interval '2 days'),

    -- 18. Czyrene → Santosh
    (v_org_id, v_czyrene,  v_santosh,  ARRAY[v_santosh],
     'Santosh ran an amazing knowledge-share on Flow best practices. Everyone learned something.',
     15, ARRAY['mentorship','innovation'], now() - interval '8 days'),

    -- 20. Paulene → Aniket
    (v_org_id, v_paulene,  v_aniket,   ARRAY[v_aniket],
     'Aniket got up to speed on the new Salesforce product so quickly and is already contributing.',
     20, ARRAY['delivery','teamwork'],     now() - interval '5 days'),

    -- 21. Lara → Aniket
    (v_org_id, v_lara,     v_aniket,   ARRAY[v_aniket],
     'Aniket onboarded to the new module in record time and was contributing before sprint ended.',
     20, ARRAY['delivery'],               now() - interval '1 day'),

    -- 22. Jan Michelle → Devendra
    (v_org_id, v_michelle, v_devendra, ARRAY[v_devendra],
     'Devendra''s research spike on integration options was thorough and saved us from a costly mistake.',
     25, ARRAY['quality','innovation'],   now() - interval '9 days'),

    -- 23. Kim → Devendra
    (v_org_id, v_kim,      v_devendra, ARRAY[v_devendra],
     'Devendra''s research on third-party integration saved us from a very expensive wrong turn.',
     20, ARRAY['quality'],               now() - interval '4 days'),

    -- 24. Aniket → Abigail
    (v_org_id, v_aniket,   v_abigail,  ARRAY[v_abigail],
     'Abigail handled client-side testing with zero escalations. Super reliable all sprint.',
     20, ARRAY['quality','delivery'],    now() - interval '7 days'),

    -- 25. Mithun → Abigail
    (v_org_id, v_mithun,   v_abigail,  ARRAY[v_abigail],
     'Abigail''s testing methodology caught issues before they reached staging. Exactly what we needed.',
     15, ARRAY['quality'],              now() - interval '3 days'),

    -- 26. Devendra → Nicka
    (v_org_id, v_devendra, v_nicka,    ARRAY[v_nicka],
     'Nicka''s collaboration with the UX team on the portal was seamless — great bridge between teams.',
     15, ARRAY['collaboration','teamwork'], now() - interval '11 days'),

    -- 27. Paulene → Nicka
    (v_org_id, v_paulene,  v_nicka,    ARRAY[v_nicka],
     'Nicka bridges the gap between tech and stakeholders better than anyone. Great communicator.',
     20, ARRAY['collaboration'],        now() - interval '6 days'),

    -- 28. Nicka → Johnna Izza
    (v_org_id, v_nicka,    v_izza,     ARRAY[v_izza],
     'Izza raised three QA issues nobody else spotted. Sharp eye — made the release much cleaner.',
     20, ARRAY['quality'],             now() - interval '8 days'),

    -- 29. Czyrene → Johnna Izza
    (v_org_id, v_czyrene,  v_izza,     ARRAY[v_izza],
     'Izza''s QA eye is unmatched. Every sprint she catches something critical before it ships.',
     20, ARRAY['quality'],             now() - interval '5 days'),

    -- 30. Abigail → Apurva
    (v_org_id, v_abigail,  v_apurva,   ARRAY[v_apurva],
     'Apurva''s automation proposal got accepted into the backlog — well-structured thinking.',
     15, ARRAY['innovation','collaboration'], now() - interval '3 days'),

    -- 31. Santosh → Apurva
    (v_org_id, v_santosh,  v_apurva,   ARRAY[v_apurva],
     'Apurva''s automation proposal was the highlight of our sprint retro — very well thought out.',
     20, ARRAY['innovation'],          now() - interval '1 day'),

    -- 32. Apurva → Rachelle
    (v_org_id, v_apurva,   v_rachelle, ARRAY[v_rachelle],
     'Rachelle''s admin support and sprint facilitation keeps us all aligned. Couldn''t do it without her.',
     25, ARRAY['leadership'],          now() - interval '6 days'),

    -- 33. Aniket → Rachelle
    (v_org_id, v_aniket,   v_rachelle, ARRAY[v_rachelle],
     'Rachelle keeps the whole team accountable without pressure. Real, effective leadership.',
     25, ARRAY['leadership'],          now() - interval '2 days'),

    -- 34. Noah → Angelica
    (v_org_id, v_noah,     v_angelica, ARRAY[v_angelica],
     'Angelica''s handling of the client escalation was calm and professional — resolved in record time.',
     25, ARRAY['leadership'],          now() - interval '7 days'),

    -- 35. Mithun → Angelica
    (v_org_id, v_mithun,   v_angelica, ARRAY[v_angelica],
     'Angelica''s facilitation of the cross-team workshop was excellent — everyone left aligned.',
     25, ARRAY['leadership','collaboration'], now() - interval '4 days'),

    -- 36. Rachelle → Noah
    (v_org_id, v_rachelle, v_noah,     ARRAY[v_noah],
     'Noah has been incredibly reliable this sprint — dependable and proactive.',
     20, ARRAY['teamwork'],            now() - interval '1 day');

  -- 9. Arya → Mithun + Santosh (multi-receiver, same message)
  INSERT INTO recognitions
    (org_id, giver_id, receiver_id, receiver_ids, message, points, hashtags, created_at)
  VALUES
    (v_org_id, v_arya, v_mithun, ARRAY[v_mithun, v_santosh],
     'Mithun and Santosh''s teamwork on the data sync feature was textbook — clean, documented, delivered.',
     20, ARRAY['teamwork','delivery'], now() - interval '5 days'),
    (v_org_id, v_arya, v_santosh, ARRAY[v_mithun, v_santosh],
     'Mithun and Santosh''s teamwork on the data sync feature was textbook — clean, documented, delivered.',
     20, ARRAY['teamwork','delivery'], now() - interval '5 days');

  -- 11. Angelica → Lara + Kim (multi-receiver)
  INSERT INTO recognitions
    (org_id, giver_id, receiver_id, receiver_ids, message, points, hashtags, created_at)
  VALUES
    (v_org_id, v_angelica, v_lara, ARRAY[v_lara, v_kim],
     'Both Lara and Kim went above and beyond to get Friday''s release over the line. Heroes!',
     30, ARRAY['teamwork','delivery'], now() - interval '1 day'),
    (v_org_id, v_angelica, v_kim,  ARRAY[v_lara, v_kim],
     'Both Lara and Kim went above and beyond to get Friday''s release over the line. Heroes!',
     30, ARRAY['teamwork','delivery'], now() - interval '1 day');

  -- ── Update Points Balances (earned kudos points) ──────────────
  -- Arya:     Leon(30) + Angelica(20) + Devendra(15) = 65
  -- Leon:     Mithun(25) + Izza(20) = 45
  -- Noah:     Arya(25) + Rachelle(20) = 45
  -- Kim:      Arya(20) + Angelica multi(30) = 50
  -- Lara:     Rachelle(30) + Angelica multi(30) = 60
  -- Mithun:   Noah(25) + Arya multi(20) = 45
  -- Paulene:  Kim(15) + Rachelle(20) = 35
  -- Czyrene:  Lara(30) + Leon(20) = 50
  -- Michelle: Santosh(20) + Angelica(25) = 45
  -- Santosh:  Arya multi(20) + Czyrene(15) = 35
  -- Aniket:   Paulene(20) + Lara(20) = 40
  -- Devendra: Michelle(25) + Kim(20) = 45
  -- Abigail:  Aniket(20) + Mithun(15) = 35
  -- Nicka:    Devendra(15) + Paulene(20) = 35
  -- Izza:     Nicka(20) + Czyrene(20) = 40
  -- Apurva:   Abigail(15) + Santosh(20) = 35
  -- Rachelle: Apurva(25) + Aniket(25) = 50
  -- Angelica: Noah(25) + Mithun(25) = 50
  UPDATE profiles SET points_balance = points_balance + 65 WHERE id = v_arya;
  UPDATE profiles SET points_balance = points_balance + 45 WHERE id = v_leon;
  UPDATE profiles SET points_balance = points_balance + 45 WHERE id = v_noah;
  UPDATE profiles SET points_balance = points_balance + 50 WHERE id = v_kim;
  UPDATE profiles SET points_balance = points_balance + 60 WHERE id = v_lara;
  UPDATE profiles SET points_balance = points_balance + 45 WHERE id = v_mithun;
  UPDATE profiles SET points_balance = points_balance + 35 WHERE id = v_paulene;
  UPDATE profiles SET points_balance = points_balance + 50 WHERE id = v_czyrene;
  UPDATE profiles SET points_balance = points_balance + 45 WHERE id = v_michelle;
  UPDATE profiles SET points_balance = points_balance + 35 WHERE id = v_santosh;
  UPDATE profiles SET points_balance = points_balance + 40 WHERE id = v_aniket;
  UPDATE profiles SET points_balance = points_balance + 45 WHERE id = v_devendra;
  UPDATE profiles SET points_balance = points_balance + 35 WHERE id = v_abigail;
  UPDATE profiles SET points_balance = points_balance + 35 WHERE id = v_nicka;
  UPDATE profiles SET points_balance = points_balance + 40 WHERE id = v_izza;
  UPDATE profiles SET points_balance = points_balance + 35 WHERE id = v_apurva;
  UPDATE profiles SET points_balance = points_balance + 50 WHERE id = v_rachelle;
  UPDATE profiles SET points_balance = points_balance + 50 WHERE id = v_angelica;

  -- ── Update Monthly Allowances (remaining after giving) ────────
  -- Arya:     200 - (25+20+40) = 115
  -- Leon:     200 - (30+20) = 150
  -- Angelica: 200 - (20+60+25) = 95
  -- Devendra: 200 - (15+15) = 170
  -- Mithun:   200 - (25+15+25) = 135
  -- Izza:     200 - 20 = 180
  -- Noah:     200 - (25+25) = 150
  -- Rachelle: 200 - (30+20+20) = 130
  -- Kim:      200 - (15+20) = 165
  -- Lara:     200 - (30+20) = 150
  -- Santosh:  200 - (20+20) = 160
  -- Czyrene:  200 - (15+20) = 165
  -- Paulene:  200 - (20+20) = 160
  -- Michelle: 200 - 25 = 175
  -- Aniket:   200 - (20+25) = 155
  -- Abigail:  200 - 15 = 185
  -- Apurva:   200 - 25 = 175
  -- Nicka:    200 - 20 = 180
  UPDATE profiles SET monthly_allowance = 115 WHERE id = v_arya;
  UPDATE profiles SET monthly_allowance = 150 WHERE id = v_leon;
  UPDATE profiles SET monthly_allowance =  95 WHERE id = v_angelica;
  UPDATE profiles SET monthly_allowance = 170 WHERE id = v_devendra;
  UPDATE profiles SET monthly_allowance = 135 WHERE id = v_mithun;
  UPDATE profiles SET monthly_allowance = 180 WHERE id = v_izza;
  UPDATE profiles SET monthly_allowance = 150 WHERE id = v_noah;
  UPDATE profiles SET monthly_allowance = 130 WHERE id = v_rachelle;
  UPDATE profiles SET monthly_allowance = 165 WHERE id = v_kim;
  UPDATE profiles SET monthly_allowance = 150 WHERE id = v_lara;
  UPDATE profiles SET monthly_allowance = 160 WHERE id = v_santosh;
  UPDATE profiles SET monthly_allowance = 165 WHERE id = v_czyrene;
  UPDATE profiles SET monthly_allowance = 160 WHERE id = v_paulene;
  UPDATE profiles SET monthly_allowance = 175 WHERE id = v_michelle;
  UPDATE profiles SET monthly_allowance = 155 WHERE id = v_aniket;
  UPDATE profiles SET monthly_allowance = 185 WHERE id = v_abigail;
  UPDATE profiles SET monthly_allowance = 175 WHERE id = v_apurva;
  UPDATE profiles SET monthly_allowance = 180 WHERE id = v_nicka;

  -- ── User Goals ────────────────────────────────────────────────
  INSERT INTO user_goals (user_id, org_id, goal_id, status, description) VALUES

  -- Arya Laddha — 3 achieved
  (v_arya, v_org_id, 'sprint_on_time_delivery', 'achieved',
   'Delivered all tasks on time across Q1 Sprint 3 and Q1 Sprint 4 with zero carry-over items.'),
  (v_arya, v_org_id, 'learning_certification', 'achieved',
   'Passed the Salesforce Platform App Builder certification in March 2026.'),
  (v_arya, v_org_id, 'growth_demo_session', 'achieved',
   'Presented a customer portal deep-dive to the wider Scape team in Sprint 3 review.'),

  -- Leon Shi — 3 achieved
  (v_leon, v_org_id, 'productivity_reusable_component', 'achieved',
   'Built and documented a reusable LWC data-table component now used across 4 projects.'),
  (v_leon, v_org_id, 'collab_zero_defects', 'achieved',
   'Zero critical defects raised against Leon''s deliverables throughout Q1.'),
  (v_leon, v_org_id, 'sprint_exceeds_expectation', 'achieved',
   'Rated "exceeds expectation" in Q1 Sprint 4 review for the automation engine delivery.'),

  -- Lara Gatchalian — 3 achieved
  (v_lara, v_org_id, 'learning_superbadge', 'achieved',
   'Completed the Apex Specialist Superbadge on Trailhead.'),
  (v_lara, v_org_id, 'growth_onboard_mentor', 'achieved',
   'Mentored Aniket through his first sprint, pairing daily and reviewing all deliverables.'),
  (v_lara, v_org_id, 'collab_stakeholder_feedback', 'achieved',
   'Received formal positive feedback from the Scape facilities stakeholder via email after the portal launch.'),

  -- Noah Kawi — 2 achieved + 1 aim
  (v_noah, v_org_id, 'sprint_bug_before_uat', 'achieved',
   'Identified and resolved a data-binding bug in the portal component before it reached UAT.'),
  (v_noah, v_org_id, 'learning_trailhead_badge', 'achieved',
   'Completed the Flow Basics Trailhead badge tied to the current automation sprint.'),
  (v_noah, v_org_id, 'sprint_exceeds_expectation', 'aim',
   'Targeting an "exceeds expectation" rating in Q2 Sprint 1 for the service cloud integration.'),

  -- Kim Edar — 2 achieved
  (v_kim, v_org_id, 'growth_document_process', 'achieved',
   'Documented the full data migration process and integration specs in Confluence.'),
  (v_kim, v_org_id, 'productivity_code_review', 'achieved',
   'Completed peer config reviews for 5 sprint deliverables in Q1 Sprint 3.'),

  -- Mithun Srindhar — 2 achieved
  (v_mithun, v_org_id, 'sprint_on_time_delivery', 'achieved',
   'Zero carry-over items across Q1 Sprint 2 and Q1 Sprint 3.'),
  (v_mithun, v_org_id, 'growth_feature_proposal', 'achieved',
   'Proposed a batch-processing optimisation that was accepted into the Q2 product backlog.'),

  -- Santosh Hazari — 2 achieved
  (v_santosh, v_org_id, 'learning_webinar_summary', 'achieved',
   'Attended the Salesforce Flow Best Practices webinar and shared a written summary with the team.'),
  (v_santosh, v_org_id, 'collab_cross_functional_pairing', 'achieved',
   'Paired with Czyrene on a sprint task to improve the deployment checklist process.'),

  -- Paulene Pascual — 2 achieved
  (v_paulene, v_org_id, 'sprint_user_story', 'achieved',
   'Submitted a fully documented user story for the service cloud module, accepted without revision.'),
  (v_paulene, v_org_id, 'growth_post_implementation_review', 'achieved',
   'Led the post-implementation review for the customer portal launch with three team-adopted insights.'),

  -- Czyrene Paguio — 2 achieved
  (v_czyrene, v_org_id, 'productivity_process_improvement', 'achieved',
   'Redesigned the deployment checklist, reducing prep time by 50% — adopted as team standard.'),
  (v_czyrene, v_org_id, 'collab_qa_improvements', 'achieved',
   'Submitted 3 QA process improvements accepted in Q1 Sprint 4, reducing regression issues.'),

  -- Jan Michelle Lamboso — 1 achieved
  (v_michelle, v_org_id, 'growth_demo_session', 'achieved',
   'Presented a cross-team knowledge-share on data migration best practices attended by 12 people.'),

  -- Aniket Kushwaha — 1 achieved
  (v_aniket, v_org_id, 'learning_onboarding', 'achieved',
   'Completed onboarding to the new Salesforce Service Cloud module relevant to Q2 roadmap.'),

  -- Abigail Zamora — 1 achieved
  (v_abigail, v_org_id, 'sprint_spike_task', 'achieved',
   'Completed an integration research spike and presented findings that informed the portal architecture.'),

  -- Apurva Gaur — 0 achieved, 2 aim
  (v_apurva, v_org_id, 'learning_certification', 'aim',
   'Working towards the Salesforce Admin certification — exam booked for May 2026.'),
  (v_apurva, v_org_id, 'productivity_automation', 'aim',
   'Developing a case-routing automation to reduce average resolution time across Q2.'),

  -- Devendra Singh — 0 achieved, 1 aim
  (v_devendra, v_org_id, 'sprint_on_time_delivery', 'aim',
   'Aiming for zero carry-over across Q2 Sprint 1 and Q2 Sprint 2.'),

  -- Nicka Jacinto — 0 achieved, 2 aim
  (v_nicka, v_org_id, 'collab_zero_defects', 'aim',
   'Working towards zero critical defects across all Q2 deliverables.'),
  (v_nicka, v_org_id, 'growth_onboard_mentor', 'aim',
   'Planning to mentor the next new team member joining in Q2.'),

  -- Johnna Izza Diadio — 0 achieved, 1 aim
  (v_izza, v_org_id, 'learning_superbadge', 'aim',
   'Working through the Lightning Web Components Specialist Superbadge on Trailhead.'),

  -- Angelica Chavez — 0 achieved, 1 aim
  (v_angelica, v_org_id, 'productivity_process_improvement', 'aim',
   'Mapping out a sprint facilitation improvement to reduce planning overhead by 30%.'),

  -- Rachelle Brade — 0 achieved, 0 aim (intentionally clean)
  -- (no rows)

  -- (dummy trailing value to close the VALUES list cleanly — not needed, last row above is fine)
  -- Just end with a semicolon on the INSERT
  ;

END;
$$;

-- ============================================================
-- VERIFICATION QUERIES (run these to check data was inserted)
-- ============================================================
-- SELECT full_name, points_balance, monthly_allowance FROM profiles ORDER BY points_balance DESC;
-- SELECT count(*) FROM recognitions;        -- expect: 38 rows (36 singles + 2×2 multi)
-- SELECT count(*) FROM user_goals;          -- expect: 34 rows
-- SELECT count(*) FROM projects;            -- expect: 4
-- SELECT count(*) FROM sprints;             -- expect: 1
-- SELECT count(*) FROM sprint_participants; -- expect: 9


-- ============================================================
-- ROLLBACK — removes all test data, resets points to zero
-- Run this block independently to clean everything up
-- ============================================================

/*
DO $$
DECLARE
  v_org_id uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
BEGIN
  -- Remove all user goals for the org
  DELETE FROM user_goals WHERE org_id = v_org_id;

  -- Remove all recognitions for the org
  DELETE FROM recognitions WHERE org_id = v_org_id;

  -- Remove sprint (cascades sprint_participants)
  DELETE FROM sprints WHERE org_id = v_org_id AND name = 'Q2 Sprint 1';

  -- Remove projects
  DELETE FROM projects WHERE org_id = v_org_id AND name IN (
    'Customer Portal Redesign',
    'Salesforce Automation',
    'Data Migration',
    'Service Cloud Optimisation'
  );

  -- Reset all points balances and monthly allowances back to defaults
  UPDATE profiles
  SET points_balance    = 0,
      monthly_allowance = 200
  WHERE org_id = v_org_id;

END;
$$;
*/
