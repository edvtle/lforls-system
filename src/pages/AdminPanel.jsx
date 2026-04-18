import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxOpen,
  faChartColumn,
  faCircleCheck,
  faFileCircleExclamation,
  faFilter,
  faFlag,
  faGavel,
  faMagnifyingGlassPlus,
  faShield,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AnimatedContent from "../components/AnimatedContent";
import SearchBar from "../components/ui/SearchBar";
import { useAuth } from "../context/AuthContext";
import {
  deleteAdminItem,
  loadAdminPanelData,
  updateAdminClaimStatus,
  updateAdminFlagStatus,
  updateAdminItemStatus,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from "../services/adminService";
import "../styles/AdminPanel.css";

const menuItems = [
  { id: "home", label: "Home", icon: faChartColumn },
  { id: "items", label: "Manage Items", icon: faBoxOpen },
  { id: "users", label: "User", icon: faUsers },
  { id: "claims", label: "Claims/Request", icon: faGavel },
  { id: "flags", label: "Reports", icon: faFlag },
];

const emptyStats = {
  totalLostItems: 0,
  totalFoundItems: 0,
  activeMatches: 0,
  claimedItems: 0,
};

const emptyPanelState = {
  items: [],
  users: [],
  claims: [],
  flags: [],
  stats: emptyStats,
  dailyReports: [],
  activityLogs: [],
};

const barColors = [
  "#53c93e",
  "#67d74f",
  "#5fd44a",
  "#6ee25a",
  "#7ef067",
  "#67d74f",
  "#74e95f",
];

const iconForLog = {
  item: faCircleCheck,
  user: faShield,
  claim: faGavel,
  flag: faFileCircleExclamation,
};

const renderEmptyRow = (message, colSpan) => (
  <tr>
    <td colSpan={colSpan}>{message}</td>
  </tr>
);

const AdminPanel = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [activeMenu, setActiveMenu] = useState("home");
  const [query, setQuery] = useState("");
  const [panelData, setPanelData] = useState(emptyPanelState);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    department: "",
    yearSection: "",
  });
  const [selectedItem, setSelectedItem] = useState(null);
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userDeptFilter, setUserDeptFilter] = useState("all");

  useEffect(() => {
    if (!snackbar.open) {
      return undefined;
    }

    const timerId = window.setTimeout(
      () => setSnackbar({ open: false, message: "" }),
      2200,
    );
    return () => window.clearTimeout(timerId);
  }, [snackbar.open]);

  useEffect(() => {
    const themeMode = window.localStorage.getItem("lforls:themeMode") || "dark";
    document.documentElement.dataset.theme = themeMode;
  }, []);

  const showSnackbar = (message) => {
    setSnackbar({ open: true, message });
  };

  const refreshPanel = async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const nextData = await loadAdminPanelData();
      setPanelData(nextData);
      setLoadError("");
    } catch (error) {
      setLoadError(error?.message || "Unable to load admin data from database.");
      setPanelData(emptyPanelState);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshPanel();
  }, []);

  const { items, users, claims, flags, stats, dailyReports, activityLogs } =
    panelData;

  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const haystack =
        `${item.id} ${item.name} ${item.category} ${item.typeLabel} ${item.lifecycleStatus}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  const filteredUsers = useMemo(() => {
    const source = users.filter((user) => {
      const matchesStatus =
        userStatusFilter === "all" || user.rawStatus === userStatusFilter;
      const matchesDepartment =
        userDeptFilter === "all" || user.department === userDeptFilter;

      return matchesStatus && matchesDepartment;
    });

    if (!normalizedQuery) {
      return source;
    }

    return source.filter((user) =>
      `${user.name} ${user.email} ${user.department} ${user.yearSection} ${user.status}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [users, normalizedQuery, userStatusFilter, userDeptFilter]);

  const userDepartments = useMemo(() => {
    return [
      "all",
      ...Array.from(new Set(users.map((user) => user.department).filter(Boolean))),
    ];
  }, [users]);

  const filteredClaims = useMemo(() => {
    if (!normalizedQuery) {
      return claims;
    }

    return claims.filter((claim) => {
      const haystack =
        `${claim.id} ${claim.item} ${claim.fullName} ${claim.contact} ${claim.collegeDept} ${claim.programYear} ${claim.routeTo} ${claim.status}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [claims, normalizedQuery]);

  const filteredFlags = useMemo(() => {
    if (!normalizedQuery) {
      return flags;
    }

    return flags.filter((flag) =>
      `${flag.id} ${flag.reason} ${flag.target} ${flag.status}`.toLowerCase().includes(normalizedQuery),
    );
  }, [flags, normalizedQuery]);

  const withMutationFeedback = async (action, successMessage) => {
    try {
      await action();
      await refreshPanel({ silent: true });
      showSnackbar(successMessage);
    } catch (error) {
      showSnackbar(error?.message || "Database update failed.");
    }
  };

  const changeItemStatus = (id, status, label) =>
    withMutationFeedback(
      () => updateAdminItemStatus(id, status),
      `Item ${id} marked as ${label}.`,
    );

  const removeItem = (id) =>
    withMutationFeedback(() => deleteAdminItem(id), `Item ${id} deleted.`);

  const changeUserStatus = (id, status, label) =>
    withMutationFeedback(
      () => updateAdminUserStatus(id, status),
      `User ${id} is now ${label}.`,
    );

  const openEditUserModal = (user) => {
    setEditingUser(user);
    setEditUserForm({
      name: user.name,
      email: user.email,
      department: user.department === "N/A" ? "" : user.department,
      yearSection: user.yearSection === "N/A" ? "" : user.yearSection,
    });
  };

  const closeEditUserModal = () => {
    setEditingUser(null);
    setEditUserForm({ name: "", email: "", department: "", yearSection: "" });
  };

  const saveUserProfileChanges = async () => {
    if (!editingUser) {
      return;
    }

    if (
      !editUserForm.name.trim() ||
      !editUserForm.email.trim() ||
      !editUserForm.department.trim() ||
      !editUserForm.yearSection.trim()
    ) {
      showSnackbar("Name, email, department, and yr/sec are required.");
      return;
    }

    await withMutationFeedback(
      () =>
        updateAdminUserProfile({
          userId: editingUser.id,
          fullName: editUserForm.name,
          email: editUserForm.email,
          department: editUserForm.department,
          yearSection: editUserForm.yearSection,
        }),
      "User profile updated.",
    );

    closeEditUserModal();
  };

  const changeClaimStatus = (id, status, label) =>
    withMutationFeedback(
      () => updateAdminClaimStatus(id, status),
      `Claim ${id} ${label.toLowerCase()}.`,
    );

  const changeFlagStatus = (id, status, label) =>
    withMutationFeedback(
      () => updateAdminFlagStatus(id, status),
      `Flag ${id} updated: ${label}.`,
    );

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate("/auth", { replace: true });
    }
  };

  const renderDashboard = () => (
    <div className="admin-section-stack">
      <AnimatedContent
        distance={20}
        duration={0.56}
        ease="power2.out"
        delay={0.04}
        threshold={0.08}
      >
        <div className="admin-card-grid">
          <article className="admin-stat-card">
            <p>Total Lost Items</p>
            <strong>{stats.totalLostItems}</strong>
          </article>
          <article className="admin-stat-card">
            <p>Total Found Items</p>
            <strong>{stats.totalFoundItems}</strong>
          </article>
          <article className="admin-stat-card">
            <p>Active Matches</p>
            <strong>{stats.activeMatches}</strong>
          </article>
          <article className="admin-stat-card">
            <p>Claimed Items</p>
            <strong>{stats.claimedItems}</strong>
          </article>
        </div>
      </AnimatedContent>

      <div className="admin-grid-two">
        <AnimatedContent
          distance={24}
          duration={0.6}
          ease="power2.out"
          delay={0.08}
          threshold={0.08}
        >
          <article className="admin-content-card">
            <div className="admin-content-head">
              <h3>Daily reports</h3>
              <span>Last 7 days from database</span>
            </div>
            <div className="admin-chart-wrap" aria-label="Daily report chart">
              {dailyReports.length ? (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart
                    data={dailyReports}
                    margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(130, 171, 120, 0.2)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: "#9eb694", fontSize: 12, fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#88a980", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(93, 214, 44, 0.09)" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(93, 214, 44, 0.35)",
                        background: "rgba(7, 12, 8, 0.96)",
                        color: "#e8f7e0",
                      }}
                      labelStyle={{ color: "#bcd4b4", fontWeight: 700 }}
                    />
                    <Bar dataKey="reports" radius={[8, 8, 2, 2]} maxBarSize={28}>
                      {dailyReports.map((entry, index) => (
                        <Cell
                          key={`${entry.day}-${entry.reports}`}
                          fill={barColors[index % barColors.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p>No database reports found for the last 7 days.</p>
              )}
            </div>
          </article>
        </AnimatedContent>

        <AnimatedContent
          distance={24}
          duration={0.6}
          ease="power2.out"
          delay={0.13}
          threshold={0.08}
        >
          <article className="admin-content-card">
            <div className="admin-content-head">
              <h3>Activity logs</h3>
              <span>Recent database-backed records</span>
            </div>
            {activityLogs.length ? (
              <ul className="admin-log-list">
                {activityLogs.map((entry) => (
                  <li key={entry.id}>
                    <FontAwesomeIcon
                      icon={iconForLog[entry.icon] || faCircleCheck}
                    />{" "}
                    {entry.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent database activity to display.</p>
            )}
          </article>
        </AnimatedContent>
      </div>
    </div>
  );

  const renderItems = () => (
    <AnimatedContent
      distance={24}
      duration={0.58}
      ease="power2.out"
      delay={0.06}
      threshold={0.08}
    >
      <article className="admin-content-card">
        <div className="admin-content-head">
          <h3>Manage Items</h3>
          <span>{filteredItems.length} items</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length
                ? filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <img
                          src={item.image}
                          alt={item.name}
                          className="admin-thumb"
                        />
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                        <small>{item.id}</small>
                      </td>
                      <td>{item.category}</td>
                      <td>
                        <span
                          className={`admin-status admin-status-${item.typeLabel.toLowerCase()}`}
                        >
                          {item.typeLabel}
                        </span>
                        <span
                          className={`admin-review admin-review-${item.lifecycleStatus.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {item.lifecycleStatus}
                        </span>
                      </td>
                      <td>{item.date}</td>
                      <td>
                        <div className="admin-action-row">
                          <button
                            type="button"
                            className="admin-action admin-action-approve"
                            onClick={() =>
                              changeItemStatus(item.id, "resolved", "resolved")
                            }
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-reject"
                            onClick={() =>
                              changeItemStatus(item.id, "open", "open")
                            }
                          >
                            Reopen
                          </button>
                          <button
                            type="button"
                            className="admin-action"
                            onClick={() => setSelectedItem(item)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-delete"
                            onClick={() => removeItem(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : renderEmptyRow(
                    "No database items found for this filter.",
                    6,
                  )}
            </tbody>
          </table>
        </div>
      </article>
    </AnimatedContent>
  );

  const renderUsers = () => (
    <AnimatedContent
      distance={24}
      duration={0.58}
      ease="power2.out"
      delay={0.06}
      threshold={0.08}
    >
      <article className="admin-content-card">
        <div className="admin-content-head">
          <div className="admin-head-title">
            <h3>User Management</h3>
            <p className="admin-head-subtitle">{filteredUsers.length} users</p>
          </div>
          <div className="admin-filter-controls">
            <label className="admin-filter-select-wrap">
              <span>Status</span>
              <select
                value={userStatusFilter}
                onChange={(event) => setUserStatusFilter(event.target.value)}
                className="admin-filter-select"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </label>
            <label className="admin-filter-select-wrap">
              <span>Department</span>
              <select
                value={userDeptFilter}
                onChange={(event) => setUserDeptFilter(event.target.value)}
                className="admin-filter-select"
              >
                {userDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "all" ? "All" : dept}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>YR/SECTION</th>
                <th>Reports</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length
                ? filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.department || "N/A"}</td>
                      <td>{user.yearSection || "N/A"}</td>
                      <td>{user.reportsCount}</td>
                      <td>
                        <span
                          className={`admin-review admin-review-${user.status.toLowerCase()}`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-action-row">
                          <button
                            type="button"
                            className="admin-action"
                            onClick={() => openEditUserModal(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-reject"
                            onClick={() =>
                              changeUserStatus(
                                user.id,
                                user.rawStatus === "suspended" ? "active" : "suspended",
                                user.rawStatus === "suspended" ? "Active" : "Suspended",
                              )
                            }
                          >
                            {user.rawStatus === "suspended" ? "Unsuspend" : "Suspend"}
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-delete"
                            onClick={() =>
                              changeUserStatus(
                                user.id,
                                user.rawStatus === "banned" ? "active" : "banned",
                                user.rawStatus === "banned" ? "Active" : "Banned",
                              )
                            }
                          >
                            {user.rawStatus === "banned" ? "Unban" : "Ban"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : renderEmptyRow(
                    "No database users found for this filter.",
                    7,
                  )}
            </tbody>
          </table>
        </div>
      </article>
    </AnimatedContent>
  );

  const renderClaims = () => (
    <AnimatedContent
      distance={24}
      duration={0.58}
      ease="power2.out"
      delay={0.06}
      threshold={0.08}
    >
      <article className="admin-content-card">
        <div className="admin-content-head">
          <h3>Claims / Requests</h3>
          <span>{filteredClaims.length} database claims</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Item</th>
                <th>Claiming User</th>
                <th>Contact</th>
                <th>College Dept</th>
                <th>Program Year</th>
                <th>Route</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.length
                ? filteredClaims.map((claim) => (
                    <tr key={claim.id}>
                      <td>{claim.id}</td>
                      <td>{claim.item}</td>
                      <td>{claim.fullName}</td>
                      <td>{claim.contact}</td>
                      <td>{claim.collegeDept || "N/A"}</td>
                      <td>{claim.programYear || "N/A"}</td>
                      <td>{claim.routeTo || "admin-panel"}</td>
                      <td>
                        <div className="admin-action-row">
                          <button
                            type="button"
                            className="admin-action admin-action-approve"
                            onClick={() =>
                              changeClaimStatus(
                                claim.id,
                                "approved",
                                "Approved",
                              )
                            }
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-reject"
                            onClick={() =>
                              changeClaimStatus(
                                claim.id,
                                "rejected",
                                "Rejected",
                              )
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : renderEmptyRow(
                    "No database-backed claims table entries were found.",
                    8,
                  )}
            </tbody>
          </table>
        </div>
      </article>
    </AnimatedContent>
  );

  const renderFlags = () => (
    <AnimatedContent
      distance={24}
      duration={0.58}
      ease="power2.out"
      delay={0.06}
      threshold={0.08}
    >
      <article className="admin-content-card">
        <div className="admin-content-head">
          <h3>Reports / Flags</h3>
          <span>{filteredFlags.length} database reports</span>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Reported Item/User</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlags.length
                ? filteredFlags.map((flag) => (
                    <tr key={flag.id}>
                      <td>{flag.reason}</td>
                      <td>{flag.target}</td>
                      <td>{flag.severity}</td>
                      <td>{flag.status}</td>
                      <td>
                        <div className="admin-action-row">
                          <button
                            type="button"
                            className="admin-action"
                            onClick={() =>
                              changeFlagStatus(
                                flag.id,
                                "reviewed",
                                "Reviewed",
                              )
                            }
                          >
                            Review
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-delete"
                            onClick={() =>
                              changeFlagStatus(
                                flag.id,
                                "content_removed",
                                "Content Removed",
                              )
                            }
                          >
                            Remove Content
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-reject"
                            onClick={() =>
                              changeFlagStatus(
                                flag.id,
                                "warned_user",
                                "Warned User",
                              )
                            }
                          >
                            Warn User
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : renderEmptyRow(
                    "No database-backed reports table entries were found.",
                    5,
                  )}
            </tbody>
          </table>
        </div>
      </article>
    </AnimatedContent>
  );

  return (
    <main className="admin-shell">
      <AnimatedContent
        distance={30}
        duration={0.62}
        ease="power2.out"
        direction="horizontal"
        delay={0.02}
        threshold={0.02}
      >
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <img src="/logo.png" alt="PLP Lost and Found" />
            <div>
              <small>PLP - LOST AND FOUND</small>
              <strong>Admin Control</strong>
            </div>
          </div>

          <nav className="admin-menu" aria-label="Admin sections">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  activeMenu === item.id
                    ? "admin-menu-btn admin-menu-btn-active"
                    : "admin-menu-btn"
                }
                onClick={() => setActiveMenu(item.id)}
              >
                <FontAwesomeIcon icon={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="admin-sidebar-foot">
            <button
              type="button"
              className="admin-logout-btn"
              onClick={handleLogout}
            >
              Sign out admin session
            </button>
          </div>
        </aside>
      </AnimatedContent>

      <section className="admin-main">
        {activeMenu !== "home" ? (
          <AnimatedContent
            distance={20}
            duration={0.5}
            ease="power2.out"
            delay={0.03}
            threshold={0.05}
          >
            <header className="admin-topbar">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search database records..."
                ariaLabel="Search admin data"
                className="admin-top-search"
                shellClassName="admin-search-shell"
                iconClassName="admin-search-icon"
                inputClassName="admin-search-input"
              />
              <div className="admin-top-actions">
                <button
                  type="button"
                  className="admin-refresh-btn"
                  onClick={() => refreshPanel({ silent: true })}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </header>
          </AnimatedContent>
        ) : null}

        <AnimatedContent
          distance={22}
          duration={0.56}
          ease="power2.out"
          delay={0.04}
          threshold={0.06}
        >
          <section className="admin-overview">
            <div>
              <p className="page-kicker">
                <FontAwesomeIcon icon={faShield} /> PLP - LOST AND FOUND System
                Control
              </p>
              <h1>Admin Panel</h1>
              <p>
                This view now shows only database-backed records for items,
                users, claims, and reports.
              </p>
              {loadError ? <p>{loadError}</p> : null}
            </div>
            <div className="admin-overview-chips">
              <span>
                <FontAwesomeIcon icon={faFilter} /> Review queue:{" "}
                {claims.filter((claim) => claim.rawStatus === "pending").length}
              </span>
              <span>
                <FontAwesomeIcon icon={faFlag} /> Open flags:{" "}
                {flags.filter((flag) => flag.rawStatus === "open").length}
              </span>
            </div>
          </section>
        </AnimatedContent>

        {isLoading ? (
          <AnimatedContent
            distance={18}
            duration={0.4}
            ease="power2.out"
            delay={0.02}
            threshold={0.04}
          >
            <article className="admin-content-card">
              <div className="admin-content-head">
                <h3>Loading admin data</h3>
                <span>Fetching records from database</span>
              </div>
              <p>Please wait while the admin panel loads live data.</p>
            </article>
          </AnimatedContent>
        ) : null}

        {!isLoading && activeMenu === "home" ? renderDashboard() : null}
        {!isLoading && activeMenu === "items" ? renderItems() : null}
        {!isLoading && activeMenu === "users" ? renderUsers() : null}
        {!isLoading && activeMenu === "claims" ? renderClaims() : null}
        {!isLoading && activeMenu === "flags" ? renderFlags() : null}
      </section>

      {snackbar.open ? (
        <div className="admin-snackbar">{snackbar.message}</div>
      ) : null}

      {editingUser ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Edit user">
            <h3>Edit User</h3>
            <label className="admin-modal-field">
              User name
              <input
                type="text"
                value={editUserForm.name}
                onChange={(event) =>
                  setEditUserForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="admin-modal-field">
              Email
              <input
                type="email"
                value={editUserForm.email}
                onChange={(event) =>
                  setEditUserForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label className="admin-modal-field">
              Department
              <input
                type="text"
                value={editUserForm.department}
                onChange={(event) =>
                  setEditUserForm((current) => ({ ...current, department: event.target.value }))
                }
              />
            </label>
            <label className="admin-modal-field">
              YR/SECTION
              <input
                type="text"
                value={editUserForm.yearSection}
                onChange={(event) =>
                  setEditUserForm((current) => ({ ...current, yearSection: event.target.value.toUpperCase() }))
                }
                placeholder="e.g., 3B"
                maxLength={3}
              />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="admin-action" onClick={closeEditUserModal}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-action admin-action-approve"
                onClick={saveUserProfileChanges}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedItem ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-modal admin-modal-item" role="dialog" aria-modal="true" aria-label="Item details">
            <div className="admin-modal-header">
              <div>
                <p className="admin-modal-kicker">Manage Items</p>
                <h3>{selectedItem.name}</h3>
              </div>
              <div className="admin-item-badges">
                <span className={`admin-status admin-status-${selectedItem.typeLabel.toLowerCase()}`}>
                  {selectedItem.typeLabel}
                </span>
                <span className="admin-review">{selectedItem.lifecycleStatus}</span>
              </div>
            </div>
            <div className="admin-modal-image-wrap">
              <img src={selectedItem.image} alt={selectedItem.name} className="admin-modal-image" />
              <a
                href={selectedItem.image}
                target="_blank"
                rel="noreferrer"
                className="admin-modal-image-expand"
                title="View full-size image"
                aria-label="View full-size image"
              >
                <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
              </a>
            </div>
            <div className="admin-item-modal-grid">
              <article className="admin-item-fact"><span>ID</span><strong>{selectedItem.id}</strong></article>
              <article className="admin-item-fact"><span>Category</span><strong>{selectedItem.category}</strong></article>
              <article className="admin-item-fact"><span>Date</span><strong>{selectedItem.date}</strong></article>
              <article className="admin-item-fact"><span>Location</span><strong>{selectedItem.location}</strong></article>
              <article className="admin-item-fact"><span>Color</span><strong>{selectedItem.color}</strong></article>
              <article className="admin-item-fact"><span>Brand</span><strong>{selectedItem.brand}</strong></article>
              <article className="admin-item-fact"><span>Identifiers</span><strong>{selectedItem.identifiers}</strong></article>
              <article className="admin-item-fact"><span>Contact</span><strong>{selectedItem.contactMethod} - {selectedItem.contactValue}</strong></article>
            </div>
            <label className="admin-modal-field">
              Description
              <textarea value={selectedItem.description} readOnly rows={4} />
            </label>
            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-action"
                onClick={() => setSelectedItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default AdminPanel;
