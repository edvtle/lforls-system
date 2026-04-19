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

const Messages = () => {
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const currentUserId = profile?.id || null;
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [conversationQuery, setConversationQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verification, setVerification] = useState({
    fullName: "",
    contact: "",
    collegeDept: "",
    programYear: "",
  });
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [menuConversationId, setMenuConversationId] = useState("");
  const menuWrapRef = useRef(null);

  const showSnackbar = (message) => {
    setSnackbar({ visible: true, message });
  };

  const refreshConversations = async () => {
    if (!currentUserId) {
      setConversations([]);
      setActiveId("");
      setLoading(false);
      return;
    }

    try {
      const nextConversations = await getConversations({ userId: currentUserId });
      setConversations(nextConversations);
      setActiveId((current) => {
        if (current && nextConversations.some((entry) => entry.id === current)) {
          return current;
        }
        return nextConversations[0]?.id || "";
      });
    } catch (error) {
      setConversations([]);
      showSnackbar(error?.message || "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const requestedConversation = searchParams.get("conv");
    if (!requestedConversation) {
      return;
    }

    const exists = conversations.some((entry) => entry.id === requestedConversation);
    if (exists) {
      setActiveId(requestedConversation);
    }
  }, [searchParams, conversations]);

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

  const activeConversation = useMemo(
    () => conversations.find((entry) => entry.id === activeId) || conversations[0],
    [conversations, activeId]
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

  const conversationSummaries = useMemo(() => conversations, [conversations]);

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

    if (activeConversation.blocked) {
      showSnackbar("Conversation is blocked.");
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
    });

    showSnackbar("Claim submitted. Waiting for approval.");
  };

  const handleReportUser = async () => {
    if (!activeConversation) {
      return;
    }

    if (activeConversation.reported) {
      showSnackbar("This conversation is already reported.");
      return;
    }

    try {
      await reportConversation({
        conversationId: activeConversation.id,
        itemId: activeConversation.itemId,
        itemName: activeConversation.context,
        userId: currentUserId,
      });
      createNotification({
        type: "safety",
        priority: "high",
        title: "User reported",
        body: "Your safety report was submitted to admin for review.",
        path: "/messages",
      });
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

    const nextBlocked = !activeConversation.blocked;
    try {
      await updateConversationFlags(activeConversation.id, { blocked: nextBlocked });
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
            <h3>Conversations</h3>
            <span>{conversationSummaries.length}</span>
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

          <ul className="messages-conversation-list" ref={menuWrapRef}>
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
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleArchiveConversation(entry.id)}
                        >
                          <FontAwesomeIcon icon={faBoxArchive} /> Archive
                        </button>
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

        <section className="messages-chat-panel">
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
                  >
                    <FontAwesomeIcon icon={faBan} /> {activeConversation.blocked ? "Unblock" : "Block"}
                  </button>
                </div>
              </div>

              <div className="messages-safety-strip">
                <FontAwesomeIcon icon={faShieldHalved} /> Safety mode on. Email and phone are not shared in chat.
              </div>

              {canSubmitClaimVerification ? (
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

              <div className="messages-input-row">
                <div className="messages-input-wrap">
                <input
                  type="text"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder={activeConversation.blocked ? "Conversation is blocked" : "Type a secure message"}
                  disabled={activeConversation.blocked}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitMessage();
                    }
                  }}
                />
                <small>Keep personal details private. Use verification flow for claims.</small>
                </div>
                <button type="button" className="hero-button hero-button-lost" onClick={submitMessage} disabled={activeConversation.blocked}>
                  <FontAwesomeIcon icon={faPaperPlane} /> Send
                </button>
              </div>
            </>
          ) : (
            <div className="messages-empty-state">
              <p>{currentUserId ? "No conversations yet." : "Sign in to view your messages."}</p>
              <small>New secure chats will appear here when a match is created.</small>
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
    </section>
  );
};

export default Messages;
