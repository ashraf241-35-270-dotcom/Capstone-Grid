import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api/client.js';

export default function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  async function markAllRead() {
    setError('');
    try {
      await api.put('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update notifications.'));
    }
  }

  async function openNotification(notification) {
    setError('');
    if (!notification.isRead) {
      try {
        await api.put(`/notifications/${notification.notificationId}/read`);
        setNotifications((current) => current.map((item) => (
          item.notificationId === notification.notificationId ? { ...item, isRead: true } : item
        )));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (err) {
        setError(getErrorMessage(err, 'Could not mark this notification as read.'));
        return;
      }
    }

    setOpen(false);
    if (notification.projectId) {
      navigate('/projects', { state: { highlightProjectId: notification.projectId } });
    } else {
      navigate(notification.sectionId ? '/sections' : '/dashboard');
    }
  }

  return (
    <div className="notification-control">
      <button
        type="button"
        className="notification-button"
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen((current) => !current);
          loadNotifications();
        }}
      >
        Notifications
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-panel" id="notification-panel" aria-label="Notifications">
          <div className="notification-panel-head">
            <h2>Notifications</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </div>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {loading ? (
            <p className="muted small">Loading notifications...</p>
          ) : notifications.length > 0 ? (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  type="button"
                  className={`notification-item ${notification.isRead ? '' : 'notification-unread'}`}
                  key={notification.notificationId}
                  onClick={() => openNotification(notification)}
                >
                  <span>{notification.message}</span>
                  <time className="muted small">{notification.createdAt}</time>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small">You have no notifications.</p>
          )}
        </section>
      )}
    </div>
  );
}
