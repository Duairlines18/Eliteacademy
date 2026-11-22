-- Read-only storage inventory; these counts do not certify footage correctness.
WITH links AS (
 SELECT b.id,v.link FROM public.session_blocks b
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(b.content->'video_links')='array'
   THEN b.content->'video_links' ELSE '[]'::jsonb END) v(link)
)
SELECT count(*) AS saved_links,
 count(*) FILTER (WHERE nullif(link->>'exerciseCode','') IS NULL) AS name_only_links,
 count(DISTINCT id) FILTER (WHERE nullif(link->>'exerciseCode','') IS NULL) AS blocks_with_name_only_links
FROM links;

-- Review each identity before any remap. Never bulk UPDATE from this report.
WITH links AS (
 SELECT b.id AS block_id,b.title,v.link FROM public.session_blocks b
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(b.content->'video_links')='array'
   THEN b.content->'video_links' ELSE '[]'::jsonb END) v(link)
)
SELECT l.block_id,l.title,l.link,
 (SELECT count(*) FROM public.exercises e WHERE e.active AND e.name=l.link->>'exercise') AS active_exact_name_matches
FROM links l WHERE nullif(l.link->>'exerciseCode','') IS NULL
ORDER BY l.block_id,l.link->>'item_index';
