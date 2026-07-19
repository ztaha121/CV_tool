const PRODUCT_PERMALINK = 'cvhealthcheck'; // the part after /l/ in your Gumroad URL — make this a subscription product in Gumroad

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
  // For subscription products, Gumroad also reports whether the sale was
  // refunded/cancelled — treat those as invalid so a cancelled sub can't
  // keep unlimited access forever.
  if (data.success !== true) return false;
  const sale = data.purchase || {};
  if (sale.refunded || sale.chargebacked || sale.subscription_cancelled_at) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { licenseKey } = req.body;
  if (!licenseKey) return res.status(400).json({ valid: false, error: 'No license key provided' });

  try {
    const valid = await checkGumroadLicense(licenseKey);
    if (!valid) {
      return res.status(200).json({ valid: false, error: "That key didn't work — check it or make sure your subscription is still active." });
    }
    res.status(200).json({ valid: true });
  } catch (err) {
    res.status(200).json({ valid: false, error: 'Verification failed, try again.' });
  }
}
