-- Video matching regression audit (read-only).
-- Run before and after applying any matcher change.
-- An unlinked running prescription is not automatically a missing demonstration.
WITH indexed AS (
 SELECT b.id AS block_id, d.day_key, w.week_number, p.name AS programme,
        (i.ordinality - 1)::int AS item_index, i.item AS prescription,
        coalesce(b.content->'video_links','[]'::jsonb) AS video_links
 FROM public.session_blocks b
 JOIN public.training_days d ON d.id=b.training_day_id
 JOIN public.programme_weeks w ON w.id=d.programme_week_id
 JOIN public.programmes p ON p.id=w.programme_id
 CROSS JOIN LATERAL jsonb_array_elements_text(
   CASE WHEN jsonb_typeof(b.content->'items')='array'
        THEN b.content->'items' ELSE '[]'::jsonb END
 ) WITH ORDINALITY i(item,ordinality)
)
SELECT programme,week_number,day_key,block_id,item_index,prescription,
       video_links
FROM indexed
WHERE programme ILIKE '%Mphatso%' AND week_number IN (6,7)
ORDER BY week_number,day_key,block_id,item_index;

-- Explicit known false-positive detector: an item containing a single-leg
-- glute bridge must not display the ordinary glute bridge as a substitute.
SELECT b.id,b.title,i.item AS prescription,link.value AS linked_demo
FROM public.session_blocks b
CROSS JOIN LATERAL jsonb_array_elements_text(
 CASE WHEN jsonb_typeof(b.content->'items')='array'
 THEN b.content->'items' ELSE '[]'::jsonb END
) WITH ORDINALITY i(item,ord)
CROSS JOIN LATERAL jsonb_array_elements(
 CASE WHEN jsonb_typeof(b.content->'video_links')='array'
 THEN b.content->'video_links' ELSE '[]'::jsonb END
) link(value)
WHERE i.item ILIKE '%single-leg glute bridge%'
  AND (link.value->>'item_index')::int=i.ord-1
  AND link.value->>'exercise'='Glute Bridge';
