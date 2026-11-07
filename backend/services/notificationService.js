const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Centralized notification service — one notification centre for every portal.
 *
 * Each notification has a category (lead assigned, visit accepted, payment verified, …) so people can
 * choose what reaches them in the app and on their phone (Web Push). Notifications point at a record
 * (related_entity_type / related_entity_id) so the bell can open it.
 *
 * Callers decide who is authorised to hear about a record; helpers here only resolve role lists to
 * active users.
 */

const CATEGORIES = {
  LEAD_ASSIGNED: 'New lead assigned to you',
  LEAD_REASSIGNED: 'Lead moved to or from you',
  LEAD_NEW: 'New enquiries (managers)',
  FOLLOWUP_DUE: 'Follow-ups due',
  FOLLOWUP_OVERDUE: 'Overdue follow-ups',
  VISIT_ASSIGNED: 'Site visit assigned',
  VISIT_ACCEPTED: 'Site visit accepted / rejected',
  VISIT_COMPLETED: 'Site visit completed',
  VISIT_UPDATE: 'Other site visit changes',
  BOOKING_SUBMITTED: 'Booking submitted',
  BOOKING_APPROVED: 'Booking approved / rejected',
  PAYMENT_RECEIVED: 'Payment recorded (awaiting verification)',
  PAYMENT_CONFIRMED: 'Payment verified',
  PAYMENT_OVERDUE: 'Overdue payments',
  REFUND: 'Refund requests and decisions',
  COMPLAINT: 'Customer complaints',
  SERVICE_REQUEST: 'Service requests',
  APPROVAL_REQUEST: 'Approval requests',
  ESCALATION: 'Escalations',
  CALL: 'Calls (incoming, missed)',
  COMMISSION: 'Commission and payouts',
  SYSTEM: 'Other updates'
};

/**
 * Creates a single persistent notification. Respects the recipient's preferences for the category.
 * Returns the created notification, or null when it was skipped or failed.
 */
async function createNotification({
  recipientUserId,
  type = 'INFO',
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
  category = null
}) {
  if (!recipientUserId || !title || !message) {
    return null;
  }

  try {
    let inApp = true;
    let push = true;
    if (category) {
      const [prefs] = await pool.query(
        'SELECT in_app, push FROM notification_preferences WHERE user_id = ? AND category = ?',
        [recipientUserId, category]
      ).catch(() => [[]]);
      if (prefs[0]) { inApp = Boolean(prefs[0].in_app); push = Boolean(prefs[0].push); }
    }
    if (!inApp && !push) return null;

    const id = crypto.randomUUID();
    if (inApp) {
      await pool.query(
        `INSERT INTO notifications (id, recipient_user_id, type, title, message, related_entity_type, related_entity_id, category, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, NOW())`,
        [id, recipientUserId, type, String(title).slice(0, 255), message, relatedEntityType, relatedEntityId, category]
      );
    }
    if (push) {
      require('./pushService').sendToUser(recipientUserId, {
        title,
        body: message,
        leadId: relatedEntityType === 'LEAD' ? relatedEntityId : null
      });
    }
    return { id, recipientUserId, type, title, message, relatedEntityType, relatedEntityId, category };
  } catch (err) {
    console.error('[Notification Service Error]: Failed to create notification:', err.message);
    return null;
  }
}

/** Active users holding any of the roles (optionally only HEADs of those roles). */
async function usersWithRoles(roles, { headsOnly = false } = {}) {
  if (!roles || !roles.length) return [];
  const [rows] = await pool.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.status = 'ACTIVE' AND r.name IN (?) ${headsOnly ? "AND u.job_level = 'HEAD'" : ''}`,
    [roles]
  );
  return rows.map((r) => r.id);
}

/**
 * Sends the same notification to several users (deduplicated), skipping `exceptUserId`
 * (usually the person who did the action — they don't need to be told).
 */
async function notifyUsers(userIds, payload, exceptUserId = null) {
  const ids = [...new Set((userIds || []).filter(Boolean))].filter((id) => id !== exceptUserId);
  await Promise.all(ids.map((recipientUserId) => createNotification({ ...payload, recipientUserId })));
  return ids.length;
}

async function notifyRoles(roles, payload, exceptUserId = null, opts = {}) {
  return notifyUsers(await usersWithRoles(roles, opts), payload, exceptUserId);
}

/**
 * Broadcasts a notification to the owner (Super Admin) and every Sales Manager (Admin)
 */
async function broadcastToAdmins({
  type = 'INFO',
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
  category = 'LEAD_NEW'
}) {
  try {
    await notifyRoles(['SUPER_ADMIN', 'ADMIN'], { type, title, message, relatedEntityType, relatedEntityId, category });
  } catch (err) {
    console.error('[Notification Service Error]: Failed to broadcast to admins:', err.message);
  }
}

/**
 * Notification history for a user: newest first, optional unread-only / category filter, and
 * `before` (an ISO time) for loading older pages.
 */
async function getNotifications(userId, { limit = 30, unreadOnly = false, category = null, before = null } = {}) {
  let sql = `
    SELECT * FROM notifications
    WHERE recipient_user_id = ?
  `;
  const params = [userId];

  if (unreadOnly) {
    sql += ` AND is_read = FALSE`;
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (before) {
    sql += ' AND created_at < ?';
    params.push(new Date(before));
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Math.min(Math.max(Number(limit) || 30, 1), 200));

  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Notifications newer than `since` (used by the live stream). */
async function getNotificationsSince(userId, since) {
  const [rows] = await pool.query(
    `SELECT * FROM notifications WHERE recipient_user_id = ? AND created_at > ? ORDER BY created_at ASC LIMIT 50`,
    [userId, since]
  );
  return rows;
}

/**
 * Gets count of unread notifications for a user
 */
async function getUnreadCount(userId) {
  const [[result]] = await pool.query(
    `SELECT COUNT(*) AS unread_count FROM notifications
     WHERE recipient_user_id = ? AND is_read = FALSE`,
    [userId]
  );
  return result ? Number(result.unread_count) : 0;
}

/**
 * Marks a single notification as read
 */
async function markAsRead(notificationId, userId) {
  const [result] = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE id = ? AND recipient_user_id = ?`,
    [notificationId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Marks all notifications for a user as read
 */
async function markAllAsRead(userId) {
  const [result] = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = NOW()
     WHERE recipient_user_id = ? AND is_read = FALSE`,
    [userId]
  );
  return result.affectedRows;
}

/** Every category with the user's current choice (defaults: on in the app and on the phone). */
async function getPreferences(userId) {
  const [rows] = await pool.query('SELECT category, in_app, push FROM notification_preferences WHERE user_id = ?', [userId]);
  const saved = Object.fromEntries(rows.map((r) => [r.category, r]));
  return Object.entries(CATEGORIES).map(([key, label]) => ({
    category: key,
    label,
    in_app: saved[key] ? Boolean(saved[key].in_app) : true,
    push: saved[key] ? Boolean(saved[key].push) : true
  }));
}

async function setPreferences(userId, prefs) {
  for (const p of prefs || []) {
    if (!CATEGORIES[p.category]) continue;
    await pool.query(
      `INSERT INTO notification_preferences (user_id, category, in_app, push) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE in_app = VALUES(in_app), push = VALUES(push)`,
      [userId, p.category, p.in_app ? 1 : 0, p.push ? 1 : 0]
    );
  }
  return getPreferences(userId);
}

module.exports = {
  CATEGORIES,
  createNotification,
  broadcastToAdmins,
  usersWithRoles,
  notifyUsers,
  notifyRoles,
  getNotifications,
  getNotificationsSince,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  setPreferences
};
