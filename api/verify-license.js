import { reportCache, buildPrompt, callClaude, extractJson } from './analyze.js';

const PRODUCT_PERMALINK = 'cvhealthcheck'; // the part after /l/ in your Gumroad URL

async function checkGumroadLicense(licenseKey) {
  const params = new URLSearchParams({
    product_permalink: PRODUCT_PERMALINK,
    license_key: licenseKey
  });
  const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await response.json();
  return data.success === true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { licenseKey, reportId } = req.body;
  if (!licenseKey) return res.status(400).json({ valid: false, error: 'No license key provided' });

  try {
    const valid = await checkGumroadLicense(licenseKey);
    if (!valid) {
      return res.status(200).json({ valid: false, error: "That key didn't work — check and try again." });
    }

    // Re-run the same report on the higher-accuracy paid model so the
    // unlocked version is genuinely better, not just "the same text, unblurred".
    const cached = reportCache.get(reportId);
    if (!cached) {
      return res.status(200).json({ valid: true, result: null }); // frontend just unblurs existing free result
    }

    const prompt = buildPrompt({
      cvText: cached.cvText,
      jobTitle: cached.jobTitle,
      jobDesc: cached.jobDesc,
      regionNote: cached.regionNote || 'general international best practice'
    });
    const raw = await callClaude(prompt);
    const result = extractJson(raw);

    res.status(200).json({ valid: true, result });
  } catch (err) {
    res.status(200).json({ valid: false, error: 'Verification failed, try again.' });
  }
}
