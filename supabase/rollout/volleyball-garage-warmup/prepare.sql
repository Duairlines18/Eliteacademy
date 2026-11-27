-- Set du.warmup_athlete and du.warmup_programme with SET LOCAL after BEGIN,
-- using the independently verified assignment IDs. Default execution rolls back.
BEGIN;
DO $garage_warmup$
DECLARE
  target_athlete uuid := current_setting('du.warmup_athlete')::uuid;
  target_programme uuid := current_setting('du.warmup_programme')::uuid;
  target_week uuid;
  preferred_name text;
  routine_day uuid;
BEGIN
  SELECT split_part(trim(display_name), ' ', 1) INTO STRICT preferred_name
  FROM public.athletes WHERE id = target_athlete AND programme_id = target_programme
    AND current_week = 11 AND parent_user_id IS NOT NULL AND access_status = 'active'
  FOR UPDATE;
  IF nullif(preferred_name, '') IS NULL OR EXISTS (
    SELECT 1 FROM public.athletes WHERE programme_id = target_programme AND id <> target_athlete
  ) THEN RAISE EXCEPTION 'Expected an individual parent-managed assignment'; END IF;

  SELECT id INTO STRICT target_week FROM public.programme_weeks
  WHERE programme_id = target_programme AND week_number = 11 AND tier_id IS NULL
    AND status = 'live' AND verification_status = 'verified' AND published_at IS NOT NULL
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.training_days d JOIN public.session_blocks b ON b.training_day_id = d.id
    WHERE d.programme_week_id = target_week AND b.content->>'assignedWarmUpAthleteId' = target_athlete::text
  ) THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.training_days WHERE programme_week_id = target_week) <> 3
    OR (SELECT count(*) FROM public.training_days d JOIN public.session_blocks b ON b.training_day_id = d.id
        WHERE d.programme_week_id = target_week AND b.block_type = 'warmup'
          AND b.title = 'My Du Airlines Warm-Up' AND b.sort_order = 1 AND b.saved_block_id IS NULL) <> 3
  THEN RAISE EXCEPTION 'Published Week 11 warm-up structure changed'; END IF;

  IF (SELECT count(DISTINCT code) FROM public.exercises WHERE active
      AND (code, video_id) IN (
        ('WU01','6Dlac5mxD6k'), ('MOB01','pW9QAqCau3Y'), ('ACT01','nD1CM76NlVs'),
        ('ACT06','vAUZlEFjM9U'), ('ISO01','tx3FFbtkTnk'), ('PLY03','l6kbuPq2aHU'),
        ('PLY10','B0Yd3lnlW2E')
      ) AND video_url = 'https://www.youtube.com/shorts/' || video_id) <> 7
  THEN RAISE EXCEPTION 'Reviewed exercise mapping changed'; END IF;

  INSERT INTO public.training_days (programme_week_id, day_key, title, objective, duration, sort_order)
  VALUES (target_week, 'Libero Garage Warm-Up', preferred_name || ' — Libero Garage Warm-Up',
    concat_ws(E'\n',
      'Use a mini resistance band, an exercise mat and three shuffle steps of clear space in each direction.',
      'Rest about 10–20 seconds between movements. Take more recovery after reactive exercises as needed.',
      'If your hip hurts, stop the movement that causes the discomfort and tell Coach Du.'),
    'About 8–12 minutes', 90)
  RETURNING id INTO routine_day;

  INSERT INTO public.session_blocks (training_day_id, block_type, title, sort_order, content)
  VALUES
    (routine_day, 'warmup', 'Phase 1 — Mobility & Activation', 0,
      jsonb_build_object('routineKind', 'warm-up', 'assignedWarmUpProgrammeId', target_programme,
        'assignedWarmUpAthleteId', target_athlete, 'carryForward', true, 'prescriptions', '[
        {"exerciseCode":"WU01","dosage":"1 × 8 each ankle","cues":"Keep your heel down and move your knee gently forward to prepare the ankle."},
        {"exerciseCode":"MOB01","dosage":"1 × 5 each side","cues":"Rotate through a comfortable range to prepare your hips. Stay tall and control the switch."},
        {"exerciseCode":"ACT01","dosage":"1 × 10","cues":"Squeeze your glutes to lift. Keep your ribs down and avoid arching your lower back."}
      ]'::jsonb)),
    (routine_day, 'warmup', 'Phase 2 — Defensive Position & Control', 1, '{
      "prescriptions":[
        {"exerciseCode":"ACT06","dosage":"1 × 8 steps each direction","cues":"Keep hips back and knees tracking over toes. Step to the side with a steady trunk and eyes forward."},
        {"exerciseCode":"ISO01","dosage":"2 × 15 seconds","cues":"Set your hips back and track your knees over your toes. Hold a steady trunk and chest, with your eyes forward."}
      ]}'::jsonb),
    (routine_day, 'warmup', 'Phase 3 — Reactive Feet & Lateral Control', 2, '{
      "prescriptions":[
        {"exerciseCode":"PLY03","dosage":"2 × 8","cues":"Keep the contacts quick and quiet. Use small bounces."},
        {"exerciseCode":"PLY10","dosage":"1 × 4 each side","cues":"Use small, controlled side-to-side bounds. Land quietly and stick each landing before you repeat."}
      ]}'::jsonb),
    (routine_day, 'warmup', 'Phase 4 — Libero Defensive Shuffle', 3,
      jsonb_build_object('writtenOnly', true, 'items', jsonb_build_array(
        '3-Step Defensive Shuffle — 3–4 rounds; Start in a low volleyball defensive stance. Shuffle three steps right and return to center. Shuffle three steps left and return to center. Stay low and controlled, keep your eyes forward and avoid crossing your feet.'
      )));
END
$garage_warmup$;
ROLLBACK;
