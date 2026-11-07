-- Staged repair only: replace the existing trigger function, no rows/backfill/grants.
-- Capture the live function definition before rollout; restore that definition to roll back.
-- Only generated video_links may change. All prescription fields remain literal.
CREATE OR REPLACE FUNCTION public.sync_session_block_exercise_videos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE links jsonb; reviewed jsonb; expected_code text;
BEGIN
 IF jsonb_typeof(NEW.content->'items') IS DISTINCT FROM 'array' THEN
   IF EXISTS (SELECT 1 FROM jsonb_array_elements(
     CASE WHEN jsonb_typeof(NEW.content->'video_links')='array' THEN NEW.content->'video_links' ELSE '[]'::jsonb END
   ) v(link) WHERE v.link ? 'exerciseCode' OR v.link->'no_demo'='true'::jsonb) THEN
     RAISE EXCEPTION 'Reviewed demo requires a visible instruction row' USING ERRCODE='23514';
   END IF;
   RETURN NEW;
 END IF;
 IF NEW.content->'videoLinksAlignWithPrescriptions' = 'true'::jsonb AND
    (jsonb_typeof(NEW.content->'prescriptions') IS DISTINCT FROM 'array' OR
     jsonb_array_length(NEW.content->'prescriptions') <> jsonb_array_length(NEW.content->'items')) THEN
   RAISE EXCEPTION 'Reviewed demo alignment requires equal item and prescription rows' USING ERRCODE='23514';
 END IF;
 -- A reviewed code is authoritative. Never fall back to a similarly named movement.
 FOR reviewed IN SELECT value FROM jsonb_array_elements(
   CASE WHEN jsonb_typeof(NEW.content->'video_links')='array'
        THEN NEW.content->'video_links' ELSE '[]'::jsonb END
 ) WHERE value ? 'exerciseCode' OR value->'no_demo'='true'::jsonb LOOP
   IF reviewed->'no_demo'='true'::jsonb THEN
     IF reviewed ? 'exerciseCode' OR
        jsonb_typeof(reviewed->'item_index') IS DISTINCT FROM 'number' OR
        coalesce(reviewed->>'item_index','') !~ '^[0-9]+$' THEN
       RAISE EXCEPTION 'Reviewed demo exclusion requires one valid instruction row' USING ERRCODE='23514';
     END IF;
     IF (reviewed->>'item_index')::numeric >= jsonb_array_length(NEW.content->'items') THEN
       RAISE EXCEPTION 'Reviewed demo exclusion points to a missing instruction' USING ERRCODE='23514';
     END IF;
     IF reviewed->'reviewed_item' IS DISTINCT FROM NEW.content->'items'->((reviewed->>'item_index')::integer) OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(NEW.content->'video_links') other(link)
       WHERE other.link->'item_index'=reviewed->'item_index' AND other.link ? 'exerciseCode'
     ) OR (NEW.content->'videoLinksAlignWithPrescriptions'='true'::jsonb AND
       NEW.content->'prescriptions'->((reviewed->>'item_index')::integer)->>'exerciseCode' IS NOT NULL) THEN
       RAISE EXCEPTION 'Reviewed demo exclusion conflicts with its instruction or selection' USING ERRCODE='23514';
     END IF;
     CONTINUE;
   END IF;
   IF jsonb_typeof(reviewed->'exerciseCode') IS DISTINCT FROM 'string' OR
      coalesce(btrim(reviewed->>'exerciseCode'),'')='' OR
      jsonb_typeof(reviewed->'item_index') IS DISTINCT FROM 'number' OR
      coalesce(reviewed->>'item_index','') !~ '^[0-9]+$' THEN
     RAISE EXCEPTION 'Reviewed demo requires an exercise code and integer instruction row' USING ERRCODE='23514';
   END IF;
   IF (reviewed->>'item_index')::numeric >= jsonb_array_length(NEW.content->'items') OR
      (SELECT count(*) FROM public.exercises e WHERE e.code=reviewed->>'exerciseCode'
       AND e.active AND nullif(btrim(e.video_url),'') IS NOT NULL) <> 1 THEN
     RAISE EXCEPTION 'Reviewed demo is missing, inactive, ambiguous or points to a missing row' USING ERRCODE='23514';
   END IF;
   IF reviewed ? 'reviewed_item' AND reviewed->'reviewed_item' IS DISTINCT FROM
      NEW.content->'items'->((reviewed->>'item_index')::integer) THEN
     RAISE EXCEPTION 'Reviewed demo is bound to a different instruction' USING ERRCODE='23514';
   END IF;
   -- Generated output also carries codes. A caller editing text must remove or
   -- reselect that row's mapping rather than carrying its old positional code.
   IF TG_OP='UPDATE' THEN
     IF OLD.content->'items'->((reviewed->>'item_index')::integer) IS DISTINCT FROM
        NEW.content->'items'->((reviewed->>'item_index')::integer) AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.content->'video_links')='array'
         THEN OLD.content->'video_links' ELSE '[]'::jsonb END) prior(link)
       WHERE prior.link->'item_index'=reviewed->'item_index'
         AND prior.link->>'exerciseCode'=reviewed->>'exerciseCode'
     ) AND reviewed->'reviewed_item' IS DISTINCT FROM
           NEW.content->'items'->((reviewed->>'item_index')::integer) THEN
       RAISE EXCEPTION 'Instruction changed: review or clear its saved demo selection before saving' USING ERRCODE='23514';
     END IF;
   END IF;
   IF NEW.content->'videoLinksAlignWithPrescriptions' = 'true'::jsonb THEN
     expected_code=NEW.content->'prescriptions'->((reviewed->>'item_index')::integer)->>'exerciseCode';
     IF expected_code IS NOT NULL AND expected_code <> reviewed->>'exerciseCode' THEN
       RAISE EXCEPTION 'Reviewed demo does not match the aligned prescription code' USING ERRCODE='23514';
     END IF;
   END IF;
 END LOOP;
 IF NEW.content->'videoLinksAlignWithPrescriptions' = 'true'::jsonb THEN
   FOR reviewed IN SELECT value FROM jsonb_array_elements(NEW.content->'prescriptions') WHERE value ? 'exerciseCode' LOOP
     IF (SELECT count(*) FROM public.exercises e WHERE e.code=reviewed->>'exerciseCode'
         AND e.active AND nullif(btrim(e.video_url),'') IS NOT NULL) <> 1 THEN
       RAISE EXCEPTION 'Reviewed demo unavailable for aligned prescription code' USING ERRCODE='23514';
     END IF;
   END LOOP;
 END IF;
 WITH aliases(alias, canonical) AS (
   VALUES
    ('leg swing front back','Leg Swing Front / Back'),
    ('leg swings front back','Leg Swing Front / Back'),
    ('leg swing side side','Leg Swing Side / Side'),
    ('soleus hold','Bent-Knee Soleus Hold'),
    ('hip lock','Hip-Lock Hold'),
    ('quarter squat iso','Quarter-Squat ISO Hold'),
    ('calf iso','Calf ISO Hold'),
    ('hamstring bridge','Hamstring Bridge ISO Hold'),
    ('single leg bridge','Single-Leg Glute Bridge'),
    ('straight leg hamstring kicks','Straight-Leg Hamstring Kick'),
    ('40m progressive build ups','Progressive 40m Build-Up'),
    ('snap downs','Snap Down'),
    ('pogos','Two-Leg Pogos')
 ), reviewed_links AS (
   SELECT (v.link->>'item_index')::integer item_index,e.id,e.code,e.name,e.video_url
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.content->'video_links')='array'
        THEN NEW.content->'video_links' ELSE '[]'::jsonb END) v(link)
   JOIN public.exercises e ON e.code=v.link->>'exerciseCode'
   WHERE e.active AND nullif(btrim(e.video_url),'') IS NOT NULL
 ), no_demo_rows AS (
   SELECT DISTINCT (v.link->>'item_index')::integer item_index
   FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.content->'video_links')='array'
        THEN NEW.content->'video_links' ELSE '[]'::jsonb END) v(link)
   WHERE v.link->'no_demo'='true'::jsonb
 ), coded AS (
   SELECT (p.ord-1)::integer item_index,e.id,e.code,e.name,e.video_url
   FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(NEW.content->'prescriptions')='array'
           THEN NEW.content->'prescriptions' ELSE '[]'::jsonb END
   ) WITH ORDINALITY p(item,ord)
   JOIN public.exercises e ON e.code=p.item->>'exerciseCode'
   WHERE e.active AND nullif(trim(e.video_url),'') IS NOT NULL
     AND NEW.content->'videoLinksAlignWithPrescriptions' = 'true'::jsonb
     AND p.ord<=jsonb_array_length(NEW.content->'items')
 ), names AS (
   SELECT e.id,e.code,e.name,e.video_url,
     trim(regexp_replace(lower(e.name),'[^a-z0-9]+',' ','g')) AS needle
   FROM public.exercises e
   WHERE e.active AND nullif(trim(e.video_url),'') IS NOT NULL
   UNION ALL
   SELECT e.id,e.code,e.name,e.video_url,a.alias
   FROM aliases a JOIN public.exercises e ON e.name=a.canonical
   WHERE e.active AND nullif(trim(e.video_url),'') IS NOT NULL
 ), items AS (
   SELECT (i.ord-1)::integer item_index,
     i.item raw_item,
     ' '||trim(regexp_replace(lower(i.item),'[^a-z0-9]+',' ','g'))||' ' haystack
   FROM jsonb_array_elements_text(NEW.content->'items') WITH ORDINALITY i(item,ord)
 ), candidates AS (
   SELECT DISTINCT i.item_index,n.id,n.code,n.name,n.video_url,n.needle
   FROM items i JOIN names n
     ON position(' '||n.needle||' ' IN i.haystack)>0
     AND (n.needle<>'pogos' OR (
       coalesce(NEW.content->'exerciseCodes','[]'::jsonb) @> '["PLY03"]'::jsonb
       AND i.raw_item ~* '(^|;)\s*([0-9]+\s*[x×]\s*)?[0-9]+\s+pogos\s*($|;)'
     ))
 ), selected AS (
   SELECT c.* FROM candidates c
   WHERE NOT EXISTS (SELECT 1 FROM coded k WHERE k.item_index=c.item_index)
     AND NOT EXISTS (SELECT 1 FROM reviewed_links r WHERE r.item_index=c.item_index)
     AND NOT EXISTS (SELECT 1 FROM no_demo_rows r WHERE r.item_index=c.item_index)
     AND NOT EXISTS (SELECT 1 FROM candidates duplicate WHERE duplicate.item_index=c.item_index
       AND duplicate.needle=c.needle AND duplicate.id<>c.id)
     AND NOT EXISTS (SELECT 1 FROM public.exercises duplicate WHERE duplicate.active AND duplicate.id<>c.id
       AND trim(regexp_replace(lower(duplicate.name),'[^a-z0-9]+',' ','g')) =
           trim(regexp_replace(lower(c.name),'[^a-z0-9]+',' ','g')))
     AND NOT EXISTS (
     SELECT 1 FROM candidates longer
     WHERE longer.item_index=c.item_index AND longer.id<>c.id
       AND length(longer.needle)>length(c.needle)
       AND position(' '||c.needle||' ' IN ' '||longer.needle||' ')>0
   )
 )
 SELECT coalesce(jsonb_agg(payload ORDER BY item_index,payload->>'exercise'),'[]'::jsonb)
 INTO links FROM (
 SELECT item_index,jsonb_build_object(
   'item_index',item_index,'exercise',name,'exerciseCode',code,'video_url',video_url,
   'reviewed_item',NEW.content->'items'->item_index
 ) payload
 FROM (SELECT DISTINCT item_index,id,code,name,video_url FROM selected UNION SELECT item_index,id,code,name,video_url FROM coded UNION SELECT item_index,id,code,name,video_url FROM reviewed_links) s
 UNION ALL SELECT item_index,jsonb_build_object('item_index',item_index,'no_demo',true,'reviewed_item',NEW.content->'items'->item_index) FROM no_demo_rows
 ) final_links;
 NEW.content=jsonb_set(NEW.content,'{video_links}',links,true);
 RETURN NEW;
END $function$
;
