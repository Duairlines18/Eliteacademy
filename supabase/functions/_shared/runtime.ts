import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  let key = '';
  const newKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (newKeys) {
    try { key = JSON.parse(newKeys).default || ''; } catch { key = ''; }
  }
  key ||= Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) throw new Error('Supabase function environment is incomplete.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function verifiedUserFromRequest(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return null;
  const token = match[1];
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export const cryptoPort = {
  async sha256(value: string) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  },
  randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  },
};

