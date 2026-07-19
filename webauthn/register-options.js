import { generateRegistrationOptions } from '@simplewebauthn/server';
import { supabaseAdmin, rpName, rpID, getUserFromAuthHeader } from './_shared.js';

export default async function handler(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ error: 'Not signed in' });

  const { data: existing } = await supabaseAdmin
    .from('webauthn_credentials')
    .select('credential_id')
    .eq('user_id', user.id);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(user.id),
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: (existing || []).map(c => ({
      id: Buffer.from(c.credential_id, 'base64url'),
      type: 'public-key'
    })),
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // prefers Face ID / Touch ID / Windows Hello
      userVerification: 'required'
    }
  });

  // Store the challenge so register-verify.js can check it. Upsert so a
  // retry overwrites the previous unused challenge for this user.
  await supabaseAdmin
    .from('webauthn_challenges')
    .upsert({ identifier: user.id, challenge: options.challenge, created_at: new Date().toISOString() }, { onConflict: 'identifier' });

  res.status(200).json(options);
}
