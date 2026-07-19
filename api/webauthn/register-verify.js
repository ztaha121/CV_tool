import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { supabaseAdmin, rpID, origin, getUserFromAuthHeader } from './_shared.js';

export default async function handler(req, res) {
  const user = await getUserFromAuthHeader(req);
  if (!user) return res.status(401).json({ verified: false, error: 'Not signed in' });

  try {
    const { data: challengeRow } = await supabaseAdmin
      .from('webauthn_challenges')
      .select('challenge, created_at')
      .eq('identifier', user.id)
      .single();

    if (!challengeRow) return res.status(400).json({ verified: false, error: 'No pending registration — try again.' });
    // Challenges expire after 5 minutes.
    if (Date.now() - new Date(challengeRow.created_at).getTime() > 5 * 60 * 1000) {
      return res.status(400).json({ verified: false, error: 'Registration expired — try again.' });
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(200).json({ verified: false, error: 'Could not verify passkey.' });
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    await supabaseAdmin.from('webauthn_credentials').insert({
      user_id: user.id,
      email: user.email,
      credential_id: Buffer.from(credentialID).toString('base64url'),
      public_key: Buffer.from(credentialPublicKey).toString('base64url'),
      counter
    });

    // Clean up the used challenge.
    await supabaseAdmin.from('webauthn_challenges').delete().eq('identifier', user.id);

    res.status(200).json({ verified: true });
  } catch (err) {
    res.status(200).json({ verified: false, error: err.message });
  }
}
