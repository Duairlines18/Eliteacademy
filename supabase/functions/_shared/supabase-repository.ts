type SupabaseClient = any;

const PROFESSIONAL_MEMBER_FIELDS = [
  'id', 'user_id', 'first_name', 'last_name', 'email', 'member_type', 'founding_member',
  'membership_price', 'membership_status', 'paid', 'primary_goals', 'work_environment',
  'training_environment', 'preferred_duration', 'current_frequency', 'equipment',
  'training_experience', 'limitations', 'onboarding_complete', 'selected_plan',
  'selected_plan_label', 'selected_plan_price', 'cohort_id', 'access_status',
  'access_reason', 'payment_status', 'programme_start_date',
  'coach_note', 'exercise_substitutions',
].join(',');

const PARENT_ATHLETE_FIELDS = [
  'id', 'parent_user_id', 'athlete_user_id', 'athlete_email', 'parent_first_name', 'parent_last_name', 'parent_email',
  'full_name', 'display_name', 'cohort_id', 'access_status', 'paid',
  'access_reason', 'payment_status', 'programme_start_date',
  'coach_note', 'exercise_substitutions',
  'onboarding_complete', 'onboarding_data',
].join(',');

function assertResult<T>(result: { data: T; error: any }, operation: string): T {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

export class SupabaseHubRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findProfessionalMember(userId: string) {
    return assertResult(
      await this.client.from('professional_members')
        .select(PROFESSIONAL_MEMBER_FIELDS)
        .eq('user_id', userId)
        .maybeSingle(),
      'Professional member lookup failed',
    );
  }

  async ensureProfessionalMember(user: { id: string; email?: string; user_metadata?: any }) {
    const existing = await this.findProfessionalMember(user.id);
    if (existing) return existing;
    const payload = {
      user_id: user.id,
      first_name: typeof user.user_metadata?.first_name === 'string' ? user.user_metadata.first_name.trim() : '',
      last_name: typeof user.user_metadata?.last_name === 'string' ? user.user_metadata.last_name.trim() : '',
      email: user.email || '',
      member_type: 'professional',
      founding_member: true,
    };
    return assertResult(
      await this.client.from('professional_members')
        .insert(payload)
        .select(PROFESSIONAL_MEMBER_FIELDS)
        .single(),
      'Professional member creation failed',
    );
  }

  async updateProfessionalOnboarding(userId: string, safeFields: Record<string, unknown>) {
    return assertResult(
      await this.client.from('professional_members')
        .update(safeFields)
        .eq('user_id', userId)
        .select(PROFESSIONAL_MEMBER_FIELDS)
        .single(),
      'Professional onboarding update failed',
    );
  }

  async findParentAthlete(userId: string) {
    return assertResult(
      await this.client.from('athletes')
        .select(PARENT_ATHLETE_FIELDS)
        .eq('parent_user_id', userId)
        .maybeSingle(),
      'Parent athlete lookup failed',
    );
  }

  async ensureParentAthlete(user: { id: string; email?: string; user_metadata?: any }) {
    const existing = await this.findParentAthlete(user.id);
    if (existing) return existing;
    const athleteFirst = typeof user.user_metadata?.athlete_first_name === 'string'
      ? user.user_metadata.athlete_first_name.trim() : '';
    const athleteLast = typeof user.user_metadata?.athlete_last_name === 'string'
      ? user.user_metadata.athlete_last_name.trim() : '';
    const payload = {
      parent_user_id: user.id,
      parent_first_name: typeof user.user_metadata?.first_name === 'string' ? user.user_metadata.first_name.trim() : '',
      parent_last_name: typeof user.user_metadata?.last_name === 'string' ? user.user_metadata.last_name.trim() : '',
      parent_email: user.email || '',
      full_name: [athleteFirst, athleteLast].filter(Boolean).join(' '),
      display_name: athleteFirst,
      access_status: 'pending',
    };
    return assertResult(
      await this.client.from('athletes')
        .insert(payload)
        .select(PARENT_ATHLETE_FIELDS)
        .single(),
      'Parent athlete creation failed',
    );
  }

  async updateParentOnboarding(userId: string, safeFields: Record<string, unknown>) {
    return assertResult(
      await this.client.from('athletes')
        .update(safeFields)
        .eq('parent_user_id', userId)
        .select(PARENT_ATHLETE_FIELDS)
        .single(),
      'Parent onboarding update failed',
    );
  }

  async findPrivateAthlete(userId: string) {
    return assertResult(
      await this.client.from('athletes')
        .select(PARENT_ATHLETE_FIELDS)
        .eq('athlete_user_id', userId)
        .maybeSingle(),
      'Private athlete lookup failed',
    );
  }

  async ensurePrivateAthlete(user: { id: string; email?: string; user_metadata?: any }) {
    const existing = await this.findPrivateAthlete(user.id);
    if (existing) return existing;
    const firstName = typeof user.user_metadata?.first_name === 'string' ? user.user_metadata.first_name.trim() : '';
    const lastName = typeof user.user_metadata?.last_name === 'string' ? user.user_metadata.last_name.trim() : '';
    return assertResult(
      await this.client.from('athletes')
        .insert({
          athlete_user_id: user.id,
          athlete_email: user.email || '',
          full_name: [firstName, lastName].filter(Boolean).join(' '),
          display_name: firstName,
          access_status: 'pending',
        })
        .select(PARENT_ATHLETE_FIELDS)
        .single(),
      'Private athlete creation failed',
    );
  }

  async updatePrivateAthleteOnboarding(userId: string, safeFields: Record<string, unknown>) {
    return assertResult(
      await this.client.from('athletes')
        .update(safeFields)
        .eq('athlete_user_id', userId)
        .select(PARENT_ATHLETE_FIELDS)
        .single(),
      'Private athlete onboarding update failed',
    );
  }

  async findAccessCode(codeHash: string) {
    return assertResult(
      await this.client.from('access_codes')
        .select('id,status,code_type,cohort_id,expires_at')
        .eq('code_hash', codeHash)
        .eq('status', 'active')
        .maybeSingle(),
      'Access lookup failed',
    );
  }

  async createSession(row: Record<string, unknown>) {
    assertResult(await this.client.from('hub_sessions').insert(row), 'Session creation failed');
  }

  async findAccessCodeById(id: string) {
    return assertResult(
      await this.client.from('access_codes')
        .select('id,status,code_type,cohort_id,expires_at')
        .eq('id', id)
        .maybeSingle(),
      'Access status lookup failed',
    );
  }

  async touchCode(id: string, at: string) {
    assertResult(await this.client.from('access_codes').update({ last_used_at: at }).eq('id', id), 'Code update failed');
  }

  async findSession(tokenHash: string) {
    return assertResult(
      await this.client.from('hub_sessions')
        .select('id,role,cohort_id,access_code_id,revoked_at,expires_at')
        .eq('token_hash', tokenHash)
        .maybeSingle(),
      'Session lookup failed',
    );
  }

  async touchSession(id: string, at: string) {
    assertResult(await this.client.from('hub_sessions').update({ last_active_at: at }).eq('id', id), 'Session update failed');
  }

  async findCohort(id: string) {
    return assertResult(
      await this.client.from('cohorts')
        .select('id,status')
        .eq('id', id)
        .maybeSingle(),
      'Cohort status lookup failed',
    );
  }

  async loadCurrentProgramme(cohortId: string) {
    const cohort = assertResult(
      await this.client.from('cohorts')
        .select('id,name,current_week,status,programme_id,tier,start_date,expected_sessions_per_week')
        .eq('id', cohortId)
        .eq('status', 'live')
        .maybeSingle(),
      'Cohort lookup failed',
    );
    if (!cohort?.programme_id) return null;

    const programme = assertResult(
      await this.client.from('programmes')
        .select('id,name,duration_weeks,sport')
        .eq('id', cohort.programme_id)
        .maybeSingle(),
      'Programme lookup failed',
    );
    if (!programme) return null;

    let weekQuery = this.client.from('programme_weeks')
        .select('id,programme_id,week_number,phase,weekly_objective,running_focus,strength_focus,event_focus,athlete_education,status,verification_status,published_at')
        .eq('programme_id', programme.id)
        .eq('week_number', cohort.current_week)
        .in('status', ['live', 'completed'])
        .eq('verification_status', 'verified')
        .not('published_at', 'is', null);
    if (cohort.tier) {
      const tier = assertResult(
        await this.client.from('programme_tiers')
          .select('id')
          .eq('programme_id', programme.id)
          .eq('name', cohort.tier)
          .maybeSingle(),
        'Programme tier lookup failed',
      );
      if (!tier) return { cohort, programme, week: null, trainingDays: [], blocks: [], exercises: [] };
      weekQuery = weekQuery.eq('tier_id', tier.id);
    } else {
      weekQuery = weekQuery.is('tier_id', null);
    }
    const week = assertResult(
      await weekQuery.maybeSingle(),
      'Programme week lookup failed',
    );
    if (!week) return { cohort, programme, week: null, trainingDays: [], blocks: [], exercises: [] };

    const trainingDays = assertResult(
      await this.client.from('training_days')
        .select('id,programme_week_id,day_key,title,intensity,objective,duration,sort_order,playlist_id,playlist_url')
        .eq('programme_week_id', week.id)
        .order('sort_order'),
      'Training days lookup failed',
    ) || [];
    const dayIds = trainingDays.map((day: any) => day.id);
    const blocks = dayIds.length ? (assertResult(
      await this.client.from('session_blocks')
        .select('id,training_day_id,block_type,title,sort_order,content,athlete_note,staff_note')
        .in('training_day_id', dayIds)
        .order('sort_order'),
      'Session blocks lookup failed',
    ) || []) : [];
    const referencedCodes = [...new Set(blocks.flatMap((block: any) => {
      const legacyCodes = Array.isArray(block?.content?.exerciseCodes) ? block.content.exerciseCodes : [];
      const prescriptions = Array.isArray(block?.content?.prescriptions) ? block.content.prescriptions : [];
      const prescriptionCodes = prescriptions.flatMap((item: any) => [item?.exerciseCode, item?.alternativeExerciseCode]);
      return [...legacyCodes, ...prescriptionCodes]
        .filter((code: unknown) => typeof code === 'string' && code.trim())
        .map((code: string) => code.trim());
    }))];
    const exercises = referencedCodes.length ? (assertResult(
      await this.client.from('exercises')
        .select('id,code,name,category_slug,categories,video_id,video_url,description,purpose,coaching_cues,default_dosage,display_order,active')
        .in('code', referencedCodes)
        .eq('active', true)
        .order('display_order'),
      'Exercise lookup failed',
    ) || []) : [];

    return { cohort, programme, week, trainingDays, blocks, exercises };
  }

  async findCohortContext(id: string) { return assertResult(await this.client.from('cohorts').select('id,status,current_week,programme_id,tier').eq('id',id).maybeSingle(),'Cohort context lookup failed'); }
  async findFeedbackBySubmissionId(submissionId: string) { return assertResult(await this.client.from('feedback').select('id,status').contains('payload',{submissionId}).limit(1).maybeSingle(),'Feedback duplicate lookup failed'); }
  async findFeedbackForContext({athleteId,staffId,cohortId,weekNumber,feedbackType}:any){let query=this.client.from('feedback').select('id,status').eq('feedback_type',feedbackType).eq('week_number',weekNumber);query=athleteId?query.eq('athlete_id',athleteId):query.is('athlete_id',null);query=staffId?query.eq('staff_id',staffId):query.is('staff_id',null);query=cohortId?query.eq('cohort_id',cohortId):query.is('cohort_id',null);return assertResult(await query.limit(1).maybeSingle(),'Feedback context lookup failed');}
  async insertFeedback(row:Record<string,unknown>){return assertResult(await this.client.from('feedback').insert(row).select('id,status').single(),'Feedback insert failed');}
  async updateFeedback(id:string,row:Record<string,unknown>){return assertResult(await this.client.from('feedback').update(row).eq('id',id).select('id,status').single(),'Feedback update failed');}
  async listPublishedWeeks(cohortId:string){const cohort=await this.findCohortContext(cohortId);if(!cohort?.programme_id||cohort.status!=='live')return[];let query=this.client.from('programme_weeks').select('id,week_number,phase,weekly_objective,published_at').eq('programme_id',cohort.programme_id).lt('week_number',cohort.current_week).in('status',['live','completed']).eq('verification_status','verified').not('published_at','is',null).order('week_number',{ascending:false});if(cohort.tier){const tier=assertResult(await this.client.from('programme_tiers').select('id').eq('programme_id',cohort.programme_id).eq('name',cohort.tier).maybeSingle(),'Programme tier lookup failed');if(!tier)return[];query=query.eq('tier_id',tier.id);}else query=query.is('tier_id',null);return assertResult(await query,'Programme history lookup failed')||[];}
  async loadProgrammeWeek(cohortId:string,weekNumber:number){const cohort=assertResult(await this.client.from('cohorts').select('id,name,current_week,status,programme_id,tier,start_date,expected_sessions_per_week').eq('id',cohortId).eq('status','live').maybeSingle(),'Cohort lookup failed');if(!cohort?.programme_id||!Number.isInteger(weekNumber)||weekNumber<1||weekNumber>=cohort.current_week)return null;const programme=assertResult(await this.client.from('programmes').select('id,name,duration_weeks,sport').eq('id',cohort.programme_id).maybeSingle(),'Programme lookup failed');if(!programme)return null;let weekQuery=this.client.from('programme_weeks').select('id,programme_id,week_number,phase,weekly_objective,running_focus,strength_focus,event_focus,athlete_education,status,verification_status,published_at').eq('programme_id',programme.id).eq('week_number',weekNumber).in('status',['live','completed']).eq('verification_status','verified').not('published_at','is',null);if(cohort.tier){const tier=assertResult(await this.client.from('programme_tiers').select('id').eq('programme_id',programme.id).eq('name',cohort.tier).maybeSingle(),'Programme tier lookup failed');if(!tier)return null;weekQuery=weekQuery.eq('tier_id',tier.id);}else weekQuery=weekQuery.is('tier_id',null);const week=assertResult(await weekQuery.maybeSingle(),'Programme history week lookup failed');if(!week)return null;const trainingDays=assertResult(await this.client.from('training_days').select('id,programme_week_id,day_key,title,intensity,objective,duration,sort_order,playlist_id,playlist_url').eq('programme_week_id',week.id).order('sort_order'),'Training days lookup failed')||[];const dayIds=trainingDays.map((day:any)=>day.id);const blocks=dayIds.length?(assertResult(await this.client.from('session_blocks').select('id,training_day_id,block_type,title,sort_order,content,athlete_note,staff_note').in('training_day_id',dayIds).order('sort_order'),'Session blocks lookup failed')||[]):[];const referencedCodes=[...new Set(blocks.flatMap((block:any)=>{const legacy=Array.isArray(block?.content?.exerciseCodes)?block.content.exerciseCodes:[];const prescriptions=Array.isArray(block?.content?.prescriptions)?block.content.prescriptions:[];return[...legacy,...prescriptions.flatMap((item:any)=>[item?.exerciseCode,item?.alternativeExerciseCode])].filter((code:unknown)=>typeof code==='string'&&code.trim()).map((code:string)=>code.trim());}))];const exercises=referencedCodes.length?(assertResult(await this.client.from('exercises').select('id,code,name,category_slug,categories,video_id,video_url,description,purpose,coaching_cues,default_dosage,display_order,active').in('code',referencedCodes).eq('active',true).order('display_order'),'Exercise lookup failed')||[]):[];return{cohort,programme,week,trainingDays,blocks,exercises};}

  async loadExercisesByCodes(codes: string[]) {
    if (!codes.length) return [];
    return assertResult(
      await this.client.from('exercises')
        .select('id,code,name,category_slug,categories,video_id,video_url,description,purpose,coaching_cues,default_dosage,display_order,active')
        .in('code', codes)
        .eq('active', true)
        .order('display_order'),
      'Replacement exercise lookup failed',
    ) || [];
  }
}

