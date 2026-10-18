export const ACCESS_DENIED_MESSAGE = 'Access code not recognized. Please contact Coach Du.';
export const PROGRAMME_PENDING_MESSAGE = 'Programme week is being prepared.';
export const SESSION_EXPIRED_MESSAGE = 'Your Hub session has expired. Enter your access code again.';

const PRODUCTION_ORIGINS = new Set([
  'https://duairlineseliteacademy.com',
  'https://www.duairlineseliteacademy.com',
  'https://hiktwkdfvlujszczthdu.supabase.co',
]);

const PROTOTYPE_ORIGINS = new Set([
  'http://terminal.local:4173',
  'https://du-airlines-performance-hub-pilot.light-auk-1409.chatgpt.site',
  'https://du-airlines-performance-hub-pilot.duchenge28.chatgpt.site',
]);

export function corsHeaders(origin = ''): Record<string, string> {
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-du-session',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Vary': 'Origin',
  };
  if (PRODUCTION_ORIGINS.has(origin) || PROTOTYPE_ORIGINS.has(origin) || local) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function normalizeCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateLoginInput(input: { code?: unknown; view?: unknown }): { code: string; view: 'athlete' | 'staff' } {
  const code = normalizeCode(input?.code);
  const view = input?.view;
  if (code.length < 12 || code.length > 128 || (view !== 'athlete' && view !== 'staff')) {
    throw new Error(ACCESS_DENIED_MESSAGE);
  }
  return { code, view };
}

export function codeTypeForView(view: 'athlete' | 'staff'): 'cohort' | 'staff' {
  return view === 'staff' ? 'staff' : 'cohort';
}

export function isCodeUsable(record: any, view: 'athlete' | 'staff', now = new Date()): boolean {
  if (!record || record.status !== 'active' || !record.cohort_id) return false;
  if (record.code_type !== codeTypeForView(view)) return false;
  if (record.expires_at && new Date(record.expires_at).getTime() <= now.getTime()) return false;
  return true;
}

export function isSessionUsable(record: any, now = new Date()): boolean {
  if (!record || !record.cohort_id || record.revoked_at) return false;
  if (!record.expires_at || new Date(record.expires_at).getTime() <= now.getTime()) return false;
  return record.role === 'athlete' || record.role === 'staff';
}

export function prepareBundleForDelivery(bundle: any) {
  if (!bundle?.cohort || !bundle?.programme) return null;
  const published = bundle?.week
    && (bundle.week.status === 'live' || bundle.week.status === 'completed')
    && bundle.week.verification_status === 'verified'
    && bundle.week.published_at;
  if (published) return bundle;
  return { ...bundle, week: null, trainingDays: [], blocks: [], exercises: [] };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function firstText(blocks: any[], key: string): string {
  for (const block of blocks) {
    const value = block?.content?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function prescriptionsFrom(blocks: any[]) {
  return blocks.flatMap(block => Array.isArray(block?.content?.prescriptions)
    ? block.content.prescriptions
        .filter((item: any) => typeof item?.exerciseCode === 'string' && item.exerciseCode.trim())
        .map((item: any) => ({
          sectionTitle: typeof block?.title === 'string' ? block.title.trim() : '',
          sectionOrder: Number.isFinite(block?.sort_order) ? block.sort_order : 0,
          exerciseCode: item.exerciseCode.trim(),
          dosage: typeof item.dosage === 'string' ? item.dosage : '',
          rest: typeof item.rest === 'string' ? item.rest : '',
          cues: typeof item.cues === 'string' ? item.cues : '',
          equipment: typeof item.equipment === 'string' ? item.equipment : '',
          alternativeExerciseCode: typeof item.alternativeExerciseCode === 'string' ? item.alternativeExerciseCode : '',
          ...(typeof item.originalExerciseCode === 'string' && item.originalExerciseCode
            ? { originalExerciseCode: item.originalExerciseCode } : {}),
          ...(typeof item.substitutionNote === 'string' && item.substitutionNote
            ? { substitutionNote: item.substitutionNote } : {}),
        }))
    : []);
}

function routinePlaylistsFrom(blocks: any[]) {
  return blocks.flatMap(block => Array.isArray(block?.content?.playlists) ? block.content.playlists : [])
    .filter((item: any) => {
      const id = typeof item?.id === 'string' && /^[A-Za-z0-9_-]{6,100}$/.test(item.id.trim());
      const url = typeof item?.url === 'string' && /^https:\/\/(www\.|m\.)?youtube\.com\/playlist\?[^\s]*\blist=[A-Za-z0-9_-]{6,100}(?:&[^\s]*)?$/i.test(item.url.trim());
      return id || url;
    })
    .map((item: any) => ({
      type: typeof item.type === 'string' && item.type.trim() ? item.type.trim() : 'routine',
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Session Playlist',
      id: typeof item.id === 'string' && /^[A-Za-z0-9_-]{6,100}$/.test(item.id.trim()) ? item.id.trim() : '',
      url: typeof item.url === 'string' ? item.url.trim() : '',
    }));
}

export function shapeBootstrap(input: {
  role: 'athlete' | 'staff';
  cohort: any;
  programme: any;
  week: any;
  trainingDays: any[];
  blocks: any[];
  exercises: any[];
  personalNote?: string;
}) {
  const { role, cohort, programme, week } = input;
  const cohortPayload = {
    id: cohort.id,
    name: cohort.name,
    currentWeek: cohort.current_week,
    startDate: cohort.start_date || '',
  };
  if (!week) {
    const expectedSessions = Number.isInteger(cohort.expected_sessions_per_week)
      ? Math.min(7, Math.max(1, cohort.expected_sessions_per_week)) : 3;
    return {
      contentStatus: 'preparing',
      role,
      cohort: cohortPayload,
      programme: {
        id: programme.id,
        school: cohort.name,
        title: programme.name,
        sport: programme.sport || '',
        week: cohort.current_week,
        totalWeeks: programme.duration_weeks,
        weeklyObjective: 'Your programme week is being prepared.',
        athleteEducation: '',
        programmeNotes: '',
        coachGuidance: '',
        sessions: Array.from({ length: expectedSessions }, (_, index) => ({
          id: `preparing-day-${index + 1}`,
          day: `Day ${index + 1}`,
          title: 'Session being prepared',
          duration: '',
          objective: 'Coach Du will publish this session before your programme begins.',
          prescriptions: [],
          playlist: { id: '', url: '' },
          locked: true,
        })),
      },
      exercises: [],
    };
  }
  const trainingDays = [...(input.trainingDays || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const allBlocks = input.blocks || [];

  const sessions = trainingDays.map((day, index) => {
    const blocks = allBlocks
      .filter(block => block.training_day_id === day.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const items = blocks.flatMap(block => Array.isArray(block?.content?.items) ? block.content.items.filter((item: unknown) => typeof item === 'string') : []);
    const itemSections = blocks
      .filter(block => Array.isArray(block?.content?.items) && block.content.items.some((item: unknown) => typeof item === 'string'))
      .map(block => ({
        title: typeof block.title === 'string' ? block.title.trim() : 'Session Instructions',
        order: Number.isFinite(block.sort_order) ? block.sort_order : 0,
        items: block.content.items.filter((item: unknown) => typeof item === 'string'),
        // Keep the database's reviewed movement selection and original row scope.
        // URLs come from the current authorized library, never stale JSON URLs.
        videoLinks: (Array.isArray(block.content.video_links) ? block.content.video_links : [])
          .flatMap((link: any) => {
            if (!Number.isInteger(link?.item_index) || link.item_index < 0
              || typeof block.content.items[link.item_index] !== 'string') return [];
            const exercise = (input.exercises || []).find(ex => ex.active !== false && ex.name === link.exercise);
            if (!exercise) return [];
            const url = exercise.video_url || (exercise.video_id ? 'https://www.youtube.com/watch?v=' + exercise.video_id : '');
            return url ? [{itemIndex: block.content.items.slice(0, link.item_index).filter((item: unknown) => typeof item === 'string').length,
              title: exercise.name, code: exercise.code, url}] : [];
          }),
      }));
    const exerciseCodes = unique(blocks.flatMap(block => Array.isArray(block?.content?.exerciseCodes) ? block.content.exerciseCodes.filter((code: unknown) => typeof code === 'string') : []));
    const athleteNotes = blocks.map(block => block.athlete_note).filter((note: unknown) => typeof note === 'string' && note.trim());
    const staffNotes = blocks.map(block => block.staff_note).filter((note: unknown) => typeof note === 'string' && note.trim());
    const prescriptions = prescriptionsFrom(blocks);
    const session: Record<string, unknown> = {
      id: day.id,
      day: day.day_key || `Day ${index + 1}`,
      requirement: firstText(blocks, 'requirement') || 'Mandatory',
      title: day.title || `Day ${index + 1}`,
      duration: day.duration || '',
      focus: firstText(blocks, 'focus') || day.intensity || day.objective || '',
      objective: day.objective || '',
      why: firstText(blocks, 'why'),
      watch: firstText(blocks, 'watch'),
      items,
      itemSections,
      exerciseCodes,
      playlist: {
        id: day.playlist_id || '',
        url: day.playlist_url || '',
      },
      playlists: routinePlaylistsFrom(blocks),
      prescriptions,
      athleteNote: athleteNotes.join('\n'),
    };
    if (role === 'staff') session.staffNote = staffNotes.join('\n');
    return session;
  });

  const referencedCodes = new Set(allBlocks.flatMap(block => {
    const legacyCodes = Array.isArray(block?.content?.exerciseCodes) ? block.content.exerciseCodes : [];
    const prescriptionCodes = prescriptionsFrom([block]).flatMap(item => [item.exerciseCode, item.alternativeExerciseCode]);
    return [...legacyCodes, ...prescriptionCodes].filter(code => typeof code === 'string' && code.trim());
  }));
  const referencedNames = new Set(allBlocks.flatMap(block => (Array.isArray(block?.content?.video_links) ? block.content.video_links : []).map((link: any) => link?.exercise)));
  const exercises = (input.exercises || []).filter(exercise => exercise.active !== false && (referencedCodes.has(exercise.code) || referencedNames.has(exercise.name))).map(exercise => ({
    id: exercise.id,
    code: exercise.code,
    title: exercise.name,
    category: exercise.categories || (exercise.category_slug ? [exercise.category_slug] : []),
    videoId: exercise.video_id || '',
    videoUrl: exercise.video_url || '',
    description: exercise.description || '',
    purpose: exercise.purpose || '',
    coachingCues: exercise.coaching_cues || '',
    defaultDosage: exercise.default_dosage || '',
    order: exercise.display_order || 0,
    active: true,
  }));
  const staffGuidance = unique(allBlocks
    .map(block => block.staff_note)
    .filter((note: unknown) => typeof note === 'string' && note.trim()))
    .join(' ');
  const programmeNotes = [
    week.running_focus ? `Running: ${week.running_focus}` : '',
    week.strength_focus ? `Strength: ${week.strength_focus}` : '',
    week.event_focus ? `Event: ${week.event_focus}` : '',
  ].filter(Boolean).join(' • ');

  return {
    contentStatus: 'published',
    role,
    cohort: cohortPayload,
    programme: {
      id: programme.id,
      school: cohort.name,
      title: programme.name,
      sport: programme.sport || '',
      week: week.week_number,
      totalWeeks: programme.duration_weeks,
      phase: week.phase || '',
      weeklyObjective: week.weekly_objective || '',
      athleteEducation: week.athlete_education || '',
      programmeNotes: role === 'staff' ? programmeNotes : '',
      coachGuidance: role === 'staff' ? staffGuidance : '',
      personalNote: typeof input.personalNote === 'string' ? input.personalNote : '',
      sessions,
    },
    exercises,
  };
}

