import { handleParentRequest } from '../_shared/parent-handler.ts';
import { SupabaseHubRepository } from '../_shared/supabase-repository.ts';
import { adminClient, verifiedUserFromRequest } from '../_shared/runtime.ts';

Deno.serve(request => handleParentRequest(request, {
  verifyUser: verifiedUserFromRequest,
  repository: new SupabaseHubRepository(adminClient()),
}));


