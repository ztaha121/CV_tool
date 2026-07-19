import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the SERVICE ROLE key — never expose this
// key to the browser. Set it as an env var in Vercel: SUPABASE_SERVICE_ROLE_KEY.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Change these to match your real deployed domain before going live.
export const rpName = 'ZAYT CV Health Check';
export const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
export const origin = process.env.WEBAUTHN_ORIGIN || `https://${rpID}`;

export async function getUserFromAuthHeader(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}
