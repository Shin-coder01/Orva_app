import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization');
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authorization || !url || !anonKey || !serviceRoleKey) {
    return response(401, { error: 'not_authenticated' });
  }

  const token = authorization.replace(/^Bearer\s+/i, '');
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return response(401, { error: 'not_authenticated' });

  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: prepareError } = await adminClient.rpc('prepare_account_deletion', { p_user: data.user.id });
  if (prepareError) return response(500, { error: 'account_cleanup_failed' });

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id);
  if (deleteError) return response(500, { error: 'account_deletion_failed' });
  return response(200, { status: 'deleted' });
});
