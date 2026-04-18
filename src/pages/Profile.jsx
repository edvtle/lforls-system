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
import { useAuth } from "../context/AuthContext";
import { updateProfileById } from "../services/authService";
import { deleteItemReport, listUserItemReports, updateItemReport } from "../services/reportingService";
import { isSupabaseConfigured } from "../services/supabaseClient";
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

const toLocalReportCard = (report) => ({
  ...report,
  source: "local",
  itemId: report.itemId || report.id,
  reportType: report.reportStatus === "Found" ? "found" : "lost",
});

const Profile = () => {
  const navigate = useNavigate();
  const { signOut, session, profile: authProfile } = useAuth();
  const [activeSection, setActiveSection] = useState("account");
  const [reportFilter, setReportFilter] = useState("All");
  const [reports, setReports] = useState([]);
  const [editingReportId, setEditingReportId] = useState("");
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [accountProfile, setAccountProfile] = useState({
    name: "User Demo",
    email: "userdemo@example.com",
    collegeDept: "College of Computer Studies",
    programYear: "3B",
    program: "",
  });
  const [draftProfile, setDraftProfile] = useState(accountProfile);
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
    const refreshReports = () => {
      const localReports = getUserReports().map(toLocalReportCard);
      setReports((current) => {
        const supabaseReports = current.filter((entry) => entry.source === "supabase");
        return [...supabaseReports, ...localReports];
      });
    };

    window.addEventListener(reportsUpdatedEventName, refreshReports);
    refreshReports();
    return () => window.removeEventListener(reportsUpdatedEventName, refreshReports);
  }, []);

  useEffect(() => {
    if (!authProfile) {
      return;
    }

    const next = {
      name: authProfile.fullName || "User Demo",
      email: authProfile.email || "userdemo@example.com",
      collegeDept: authProfile.collegeDept || "College of Computer Studies",
      programYear: authProfile.programYear || "3B",
      program: authProfile.program || "",
    };

    setAccountProfile(next);
    setDraftProfile(next);
  }, [authProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user?.id) {
      return;
    }

    let mounted = true;

    const loadReports = async () => {
      try {
        const supabaseReports = await listUserItemReports({ reporterId: session.user.id });
        const localReports = getUserReports().map(toLocalReportCard);

        if (!mounted) {
          return;
        }

        setReports([...supabaseReports, ...localReports]);
      } catch {
        if (!mounted) {
          return;
        }

        setReports(getUserReports().map(toLocalReportCard));
      }
    };

    loadReports();

    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

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

  const saveProfile = async () => {
    if (!draftProfile.name.trim() || !draftProfile.email.trim() || !draftProfile.collegeDept.trim() || !draftProfile.programYear.trim()) {
      showSnackbar("Complete name, email, college dept, and year/section.");
      return;
    }

    if (!/^[1-9][A-Za-z]$/.test(draftProfile.programYear.trim())) {
      showSnackbar("Year/Section must be in format like 3B.");
      return;
    }

    try {
      if (isSupabaseConfigured && session?.user?.id) {
        await updateProfileById(session.user.id, {
          fullName: draftProfile.name,
          email: draftProfile.email,
          collegeDept: draftProfile.collegeDept,
          programYear: draftProfile.programYear,
          program: draftProfile.program,
        });
      }

      setAccountProfile(draftProfile);
      showSnackbar("Profile updated.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to update profile.");
    }
  };

  const deleteReport = async (entry) => {
    try {
      if (entry.source === "supabase" && isSupabaseConfigured && session?.user?.id) {
        await deleteItemReport({
          reporterId: session.user.id,
          itemId: entry.itemId || entry.id,
        });
      } else {
        deleteUserReportById(entry.id);
      }

      setReports((current) => current.filter((item) => item.id !== entry.id));

      if (editingReportId === entry.id) {
        setEditingReportId("");
      }

      showSnackbar("Report deleted.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to delete report.");
    }
  };

  const saveReportChanges = async (entry) => {
    try {
      if (entry.source === "supabase" && isSupabaseConfigured && session?.user?.id) {
        const updated = await updateItemReport({
          reporterId: session.user.id,
          itemId: entry.itemId || entry.id,
          payload: {
            name: entry.name,
            location: entry.location,
            reportStatus: entry.reportStatus,
            status: entry.reportType === "found" ? "open" : "open",
          },
        });

        setReports((current) => current.map((item) => (item.id === entry.id ? updated : item)));
      } else {
        updateUserReportById(entry.id, entry);
      }

      setEditingReportId("");
      showSnackbar("Report changes saved.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to save report changes.");
    }
  };

  const deleteReportById = async (id) => {
    const entry = reports.find((item) => item.id === id);
    if (!entry) {
      return;
    }

    await deleteReport(entry);
  };

  const setEntryReportStatus = (id, nextStatus) => {
    setReports((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (nextStatus === "Claimed") {
          return { ...item, reportStatus: nextStatus };
        }

        return {
          ...item,
          reportStatus: nextStatus,
          reportType: nextStatus === "Found" ? "found" : "lost",
        };
      }),
    );
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      setEditingReportId("");
      navigate("/auth", { replace: true });
    }
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
                      onChange={(value) => setEntryReportStatus(entry.id, value)}
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
                        saveReportChanges(entry);
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
                    onClick={() => deleteReportById(entry.id)}
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
              <SelectDropdown
                value={draftProfile.collegeDept}
                onChange={(value) => setDraftProfile((current) => ({ ...current, collegeDept: value }))}
                className="profile-settings-select"
                options={[
                  "College of Arts and Sciences",
                  "College of Business Administration",
                  "College of Nursing",
                  "College of Engineering",
                  "College of Education",
                  "College of Computer Studies",
                  "College of International Hospitality Management",
                ]}
              />
            </label>
            <label>
              Year/Section
              <input
                type="text"
                value={draftProfile.programYear}
                onChange={(event) =>
                  setDraftProfile((current) => ({
                    ...current,
                    programYear: event.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g., 3B"
                maxLength={2}
              />
            </label>
            <label>
              Program
              <input
                type="text"
                value={draftProfile.program}
                onChange={(event) => setDraftProfile((current) => ({ ...current, program: event.target.value }))}
                placeholder="e.g., Bachelor of Science in Computer Science"
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
        <div className="profile-avatar" aria-hidden="true">{accountProfile.name.charAt(0)}</div>

        <div className="profile-header-copy">
          <p className="page-kicker">Account</p>
          <h2 className="page-title">{accountProfile.name}</h2>
          <p className="profile-header-email">
            <FontAwesomeIcon icon={faEnvelope} />
            <span>{accountProfile.email}</span>
          </p>
        </div>

        <div className="profile-header-meta" aria-label="Profile details">
          <div className="profile-header-meta-item">
            <span className="profile-header-meta-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBuildingColumns} />
            </span>
            <div>
              <span>College Dept</span>
              <strong>{accountProfile.collegeDept}</strong>
            </div>
          </div>

          <div className="profile-header-meta-item">
            <span className="profile-header-meta-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faGraduationCap} />
            </span>
            <div>
              <span>Year/Section</span>
              <strong>{accountProfile.programYear}</strong>
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
