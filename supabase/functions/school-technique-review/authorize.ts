import {authorizeSchoolSession} from '../_shared/hub-service.ts';
import {SupabaseHubRepository} from '../_shared/supabase-repository.ts';
import {cryptoPort} from '../_shared/runtime.ts';
export async function authorizeSchoolCoach(db: any, token: string, athleteId?: string) {
  const identity=await authorizeSchoolSession({token,repository:new SupabaseHubRepository(db),cryptoPort});
  if(identity.session.role!=='staff'||identity.staff?.access_profile==='sports_director')throw Error('Access denied');
  let athlete=null;
  if(athleteId){
    const {data,error}=await db.from('athletes').select('id,cohort_id,access_status')
      .eq('id',athleteId).eq('cohort_id',identity.cohort.id).eq('access_status','active').maybeSingle();
    if(error||!data)throw Error('Athlete not in assigned cohort');
    athlete=data;
  }
  return {session:identity.session,cohort:identity.cohort,athlete};
}
