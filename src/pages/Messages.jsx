import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxArchive,
  faBan,
  faCircleCheck,
  faEllipsisVertical,
  faFlag,
  faPaperPlane,
  faShieldHalved,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import Modal from "../components/Modal";
import {
  archiveConversation,
  deleteConversation,
  getConversationMessages,
  getConversations,
  messagesUpdatedEventName,
  markConversationRead,
  reportConversation,
  sendMessage,
  updateConversationFlags,
} from "../utils/messagingStore";
import { createClaim } from "../utils/claimStore";
import { createNotification } from "../utils/notificationStore";
import { useAuth } from "../context/AuthContext";
import "../styles/Messages.css";

const formatTime = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Now";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const reportReasonOptions = [
  { value: "scam", label: "Scam or fraud" },
  { value: "harassment", label: "Harassment or threats" },
  { value: "impersonation", label: "Impersonation" },
  { value: "spam", label: "Spam or repeated unwanted messages" },
  { value: "custom", label: "Custom" },
];

const Messages = () => {
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const currentUserId = profile?.id || null;
  const [inboxConversations, setInboxConversations] = useState([]);
  const [archivedConversations, setArchivedConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [viewMode, setViewMode] = useState("inbox");
  const [showVerification, setShowVerification] = useState(false);
  const [verification, setVerification] = useState({
    fullName: "",
    contact: "",
    collegeDept: "",
    programYear: "",
  });
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    reason: "scam",
    customCategory: "",
    message: "",
  });
  const [menuConversationId, setMenuConversationId] = useState("");
  const menuWrapRef = useRef(null);

  const isArchivedMode = viewMode === "archived";
  const isBlockedMode = viewMode === "blocked";

  const showSnackbar = (message) => {
    setSnackbar({ visible: true, message });
  };

  const refreshConversations = async () => {
    if (!currentUserId) {
      setInboxConversations([]);
      setArchivedConversations([]);
      setActiveId("");
      setLoading(false);
      return;
    }

    try {
      const [nextInboxConversations, nextArchivedConversations] = await Promise.all([
        getConversations({ userId: currentUserId, includeArchived: false }),
        getConversations({ userId: currentUserId, includeArchived: true }),
      ]);

      setInboxConversations(nextInboxConversations);
      setArchivedConversations(nextArchivedConversations);
    } catch (error) {
      setInboxConversations([]);
      setArchivedConversations([]);
      showSnackbar(error?.message || "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  };

  const allConversations = useMemo(
    () => [...inboxConversations, ...archivedConversations],
    [inboxConversations, archivedConversations],
  );

  useEffect(() => {
    const requestedConversation = searchParams.get("conv");
    if (!requestedConversation) {
      return;
    }

    const exists = allConversations.some((entry) => entry.id === requestedConversation);
    if (exists) {
      setActiveId(requestedConversation);
    }
  }, [searchParams, allConversations]);

  useEffect(() => {
    setLoading(true);
    refreshConversations();
  }, [currentUserId]);

  useEffect(() => {
    const handleUpdated = () => {
      refreshConversations();
    };

    window.addEventListener(messagesUpdatedEventName, handleUpdated);
    return () => window.removeEventListener(messagesUpdatedEventName, handleUpdated);
  }, [currentUserId]);

  useEffect(() => {
    if (!activeId || !currentUserId) {
      setMessages([]);
      return;
    }

    const loadThread = async () => {
      setThreadLoading(true);
      try {
        await markConversationRead({ conversationId: activeId, userId: currentUserId });
        const thread = await getConversationMessages({
          conversationId: activeId,
          currentUserId,
        });
        setMessages(thread);
      } catch (error) {
        setMessages([]);
        showSnackbar(error?.message || "Unable to load messages.");
      } finally {
        setThreadLoading(false);
      }
    };

    loadThread();
  }, [activeId, currentUserId]);

  useEffect(() => {
    if (!snackbar.visible) {
      return undefined;
    }

    const timer = setTimeout(() => setSnackbar({ visible: false, message: "" }), 2600);
    return () => clearTimeout(timer);
  }, [snackbar.visible]);

  useEffect(() => {
    if (!menuConversationId) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      const menuRoot = menuWrapRef.current?.querySelector(
        `[data-conversation-menu-id="${menuConversationId}"]`
      );

      if (!menuRoot) {
        return;
      }

      if (!menuRoot.contains(event.target)) {
        setMenuConversationId("");
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuConversationId("");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuConversationId]);

  const conversationSummaries = useMemo(() => {
    if (isArchivedMode) {
      return archivedConversations;
    }

    if (isBlockedMode) {
      return inboxConversations.filter((entry) => entry.blocked);
    }

    return inboxConversations.filter((entry) => !entry.blocked);
  }, [archivedConversations, inboxConversations, isArchivedMode, isBlockedMode]);

  const tabCounts = useMemo(() => ({
    inbox: inboxConversations.filter((entry) => !entry.blocked).length,
    archived: archivedConversations.length,
    blocked: inboxConversations.filter((entry) => entry.blocked).length,
  }), [archivedConversations, inboxConversations]);

  const switchConversationMode = (nextMode) => {
    setViewMode(nextMode);
    setMessageText("");
    setMenuConversationId("");
    setActiveId("");
  };

  const handleModeTabKeyDown = (event, mode) => {
    const tabOrder = ["inbox", "archived", "blocked"];
    const currentIndex = tabOrder.indexOf(mode);

    if (currentIndex === -1) {
      return;
    }

    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % tabOrder.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabOrder.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextMode = tabOrder[nextIndex];
    switchConversationMode(nextMode);

    const tabList = event.currentTarget.parentElement;
    const nextTab = tabList?.querySelector(`[data-view-mode="${nextMode}"]`);
    if (nextTab instanceof HTMLElement) {
      nextTab.focus();
    }
  };

  const activeConversation = useMemo(
    () =>
      conversationSummaries.find((entry) => entry.id === activeId)
      || conversationSummaries[0],
    [conversationSummaries, activeId]
  );

  const isChatDisabled = useMemo(
    () => Boolean(activeConversation?.blocked || activeConversation?.suspensionReason),
    [activeConversation],
  );

  const canSubmitClaimVerification = useMemo(() => {
    if (!activeConversation || !currentUserId) {
      return false;
    }

    return (
      String(activeConversation.itemType || "").toLowerCase() === "found"
      && activeConversation.reporterId
      && activeConversation.reporterId !== currentUserId
    );
  }, [activeConversation, currentUserId]);

  useEffect(() => {
    if (!canSubmitClaimVerification && showVerification) {
      setShowVerification(false);
    }
  }, [canSubmitClaimVerification, showVerification]);

  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) {
      return conversationSummaries;
    }

    return conversationSummaries.filter((entry) =>
      `${entry.title} ${entry.context} ${entry.maskedIdentity}`.toLowerCase().includes(query)
    );
  }, [conversationQuery, conversationSummaries]);

  const submitMessage = async () => {
    if (!activeConversation) {
      return;
    }

    if (isChatDisabled) {
      showSnackbar(activeConversation.suspensionReason || "Conversation is blocked.");
      return;
    }

    if (!messageText.trim()) {
      showSnackbar("Type a message first.");
      return;
    }

    if (!currentUserId) {
      showSnackbar("You must be logged in to send messages.");
      return;
    }

    try {
      await sendMessage({
        conversationId: activeConversation.id,
        text: messageText,
        senderId: currentUserId,
      });
      setMessageText("");
      await refreshConversations();
      const thread = await getConversationMessages({
        conversationId: activeConversation.id,
        currentUserId,
      });
      setMessages(thread);
      showSnackbar("Message sent.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to send message.");
    }
  };

  const submitVerification = async () => {
    if (!activeConversation) {
      return;
    }

    if (!canSubmitClaimVerification) {
      showSnackbar("Claim verification is available only when contacting a FOUND item reporter.");
      return;
    }

    if (
      !verification.fullName.trim() ||
      !verification.contact.trim() ||
      !verification.collegeDept.trim() ||
      !verification.programYear.trim()
    ) {
      showSnackbar("Complete all required ownership fields.");
      return;
    }

    createClaim({
      itemId: activeConversation.itemId || activeConversation.id,
      item: activeConversation.context,
      fullName: verification.fullName,
      contact: verification.contact,
      collegeDept: verification.collegeDept,
      programYear: verification.programYear,
      routeTo: "item-owner",
    });

    const payload = "Claim request submitted. Details provided for ownership verification.";

    if (!currentUserId) {
      showSnackbar("You must be logged in to send claim details.");
      return;
    }

    try {
      await sendMessage({
        conversationId: activeConversation.id,
        text: payload,
        senderId: currentUserId,
      });
    } catch (error) {
      showSnackbar(error?.message || "Unable to send verification message.");
      return;
    }

    setVerification({
      fullName: "",
      contact: "",
      collegeDept: "",
      programYear: "",
    });
    setShowVerification(false);
    await refreshConversations();

    createNotification({
      type: "claim",
      priority: "high",
      title: "Claim verification submitted",
      body: "Claim submitted. Waiting for approval.",
      path: "/messages",
      recipientId: currentUserId,
    });

    showSnackbar("Claim submitted. Waiting for approval.");
  };

  const handleReportUser = () => {
    if (!activeConversation) {
      return;
    }

    setShowReportModal(true);
  };

  const submitConversationReport = async () => {
    if (!activeConversation || !currentUserId) {
      return;
    }

    if (reportForm.reason === "custom" && !reportForm.customCategory.trim()) {
      showSnackbar("Enter a custom report category.");
      return;
    }

    if (!reportForm.message.trim()) {
      showSnackbar("Include a short report message for admin review.");
      return;
    }

    try {
      await reportConversation({
        conversationId: activeConversation.id,
        itemId: activeConversation.itemId,
        itemName: activeConversation.context,
        userId: currentUserId,
        reason: reportForm.reason,
        customCategory: reportForm.customCategory,
        message: reportForm.message,
      });
      createNotification({
        type: "safety",
        priority: "high",
        title: "User reported",
        body: "Your safety report was submitted to admin for review.",
        path: "/messages",
        recipientId: currentUserId,
      });
      setShowReportModal(false);
      setReportForm({ reason: "scam", customCategory: "", message: "" });
      await refreshConversations();
      showSnackbar("Report sent to admin.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to report conversation.");
    }
  };

  const handleToggleBlock = async () => {
    if (!activeConversation) {
      return;
    }

    if (activeConversation.suspensionReason) {
      showSnackbar("This chat is suspended by admin and cannot be unblocked here.");
      return;
    }

    const nextBlocked = !activeConversation.blocked;
    try {
      await updateConversationFlags(activeConversation.id, { blocked: nextBlocked });
      if (nextBlocked) {
        setViewMode("blocked");
      } else if (isBlockedMode) {
        setViewMode("inbox");
      }
      await refreshConversations();
      showSnackbar(nextBlocked ? "Conversation blocked." : "Conversation unblocked.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to update conversation status.");
    }
  };

  const handleArchiveConversation = async (conversationId) => {
    if (!conversationId || !currentUserId) {
      return;
    }

    try {
      await archiveConversation({ conversationId, userId: currentUserId });
      if (activeId === conversationId) {
        setActiveId("");
      }
      setMenuConversationId("");
      await refreshConversations();
      showSnackbar("Conversation archived.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to archive conversation.");
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!conversationId || !currentUserId) {
      return;
    }

    try {
      await deleteConversation({ conversationId, userId: currentUserId });
      if (activeId === conversationId) {
        setActiveId("");
      }
      setMenuConversationId("");
      await refreshConversations();
      showSnackbar("Conversation deleted from your inbox.");
    } catch (error) {
      showSnackbar(error?.message || "Unable to delete conversation.");
    }
  };

  return (
    <section className="page-card messages-page">
      <p className="page-kicker">Secure messaging</p>
      <h2 className="page-title">Messages</h2>
      <p className="page-description">Chat safely in-app. Personal contact details are masked for privacy.</p>

      <div className="messages-layout">
        <aside className="messages-sidebar">
          <div className="messages-sidebar-head">
            <h3>
              {isArchivedMode
                ? "Archived chats"
                : isBlockedMode
                  ? "Blocked chats"
                  : "Conversations"}
            </h3>
            <span>{conversationSummaries.length}</span>
          </div>

          <div className="messages-sidebar-toolbar" role="tablist" aria-label="Conversation filters">
            <button
              type="button"
              role="tab"
              data-view-mode="inbox"
              aria-selected={viewMode === "inbox"}
              tabIndex={viewMode === "inbox" ? 0 : -1}
              className={`messages-tab-button ${viewMode === "inbox" ? "messages-tab-button-active" : ""}`}
              onClick={() => switchConversationMode("inbox")}
              onKeyDown={(event) => handleModeTabKeyDown(event, "inbox")}
            >
              <span><FontAwesomeIcon icon={faShieldHalved} /> Inbox</span>
              <em>{tabCounts.inbox}</em>
            </button>
            <button
              type="button"
              role="tab"
              data-view-mode="archived"
              aria-selected={isArchivedMode}
              tabIndex={isArchivedMode ? 0 : -1}
              className={`messages-tab-button ${isArchivedMode ? "messages-tab-button-active" : ""}`}
              onClick={() => switchConversationMode("archived")}
              onKeyDown={(event) => handleModeTabKeyDown(event, "archived")}
            >
              <span><FontAwesomeIcon icon={faBoxArchive} /> Archived</span>
              <em>{tabCounts.archived}</em>
            </button>
            <button
              type="button"
              role="tab"
              data-view-mode="blocked"
              aria-selected={isBlockedMode}
              tabIndex={isBlockedMode ? 0 : -1}
              className={`messages-tab-button ${isBlockedMode ? "messages-tab-button-active" : ""}`}
              onClick={() => switchConversationMode("blocked")}
              onKeyDown={(event) => handleModeTabKeyDown(event, "blocked")}
            >
              <span><FontAwesomeIcon icon={faBan} /> Blocked</span>
              <em>{tabCounts.blocked}</em>
            </button>
          </div>

          <label className="messages-search-field">
            <span className="sr-only">Search conversations</span>
            <input
              type="text"
              value={conversationQuery}
              onChange={(event) => setConversationQuery(event.target.value)}
              placeholder="Search by item or user"
            />
          </label>

          <ul
            key={viewMode}
            className={`messages-conversation-list messages-conversation-list-${viewMode}`}
            ref={menuWrapRef}
          >
            {loading ? (
              <li>
                <p>Loading conversations...</p>
              </li>
            ) : null}
            {filteredConversations.map((entry) => (
              <li key={entry.id}>
                <div className={`messages-conversation-item ${entry.id === activeConversation?.id ? "messages-conversation-item-active" : ""}`}>
                  <button
                    type="button"
                    className="messages-conversation-main"
                    onClick={() => setActiveId(entry.id)}
                  >
                    <div className="messages-conversation-topline">
                      <strong>{entry.title}</strong>
                      <small>{formatTime(entry.previewTime)}</small>
                    </div>
                    <span>{entry.maskedIdentity}</span>
                    <p>{entry.preview}</p>
                    {entry.unreadCount ? <em>{entry.unreadCount}</em> : null}
                  </button>

                  <div className="messages-conversation-menu-wrap" data-conversation-menu-id={entry.id}>
                    <button
                      type="button"
                      className="messages-conversation-menu-trigger"
                      aria-haspopup="menu"
                      aria-expanded={menuConversationId === entry.id}
                      aria-label="Conversation actions"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuConversationId((current) =>
                          current === entry.id ? "" : entry.id,
                        );
                      }}
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>
                    {menuConversationId === entry.id ? (
                      <div className="messages-conversation-menu" role="menu" aria-label="Conversation actions menu">
                        {!isArchivedMode && !isBlockedMode ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => handleArchiveConversation(entry.id)}
                          >
                            <FontAwesomeIcon icon={faBoxArchive} /> Archive
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          className="messages-conversation-menu-danger"
                          onClick={() => handleDeleteConversation(entry.id)}
                        >
                          <FontAwesomeIcon icon={faTrashCan} /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <section
          className={`messages-chat-panel ${isChatDisabled ? "messages-chat-panel-disabled" : ""}`}
        >
          {activeConversation ? (
            <>
              <div className="messages-chat-head">
                <div>
                  <h3>{activeConversation.title}</h3>
                  <p>{activeConversation.context} • identity masked: {activeConversation.maskedIdentity}</p>
                </div>
                <div className="messages-head-actions">
                  <button
                    type="button"
                    className="messages-ghost-button"
                    onClick={handleReportUser}
                  >
                    <FontAwesomeIcon icon={faFlag} /> Report
                  </button>
                  <button
                    type="button"
                    className="messages-ghost-button"
                    onClick={handleToggleBlock}
                    disabled={Boolean(activeConversation.suspensionReason)}
                  >
                    <FontAwesomeIcon icon={faBan} /> {activeConversation.suspensionReason ? "Suspended" : activeConversation.blocked ? "Unblock" : "Block"}
                  </button>
                </div>
              </div>

              {!isChatDisabled ? (
                <div className="messages-safety-strip">
                  <FontAwesomeIcon icon={faShieldHalved} /> Safety mode on. Email and phone are not shared in chat.
                </div>
              ) : null}

              {isChatDisabled ? (
                <div className="messages-suspension-strip" role="status" aria-live="polite">
                  <FontAwesomeIcon icon={faBan} />
                  <span>{activeConversation.suspensionReason || "This chat is currently suspended by admin."}</span>
                </div>
              ) : null}

              {!isArchivedMode && !isBlockedMode && canSubmitClaimVerification ? (
                <button type="button" className="messages-claim-button" onClick={() => setShowVerification((open) => !open)}>
                  <FontAwesomeIcon icon={faCircleCheck} /> This is my item (claim verification)
                </button>
              ) : null}

              <div className="messages-thread" role="log" aria-live="polite">
                {threadLoading ? <p>Loading thread...</p> : null}
                {messages.map((entry) => (
                  <div
                    key={entry.id}
                    className={`messages-bubble ${entry.sender === "me" ? "messages-bubble-sent" : "messages-bubble-received"}`}
                  >
                    <p>{entry.text}</p>
                    <span>{entry.sender === "me" ? "You" : activeConversation.maskedIdentity} • {formatTime(entry.time)}</span>
                  </div>
                ))}
              </div>

              {isArchivedMode ? (
                <div className="messages-archive-note">
                  This conversation is archived. Switch to the Inbox tab when you want to continue active chats.
                </div>
              ) : (
                <div className="messages-input-row">
                  <div className="messages-input-wrap">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder={
                      isChatDisabled
                        ? activeConversation.suspensionReason || "Conversation is blocked"
                        : "Type a secure message"
                    }
                    disabled={isChatDisabled}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitMessage();
                      }
                    }}
                  />
                  <small>Keep personal details private. Use verification flow for claims.</small>
                  </div>
                  <button type="button" className="hero-button hero-button-lost" onClick={submitMessage} disabled={isChatDisabled}>
                    <FontAwesomeIcon icon={faPaperPlane} /> Send
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="messages-empty-state">
              <p>
                {currentUserId
                  ? isArchivedMode
                    ? "No archived chats yet."
                    : isBlockedMode
                      ? "No blocked chats yet."
                      : "No conversations yet."
                  : "Sign in to view your messages."}
              </p>
              <small>
                {isArchivedMode
                  ? "Archived conversations will appear here."
                  : isBlockedMode
                    ? "Blocked conversations will appear here."
                    : "New secure chats will appear here when a match is created."}
              </small>
            </div>
          )}
        </section>
      </div>

      {snackbar.visible ? <div className="details-snackbar">{snackbar.message}</div> : null}

      <Modal
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        ariaLabel="Verify Ownership"
        overlayClassName="details-flow-modal"
        panelClassName="details-flow-panel"
      >
        <div className="details-modal-head">
          <div>
            <p className="page-kicker">Controlled flow</p>
            <h3 className="page-title">Verify Ownership</h3>
            <p className="details-flow-note">This helps confirm you are the rightful owner.</p>
          </div>
          <button type="button" className="details-close-button" onClick={() => setShowVerification(false)} aria-label="Close dialog">
            x
          </button>
        </div>

        <form
          className="details-flow-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitVerification();
          }}
        >
          <div className="details-form-grid">
            <label className="details-form-field">
              <span>Full Name</span>
              <input
                type="text"
                value={verification.fullName}
                onChange={(event) => setVerification((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Enter your full name"
                required
              />
            </label>

            <label className="details-form-field">
              <span>Contact Number / Email</span>
              <input
                type="text"
                value={verification.contact}
                onChange={(event) => setVerification((current) => ({ ...current, contact: event.target.value }))}
                placeholder="09xx xxx xxxx or name@email.com"
                required
              />
            </label>
          </div>

          <label className="details-form-field">
            <span>College Dept</span>
            <input
              type="text"
              value={verification.collegeDept}
              onChange={(event) => setVerification((current) => ({ ...current, collegeDept: event.target.value }))}
              placeholder="e.g., College of Computer Studies"
              required
            />
          </label>

          <label className="details-form-field">
            <span>Program Year</span>
            <input
              type="text"
              value={verification.programYear}
              onChange={(event) => setVerification((current) => ({ ...current, programYear: event.target.value }))}
              placeholder="e.g., BSIT - 3rd Year"
              required
            />
          </label>

          <div className="details-flow-actions">
            <button type="button" className="details-ghost-button" onClick={() => setShowVerification(false)}>
              Cancel
            </button>
            <button type="submit" className="details-flow-submit">
              Submit Claim
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        ariaLabel="Report conversation"
        overlayClassName="details-flow-modal"
        panelClassName="details-flow-panel"
      >
        <div className="details-modal-head">
          <div>
            <p className="page-kicker">Safety report</p>
            <h3 className="page-title">Report Conversation</h3>
            <p className="details-flow-note">Choose a reason and add details for admin review.</p>
          </div>
          <button
            type="button"
            className="details-close-button"
            onClick={() => setShowReportModal(false)}
            aria-label="Close dialog"
          >
            x
          </button>
        </div>

        <form
          className="details-flow-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitConversationReport();
          }}
        >
          <label className="details-form-field">
            <span>Reason</span>
            <select
              value={reportForm.reason}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, reason: event.target.value }))
              }
              className="messages-report-select"
            >
              {reportReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {reportForm.reason === "custom" ? (
            <label className="details-form-field">
              <span>Custom Category</span>
              <input
                type="text"
                value={reportForm.customCategory}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, customCategory: event.target.value }))
                }
                placeholder="e.g., Suspicious payment request"
                required
              />
            </label>
          ) : null}

          <label className="details-form-field">
            <span>Message</span>
            <textarea
              value={reportForm.message}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, message: event.target.value }))
              }
              placeholder="Describe what happened."
              rows={4}
              required
            />
          </label>

          <div className="details-flow-actions">
            <button type="button" className="details-ghost-button" onClick={() => setShowReportModal(false)}>
              Cancel
            </button>
            <button type="submit" className="details-flow-submit">
              Submit Report
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
};

export default Messages;
