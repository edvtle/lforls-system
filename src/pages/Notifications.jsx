import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faCheckDouble, faClock, faFilter } from "@fortawesome/free-solid-svg-icons";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/notificationStore";

const formatRelativeTime = (isoDate) => {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) {
    return "Just now";
  }

  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const Notifications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState(() => getNotifications());

  useEffect(() => {
    const refresh = () => setNotifications(getNotifications());
    window.addEventListener("lforls:notifications-updated", refresh);
    return () => window.removeEventListener("lforls:notifications-updated", refresh);
  }, []);

  const filteredNotifications = useMemo(() => {
    if (activeTab === "unread") {
      return notifications.filter((entry) => !entry.read);
    }

    if (activeTab === "read") {
      return notifications.filter((entry) => entry.read);
    }

    return notifications;
  }, [notifications, activeTab]);

  const unreadCount = notifications.filter((entry) => !entry.read).length;

  const openNotification = (entry) => {
    markNotificationRead(entry.id);
    navigate(entry.path || "/notifications");
  };

  return (
    <section className="page-card notifications-page">
      <p className="page-kicker">Activity</p>
      <h2 className="page-title">Notifications</h2>
      <p className="page-description">New matches and verification updates appear here so you can act quickly.</p>

      <div className="notification-toolbar">
        <div className="notification-tabs">
          <button
            type="button"
            className={activeTab === "all" ? "notification-tab notification-tab-active" : "notification-tab"}
            onClick={() => setActiveTab("all")}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            className={activeTab === "unread" ? "notification-tab notification-tab-active" : "notification-tab"}
            onClick={() => setActiveTab("unread")}
          >
            Unread ({unreadCount})
          </button>
          <button
            type="button"
            className={activeTab === "read" ? "notification-tab notification-tab-active" : "notification-tab"}
            onClick={() => setActiveTab("read")}
          >
            Read ({notifications.length - unreadCount})
          </button>
        </div>

        <button
          type="button"
          className="notification-mark-all"
          onClick={() => {
            markAllNotificationsRead();
            setNotifications(getNotifications());
          }}
        >
          <FontAwesomeIcon icon={faCheckDouble} /> Mark all read
        </button>
      </div>

      {filteredNotifications.length ? (
        <ul className="notification-list">
          {filteredNotifications.map((entry) => (
            <li
              key={entry.id}
              className={`notification-item ${entry.priority === "high" ? "notification-item-high" : ""} ${entry.read ? "notification-item-read" : ""}`}
            >
              <div>
                <p className="notification-title">
                  <FontAwesomeIcon icon={faBell} /> {entry.title}
                </p>
                <p className="notification-copy">{entry.body}</p>
                <p className="notification-time">
                  <FontAwesomeIcon icon={faClock} /> {formatRelativeTime(entry.time)} <span>•</span> <FontAwesomeIcon icon={faFilter} /> {entry.type}
                </p>
              </div>

              <button type="button" className="hero-button hero-button-lost notification-open-action" onClick={() => openNotification(entry)}>
                Open
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="notification-empty">
          <p>No notifications yet.</p>
          <Link to="/report/lost" className="hero-button hero-button-lost">
            Create lost report
          </Link>
        </div>
      )}
    </section>
  );
};

export default Notifications;
