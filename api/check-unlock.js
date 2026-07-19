import { supabaseAdmin } from './_supabase-admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ unlocked: false, error: 'Method not allowed' });
  const email = (req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ unlocked: false, error: 'Email required' });

  const { data } = await supabaseAdmin
    .from('unlocked_purchases')
    .select('email')
    .eq('email', email)
    .single();

  res.status(200).json({ unlocked: !!data });
}
