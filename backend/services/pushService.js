/**
 * Phone & desktop alerts that arrive even when the app is closed (Web Push).
 * Works on Android, Windows/Mac Chrome & Edge, and on iPhone (iOS 16.4+) once the app is added
 * to the Home Screen. Every CRM notification is mirrored as a push to the recipient's devices.
 *
 * Keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY from .env, otherwise generated once and stored in
 * company_settings — so it works out of the box.
 */
const crypto = require('crypto');
const webpush = require('web-push');
const pool = require('../config/db');

let vapid = null;

async function getVapidKeys() {
  if (vapid) return vapid;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const [rows] = await pool.query(`SELECT setting_key, setting_value FROM company_settings WHERE setting_key IN ('vapid_public', 'vapid_private')`);
    const stored = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
    if (stored.vapid_public && stored.vapid_private) {
      vapid = { publicKey: stored.vapid_public, privateKey: stored.vapid_private };
    } else {
      const keys = webpush.generateVAPIDKeys();
      await pool.query(
        `INSERT INTO company_settings (setting_key, setting_value) VALUES ('vapid_public', ?), ('vapid_private', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [keys.publicKey, keys.privateKey]
      );
      vapid = keys;
    }
  }
  webpush.setVapidDetails(`mailto:${process.env.SUPPORT_EMAIL || 'support@example.com'}`, vapid.publicKey, vapid.privateKey);
  return vapid;
}

async function saveSubscription(userId, sub, userAgent) {
  const endpoint = String((sub && sub.endpoint) || '');
  const keys = (sub && sub.keys) || {};
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 700 || !keys.p256dh || !keys.auth) {
    const err = new Error('Invalid push subscription.');
    err.statusCode = 400;
    throw err;
  }
  await pool.query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)`,
    [crypto.randomUUID(), userId, endpoint, String(keys.p256dh).slice(0, 255), String(keys.auth).slice(0, 100), String(userAgent || '').slice(0, 255)]
  );
}

async function removeSubscription(userId, endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, String(endpoint || '')]);
}

async function countSubscriptions(userId) {
  const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', [userId]);
  return Number(r.n);
}

/**
 * Sends to every device of a user. Never throws — an alert must not break the action that caused it.
 * @returns {Promise<{sent:number, removed:number}>}
 */
async function sendToUser(userId, { title, body, url = './?source=push#/crm', leadId = null, tag = null }) {
  const result = { sent: 0, removed: 0 };
  try {
    const [subs] = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]);
    if (!subs.length) return result;
    await getVapidKeys();
    const payload = JSON.stringify({ title, body, url, leadId, tag: tag || (leadId ? `lead-${leadId}` : undefined) });
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: 'high' });
        result.sent++;
        await pool.query('UPDATE push_subscriptions SET last_success_at = NOW() WHERE id = ?', [s.id]);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // The device unsubscribed or the app was removed
          await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [s.id]);
          result.removed++;
        } else {
          console.warn('[Push] send failed:', err.statusCode || '', err.message);
        }
      }
    }));
  } catch (err) {
    console.warn('[Push]', err.message);
  }
  return result;
}

module.exports = { getVapidKeys, saveSubscription, removeSubscription, countSubscriptions, sendToUser };
