import { supabaseAdmin } from './_supabase-admin.js';

// Set this URL as your Gumroad "Ping" webhook (Settings → Advanced → Ping, or
// per-product under Settings). Gumroad POSTs form-encoded data on every sale,
// refund, and dispute for products with Ping enabled.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const email = (body.email || body.purchaser_email || '').toLowerCase().trim();
  const refunded = body.refunded === 'true' || body.refunded === true;
  const chargebacked = body.chargebacked === 'true' || body.chargebacked === true;

  if (!email) {
    // Gumroad expects a 200 even if we ignore the payload, otherwise it retries forever.
    return res.status(200).json({ ok: true, ignored: true });
  }

  if (refunded || chargebacked) {
    await supabaseAdmin.from('unlocked_purchases').delete().eq('email', email);
  } else {
    await supabaseAdmin
      .from('unlocked_purchases')
      .upsert({ email, purchased_at: new Date().toISOString() }, { onConflict: 'email' });
  }

  res.status(200).json({ ok: true });
}
