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
  faTrashCan,
  faXmark,
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
import Modal from "../components/Modal";
import SearchBar from "../components/ui/SearchBar";
import { useAuth } from "../context/AuthContext";
import {
  deleteAdminUser,
  deleteAdminItem,
  deleteAdminFlag,
  loadAdminPanelData,
  removeFlaggedContent,
  sendUserWarning,
  toggleChatConversationSuspension,
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

const adminDepartmentOptions = [
  "College of Arts and Sciences",
  "College of Business Administration",
  "College of Nursing",
  "College of Engineering",
  "College of Education",
  "College of Computer Studies",
  "College of International Hospitality Management",
];

const renderEmptyRow = (message, colSpan) => (
  <tr>
    <td colSpan={colSpan}>{message}</td>
  </tr>
);

const formatDurationLabel = ({ value, unit }) => {
  const safeValue = Number(value);
  const safeUnit = String(unit || "hours").toLowerCase() === "days" ? "days" : "hours";
  if (!Number.isFinite(safeValue) || safeValue <= 0) {
    return "0 hours";
  }

  const rounded = Math.round(safeValue);
  if (safeUnit === "days") {
    return `${rounded} day${rounded === 1 ? "" : "s"}`;
  }

  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
};

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
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [selectedItemImage, setSelectedItemImage] = useState("");
  const [selectedFlagImage, setSelectedFlagImage] = useState("");
  const [reportSuccessModal, setReportSuccessModal] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [warnUserFlag, setWarnUserFlag] = useState(null);
  const [warningForm, setWarningForm] = useState({
    templateType: "generic",
    customMessage: "",
  });
  const [suspendUserModal, setSuspendUserModal] = useState(null);
  const [suspendForm, setSuspendForm] = useState({
    durationValue: "1",
    durationUnit: "hours",
  });
  const [isSuspendSubmitting, setIsSuspendSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [isConfirmSubmitting, setIsConfirmSubmitting] = useState(false);
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

  const openReportSuccessModal = (title, message) => {
    setReportSuccessModal({ title, message });
  };

  const closeReportSuccessModal = () => {
    setReportSuccessModal(null);
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

  useEffect(() => {
    if (!selectedItem) {
      setSelectedItemImage("");
      return;
    }

    const gallery = Array.isArray(selectedItem.gallery) ? selectedItem.gallery : [];
    setSelectedItemImage(gallery[0] || selectedItem.image || "");
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedFlag?.itemDetails) {
      setSelectedFlagImage("");
      return;
    }

    const gallery = Array.isArray(selectedFlag.itemDetails.gallery)
      ? selectedFlag.itemDetails.gallery
      : [];
    setSelectedFlagImage(gallery[0] || selectedFlag.itemDetails.image || "");
  }, [selectedFlag]);

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

  const openConfirmAction = ({
    title = "Are you sure?",
    message,
    confirmLabel = "Confirm",
    tone = "warning",
    onConfirm,
  }) => {
    setConfirmAction({ title, message, confirmLabel, tone, onConfirm });
  };

  const closeConfirmAction = () => {
    if (isConfirmSubmitting) {
      return;
    }

    setConfirmAction(null);
  };

  const submitConfirmAction = async () => {
    if (!confirmAction?.onConfirm) {
      return;
    }

    setIsConfirmSubmitting(true);
    try {
      await confirmAction.onConfirm();
      setConfirmAction(null);
    } finally {
      setIsConfirmSubmitting(false);
    }
  };

  const changeItemStatus = (id, status) => {
    const message =
      status === "resolved"
        ? `Item ${id} marked as resolved and hidden from Browse.`
        : status === "open"
          ? `Item ${id} reopened and restored to Browse.`
          : `Item ${id} updated.`;

    return withMutationFeedback(() => updateAdminItemStatus(id, status), message);
  };

  const removeItem = (id) =>
    withMutationFeedback(() => deleteAdminItem(id), `Item ${id} deleted.`);

  const confirmResolveItem = (item) =>
    openConfirmAction({
      message: `Are you sure you want to mark "${item.name}" as resolved? It will be hidden from Browse.`,
      confirmLabel: "Resolve Item",
      tone: "warning",
      onConfirm: () => changeItemStatus(item.id, "resolved"),
    });

  const confirmDeleteItem = (item) =>
    openConfirmAction({
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
      confirmLabel: "Delete Item",
      tone: "danger",
      onConfirm: () => removeItem(item.id),
    });

  const closeSuspendModal = () => {
    setSuspendUserModal(null);
    setSuspendForm({ durationValue: "1", durationUnit: "hours" });
    setIsSuspendSubmitting(false);
  };

  const openSuspendModal = (user) => {
    setSuspendUserModal(user);
    setSuspendForm({ durationValue: "1", durationUnit: "hours" });
  };

  const submitSuspendUser = async () => {
    if (!suspendUserModal) {
      return;
    }

    const durationValue = Number(suspendForm.durationValue);
    const durationUnit = suspendForm.durationUnit === "days" ? "days" : "hours";

    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      showSnackbar("Suspension duration must be greater than 0.");
      return;
    }

    setIsSuspendSubmitting(true);
    try {
      await updateAdminUserStatus(suspendUserModal.id, "suspended", {
        durationValue,
        durationUnit,
      });
      await refreshPanel({ silent: true });
      showSnackbar(
        `User ${suspendUserModal.id} suspended for ${formatDurationLabel({
          value: durationValue,
          unit: durationUnit,
        })}.`,
      );
      closeSuspendModal();
    } catch (error) {
      showSnackbar(error?.message || "Database update failed.");
      setIsSuspendSubmitting(false);
    }
  };

  const toggleUserStatus = async (user, status) => {
    const userId = user.id;
    const normalizedStatus = String(status || "active").toLowerCase();

    if (normalizedStatus === "suspended") {
      openConfirmAction({
        message: `Are you sure you want to suspend ${user.name}?`,
        confirmLabel: "Continue",
        tone: "warning",
        onConfirm: () => openSuspendModal(user),
      });
      return;
    }

    if (normalizedStatus === "banned") {
      openConfirmAction({
        message: `Are you sure you want to ban ${user.name}? This account will be blocked from using the system.`,
        confirmLabel: "Ban User",
        tone: "danger",
        onConfirm: () =>
          withMutationFeedback(
            () => updateAdminUserStatus(userId, normalizedStatus),
            `User ${userId} is now Banned.`,
          ),
      });
      return;
    }

    const statusLabel = normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);

    await withMutationFeedback(
      () => updateAdminUserStatus(userId, normalizedStatus),
      `User ${userId} is now ${statusLabel}.`,
    );
  };

  const removeUser = (id) =>
    withMutationFeedback(
      () => deleteAdminUser(id),
      `User ${id} was deleted from the account database.`,
    );

  const confirmDeleteUser = (user) =>
    openConfirmAction({
      message: `Are you sure you want to delete ${user.name}? This removes the account from the admin user list.`,
      confirmLabel: "Delete User",
      tone: "danger",
      onConfirm: () => removeUser(user.id),
    });

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

    const isAdministrator =
      editUserForm.department.trim().toLowerCase() === "administrator";

    if (
      !editUserForm.name.trim() ||
      !editUserForm.email.trim() ||
      !editUserForm.department.trim() ||
      (!isAdministrator && !editUserForm.yearSection.trim())
    ) {
      showSnackbar(
        isAdministrator
          ? "Name, email, and department are required."
          : "Name, email, department, and yr/sec are required.",
      );
      return;
    }

    await withMutationFeedback(
      () =>
        updateAdminUserProfile({
          userId: editingUser.id,
          fullName: editUserForm.name,
          email: editUserForm.email,
          department: editUserForm.department,
          yearSection: isAdministrator ? "" : editUserForm.yearSection,
        }),
      "User profile updated.",
    );

    const updatedDepartment = editUserForm.department.trim();
    const updatedYearSection = isAdministrator
      ? ""
      : editUserForm.yearSection.trim().toUpperCase();
    const updatedStatus = editingUser.rawStatus || "active";

    setPanelData((current) => ({
      ...current,
      users: current.users.map((user) =>
        user.id === editingUser.id
          ? {
              ...user,
              name: editUserForm.name.trim(),
              email: editUserForm.email.trim(),
              department: updatedDepartment || "N/A",
              yearSection: updatedYearSection || "N/A",
              rawStatus: updatedStatus,
              status: updatedStatus.charAt(0).toUpperCase() + updatedStatus.slice(1),
            }
          : user,
      ),
    }));

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

  const removeContentFromFlag = (flag) =>
    (async () => {
      try {
        await removeFlaggedContent({ flagId: flag.id, itemId: flag.itemId });
        setPanelData((current) => ({
          ...current,
          flags: current.flags.map((entry) =>
            entry.id === flag.id
              ? { ...entry, status: "Content removed", rawStatus: "content_removed" }
              : entry,
          ),
          items: current.items.map((entry) =>
            String(entry.id) === String(flag.itemId)
              ? {
                  ...entry,
                  lifecycleStatus: "Content removed",
                  rawStatus: "content_removed",
                }
              : entry,
          ),
        }));
        setSelectedFlag((current) => (current?.id === flag.id ? null : current));
        openReportSuccessModal(
          "Content removed",
          `Report ${flag.id} was marked as removed and the related content is hidden from Browse.`,
        );
      } catch (error) {
        showSnackbar(error?.message || "Database update failed.");
      }
    })();

  const confirmRemoveContentFromFlag = (flag) =>
    openConfirmAction({
      message: `Are you sure you want to remove the content for report ${flag.id}? The related item will be hidden from Browse.`,
      confirmLabel: "Remove Content",
      tone: "danger",
      onConfirm: () => removeContentFromFlag(flag),
    });

  const suspendChatFromFlag = (flag) =>
    (async () => {
      try {
        const reasonMessage = `This chat was reported as ${String(
          flag.reason || "a safety concern",
        ).toLowerCase()}.`;

        await toggleChatConversationSuspension({
          reportId: flag.id,
          conversationId: flag.conversationId,
          reason: reasonMessage,
          shouldSuspend: true,
        });

        setPanelData((current) => ({
          ...current,
          flags: current.flags.map((entry) =>
            entry.id === flag.id
              ? {
                  ...entry,
                  status: "Chat suspended",
                  rawStatus: "chat_suspended",
                  body: reasonMessage,
                }
              : entry,
          ),
        }));

        setSelectedFlag((current) =>
          current?.id === flag.id
            ? {
                ...current,
                status: "Chat suspended",
                rawStatus: "chat_suspended",
                body: reasonMessage,
              }
            : current,
        );

        openReportSuccessModal(
          "Chat suspended",
          `Conversation ${flag.conversationId} is now suspended. Users will see the moderation reason in Messages.`,
        );
      } catch (error) {
        showSnackbar(error?.message || "Database update failed.");
      }
    })();

  const confirmSuspendChatFromFlag = (flag) =>
    openConfirmAction({
      message: `Are you sure you want to suspend this chat conversation? Users will no longer be able to send messages in it.`,
      confirmLabel: "Suspend Chat",
      tone: "danger",
      onConfirm: () => suspendChatFromFlag(flag),
    });

  const enableChatFromFlag = (flag) =>
    (async () => {
      try {
        await toggleChatConversationSuspension({
          reportId: flag.id,
          conversationId: flag.conversationId,
          shouldSuspend: false,
        });

        setPanelData((current) => ({
          ...current,
          flags: current.flags.map((entry) =>
            entry.id === flag.id
              ? {
                  ...entry,
                  status: "Open",
                  rawStatus: "open",
                }
              : entry,
          ),
        }));

        setSelectedFlag((current) =>
          current?.id === flag.id
            ? {
                ...current,
                status: "Open",
                rawStatus: "open",
              }
            : current,
        );

        openReportSuccessModal(
          "Chat enabled",
          `Conversation ${flag.conversationId} is active again. Users can send messages normally.`,
        );
      } catch (error) {
        showSnackbar(error?.message || "Database update failed.");
      }
    })();

  const deleteReportRow = (flag) =>
    (async () => {
      try {
        await deleteAdminFlag(flag.id);
        setPanelData((current) => ({
          ...current,
          flags: current.flags.filter((entry) => entry.id !== flag.id),
        }));
        setSelectedFlag((current) => (current?.id === flag.id ? null : current));
        openReportSuccessModal(
          "Report deleted",
          `Report ${flag.id} was removed from the admin reports table.`,
        );
      } catch (error) {
        showSnackbar(error?.message || "Database update failed.");
      }
    })();

  const confirmDeleteReportRow = (flag) =>
    openConfirmAction({
      message: `Are you sure you want to delete report ${flag.id}? This removes it from the admin reports table.`,
      confirmLabel: "Delete Report",
      tone: "danger",
      onConfirm: () => deleteReportRow(flag),
    });

  const openImagePreview = (src, alt) => {
    if (!src) {
      return;
    }

    setPreviewImage({ src, alt: alt || "Image preview" });
  };

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
                      itemStyle={{ color: "#f4fff0", fontWeight: 700 }}
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
                          {item.rawStatus === "resolved" ? (
                            <button
                              type="button"
                              className="admin-action admin-action-reject"
                              onClick={() => changeItemStatus(item.id, "open")}
                            >
                              Reopen
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-action admin-action-approve"
                              onClick={() => confirmResolveItem(item)}
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-action"
                            onClick={() => setSelectedItem(item)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-icon-delete"
                            onClick={() => confirmDeleteItem(item)}
                            aria-label={`Delete item ${item.name}`}
                            title="Delete item"
                          >
                            <FontAwesomeIcon icon={faTrashCan} />
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
                              toggleUserStatus(
                                user,
                                user.rawStatus === "suspended" ? "active" : "suspended",
                              )
                            }
                          >
                            {user.rawStatus === "suspended" ? "Unsuspend" : "Suspend"}
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-delete"
                            onClick={() =>
                              toggleUserStatus(
                                user,
                                user.rawStatus === "banned" ? "active" : "banned",
                              )
                            }
                          >
                            {user.rawStatus === "banned" ? "Unban" : "Ban"}
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-icon-delete"
                            onClick={() => confirmDeleteUser(user)}
                            aria-label={`Delete user ${user.name}`}
                            title="Delete user"
                          >
                            <FontAwesomeIcon icon={faTrashCan} />
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
                <th>Reported Student</th>
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
                      <td>{flag.reportedStudent}</td>
                      <td>{flag.severity}</td>
                      <td>{flag.status}</td>
                      <td>
                        <div className="admin-action-row admin-action-row-reports">
                          <button
                            type="button"
                            className="admin-action"
                            onClick={() => setSelectedFlag(flag)}
                          >
                            Review
                          </button>
                          {flag.reportType === "chat" ? (
                            <button
                              type="button"
                              className="admin-action admin-action-delete admin-action-report-main"
                              onClick={() =>
                                flag.rawStatus === "chat_suspended"
                                  ? enableChatFromFlag(flag)
                                  : confirmSuspendChatFromFlag(flag)
                              }
                            >
                              {flag.rawStatus === "chat_suspended" ? "Enable Chat" : "Suspend Chat"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-action admin-action-delete admin-action-report-main"
                              onClick={() => confirmRemoveContentFromFlag(flag)}
                            >
                              Remove Content
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-action admin-action-reject"
                            onClick={() => {
                              setWarnUserFlag(flag);
                              setWarningForm({ templateType: "generic", customMessage: "" });
                            }}
                          >
                            Warn User
                          </button>
                          <button
                            type="button"
                            className="admin-action admin-action-icon-delete"
                            onClick={() => confirmDeleteReportRow(flag)}
                            aria-label={`Delete report ${flag.id}`}
                            title="Delete row"
                          >
                            <FontAwesomeIcon icon={faXmark} />
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

  const selectedItemGallery = Array.isArray(selectedItem?.gallery)
    ? selectedItem.gallery
    : [];
  const selectedItemImageIndex = selectedItemGallery.findIndex(
    (image) => image === selectedItemImage,
  );
  const selectedFlagGallery = Array.isArray(selectedFlag?.itemDetails?.gallery)
    ? selectedFlag.itemDetails.gallery
    : [];
  const selectedFlagImageIndex = selectedFlagGallery.findIndex(
    (image) => image === selectedFlagImage,
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

      <Modal
        isOpen={Boolean(reportSuccessModal)}
        onClose={closeReportSuccessModal}
        ariaLabel={reportSuccessModal?.title || "Success"}
        overlayClassName="admin-modal-backdrop"
        panelClassName="admin-modal admin-modal-success"
      >
        {reportSuccessModal ? (
          <>
            <p className="admin-modal-kicker">Success</p>
            <h3>{reportSuccessModal.title}</h3>
            <p className="admin-modal-success-message">{reportSuccessModal.message}</p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-action admin-action-approve" onClick={closeReportSuccessModal}>
                Close
              </button>
            </div>
          </>
        ) : null}
      </Modal>

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
              <select
                value={editUserForm.department}
                onChange={(event) =>
                  setEditUserForm((current) => ({
                    ...current,
                    department: event.target.value,
                    yearSection:
                      event.target.value === "Administrator"
                        ? ""
                        : current.yearSection,
                  }))
                }
                className="admin-filter-select"
              >
                <option value="">Select department</option>
                {adminDepartmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-modal-field">
              YR/SECTION
              <input
                type="text"
                value={editUserForm.yearSection}
                onChange={(event) =>
                  setEditUserForm((current) => ({ ...current, yearSection: event.target.value.toUpperCase() }))
                }
                placeholder={
                  editUserForm.department === "Administrator"
                    ? "Not required for Administrator"
                    : "e.g., 3B"
                }
                maxLength={3}
                disabled={editUserForm.department === "Administrator"}
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
            <div className="admin-modal-media-shell">
              <div className="admin-modal-image-wrap">
                <img src={selectedItemImage || selectedItem.image} alt={selectedItem.name} className="admin-modal-image" />
                <button
                  type="button"
                  className="admin-modal-image-expand"
                  title="Expand image"
                  aria-label="Expand image in modal"
                  onClick={() => openImagePreview(selectedItemImage || selectedItem.image, selectedItem.name)}
                >
                  <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                </button>
                {selectedItemGallery.length > 1 ? (
                  <span className="admin-modal-image-count">
                    {(selectedItemImageIndex >= 0 ? selectedItemImageIndex : 0) + 1} / {selectedItemGallery.length}
                  </span>
                ) : null}
              </div>
              {selectedItem.gallery?.length > 1 ? (
                <div className="admin-modal-image-thumbs" aria-label="Item image thumbnails">
                  {selectedItem.gallery.map((image, index) => (
                    <button
                      key={`${selectedItem.id}-gallery-${index}`}
                      type="button"
                      className={`admin-modal-thumb ${selectedItemImage === image ? "admin-modal-thumb-active" : ""}`}
                      onClick={() => setSelectedItemImage(image)}
                      aria-label={`View item image ${index + 1}`}
                    >
                      <img src={image} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
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
              <span className="admin-item-section-title">Description</span>
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

      {selectedFlag ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setSelectedFlag(null)}>
          <div
            className="admin-modal admin-modal-item admin-modal-report"
            role="dialog"
            aria-modal="true"
            aria-label="Report details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-header">
              <div>
                <p className="admin-modal-kicker">Report Details</p>
                <h3>{selectedFlag.reason}</h3>
                <p className="admin-report-subtitle">Moderation summary and linked evidence</p>
              </div>
              <div className="admin-item-badges">
                <span className={`admin-review admin-review-${selectedFlag.rawSeverity.toLowerCase()}`}>
                  {selectedFlag.severity}
                </span>
                <span className={`admin-review admin-review-${selectedFlag.rawStatus.toLowerCase()}`}>
                  {selectedFlag.status}
                </span>
              </div>
            </div>
            <section className="admin-report-section">
              <p className="admin-item-section-title">Report Summary</p>
              <div className="admin-report-body">
                {selectedFlag.body || selectedFlag.target}
              </div>
              <div className="admin-item-modal-grid">
                <article className="admin-item-fact"><span>Reported Student</span><strong>{selectedFlag.reportedStudent}</strong></article>
                <article className="admin-item-fact"><span>Target</span><strong>{selectedFlag.relatedLabel}</strong></article>
              </div>
            </section>

            {selectedFlag.itemDetails ? (
              <section className="admin-report-section">
                <div className="admin-modal-header">
                  <div>
                    <p className="admin-modal-kicker">Related Item</p>
                    <h3>{selectedFlag.itemDetails.name}</h3>
                    <p className="admin-report-subtitle">Click thumbnails to inspect all uploaded evidence images</p>
                  </div>
                  <div className="admin-item-badges">
                    <span className={`admin-status admin-status-${selectedFlag.itemDetails.typeLabel.toLowerCase()}`}>
                      {selectedFlag.itemDetails.typeLabel}
                    </span>
                    <span className="admin-review">{selectedFlag.itemDetails.lifecycleStatus}</span>
                  </div>
                </div>
                <div className="admin-modal-media-shell">
                  <div className="admin-modal-image-wrap">
                    <img src={selectedFlagImage || selectedFlag.itemDetails.image} alt={selectedFlag.itemDetails.name} className="admin-modal-image" />
                    <button
                      type="button"
                      className="admin-modal-image-expand"
                      title="Expand image"
                      aria-label="Expand image in modal"
                      onClick={() =>
                        openImagePreview(
                          selectedFlagImage || selectedFlag.itemDetails.image,
                          selectedFlag.itemDetails.name,
                        )
                      }
                    >
                      <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                    </button>
                    {selectedFlagGallery.length > 1 ? (
                      <span className="admin-modal-image-count">
                        {(selectedFlagImageIndex >= 0 ? selectedFlagImageIndex : 0) + 1} / {selectedFlagGallery.length}
                      </span>
                    ) : null}
                  </div>
                  {selectedFlag.itemDetails.gallery?.length > 1 ? (
                    <div className="admin-modal-image-thumbs" aria-label="Reported item image thumbnails">
                      {selectedFlag.itemDetails.gallery.map((image, index) => (
                        <button
                          key={`${selectedFlag.itemDetails.id}-gallery-${index}`}
                          type="button"
                          className={`admin-modal-thumb ${selectedFlagImage === image ? "admin-modal-thumb-active" : ""}`}
                          onClick={() => setSelectedFlagImage(image)}
                          aria-label={`View reported item image ${index + 1}`}
                        >
                          <img src={image} alt="" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="admin-item-modal-grid">
                  <article className="admin-item-fact"><span>ID</span><strong>{selectedFlag.itemDetails.id}</strong></article>
                  <article className="admin-item-fact"><span>Category</span><strong>{selectedFlag.itemDetails.category}</strong></article>
                  <article className="admin-item-fact"><span>Date</span><strong>{selectedFlag.itemDetails.date}</strong></article>
                  <article className="admin-item-fact"><span>Location</span><strong>{selectedFlag.itemDetails.location}</strong></article>
                  <article className="admin-item-fact"><span>Color</span><strong>{selectedFlag.itemDetails.color}</strong></article>
                  <article className="admin-item-fact"><span>Brand</span><strong>{selectedFlag.itemDetails.brand}</strong></article>
                  <article className="admin-item-fact"><span>Identifiers</span><strong>{selectedFlag.itemDetails.identifiers}</strong></article>
                  <article className="admin-item-fact"><span>Contact</span><strong>{selectedFlag.itemDetails.contactMethod} - {selectedFlag.itemDetails.contactValue}</strong></article>
                </div>
                <label className="admin-modal-field">
                  <span className="admin-item-section-title">Item Description</span>
                  <textarea value={selectedFlag.itemDetails.description} readOnly rows={4} />
                </label>
              </section>
            ) : (
              <section className="admin-report-section">
                <p className="admin-report-empty">No linked item evidence was found for this report.</p>
              </section>
            )}
            <div className="admin-modal-actions">
              {selectedFlag.reportType === "chat" ? (
                <button
                  type="button"
                  className="admin-action admin-action-delete"
                  onClick={() =>
                    selectedFlag.rawStatus === "chat_suspended"
                      ? enableChatFromFlag(selectedFlag)
                      : confirmSuspendChatFromFlag(selectedFlag)
                  }
                >
                  {selectedFlag.rawStatus === "chat_suspended" ? "Enable Chat" : "Suspend Chat"}
                </button>
              ) : null}
              <button
                type="button"
                className="admin-action"
                onClick={() => setSelectedFlag(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div className="admin-modal-backdrop" role="presentation" onClick={() => setPreviewImage(null)}>
          <div
            className="admin-image-viewer"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="admin-image-viewer-close"
              onClick={() => setPreviewImage(null)}
              aria-label="Close image preview"
            >
              Close
            </button>
            <img src={previewImage.src} alt={previewImage.alt} className="admin-image-viewer-image" />
          </div>
        </div>
      ) : null}

      {warnUserFlag ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-modal admin-modal-warning" role="dialog" aria-modal="true" aria-label="Send user warning">
            <div className="admin-modal-header">
              <div>
                <p className="admin-modal-kicker">Moderation action</p>
                <h3>Send User Warning</h3>
              </div>
              <span className="admin-warning-pill">Report #{warnUserFlag.id}</span>
            </div>

            <div className="admin-warning-summary">
              <article>
                <span>Report reason</span>
                <strong>{warnUserFlag.reason}</strong>
              </article>
              <article>
                <span>Reported target</span>
                <strong>{warnUserFlag.target}</strong>
              </article>
            </div>

            <label className="admin-modal-field">
              Warning Template
              <select
                value={warningForm.templateType}
                onChange={(event) =>
                  setWarningForm((current) => ({ ...current, templateType: event.target.value }))
                }
                className="admin-filter-select admin-warning-select"
              >
                <option value="generic">Generic Warning</option>
                <option value="inappropriate">Inappropriate Content</option>
                <option value="false_report">False Report</option>
                <option value="spam">Spam / Abuse</option>
                <option value="custom">Custom Message</option>
              </select>
            </label>

            <label className="admin-modal-field">
              Warning Message
              {warningForm.templateType === "custom" ? (
                <textarea
                  value={warningForm.customMessage}
                  onChange={(event) =>
                    setWarningForm((current) => ({ ...current, customMessage: event.target.value }))
                  }
                  placeholder="Write a clear, professional warning message..."
                  rows={5}
                  className="admin-warning-textarea"
                />
              ) : (
                <textarea
                  value={warningForm.customMessage || warnUserFlag.reason}
                  readOnly
                  rows={5}
                  className="admin-warning-textarea admin-warning-textarea-readonly"
                />
              )}
            </label>

            <div className="admin-modal-actions admin-warning-actions">
              <button
                type="button"
                className="admin-action"
                onClick={() => {
                  setWarnUserFlag(null);
                  setWarningForm({ templateType: "generic", customMessage: "" });
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-action admin-action-approve"
                onClick={async () => {
                  try {
                    await sendUserWarning(
                      {
                        flagId: warnUserFlag.id,
                        userId: warnUserFlag.userId,
                        itemId: warnUserFlag.itemDetails?.id || warnUserFlag.itemId || "",
                        itemName: warnUserFlag.itemDetails?.name || warnUserFlag.itemName || warnUserFlag.target,
                        templateType: warningForm.templateType,
                        customMessage: warningForm.customMessage,
                        reason: warnUserFlag.reason,
                      }
                    );
                    await refreshPanel({ silent: true });
                    showSnackbar("User warning sent and flag updated.");
                    setWarnUserFlag(null);
                    setWarningForm({ templateType: "generic", customMessage: "" });
                  } catch (error) {
                    showSnackbar(error?.message || "Failed to send warning.");
                  }
                }}
              >
                Send Warning
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div
            className={`admin-modal admin-modal-confirm admin-modal-confirm-${confirmAction.tone}`}
            role="dialog"
            aria-modal="true"
            aria-label={confirmAction.title}
          >
            <div className="admin-modal-header">
              <div>
                <p className="admin-modal-kicker">Confirm action</p>
                <h3>{confirmAction.title}</h3>
              </div>
            </div>

            <p className="admin-confirm-message">{confirmAction.message}</p>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-action"
                onClick={closeConfirmAction}
                disabled={isConfirmSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`admin-action ${
                  confirmAction.tone === "danger" ? "admin-action-delete" : "admin-action-reject"
                }`}
                onClick={submitConfirmAction}
                disabled={isConfirmSubmitting}
              >
                {isConfirmSubmitting ? "Working..." : confirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {suspendUserModal ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div className="admin-modal admin-modal-suspend" role="dialog" aria-modal="true" aria-label="Suspend user">
            <div className="admin-modal-header">
              <div>
                <p className="admin-modal-kicker">User moderation</p>
                <h3>Suspend User</h3>
              </div>
              <span className="admin-warning-pill">User #{suspendUserModal.id}</span>
            </div>

            <p className="admin-suspend-copy">
              Set how long this account should stay suspended. The account will be automatically unsuspended after this duration.
            </p>

            <div className="admin-suspend-grid">
              <label className="admin-modal-field">
                Duration
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="1"
                  step="1"
                  value={suspendForm.durationValue}
                  onChange={(event) =>
                    setSuspendForm((current) => ({
                      ...current,
                      durationValue: event.target.value.replace(/\D/g, ""),
                    }))
                  }
                />
              </label>

              <label className="admin-modal-field">
                Unit
                <select
                  value={suspendForm.durationUnit}
                  onChange={(event) =>
                    setSuspendForm((current) => ({
                      ...current,
                      durationUnit: event.target.value === "days" ? "days" : "hours",
                    }))
                  }
                  className="admin-filter-select"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </label>
            </div>

            <p className="admin-suspend-preview">
              Suspension length: {formatDurationLabel({ value: suspendForm.durationValue, unit: suspendForm.durationUnit })}
            </p>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="admin-action"
                onClick={closeSuspendModal}
                disabled={isSuspendSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-action admin-action-reject"
                onClick={submitSuspendUser}
                disabled={isSuspendSubmitting}
              >
                {isSuspendSubmitting ? "Suspending..." : "Confirm Suspension"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default AdminPanel;
