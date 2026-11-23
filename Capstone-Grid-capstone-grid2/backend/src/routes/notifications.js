const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalize(notification) {
  return {
    notificationId: notification.notification_id,
    type: notification.type,
    message: notification.message,
    projectId: notification.project_id,
    sectionId: notification.section_id,
    isRead: Boolean(notification.is_read),
    createdAt: notification.created_at
  };
}

router.get('/', requireAuth, async (req, res) => {
  const notifications = await query(
    `SELECT notification_id, type, message, project_id, section_id, is_read, created_at
       FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, notification_id DESC
      LIMIT 50`,
    [req.user.id]
  );
  const [unread] = await query(
    'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );

  return res.json({
    notifications: notifications.map(normalize),
    unreadCount: Number(unread.total)
  });
});

router.put('/read-all', requireAuth, async (req, res) => {
  const result = await query(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [req.user.id]
  );
  return res.json({ updated: result.affectedRows });
});

router.put('/:id/read', requireAuth, async (req, res) => {
  const notificationId = parseId(req.params.id);
  if (!notificationId) {
    return res.status(400).json({ error: 'Invalid notification id.' });
  }

  const result = await query(
    'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ? AND is_read = 0',
    [notificationId, req.user.id]
  );
  if (result.affectedRows === 0) {
    const rows = await query(
      'SELECT notification_id FROM notifications WHERE notification_id = ? AND user_id = ? LIMIT 1',
      [notificationId, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
  }

  return res.json({ notificationId, isRead: true });
});

module.exports = router;
