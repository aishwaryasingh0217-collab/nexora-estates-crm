/**
 * Keeps public enquiry endpoints usable for real people and useless for bots:
 *  - honeypot: website forms carry a hidden "company_website" field that humans never fill
 *  - per-IP and per-mobile limits (in memory — fine for a single server process); local requests skip the IP cap
 *  - ad platforms that send WEBHOOK_SECRET in the x-webhook-secret header skip the limits
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = parseInt(process.env.ENQUIRY_MAX_PER_IP || '20', 10);
const MAX_PER_PHONE = parseInt(process.env.ENQUIRY_MAX_PER_PHONE || '4', 10);

const hits = new Map(); // key -> array of timestamps

function count(key, now) {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length;
}

// Forget idle keys so the map can't grow without bound
setInterval(() => {
  const now = Date.now();
  for (const [key, times] of hits) {
    if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(key);
  }
}, WINDOW_MS).unref();

const enquirySpamGuard = (req, res, next) => {
  const body = req.body || {};
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.get('x-webhook-secret') === secret) return next();

  if (body.company_website) {
    // Looks like success to the bot; nothing is saved
    return res.status(201).json({ status: 'success', message: 'Thanks! Our advisor will call you shortly.' });
  }

  const now = Date.now();
  // Requests from this machine (local testing) skip the IP cap; the per-mobile cap still applies.
  const loopback = /^(::1|127\.|::ffff:127\.)/.test(req.ip || '');
  if (!loopback && count(`ip:${req.ip}`, now) > MAX_PER_IP) {
    return res.status(429).json({ status: 'error', message: 'Too many requests. Please try again in a few minutes.' });
  }
  const phone = String(body.phone || body.phone_number || body.mobile || '').replace(/\D/g, '').slice(-10);
  if (phone.length === 10 && count(`ph:${phone}`, now) > MAX_PER_PHONE) {
    return res.status(429).json({ status: 'error', message: "We've already received your request — our advisor will call you shortly." });
  }
  next();
};

module.exports = { enquirySpamGuard };
