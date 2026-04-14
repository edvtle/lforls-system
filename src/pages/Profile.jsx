import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { gsap } from "gsap";
import {
  faChartLine,
  faBuildingColumns,
  faGear,
  faGraduationCap,
  faEnvelope,
  faListCheck,
  faMoon,
  faPen,
  faRightFromBracket,
  faSun,
  faTrash,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import SelectDropdown from "../components/ui/SelectDropdown";
import { clearAuthSession } from "../utils/authSession";
import { deleteUserReportById, getUserReports, reportsUpdatedEventName, updateUserReportById } from "../utils/reportStore";
import "../styles/Profile.css";

const reportFilters = ["All", "Lost", "Found", "Claimed"];

const formatRelative = (isoDate) => {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) {
    return "Just now";
  }

  const minutes = Math.floor((Date.now() - then) / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getStoredThemeMode = () => {
  return localStorage.getItem("lforls:themeMode") || "dark";
};

const Profile = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("account");
  const [reportFilter, setReportFilter] = useState("All");
  const [reports, setReports] = useState(() => getUserReports());
  const [editingReportId, setEditingReportId] = useState("");
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [profile, setProfile] = useState({
    name: "User Demo",
    email: "userdemo@example.com",
    collegeDept: "College of Computing Studies",
    programYear: "3rd Year",
  });
  const [draftProfile, setDraftProfile] = useState(profile);
  const [settings, setSettings] = useState({
    matchAlerts: true,
    messageAlerts: true,
    emailUpdates: false,
    password: "",
    themeMode: getStoredThemeMode(),
  });
  const workspaceRef = useRef(null);

  const sections = [
    {
      id: "account",
      title: "Edit Profile",
      subtitle: "Personal information and avatar",
      icon: faUser,
    },
    {
      id: "reports",
      title: "My Reports",
      subtitle: "Track and manage item reports",
      icon: faListCheck,
    },
    {
      id: "timeline",
      title: "Activity Timeline",
      subtitle: "Recent account activity",
      icon: faChartLine,
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "Alerts, security, and appearance",
      icon: faGear,
    },
  ];

  useEffect(() => {
    if (!snackbar.visible) {
      return undefined;
    }

    const timer = setTimeout(() => setSnackbar({ visible: false, message: "" }), 2600);
    return () => clearTimeout(timer);
  }, [snackbar.visible]);

  useEffect(() => {
    const refreshReports = () => setReports(getUserReports());
    window.addEventListener(reportsUpdatedEventName, refreshReports);
    return () => window.removeEventListener(reportsUpdatedEventName, refreshReports);
  }, []);

  const showSnackbar = (message) => {
    setSnackbar({ visible: true, message });
  };

  const updateThemeMode = (themeMode) => {
    setSettings((current) => {
      if (current.themeMode === themeMode) {
        return current;
      }

      localStorage.setItem("lforls:themeMode", themeMode);
      window.dispatchEvent(new Event("lforls:theme-updated"));
      document.documentElement.dataset.theme = themeMode;
      return { ...current, themeMode };
    });
  };

  useEffect(() => {
    localStorage.setItem("lforls:themeMode", settings.themeMode);
    document.documentElement.dataset.theme = settings.themeMode;
  }, [settings.themeMode]);

  useEffect(() => {
    const panel = workspaceRef.current?.querySelector(".profile-main-panel");
    if (!panel) {
      return undefined;
    }

    const activeCard = panel.firstElementChild;
    if (!activeCard) {
      return undefined;
    }

    const sectionNodes = Array.from(activeCard.children);
    const targets = sectionNodes.length ? sectionNodes : [activeCard];

    const tween = gsap.fromTo(
      targets,
      { y: 16, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.46,
        ease: "power2.out",
        stagger: 0.05,
        clearProps: "transform,opacity",
      },
    );

    return () => tween.kill();
  }, [activeSection]);

  const filteredReports = useMemo(() => {
    if (reportFilter === "All") {
      return reports;
    }

    return reports.filter((entry) => entry.reportStatus === reportFilter);
  }, [reports, reportFilter]);

  const stats = useMemo(() => {
    const itemsReported = reports.length;
    const itemsRecovered = reports.filter((entry) => entry.reportStatus === "Claimed").length;
    const activeMatches = reports.filter((entry) => entry.matchPercent >= 75).length;
    return { itemsReported, itemsRecovered, activeMatches };
  }, [reports]);

  const activityTimeline = useMemo(() => {
    const events = [
      ...reports.slice(0, 4).map((entry) => ({
        id: `report-${entry.id}`,
        text: `You reported ${entry.name}`,
        time: entry.createdAt,
      })),
    ];

    return events
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
      .slice(0, 6);
  }, [reports]);

  const saveProfile = () => {
    if (!draftProfile.name.trim() || !draftProfile.email.trim() || !draftProfile.collegeDept.trim() || !draftProfile.programYear.trim()) {
      showSnackbar("Complete name, email, college dept, and program year.");
      return;
    }

    setProfile(draftProfile);
    showSnackbar("Profile updated.");
  };

  const deleteReport = (id) => {
    deleteUserReportById(id);
    setReports((current) => current.filter((entry) => entry.id !== id));
    if (editingReportId === id) {
      setEditingReportId("");
    }
    showSnackbar("Report deleted.");
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate("/", { replace: true });
  };

  const renderReports = () => (
    <section className="profile-content-card">
      <div className="profile-content-head">
        <h3>My Reports</h3>
        <div className="profile-filter-chips">
          {reportFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={reportFilter === filter ? "profile-chip profile-chip-active" : "profile-chip"}
              onClick={() => setReportFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className={filteredReports.length === 1 ? "profile-report-grid profile-report-grid-compact" : "profile-report-grid"}>
        {filteredReports.length ? (
          filteredReports.map((entry) => (
            <article key={entry.id} className="profile-report-card">
              <img src={entry.image} alt={entry.name} />
              <div className="profile-report-copy">
                <p className="page-kicker">{entry.category}</p>
                <h4>{entry.name}</h4>
                <span className={`profile-status profile-status-${entry.reportStatus.toLowerCase()}`}>{entry.reportStatus}</span>

                {editingReportId === entry.id ? (
                  <div className="profile-edit-grid">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={(event) =>
                        setReports((current) =>
                          current.map((item) => (item.id === entry.id ? { ...item, name: event.target.value } : item))
                        )
                      }
                    />
                    <input
                      type="text"
                      value={entry.location}
                      onChange={(event) =>
                        setReports((current) =>
                          current.map((item) => (item.id === entry.id ? { ...item, location: event.target.value } : item))
                        )
                      }
                    />
                    <SelectDropdown
                      value={entry.reportStatus}
                      onChange={(value) =>
                        setReports((current) =>
                          current.map((item) => (item.id === entry.id ? { ...item, reportStatus: value } : item))
                        )
                      }
                      className="profile-edit-select"
                      options={["Lost", "Found", "Claimed"]}
                    />
                  </div>
                ) : (
                  <p className="profile-report-meta">{entry.location} • {formatRelative(entry.createdAt)}</p>
                )}

                <div className="profile-card-actions">
                  <Link to={entry.path || `/details/${entry.id}`} className="hero-button hero-button-lost">
                    View
                  </Link>
                  <button
                    type="button"
                    className="profile-inline-btn"
                    onClick={() => {
                      if (editingReportId === entry.id) {
                        updateUserReportById(entry.id, entry);
                        setEditingReportId("");
                        showSnackbar("Report changes saved.");
                      } else {
                        setEditingReportId(entry.id);
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faPen} /> {editingReportId === entry.id ? "Save" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className="profile-inline-btn profile-inline-btn-danger profile-inline-btn-icon-only"
                    onClick={() => deleteReport(entry.id)}
                    aria-label="Delete report"
                    title="Delete report"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="profile-empty-state">
            <h4>No reports yet</h4>
            <p>Submitted lost and found items will appear here after you report them.</p>
          </div>
        )}
      </div>
    </section>
  );

  const renderAccount = () => (
    <section className="profile-content-card">
      <div className="profile-content-head">
        <h3>Change User Information</h3>
      </div>

      <div className="profile-settings-layout">
        <section className="profile-settings-group">
          <h4>Account details</h4>
          <div className="profile-settings-grid">
            <label>
              Full name
              <input
                type="text"
                value={draftProfile.name}
                onChange={(event) => setDraftProfile((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={draftProfile.email}
                onChange={(event) => setDraftProfile((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label>
              College Dept
              <input
                type="text"
                value={draftProfile.collegeDept}
                onChange={(event) => setDraftProfile((current) => ({ ...current, collegeDept: event.target.value }))}
              />
            </label>
            <label>
              Program Year
              <SelectDropdown
                value={draftProfile.programYear}
                onChange={(value) => setDraftProfile((current) => ({ ...current, programYear: value }))}
                className="profile-settings-select"
                options={["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]}
              />
            </label>
          </div>
          <div className="profile-settings-actions">
            <button type="button" className="hero-button hero-button-lost" onClick={saveProfile}>Update information</button>
          </div>
        </section>
      </div>
    </section>
  );

  const renderSettings = () => (
    <section className="profile-content-card">
      <div className="profile-content-head">
        <h3>Settings</h3>
      </div>

      <div className="profile-settings-layout">
        <section className="profile-settings-group">
          <h4>Appearance</h4>
          <div className="profile-theme-switcher">
            <button
              type="button"
              className={settings.themeMode === "dark" ? "profile-theme-btn profile-theme-btn-active" : "profile-theme-btn"}
              onClick={() => {
                updateThemeMode("dark");
                showSnackbar("Dark mode enabled.");
              }}
            >
              <FontAwesomeIcon icon={faMoon} /> Dark mode
            </button>
            <button
              type="button"
              className={settings.themeMode === "light" ? "profile-theme-btn profile-theme-btn-active" : "profile-theme-btn"}
              onClick={() => {
                updateThemeMode("light");
                showSnackbar("Light mode enabled.");
              }}
            >
              <FontAwesomeIcon icon={faSun} /> Light mode
            </button>
          </div>
        </section>

        <section className="profile-settings-group">
          <h4>Notification preferences</h4>
          <div className="profile-preferences">
            <label>
              <input
                type="checkbox"
                checked={settings.matchAlerts}
                onChange={(event) => setSettings((current) => ({ ...current, matchAlerts: event.target.checked }))}
              />
              Match alerts
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.messageAlerts}
                onChange={(event) => setSettings((current) => ({ ...current, messageAlerts: event.target.checked }))}
              />
              Message alerts
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.emailUpdates}
                onChange={(event) => setSettings((current) => ({ ...current, emailUpdates: event.target.checked }))}
              />
              Email updates
            </label>
          </div>
        </section>

        <section className="profile-settings-group profile-settings-actions-group">
          <h4>Security & actions</h4>
          <label className="profile-settings-field">
            Change password
            <input
              className="profile-settings-input"
              type="password"
              value={settings.password}
              onChange={(event) => setSettings((current) => ({ ...current, password: event.target.value }))}
              placeholder="Optional"
            />
          </label>
          <div className="profile-settings-actions">
            <button type="button" className="hero-button hero-button-lost" onClick={saveProfile}>Save settings</button>
            <button type="button" className="profile-inline-btn profile-inline-btn-danger" onClick={handleLogout}>
              <FontAwesomeIcon icon={faRightFromBracket} /> Logout
            </button>
          </div>
        </section>
      </div>
    </section>
  );

  return (
    <section className={`profile-page profile-theme-${settings.themeMode}`}>
      <section className="page-card profile-header-card">
        <div className="profile-avatar" aria-hidden="true">{profile.name.charAt(0)}</div>

        <div className="profile-header-copy">
          <p className="page-kicker">Account</p>
          <h2 className="page-title">{profile.name}</h2>
          <p className="profile-header-email">
            <FontAwesomeIcon icon={faEnvelope} />
            <span>{profile.email}</span>
          </p>
        </div>

        <div className="profile-header-meta" aria-label="Profile details">
          <div className="profile-header-meta-item">
            <span className="profile-header-meta-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBuildingColumns} />
            </span>
            <div>
              <span>College Dept</span>
              <strong>{profile.collegeDept}</strong>
            </div>
          </div>

          <div className="profile-header-meta-item">
            <span className="profile-header-meta-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faGraduationCap} />
            </span>
            <div>
              <span>Program Year</span>
              <strong>{profile.programYear}</strong>
            </div>
          </div>
        </div>

      </section>

      <section className="page-card profile-stats-card">
        <div>
          <span>Items Reported</span>
          <strong>{stats.itemsReported}</strong>
        </div>
        <div>
          <span>Items Recovered</span>
          <strong>{stats.itemsRecovered}</strong>
        </div>
        <div>
          <span>Active Matches</span>
          <strong>{stats.activeMatches}</strong>
        </div>
      </section>

      <div className="profile-workspace" ref={workspaceRef}>
        <aside className="page-card profile-nav-card">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={activeSection === section.id ? "profile-nav-item profile-nav-item-active" : "profile-nav-item"}
              onClick={() => setActiveSection(section.id)}
            >
              <p>
                <FontAwesomeIcon icon={section.icon} /> {section.title}
              </p>
              <span>{section.subtitle}</span>
            </button>
          ))}
        </aside>

        <div className="profile-main-panel">
          {activeSection === "account" ? renderAccount() : null}
          {activeSection === "reports" ? renderReports() : null}
          {activeSection === "settings" ? renderSettings() : null}

          {activeSection === "timeline" ? (
            <section className="page-card profile-timeline-card">
              <h3>Activity Timeline</h3>
              <ul className="profile-simple-list">
                {activityTimeline.map((entry) => (
                  <li key={entry.id} className="profile-timeline-item">
                    <div>
                      <strong>{entry.text}</strong>
                    </div>
                    <em>{formatRelative(entry.time)}</em>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {snackbar.visible ? <div className="details-snackbar">{snackbar.message}</div> : null}
    </section>
  );
};

export default Profile;
