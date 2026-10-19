-- Audited existing trigger bodies, 19 October 2026. Local fixture only.
CREATE OR REPLACE FUNCTION public.sync_session_block_exercise_videos()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE links jsonb;
BEGIN
 IF jsonb_typeof(NEW.content->'items') <> 'array' THEN RETURN NEW; END IF;
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
 ), coded AS (
   SELECT (p.ord-1)::integer item_index,e.id,e.name,e.video_url
   FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(NEW.content->'prescriptions')='array'
           THEN NEW.content->'prescriptions' ELSE '[]'::jsonb END
   ) WITH ORDINALITY p(item,ord)
   JOIN public.exercises e ON e.code=p.item->>'exerciseCode'
   WHERE e.active AND nullif(trim(e.video_url),'') IS NOT NULL
     AND jsonb_typeof(NEW.content->'items')='array'
     AND p.ord<=jsonb_array_length(NEW.content->'items')
 ), names AS (
   SELECT e.id,e.name,e.video_url,
     trim(regexp_replace(lower(e.name),'[^a-z0-9]+',' ','g')) AS needle
   FROM public.exercises e
   WHERE e.active AND nullif(trim(e.video_url),'') IS NOT NULL
   UNION ALL
   SELECT e.id,e.name,e.video_url,a.alias
   FROM aliases a JOIN public.exercises e ON e.name=a.canonical
   WHERE e.active AND nullif(trim(e.video_url),'') IS NOT NULL
 ), items AS (
   SELECT (i.ord-1)::integer item_index,
     i.item raw_item,
     ' '||trim(regexp_replace(lower(i.item),'[^a-z0-9]+',' ','g'))||' ' haystack
   FROM jsonb_array_elements_text(NEW.content->'items') WITH ORDINALITY i(item,ord)
 ), candidates AS (
   SELECT DISTINCT i.item_index,n.id,n.name,n.video_url,n.needle
   FROM items i JOIN names n
     ON position(' '||n.needle||' ' IN i.haystack)>0
     AND (n.needle<>'pogos' OR (
       coalesce(NEW.content->'exerciseCodes','[]'::jsonb) @> '["PLY03"]'::jsonb
       AND i.raw_item ~* '(^|;)\s*([0-9]+\s*[x×]\s*)?[0-9]+\s+pogos\s*($|;)'
     ))
 ), selected AS (
   SELECT c.* FROM candidates c
   WHERE NOT EXISTS (SELECT 1 FROM coded k WHERE k.item_index=c.item_index)
     AND NOT EXISTS (
     SELECT 1 FROM candidates longer
     WHERE longer.item_index=c.item_index AND longer.id<>c.id
       AND length(longer.needle)>length(c.needle)
       AND position(' '||c.needle||' ' IN ' '||longer.needle||' ')>0
   )
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'item_index',item_index,'exercise',name,'video_url',video_url
 ) ORDER BY item_index,name),'[]'::jsonb)
 INTO links FROM (SELECT DISTINCT item_index,id,name,video_url FROM selected UNION SELECT item_index,id,name,video_url FROM coded) s;
 NEW.content=jsonb_set(NEW.content,'{video_links}',links,true);
 RETURN NEW;
END $function$
;
CREATE TRIGGER sync_session_block_exercise_videos_trigger BEFORE INSERT OR UPDATE OF content ON public.session_blocks FOR EACH ROW EXECUTE FUNCTION sync_session_block_exercise_videos();
CREATE OR REPLACE FUNCTION public.validate_session_block_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE n integer; instructions jsonb; missing boolean;
BEGIN
 IF jsonb_typeof(NEW.content->'items')='array' THEN
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content->'items') v(value) WHERE v.value='null'::jsonb OR jsonb_typeof(v.value)<>'string' OR btrim(v.value#>>'{}')='') THEN
      RAISE EXCEPTION 'Workout item cannot be null, empty, or non-text (block: %)', NEW.title USING ERRCODE='23514';
   END IF;
 END IF;
 IF NEW.title='Air Zim Warm-Up' THEN
   n=jsonb_array_length(CASE WHEN jsonb_typeof(NEW.content->'prescriptions')='array' THEN NEW.content->'prescriptions' ELSE '[]'::jsonb END);
   IF n<15 THEN
      RAISE EXCEPTION 'Air Zim Warm-Up must contain complete exercise prescriptions (block: %)', NEW.title USING ERRCODE='23514';
   END IF;
 END IF;
 IF NEW.title IN ('Build the Engine','Long Tempo') THEN
   instructions=NEW.content->'prescriptions';
   IF jsonb_typeof(instructions)='array' AND jsonb_array_length(instructions)>0 THEN
     IF jsonb_typeof(NEW.content->'items')<>'array' OR jsonb_array_length(NEW.content->'items')=0 THEN
       RAISE EXCEPTION 'Running workout requires visible items (block: %)',NEW.title USING ERRCODE='23514';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $function$
;
CREATE TRIGGER validate_session_block_content_trigger BEFORE INSERT OR UPDATE OF content, title ON public.session_blocks FOR EACH ROW EXECUTE FUNCTION validate_session_block_content();
