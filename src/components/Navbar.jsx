import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faBell, faCircleUser, faComments, faXmark } from "@fortawesome/free-solid-svg-icons";
import { getNotifications, getUnreadCount, markNotificationRead } from "../utils/notificationStore";

const menuItems = [
  { to: "/home", label: "Home" },
  { to: "/browse", label: "Browse" },
  { to: "/matches", label: "Matches" },
  { to: "/report/lost", label: "Lost" },
  { to: "/report/found", label: "Found" },
];

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());
  const [notifications, setNotifications] = useState(() => getNotifications().slice(0, 6));
  const dropdownRef = useRef(null);

  useEffect(() => {
    const refresh = () => {
      setUnreadCount(getUnreadCount());
      setNotifications(getNotifications().slice(0, 6));
    };

    window.addEventListener("lforls:notifications-updated", refresh);
    return () => window.removeEventListener("lforls:notifications-updated", refresh);
  }, []);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const latestNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  return (
    <header className="app-header">
      <div className="app-header-top">
        <div className="app-brand">
          <span className="app-brand-mark" aria-hidden="true">
            <img src="/logo.png" alt="" className="app-brand-logo" />
          </span>
          <div>
            <p className="app-brand-small">PLP</p>
            <h1 className="app-brand-title">Lost and Found</h1>
          </div>
        </div>

        <button
          type="button"
          className="app-mobile-menu-toggle"
          aria-label="Open account menu"
          aria-expanded={isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen((open) => !open)}
        >
          <FontAwesomeIcon icon={isMobileMenuOpen ? faXmark : faBars} className="app-mobile-menu-icon" aria-hidden="true" focusable="false" />
        </button>
      </div>

      <nav className="app-nav" aria-label="Primary">
        <div className="app-nav-group">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `app-link ${isActive ? "app-link-active" : ""}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {isMobileMenuOpen ? (
        <div className="app-mobile-menu-panel">
          <NavLink
            to="/notifications"
            className={({ isActive }) => `app-link ${isActive ? "app-link-active" : ""}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Notifications
          </NavLink>
          <NavLink
            to="/messages"
            className={({ isActive }) => `app-link ${isActive ? "app-link-active" : ""}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Messages
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => `app-link ${isActive ? "app-link-active" : ""}`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Profile
          </NavLink>
        </div>
      ) : null}

      <div className="app-nav-group app-nav-actions">
        <div className="app-notification-wrap" ref={dropdownRef}>
          <button
            type="button"
            className="app-icon-link app-notification-trigger"
            aria-label="Notifications"
            title="Notifications"
            onClick={() => setIsNotificationOpen((open) => !open)}
          >
            <FontAwesomeIcon icon={faBell} className="app-icon-svg" aria-hidden="true" focusable="false" />
            {unreadCount > 0 ? <span className="app-notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
          </button>

          {isNotificationOpen ? (
            <div className="app-notification-dropdown">
              <div className="app-notification-dropdown-head">
                <p>Notifications</p>
                <Link to="/notifications" onClick={() => setIsNotificationOpen(false)}>
                  View all
                </Link>
              </div>

              {latestNotifications.length ? (
                <ul>
                  {latestNotifications.map((entry) => (
                    <li key={entry.id}>
                      <Link
                        to={entry.path || "/notifications"}
                        onClick={() => {
                          markNotificationRead(entry.id);
                          setIsNotificationOpen(false);
                        }}
                      >
                        <strong>{entry.title}</strong>
                        <span>{entry.body}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="app-notification-empty">No new notifications</p>
              )}
            </div>
          ) : null}
        </div>
        <NavLink
          to="/messages"
          className={({ isActive }) => `app-icon-link ${isActive ? "app-link-active" : ""}`}
          aria-label="Messages"
          title="Messages"
        >
          <FontAwesomeIcon icon={faComments} className="app-icon-svg" aria-hidden="true" focusable="false" />
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => `app-icon-link ${isActive ? "app-link-active" : ""}`}
          aria-label="Profile"
          title="Profile"
        >
          <FontAwesomeIcon icon={faCircleUser} className="app-icon-svg" aria-hidden="true" focusable="false" />
        </NavLink>
      </div>
    </header>
  );
};

export default Navbar;
