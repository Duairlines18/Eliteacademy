import {handlePrivateAthleteRequest} from '../_shared/private-athlete-handler.ts';
import {SupabaseHubRepository} from '../_shared/supabase-repository.ts';
import {adminClient,verifiedUserFromRequest} from '../_shared/runtime.ts';

Deno.serve(request=>handlePrivateAthleteRequest(request,{
  verifyUser:verifiedUserFromRequest,
  repository:new SupabaseHubRepository(adminClient()),
}));

