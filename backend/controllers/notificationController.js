const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications
 * Get user's notifications
 */
const getNotifications = async (req, res, next) => {
  try {
    const { limit, unreadOnly } = req.query;
    const notifications = await notificationService.getNotifications(req.user.id, {
      limit: limit ? parseInt(limit, 10) : 30,
      unreadOnly: unreadOnly === 'true'
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

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
};
