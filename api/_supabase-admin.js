import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the SERVICE ROLE key — never expose this
// key to the browser. Set it as an env var in Vercel: SUPABASE_SERVICE_ROLE_KEY.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
