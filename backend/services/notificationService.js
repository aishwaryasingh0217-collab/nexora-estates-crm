const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Centralized Backend Notification Service
 * Dispatches and stores persistent notifications for CRM users
 */

/**
 * Creates a single persistent notification
 */
async function createNotification({
  recipientUserId,
  type = 'INFO',
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null
}) {
  if (!recipientUserId || !title || !message) {
    return null;
  }

  try {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO notifications (id, recipient_user_id, type, title, message, related_entity_type, related_entity_id, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())`,
      [id, recipientUserId, type, title, message, relatedEntityType, relatedEntityId]
    );
    return { id, recipientUserId, type, title, message, relatedEntityType, relatedEntityId };
  } catch (err) {
    console.error('[Notification Service Error]: Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Broadcasts a notification to all Super Admin users
 */
async function broadcastToAdmins({
  type = 'INFO',
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null
}) {
  try {
    const [admins] = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name = 'SUPER_ADMIN' AND u.status = 'ACTIVE'`
    );

    const promises = admins.map(admin =>
      createNotification({
        recipientUserId: admin.id,
        type,
        title,
        message,
        relatedEntityType,
        relatedEntityId
      })
    );

    await Promise.all(promises);
  } catch (err) {
    console.error('[Notification Service Error]: Failed to broadcast to admins:', err.message);
  }
}

/**
 * Retrieves notifications for a specific user
 */
async function getNotifications(userId, { limit = 30, unreadOnly = false } = {}) {
  let sql = `
    SELECT * FROM notifications
    WHERE recipient_user_id = ?
  `;
  const params = [userId];

  if (unreadOnly) {
    sql += ` AND is_read = FALSE`;
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const [rows] = await pool.query(sql, params);
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
  return result ? result.unread_count : 0;
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

module.exports = {
  createNotification,
  broadcastToAdmins,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
