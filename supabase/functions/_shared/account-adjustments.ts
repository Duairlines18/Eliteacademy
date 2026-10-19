type ExerciseSubstitution = {
  fromExerciseCode: string;
  toExerciseCode: string;
  note: string;
};

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,30}$/;

export function normalizeExerciseSubstitutions(value: unknown): ExerciseSubstitution[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) throw new Error('Invalid exercise substitutions.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid exercise substitutions.');
    const fields = item as Record<string, unknown>;
    if (Object.keys(fields).some(key => !['fromExerciseCode', 'toExerciseCode', 'note'].includes(key))) {
      throw new Error('Invalid exercise substitutions.');
    }
    const fromExerciseCode = typeof fields.fromExerciseCode === 'string' ? fields.fromExerciseCode.trim() : '';
    const toExerciseCode = typeof fields.toExerciseCode === 'string' ? fields.toExerciseCode.trim() : '';
    const note = typeof fields.note === 'string' ? fields.note.trim().slice(0, 500) : '';
    if (!CODE_PATTERN.test(fromExerciseCode) || !CODE_PATTERN.test(toExerciseCode) || fromExerciseCode === toExerciseCode) {
      throw new Error('Invalid exercise substitutions.');
    }
    return { fromExerciseCode, toExerciseCode, note };
  });
}

export function substitutionTargetCodes(value: unknown): string[] {
  return [...new Set(normalizeExerciseSubstitutions(value).map(item => item.toExerciseCode))];
}

export function applyAccountAdjustments(bundle: any, profile: any, extraExercises: any[] = []) {
  const substitutions = normalizeExerciseSubstitutions(profile?.exercise_substitutions);
  const substitutionByCode = new Map(substitutions.map(item => [item.fromExerciseCode, item]));
  const exerciseMap = new Map([...(bundle?.exercises || []), ...extraExercises].map((exercise: any) => [exercise.code, exercise]));
  const blocks = (bundle?.blocks || []).map((block: any) => {
    const prescriptions = Array.isArray(block?.content?.prescriptions)
      ? block.content.prescriptions.map((prescription: any) => {
          const substitution = substitutionByCode.get(prescription?.exerciseCode);
          if (!substitution) return { ...prescription };
          return {
            ...prescription,
            exerciseCode: substitution.toExerciseCode,
            originalExerciseCode: substitution.fromExerciseCode,
            substitutionNote: substitution.note,
          };
        })
      : block?.content?.prescriptions;
    const content = {...(block?.content || {}),prescriptions};
    for(const substitution of substitutions){
      const oldExercise=exerciseMap.get(substitution.fromExerciseCode),replacement=exerciseMap.get(substitution.toExerciseCode);
      const links=Array.isArray(content.video_links)?content.video_links:[];
      const referenced=(block?.content?.prescriptions || []).some((row: any)=>row.exerciseCode===substitution.fromExerciseCode)
        || (content.exerciseCodes || []).includes(substitution.fromExerciseCode)
        || links.some((link: any)=>oldExercise && link.exercise===oldExercise.name);
      if(!referenced)continue;
      if(!oldExercise || !replacement || replacement.active===false || !replacement.name)throw new Error('Coach review required: substitution movement unavailable.');
      const escaped=oldExercise.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const prefix=new RegExp('^(\\s*(?:(?:Form 2|Form 3|Lower 6)\\s*[—:-]\\s*)?)'+escaped+'(?=$|[\\s(—–:;-])','i');
      const rewrite=(line: any,index: number)=>{
        if(typeof line!=='string')return line;
        if(prefix.test(line))return line.replace(prefix,(_: string,group: string)=>group+replacement.name).replace('('+substitution.fromExerciseCode+')','('+substitution.toExerciseCode+')');
        if(links.some((link: any)=>link.exercise===oldExercise.name && link.item_index===index))throw new Error('Coach review required: ambiguous substitution instruction.');
        return line;
      };
      if(Array.isArray(content.items))content.items=content.items.map(rewrite);
      if(Array.isArray(content.exerciseCodes))content.exerciseCodes=content.exerciseCodes.map((code: string)=>code===substitution.fromExerciseCode?substitution.toExerciseCode:code);
      if(Array.isArray(content.video_links))content.video_links=links.map((link: any)=>{
        if(link.exercise!==oldExercise.name)return link;
        const {video_url:_oldUrl,video_id:_oldId,...rest}=link;
        return {...rest,exercise:replacement.name};
      });
    }
    return {...block,content};
  });
  const referencedCodes = new Set(blocks.flatMap((block: any) => {
    const prescriptions = Array.isArray(block?.content?.prescriptions) ? block.content.prescriptions : [];
    const legacy = Array.isArray(block?.content?.exerciseCodes) ? block.content.exerciseCodes : [];
    const reviewed = (Array.isArray(block?.content?.video_links) ? block.content.video_links : []).flatMap((link: any) => [...exerciseMap.values()].filter((exercise: any) => exercise.active !== false && exercise.name === link?.exercise).map((exercise: any) => exercise.code));
    return [...legacy, ...reviewed, ...prescriptions.flatMap((item: any) => [item?.exerciseCode, item?.alternativeExerciseCode])]
      .filter((code: unknown) => typeof code === 'string' && code.trim());
  }));
  return {
    ...bundle,
    blocks,
    exercises: [...referencedCodes].map(code => exerciseMap.get(code)).filter(exercise => exercise && exercise.active !== false),
    personalNote: typeof profile?.coach_note === 'string' ? profile.coach_note.trim().slice(0, 1000) : '',
  };
}

export async function prepareAccountAdjustments(bundle: any, profile: any, repository: any) {
  const targetCodes = bundle?.week ? substitutionTargetCodes(profile?.exercise_substitutions) : [];
  const extraExercises = targetCodes.length ? await repository.loadExercisesByCodes(targetCodes) : [];
  return applyAccountAdjustments(bundle, profile, extraExercises);
}

