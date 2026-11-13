// Stable response values are shared by both account audiences. Wording belongs in the UI.
const START = {
  body: ['good','sore','pain','unwell'],
  readiness: ['very_ready','ready','tired','exhausted'],
  plannedOutside: ['no','practice','match','both'],
  recentOutside: ['no','training','competition','both'],
};
const END = {
  completion: ['all','most','some','none'],
  challenge: ['easy','right','manageable','difficult'],
  recovery: ['good','sore','fatigued','unwell'],
};
function invalid(): never { throw new Error('Invalid check-in information.'); }
function option(value: unknown, values: string[], parent: boolean): string {
  if (typeof value !== 'string' || ![...values,...(parent?['unknown']:[])].includes(value)) invalid();
  return value as string;
}
function text(value: unknown, required = false, max = 500): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) invalid();
  return (value as string).trim();
}
export function checkinSafety(payload: any): boolean {
  return ['pain','unwell'].includes(payload.body) || payload.recovery === 'unwell' || payload.incompleteReason === 'pain';
}
export function normalizeCheckin(kind: string, input: any, audience: string): Record<string,any> {
  if (!input || Array.isArray(input) || typeof input !== 'object' || input.formVersion !== '2.0'
      || !['start','end'].includes(kind) || !['parent','private-athlete'].includes(audience)) invalid();
  const parent = audience === 'parent';
  const payload: Record<string,any> = {formVersion:'2.0',submittedBy:audience};
  for (const [key, values] of Object.entries(kind === 'start' ? START : END)) payload[key] = option(input[key],values,parent);
  // Older cached clients may still submit the retired end-of-week activity question.
  // Accept their explicit answer without requiring or inventing one for the shorter form.
  if (kind === 'end' && input.outside !== undefined) payload.outside = option(input.outside,['no','practice','match','both'],parent);
  const activities = kind === 'start' ? ['plannedOutside','recentOutside'] : payload.outside !== undefined ? ['outside'] : [];
  for (const key of activities) {
    if (!['no','unknown'].includes(payload[key])) payload[key+'Details'] = text(input[key+'Details'],true,300);
  }
  if (kind === 'end' && ['most','some','none'].includes(payload.completion)) {
    payload.incompleteReason = option(input.incompleteReason,['school','schedule','pain','other'],parent);
    if (payload.incompleteReason === 'other') payload.incompleteDetails = text(input.incompleteDetails,true,300);
  }
  if (checkinSafety(payload)) {
    payload.symptoms = parent && input.symptoms === 'Not sure — need to ask my child' ? 'unknown' : text(input.symptoms,true,500);
    payload.painApplicable = option(input.painApplicable,['yes','no'],parent);
    payload.movement = option(input.movement,['yes','no','unsure'],parent);
    if (payload.painApplicable === 'yes') {
      if (!(parent && input.severity === 'unknown') && (typeof input.severity !== 'number' || !Number.isInteger(input.severity) || input.severity < 0 || input.severity > 10)) invalid();
      payload.severity = input.severity;
    } else payload.severity = null;
  }
  payload.note = text(input.note,false,1000);
  return payload;
}
