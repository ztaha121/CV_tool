import { supabaseAdmin } from './_supabase-admin.js';

const FREE_PREMIUM_SCANS = 3;

async function getUserFromAuthHeader(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export default async function handler(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });

  const { data: purchase } = await supabaseAdmin
    .from('unlocked_purchases')
    .select('scan_credits, report_unlock_credits')
    .eq('email', user.email.toLowerCase().trim())
    .single();
  const scanCredits = purchase ? purchase.scan_credits : 0;

  const { data: usage } = await supabaseAdmin
    .from('user_scan_usage')
    .select('scans_used')
    .eq('user_id', user.id)
    .single();
  const scansUsed = usage ? usage.scans_used : 0;

  const totalAllowed = FREE_PREMIUM_SCANS + scanCredits;

  res.status(200).json({
    scansUsed,
    totalAllowed,
    scansRemaining: Math.max(0, totalAllowed - scansUsed)
  });
}
