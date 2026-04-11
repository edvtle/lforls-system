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
  faShield,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AnimatedContent from "../components/AnimatedContent";
import SearchBar from "../components/ui/SearchBar";
import { clearAuthSession, getAuthSession } from "../utils/authSession";
import "../styles/AdminPanel.css";

const menuItems = [
  { id: "home", label: "Home", icon: faChartColumn },
  { id: "items", label: "Manage Items", icon: faBoxOpen },
  { id: "users", label: "User", icon: faUsers },
  { id: "claims", label: "Claims/Request", icon: faGavel },
  { id: "flags", label: "Reports", icon: faFlag },
];

const seedItems = [
  { id: "ITM-1001", image: "https://picsum.photos/seed/lforls-admin-bag/120/120", name: "Black Jansport Backpack", category: "Bags", status: "Lost", date: "2026-04-09", review: "Pending" },
  { id: "ITM-1002", image: "https://picsum.photos/seed/lforls-admin-headset/120/120", name: "Wireless Headphones", category: "Electronics", status: "Found", date: "2026-04-08", review: "Approved" },
  { id: "ITM-1003", image: "https://picsum.photos/seed/lforls-admin-id/120/120", name: "Student ID - CCS", category: "IDs", status: "Found", date: "2026-04-08", review: "Pending" },
  { id: "ITM-1004", image: "https://picsum.photos/seed/lforls-admin-bottle/120/120", name: "Steel Water Bottle", category: "Personal", status: "Lost", date: "2026-04-07", review: "Rejected" },
];

const seedUsers = [
  { id: "USR-01", name: "John Dela Cruz", email: "john@example.com", reportsCount: 6, status: "Active" },
  { id: "USR-02", name: "Mia Santos", email: "mia@example.com", reportsCount: 2, status: "Suspended" },
  { id: "USR-03", name: "Carl Ramos", email: "carl@example.com", reportsCount: 4, status: "Active" },
];

const seedClaims = [
  { id: "CLM-301", item: "Black Jansport Backpack", user: "John Dela Cruz", answers: "States zipper damage and notebook initials", status: "Pending" },
  { id: "CLM-302", item: "Student ID - CCS", user: "Anne Lim", answers: "Knows student number and course details", status: "Pending" },
];

const seedFlags = [
  { id: "FLG-44", reason: "Possible fake item posting", target: "Item: Gold iPhone 15", severity: "High", status: "Open" },
  { id: "FLG-45", reason: "Suspicious user behavior", target: "User: temp_user_447", severity: "Medium", status: "Open" },
];

const dailyReports = [
  { day: "D1", reports: 5 },
  { day: "D2", reports: 8 },
  { day: "D3", reports: 6 },
  { day: "D4", reports: 9 },
  { day: "D5", reports: 11 },
  { day: "D6", reports: 7 },
  { day: "D7", reports: 10 },
];

const barColors = ["#53c93e", "#67d74f", "#5fd44a", "#6ee25a", "#7ef067", "#67d74f", "#74e95f"];

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState("home");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(seedItems);
  const [users, setUsers] = useState(seedUsers);
  const [claims, setClaims] = useState(seedClaims);
  const [flags, setFlags] = useState(seedFlags);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  useEffect(() => {
    if (!snackbar.open) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setSnackbar({ open: false, message: "" }), 2200);
    return () => window.clearTimeout(timerId);
  }, [snackbar.open]);

  useEffect(() => {
    const themeMode = window.localStorage.getItem("lforls:themeMode") || "dark";
    document.documentElement.dataset.theme = themeMode;
  }, []);

  const showSnackbar = (message) => {
    setSnackbar({ open: true, message });
  };

  const stats = useMemo(() => {
    const totalLostItems = items.filter((item) => item.status === "Lost").length;
    const totalFoundItems = items.filter((item) => item.status === "Found").length;
    const activeMatches = 8;
    const claimedItems = 5;
    return { totalLostItems, totalFoundItems, activeMatches, claimedItems };
  }, [items]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => {
      const haystack = `${item.id} ${item.name} ${item.category} ${item.status} ${item.review}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, normalizedQuery]);

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) {
      return users;
    }

    return users.filter((user) => `${user.name} ${user.email} ${user.status}`.toLowerCase().includes(normalizedQuery));
  }, [users, normalizedQuery]);

  const filteredClaims = useMemo(() => {
    if (!normalizedQuery) {
      return claims;
    }

    return claims.filter((claim) => `${claim.id} ${claim.item} ${claim.user} ${claim.answers}`.toLowerCase().includes(normalizedQuery));
  }, [claims, normalizedQuery]);

  const filteredFlags = useMemo(() => {
    if (!normalizedQuery) {
      return flags;
    }

    return flags.filter((flag) => `${flag.id} ${flag.reason} ${flag.target} ${flag.status}`.toLowerCase().includes(normalizedQuery));
  }, [flags, normalizedQuery]);

  const changeItemReview = (id, review) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, review } : item)));
    showSnackbar(`Item ${id} marked as ${review}.`);
  };

  const deleteItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
    showSnackbar(`Item ${id} deleted.`);
  };

  const updateUserStatus = (id, status) => {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, status } : user)));
    showSnackbar(`User ${id} is now ${status}.`);
  };

  const updateClaimStatus = (id, status) => {
    setClaims((current) => current.map((claim) => (claim.id === id ? { ...claim, status } : claim)));
    showSnackbar(`Claim ${id} ${status.toLowerCase()}.`);
  };

  const updateFlagStatus = (id, status) => {
    setFlags((current) => current.map((flag) => (flag.id === id ? { ...flag, status } : flag)));
    showSnackbar(`Flag ${id} updated: ${status}.`);
  };

  const handleLogout = () => {
    clearAuthSession();
    navigate("/auth", { replace: true });
  };

  const renderDashboard = () => (
    <div className="admin-section-stack">
      <AnimatedContent distance={20} duration={0.56} ease="power2.out" delay={0.04} threshold={0.08}>
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
        <AnimatedContent distance={24} duration={0.6} ease="power2.out" delay={0.08} threshold={0.08}>
          <article className="admin-content-card">
            <div className="admin-content-head">
              <h3>Daily reports</h3>
              <span>Last 7 days</span>
            </div>
            <div className="admin-chart-wrap" aria-label="Daily report chart">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={dailyReports} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(130, 171, 120, 0.2)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#9eb694", fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#88a980", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
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
                      <Cell key={`${entry.day}-${entry.reports}`} fill={barColors[index % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </AnimatedContent>

        <AnimatedContent distance={24} duration={0.6} ease="power2.out" delay={0.13} threshold={0.08}>
          <article className="admin-content-card">
            <div className="admin-content-head">
              <h3>Activity logs</h3>
              <span>Recent admin actions</span>
            </div>
            <ul className="admin-log-list">
              <li>
                <FontAwesomeIcon icon={faCircleCheck} /> Approved item ITM-1002
              </li>
              <li>
                <FontAwesomeIcon icon={faShield} /> Suspended user USR-02
              </li>
              <li>
                <FontAwesomeIcon icon={faFileCircleExclamation} /> Reviewed flag FLG-44
              </li>
            </ul>
          </article>
        </AnimatedContent>
      </div>
    </div>
  );

  const renderItems = () => (
    <AnimatedContent distance={24} duration={0.58} ease="power2.out" delay={0.06} threshold={0.08}>
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
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <img src={item.image} alt={item.name} className="admin-thumb" />
                </td>
                <td>
                  <strong>{item.name}</strong>
                  <small>{item.id}</small>
                </td>
                <td>{item.category}</td>
                <td>
                  <span className={`admin-status admin-status-${item.status.toLowerCase()}`}>{item.status}</span>
                  <span className={`admin-review admin-review-${item.review.toLowerCase()}`}>{item.review}</span>
                </td>
                <td>{item.date}</td>
                <td>
                  <div className="admin-action-row">
                    <button type="button" className="admin-action admin-action-approve" onClick={() => changeItemReview(item.id, "Approved")}>Approve</button>
                    <button type="button" className="admin-action admin-action-reject" onClick={() => changeItemReview(item.id, "Rejected")}>Reject</button>
                    <button type="button" className="admin-action" onClick={() => showSnackbar(`Viewing ${item.id}.`)}>View</button>
                    <button type="button" className="admin-action admin-action-delete" onClick={() => deleteItem(item.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </article>
    </AnimatedContent>
  );

  const renderUsers = () => (
    <AnimatedContent distance={24} duration={0.58} ease="power2.out" delay={0.06} threshold={0.08}>
      <article className="admin-content-card">
      <div className="admin-content-head">
        <h3>User Management</h3>
        <span>{filteredUsers.length} users</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User Name</th>
              <th>Email</th>
              <th>Reports</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.reportsCount}</td>
                <td>
                  <span className={`admin-review admin-review-${user.status.toLowerCase()}`}>{user.status}</span>
                </td>
                <td>
                  <div className="admin-action-row">
                    <button type="button" className="admin-action" onClick={() => showSnackbar(`Viewing ${user.id}.`)}>View</button>
                    <button type="button" className="admin-action admin-action-reject" onClick={() => updateUserStatus(user.id, "Suspended")}>Suspend</button>
                    <button type="button" className="admin-action admin-action-delete" onClick={() => updateUserStatus(user.id, "Banned")}>Ban</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </article>
    </AnimatedContent>
  );

  const renderClaims = () => (
    <AnimatedContent distance={24} duration={0.58} ease="power2.out" delay={0.06} threshold={0.08}>
      <article className="admin-content-card">
      <div className="admin-content-head">
        <h3>Claims / Requests</h3>
        <span>{filteredClaims.length} pending</span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Claim ID</th>
              <th>Item</th>
              <th>Claiming User</th>
              <th>Verification Answers</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClaims.map((claim) => (
              <tr key={claim.id}>
                <td>{claim.id}</td>
                <td>{claim.item}</td>
                <td>{claim.user}</td>
                <td>{claim.answers}</td>
                <td>
                  <div className="admin-action-row">
                    <button type="button" className="admin-action admin-action-approve" onClick={() => updateClaimStatus(claim.id, "Approved")}>Approve</button>
                    <button type="button" className="admin-action admin-action-reject" onClick={() => updateClaimStatus(claim.id, "Rejected")}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </article>
    </AnimatedContent>
  );

  const renderFlags = () => (
    <AnimatedContent distance={24} duration={0.58} ease="power2.out" delay={0.06} threshold={0.08}>
      <article className="admin-content-card">
      <div className="admin-content-head">
        <h3>Reports / Flags</h3>
        <span>{filteredFlags.length} active flags</span>
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
            {filteredFlags.map((flag) => (
              <tr key={flag.id}>
                <td>{flag.reason}</td>
                <td>{flag.target}</td>
                <td>{flag.severity}</td>
                <td>{flag.status}</td>
                <td>
                  <div className="admin-action-row">
                    <button type="button" className="admin-action" onClick={() => updateFlagStatus(flag.id, "Reviewed")}>Review</button>
                    <button type="button" className="admin-action admin-action-delete" onClick={() => updateFlagStatus(flag.id, "Content Removed")}>Remove Content</button>
                    <button type="button" className="admin-action admin-action-reject" onClick={() => updateFlagStatus(flag.id, "Warned User")}>Warn User</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </article>
    </AnimatedContent>
  );

  return (
    <main className="admin-shell">
      <AnimatedContent distance={30} duration={0.62} ease="power2.out" direction="horizontal" delay={0.02} threshold={0.02}>
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
              className={activeMenu === item.id ? "admin-menu-btn admin-menu-btn-active" : "admin-menu-btn"}
              onClick={() => setActiveMenu(item.id)}
            >
              <FontAwesomeIcon icon={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-foot">
          <button type="button" className="admin-logout-btn" onClick={handleLogout}>
            Sign out admin session
          </button>
        </div>
        </aside>
      </AnimatedContent>

      <section className="admin-main">
        {activeMenu !== "home" ? (
          <AnimatedContent distance={20} duration={0.5} ease="power2.out" delay={0.03} threshold={0.05}>
            <header className="admin-topbar">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search items, users, claims..."
                ariaLabel="Search admin data"
                className="admin-top-search"
                shellClassName="admin-search-shell"
                iconClassName="admin-search-icon"
                inputClassName="admin-search-input"
              />
            </header>
          </AnimatedContent>
        ) : null}

        <AnimatedContent distance={22} duration={0.56} ease="power2.out" delay={0.04} threshold={0.06}>
          <section className="admin-overview">
            <div>
              <p className="page-kicker">
                <FontAwesomeIcon icon={faShield} /> PLP - LOST AND FOUND System Control
              </p>
              <h1>Admin Panel</h1>
              <p>Monitor system activity, validate reports, moderate users, and resolve claims quickly.</p>
            </div>
            <div className="admin-overview-chips">
              <span><FontAwesomeIcon icon={faFilter} /> Review queue: {claims.filter((claim) => claim.status === "Pending").length}</span>
              <span><FontAwesomeIcon icon={faFlag} /> Open flags: {flags.filter((flag) => flag.status === "Open").length}</span>
            </div>
          </section>
        </AnimatedContent>

        {activeMenu === "home" ? renderDashboard() : null}
        {activeMenu === "items" ? renderItems() : null}
        {activeMenu === "users" ? renderUsers() : null}
        {activeMenu === "claims" ? renderClaims() : null}
        {activeMenu === "flags" ? renderFlags() : null}
      </section>

      {snackbar.open ? <div className="admin-snackbar">{snackbar.message}</div> : null}
    </main>
  );
};

export default AdminPanel;
