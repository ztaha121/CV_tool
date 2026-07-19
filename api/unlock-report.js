import { supabaseAdmin } from './_supabase-admin.js';
import { reportCache, buildPrompt, callClaude } from './analyze.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ unlocked: false, error: 'Method not allowed' });
  const { email, reportId } = req.body;
  if (!email || !reportId) return res.status(400).json({ unlocked: false, error: 'Missing email or reportId' });
  const cleanEmail = email.toLowerCase().trim();

  try {
    const { data: row } = await supabaseAdmin
      .from('unlocked_purchases')
      .select('report_unlock_credits')
      .eq('email', cleanEmail)
      .single();

    const credits = row ? row.report_unlock_credits : 0;
    if (credits <= 0) {
      return res.status(200).json({ unlocked: false, error: "We don't see a report-unlock payment from that email yet — it can take a minute after checkout." });
    }

    const cached = reportCache.get(reportId);
    if (!cached) {
      return res.status(200).json({ unlocked: false, error: 'This report has expired — please run a new scan.' });
    }

    // Spend the credit before doing the (paid) Claude call, so a network
    // failure mid-request can't be exploited to re-try for free repeatedly.
    await supabaseAdmin
      .from('unlocked_purchases')
      .update({ report_unlock_credits: credits - 1, updated_at: new Date().toISOString() })
      .eq('email', cleanEmail);

    const prompt = buildPrompt({
      cvText: cached.cvText,
      jobTitle: cached.jobTitle,
      jobDesc: cached.jobDesc,
      regionNote: cached.regionNote || 'general international best practice',
      lang: cached.lang
    });
    const raw = await callClaude(prompt);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in model response');
    const result = JSON.parse(match[0]);

    res.status(200).json({ unlocked: true, result });
  } catch (err) {
    res.status(500).json({ unlocked: false, error: err.message });
  }
}
