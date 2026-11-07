const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications
 * Get user's notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const { limit, unreadOnly, category, before } = req.query;
    const notifications = await notificationService.getNotifications(req.user.id, {
      limit: limit ? parseInt(limit, 10) : 30,
      unreadOnly: unreadOnly === 'true',
      category: category || null,
      before: before || null
    });

    const unreadCount = await notificationService.getUnreadCount(req.user.id);

    res.status(200).json({
      status: 'success',
      results: notifications.length,
      unreadCount,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.status(200).json({
      status: 'success',
      data: { unreadCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
const markAsRead = async (req, res, next) => {
  try {
    const success = await notificationService.markAsRead(req.params.id, req.user.id);
    if (!success) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found or already read.'
      });
    }

    const unreadCount = await notificationService.getUnreadCount(req.user.id);

    res.status(200).json({
      status: 'success',
      message: 'Notification marked as read.',
      data: { unreadCount }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const updatedCount = await notificationService.markAllAsRead(req.user.id);
    res.status(200).json({
      status: 'success',
      message: `${updatedCount} notifications marked as read.`,
      data: { unreadCount: 0 }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/preferences — every category with the user's choices
 * PUT /api/notifications/preferences { preferences: [{ category, in_app, push }] }
 */
const getPreferences = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: await notificationService.getPreferences(req.user.id) });
  } catch (error) {
    next(error);
  }
};

const setPreferences = async (req, res, next) => {
  try {
    const prefs = Array.isArray(req.body && req.body.preferences) ? req.body.preferences : [];
    res.json({ status: 'success', message: 'Notification preferences saved.', data: await notificationService.setPreferences(req.user.id, prefs) });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/notifications/stream — live notifications as Server-Sent Events.
 * Several copies of the app may run at once, so each stream reads new rows from the database
 * every few seconds rather than relying on in-memory events. The connection closes after a few
 * minutes and the browser reconnects; if a proxy buffers the stream, the browser falls back to polling.
 */
const STREAM_POLL_MS = 4000;
const STREAM_HEARTBEAT_MS = 20000;
const STREAM_LIFETIME_MS = 5 * 60 * 1000;

const stream = async (req, res, next) => {
  try {
    const userId = req.user.id;
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    let since = new Date(Date.now() - 2000);
    const sent = new Set();
    send('ready', { unreadCount: await notificationService.getUnreadCount(userId), retry: STREAM_POLL_MS });

    let busy = false;
    const poll = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        // created_at has one-second precision: re-read the last second and skip what was already sent
        const rows = await notificationService.getNotificationsSince(userId, new Date(since.getTime() - 1000));
        const fresh = rows.filter((r) => !sent.has(r.id));
        if (fresh.length) {
          fresh.forEach((r) => { sent.add(r.id); send('notification', r); });
          since = new Date(fresh[fresh.length - 1].created_at);
          if (sent.size > 500) sent.clear();
          send('unread', { unreadCount: await notificationService.getUnreadCount(userId) });
        }
      } catch (err) {
        send('error', { message: 'Live updates paused' });
      } finally {
        busy = false;
      }
    }, STREAM_POLL_MS);
    const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), STREAM_HEARTBEAT_MS);
    const lifetime = setTimeout(() => { send('bye', { reconnect: true }); res.end(); }, STREAM_LIFETIME_MS);

    req.on('close', () => {
      clearInterval(poll);
      clearInterval(heartbeat);
      clearTimeout(lifetime);
    });
  } catch (error) {
    next(error);
  }
};

const getCategories = (req, res) => {
  res.json({ status: 'success', data: Object.entries(notificationService.CATEGORIES).map(([category, label]) => ({ category, label })) });
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  setPreferences,
  stream,
  getCategories
};
