-- Use a fresh routine ID per published week so completions stay week-scoped.
CREATE FUNCTION public.carry_forward_assigned_warmup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  source_day uuid;
  new_day uuid;
BEGIN
  IF NEW.tier_id IS NOT NULL OR NEW.status NOT IN ('live', 'completed')
    OR NEW.verification_status <> 'verified' OR NEW.published_at IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('live', 'completed') AND OLD.verification_status = 'verified'
      AND OLD.published_at IS NOT NULL THEN RETURN NEW; END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.training_days d JOIN public.session_blocks b ON b.training_day_id = d.id
    WHERE d.programme_week_id = NEW.id
      AND b.content->>'routineKind' = 'warm-up'
      AND b.content->>'assignedWarmUpProgrammeId' = NEW.programme_id::text
  ) THEN RETURN NEW; END IF;

  SELECT d.id INTO source_day
  FROM public.programme_weeks w
  JOIN public.training_days d ON d.programme_week_id = w.id
  JOIN public.session_blocks b ON b.training_day_id = d.id
  JOIN public.athletes a ON a.id::text = b.content->>'assignedWarmUpAthleteId' AND a.programme_id = w.programme_id
  WHERE w.programme_id = NEW.programme_id AND w.week_number < NEW.week_number
    AND w.tier_id IS NULL AND w.status IN ('live', 'completed')
    AND w.verification_status = 'verified' AND w.published_at IS NOT NULL
    AND b.content->>'routineKind' = 'warm-up'
    AND b.content->>'assignedWarmUpProgrammeId' = NEW.programme_id::text
    AND b.content->'carryForward' = 'true'::jsonb
  ORDER BY w.week_number DESC, d.id
  LIMIT 1;
  IF source_day IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.training_days (programme_week_id, day_key, title, objective, duration, sort_order)
  SELECT NEW.id, day_key, title, objective, duration, sort_order FROM public.training_days WHERE id = source_day
  RETURNING id INTO new_day;

  INSERT INTO public.session_blocks (training_day_id, block_type, title, sort_order, content)
  SELECT new_day, block_type, title, sort_order, content - 'carryForward'
  FROM public.session_blocks WHERE training_day_id = source_day;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.carry_forward_assigned_warmup() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER carry_forward_assigned_warmup
AFTER INSERT OR UPDATE OF status, verification_status, published_at ON public.programme_weeks
FOR EACH ROW EXECUTE FUNCTION public.carry_forward_assigned_warmup();
