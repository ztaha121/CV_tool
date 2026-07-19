import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { supabaseAdmin, rpID, origin } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ verified: false, error: 'Method not allowed' });
  const { email, assertion } = req.body;
  if (!email || !assertion) return res.status(400).json({ verified: false, error: 'Missing email or assertion' });

  try {
    const { data: challengeRow } = await supabaseAdmin
      .from('webauthn_challenges')
      .select('challenge, created_at')
      .eq('identifier', email)
      .single();

    if (!challengeRow) return res.status(400).json({ verified: false, error: 'No pending sign-in — try again.' });
    if (Date.now() - new Date(challengeRow.created_at).getTime() > 5 * 60 * 1000) {
      return res.status(400).json({ verified: false, error: 'Sign-in expired — try again.' });
    }

    const { data: credRow } = await supabaseAdmin
      .from('webauthn_credentials')
      .select('*')
      .eq('email', email)
      .eq('credential_id', assertion.rawId)
      .single();

    if (!credRow) return res.status(200).json({ verified: false, error: 'Passkey not recognised.' });

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: Buffer.from(credRow.credential_id, 'base64url'),
        credentialPublicKey: Buffer.from(credRow.public_key, 'base64url'),
        counter: credRow.counter
      }
    });

    if (!verification.verified) {
      return res.status(200).json({ verified: false, error: 'Face ID verification failed.' });
    }

    // Update the stored counter to guard against cloned authenticators.
    await supabaseAdmin
      .from('webauthn_credentials')
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq('id', credRow.id);
    await supabaseAdmin.from('webauthn_challenges').delete().eq('identifier', email);

    // Mint a real Supabase session for this email without a password —
    // generateLink (admin-only) returns a token_hash the frontend redeems
    // via supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email
    });
    if (linkError) throw linkError;

    res.status(200).json({ verified: true, token_hash: linkData.properties.hashed_token });
  } catch (err) {
    res.status(200).json({ verified: false, error: err.message });
  }
}
