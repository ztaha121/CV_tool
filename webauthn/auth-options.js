import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { supabaseAdmin, rpID } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const { data: creds } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('credential_id')
    .eq('email', email);

  if (!creds || !creds.length) {
    return res.status(200).json({ error: 'No Face ID / passkey found for this email. Log in with a password first, then add one.' });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'required',
    allowCredentials: creds.map(c => ({ id: Buffer.from(c.credential_id, 'base64url'), type: 'public-key' }))
  });

  await supabaseAdmin
    .from('webauthn_challenges')
    .upsert({ identifier: email, challenge: options.challenge, created_at: new Date().toISOString() }, { onConflict: 'identifier' });

  res.status(200).json(options);
}
