-- Shared canonical video resolver for all session-block writes.
-- Prescriptions are never edited; only generated video_links are replaced.
CREATE OR REPLACE FUNCTION public.sync_session_block_exercise_videos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
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
    ('single leg bridge','Single-Leg Bridge Hold'),
    ('straight leg hamstring kicks','Straight-Leg Hamstring Kick'),
    ('40m progressive build ups','Progressive 40m Build-Up'),
    ('snap downs','Snap Down')
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
     ' '||trim(regexp_replace(lower(i.item),'[^a-z0-9]+',' ','g'))||' ' haystack
   FROM jsonb_array_elements_text(NEW.content->'items') WITH ORDINALITY i(item,ord)
 ), candidates AS (
   SELECT DISTINCT i.item_index,n.id,n.name,n.video_url,n.needle
   FROM items i JOIN names n
     ON position(' '||n.needle||' ' IN i.haystack)>0
 ), selected AS (
   SELECT c.* FROM candidates c
   WHERE NOT EXISTS (
     SELECT 1 FROM candidates longer
     WHERE longer.item_index=c.item_index AND longer.id<>c.id
       AND length(longer.needle)>length(c.needle)
       AND position(' '||c.needle||' ' IN ' '||longer.needle||' ')>0
   )
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'item_index',item_index,'exercise',name,'video_url',video_url
 ) ORDER BY item_index,name),'[]'::jsonb)
 INTO links FROM (SELECT DISTINCT item_index,id,name,video_url FROM selected) s;
 NEW.content=jsonb_set(NEW.content,'{video_links}',links,true);
 RETURN NEW;
END $$;

-- Backfill only generated links; retain prescriptions and all other content.
UPDATE public.session_blocks SET content=content
WHERE jsonb_typeof(content->'items')='array';
