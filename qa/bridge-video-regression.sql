-- Rolled-back trigger test: repetitions and holds must remain distinct.
BEGIN;
DO $$
DECLARE target uuid; links jsonb;
BEGIN
 SELECT id INTO target FROM public.session_blocks WHERE title='Main Strength'
  AND jsonb_typeof(content->'items')='array' ORDER BY id LIMIT 1;
 IF target IS NULL THEN RAISE EXCEPTION 'A session block fixture is required'; END IF;
 UPDATE public.session_blocks SET content=jsonb_build_object(
  'items',jsonb_build_array('2 × 10 single-leg bridge','2 × 20s single-leg bridge hold','2 × 10 glute bridge','2 × 10 single-leg glute bridge'),
  'exerciseCodes',jsonb_build_array('ACT01','ACT02','ACT08'))
 WHERE id=target RETURNING content->'video_links' INTO links;
 IF jsonb_array_length(links)<>4 OR NOT links @> '[
  {"item_index":0,"exercise":"Single-Leg Glute Bridge"},
  {"item_index":1,"exercise":"Single-Leg Bridge Hold"},
  {"item_index":2,"exercise":"Glute Bridge"},
  {"item_index":3,"exercise":"Single-Leg Glute Bridge"}]'::jsonb
 THEN RAISE EXCEPTION 'Bridge video selection regression: %',links; END IF;
END $$;
ROLLBACK;
