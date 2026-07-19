import { supabaseAdmin } from './_supabase-admin.js';

// Two separate Gumroad products map to two separate credit types.
// Set these to your real product permalinks (the part after /l/ in each URL).
const REPORT_UNLOCK_PERMALINK = 'kdfaka'; // $4.99 — unlocks one partial report to full
const SCAN_CREDIT_PERMALINK = 'okbik'; // $7.99 — +1 scan, permanently

// Set this URL as your Gumroad "Ping" webhook (Settings → Advanced → Ping, or
// per-product under Settings). Gumroad POSTs form-encoded data on every sale,
// refund, and dispute for products with Ping enabled.
export default async function handler(req, res) {
  // Gumroad's "Send test ping" button may hit this with GET just to check
  // the endpoint is reachable — respond 200 so that check passes.
  if (req.method === 'GET') return res.status(200).json({ ok: true, note: 'Gumroad webhook endpoint is reachable' });
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const email = (body.email || body.purchaser_email || '').toLowerCase().trim();
  const permalink = body.product_permalink || body.short_product_id || '';
  const refunded = body.refunded === 'true' || body.refunded === true;
  const chargebacked = body.chargebacked === 'true' || body.chargebacked === true;
  const isTestPing = body.test === 'true' || body.test === true;

  if (!email || isTestPing) {
    // Gumroad expects a 200 even if we ignore the payload, otherwise it retries forever.
    // Test pings (from "Send test ping to URL") are explicitly ignored so they can't
    // accidentally grant a real credit.
    return res.status(200).json({ ok: true, ignored: true });
  }

  const { data: existing } = await supabaseAdmin
    .from('unlocked_purchases')
    .select('report_unlock_credits, scan_credits')
    .eq('email', email)
    .single();

  let reportCredits = existing ? existing.report_unlock_credits : 0;
  let scanCredits = existing ? existing.scan_credits : 0;

  if (refunded || chargebacked) {
    // Best-effort: remove one credit of whichever type matches this product.
    if (permalink === REPORT_UNLOCK_PERMALINK) reportCredits = Math.max(0, reportCredits - 1);
    else if (permalink === SCAN_CREDIT_PERMALINK) scanCredits = Math.max(0, scanCredits - 1);
  } else {
    if (permalink === REPORT_UNLOCK_PERMALINK) reportCredits += 1;
    else if (permalink === SCAN_CREDIT_PERMALINK) scanCredits += 1;
    // Unknown product permalink: ignore rather than guess which credit to grant.
  }

  await supabaseAdmin
    .from('unlocked_purchases')
    .upsert({ email, report_unlock_credits: reportCredits, scan_credits: scanCredits, updated_at: new Date().toISOString() }, { onConflict: 'email' });

  res.status(200).json({ ok: true });
}
