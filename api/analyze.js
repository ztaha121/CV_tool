// In-memory report cache (per serverless instance — fine for MVP; swap for
// a KV/Supabase table if you need reports to survive cold starts / scale).
const reportCache = global.__cvReportCache || (global.__cvReportCache = new Map());

function buildPrompt({ cvText, jobTitle, jobDesc, regionNote }) {
  const jobContext = jobTitle ? `The candidate is targeting the role: ${jobTitle}.` : '';
  const jdBlock = jobDesc
    ? `\nJOB DESCRIPTION TO MATCH AGAINST:\n${jobDesc}\n\nAlso compute a "keywordMatch" score (0-100): the percentage of important hard skills, tools, and qualifications from the job description that genuinely appear (or are clearly implied) in the CV. Be strict — don't count a keyword as matched just because a loosely related word appears.`
    : `\nNo job description was provided, so omit "keywordMatch" entirely from the JSON (don't include the key).`;
  return `You are an industrial-grade ATS (Applicant Tracking System) simulator and senior CV consultant, evaluating with the rigor of real enterprise ATS platforms (Workday, Taleo, Greenhouse). Evaluate this CV against ${regionNote}

RUN THIS AS A FULL TECHNICAL + CONTENT AUDIT, not a surface read:
1. Parse simulation: check for standard section headers (Experience, Education, Skills), whether contact info is machine-extractable, whether tables/columns/text-boxes/graphics would break parsing, date format consistency, and file structure.
2. Keyword and skill density relative to the candidate's apparent target role.
3. Achievement specificity — quantified impact vs vague duty statements.
4. Tone, grammar, and consistency of voice.
5. Structural flow — logical section order, length appropriate to seniority.

EXAMPLES OF WEAK VS STRONG BULLETS (use this calibration when scoring "impact" and "achievementRatio"):
- Weak: "Responsible for handling customer complaints."
  Strong: "Resolved an average of 25 customer complaints weekly, improving satisfaction scores from 72% to 89% over 6 months."
- Weak: "Worked on marketing campaigns for the company."
  Strong: "Led 3 social media campaigns that grew Instagram following by 40% and drove a 15% increase in inbound leads."

The "ats" score should reflect parse-ability specifically (section headers, no tables/columns/graphics, consistent date formats, machine-readable structure) — not general quality.
${jdBlock}

INSTRUCTIONS:
First, briefly reason through the CV's strengths and weaknesses in plain text (2-4 short sentences, not a list) — consider achievement specificity, ATS parse-ability, tone, and market fit given the calibration above.

Then, on a new line, output ONLY a valid JSON object with this exact structure (no markdown, no code fences, nothing after it):
{"overall":<0-100>,"verdict":"strong"|"good"|"weak","verdictText":"<one punchy sentence>","scores":{"impact":<0-100>,"ats":<0-100>,"tone":<0-100>,"regionFit":<0-100>,"achievementRatio":<0-100>,"structure":<0-100>}${jobDesc ? ',"keywordMatch":<0-100>' : ''},"wins":["<exactly 5 real strengths, specific to this CV, not generic, ordered strongest first>"],"weaknesses":["<exactly 5 real weaknesses/gaps holding this CV back, specific and diagnostic, ordered most damaging first>"],"fixes":["<exactly 5 concrete prescriptive changes to make, specific to this CV, ordered highest-impact first>"],"atsIssues":["<exactly 5 technical parse-level flags: formatting, headers, structure — specific to this CV, ordered most severe first, or state clearly if none found>"],"quickWins":["<3 concrete step-by-step actions the person can do today, ranked by impact>"],"rewrittenExample":{"before":"<one weak bullet copied/adapted from this CV>","after":"<the same bullet rewritten strong, with a real plausible number>"}}

${jobContext}
CV TEXT:
${cvText}`;
}

async function callGroq(prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await response.json();
  return (data.content || []).map(b => b.text || '').join('');
}

function extractJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in model response');
  return JSON.parse(match[0]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { cvText, jobTitle, jobDesc, region, regionNote, tier } = req.body;
  if (!cvText || cvText.length < 50) return res.status(400).json({ error: 'No CV text provided' });

  try {
    const prompt = buildPrompt({ cvText, jobTitle, jobDesc, regionNote: regionNote || 'general international best practice' });
    // Free tier uses the cheap/fast model. A paid unlock re-runs on Claude
    // Haiku for a more accurate, personalized pass (see verify-license.js).
    const raw = tier === 'paid' ? await callClaude(prompt) : await callGroq(prompt);
    const result = extractJson(raw);

    const reportId = `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    reportCache.set(reportId, { cvText, jobTitle, jobDesc, region, regionNote, createdAt: Date.now() });

    res.status(200).json({ result, reportId });
  } catch (err) {
    res.status(500).json({ error: 'Analysis failed', details: err.message });
  }
}

export { reportCache, buildPrompt, callClaude, extractJson };
