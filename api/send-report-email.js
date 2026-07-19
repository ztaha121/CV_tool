import nodemailer from 'nodemailer';
import { supabaseAdmin } from './_supabase-admin.js';
import { buildReportEmailHtml } from './_report-email-template.js';

const MAX_EMAILS_PER_DAY = 5;
const MIN_SECONDS_BETWEEN_SENDS = 30;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD // Gmail App Password, not your regular password
  }
});

async function isRateLimited(email) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('email_send_log')
    .select('sent_at')
    .eq('email', email)
    .gte('sent_at', since24h)
    .order('sent_at', { ascending: false });

  if (recent && recent.length >= MAX_EMAILS_PER_DAY) return 'Too many report emails sent to this address today — try again tomorrow.';
  if (recent && recent.length > 0) {
    const secondsSinceLast = (Date.now() - new Date(recent[0].sent_at).getTime()) / 1000;
    if (secondsSinceLast < MIN_SECONDS_BETWEEN_SENDS) return 'Please wait a moment before requesting another copy.';
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ sent: false, error: 'Method not allowed' });
  const { email, result } = req.body;
  if (!email || !result) return res.status(400).json({ sent: false, error: 'Missing email or report data' });
  const cleanEmail = email.toLowerCase().trim();

  try {
    // Hard requirement: only ever email the full report to someone who has
    // actually paid — never trust the client's claim of being unlocked.
    const { data: purchase } = await supabaseAdmin
      .from('unlocked_purchases')
      .select('email')
      .eq('email', cleanEmail)
      .single();
    if (!purchase) {
      return res.status(403).json({ sent: false, error: 'No confirmed payment on file for this email.' });
    }

    const limitError = await isRateLimited(cleanEmail);
    if (limitError) return res.status(429).json({ sent: false, error: limitError });

    const html = buildReportEmailHtml(result);
    await transporter.sendMail({
      from: `"ZAYT CV Services" <${process.env.GMAIL_USER}>`,
      to: cleanEmail,
      subject: `Your full ATS report — score ${result.overall}/100`,
      html
    });

    await supabaseAdmin.from('email_send_log').insert({ email: cleanEmail, sent_at: new Date().toISOString() });

    res.status(200).json({ sent: true });
  } catch (err) {
    res.status(500).json({ sent: false, error: err.message });
  }
}
