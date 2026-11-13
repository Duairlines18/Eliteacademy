import {handleWeeklyCheckinAdmin} from '../_shared/weekly-checkin-admin-handler.ts';
import {SupabaseHubRepository} from '../_shared/supabase-repository.ts';
import {adminClient,verifiedUserFromRequest} from '../_shared/runtime.ts';
Deno.serve(request=>handleWeeklyCheckinAdmin(request,{verifyUser:verifiedUserFromRequest,repository:new SupabaseHubRepository(adminClient())}));
