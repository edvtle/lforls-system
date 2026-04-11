import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan,
  faCircleCheck,
  faFlag,
  faPaperPlane,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import {
  getConversationMessages,
  getConversations,
  markConversationRead,
  sendAutoReply,
  sendMessage,
  updateConversationFlags,
} from "../utils/messagingStore";
import { createNotification } from "../utils/notificationStore";

const formatTime = (isoDate) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Now";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const Messages = () => {
  const [conversations, setConversations] = useState(() => getConversations());
  const [activeId, setActiveId] = useState(() => getConversations()[0]?.id || "");
  const [conversationQuery, setConversationQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [verification, setVerification] = useState({ description: "", proof: "" });
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  const showSnackbar = (message) => {
    setSnackbar({ visible: true, message });
  };

  useEffect(() => {
    const refresh = () => setConversations(getConversations());
    window.addEventListener("lforls:messages-updated", refresh);
    return () => window.removeEventListener("lforls:messages-updated", refresh);
  }, []);

  useEffect(() => {
    if (activeId) {
      markConversationRead(activeId);
      setConversations(getConversations());
    }
  }, [activeId]);

  useEffect(() => {
    if (!snackbar.visible) {
      return undefined;
    }

    const timer = setTimeout(() => setSnackbar({ visible: false, message: "" }), 2600);
    return () => clearTimeout(timer);
  }, [snackbar.visible]);

  const activeConversation = useMemo(
    () => conversations.find((entry) => entry.id === activeId) || conversations[0],
    [conversations, activeId]
  );

  const messages = useMemo(
    () => (activeConversation ? getConversationMessages(activeConversation.id) : []),
    [activeConversation, conversations]
  );

  const conversationSummaries = useMemo(
    () =>
      conversations.map((entry) => {
        const thread = getConversationMessages(entry.id);
        const lastMessage = thread[thread.length - 1];
        return {
          ...entry,
          preview: lastMessage?.text || "No messages yet",
          previewTime: lastMessage?.time || entry.updatedAt,
        };
      }),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) {
      return conversationSummaries;
    }

    return conversationSummaries.filter((entry) =>
      `${entry.title} ${entry.context} ${entry.maskedIdentity}`.toLowerCase().includes(query)
    );
  }, [conversationQuery, conversationSummaries]);

  const submitMessage = () => {
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

    sendMessage(activeConversation.id, messageText, "me");
    setMessageText("");
    setConversations(getConversations());
    showSnackbar("Message sent.");

    setTimeout(() => {
      sendAutoReply(activeConversation.id);
      setConversations(getConversations());
    }, 450);
  };

  const submitVerification = () => {
    if (!activeConversation) {
      return;
    }

    if (!verification.description.trim() || !verification.proof.trim()) {
      showSnackbar("Complete both verification fields.");
      return;
    }

    const payload = `Claim request submitted. Item description: ${verification.description}. Proof: ${verification.proof}.`;
    sendMessage(activeConversation.id, payload, "me");
    setVerification({ description: "", proof: "" });
    setShowVerification(false);
    setConversations(getConversations());

    createNotification({
      type: "claim",
      priority: "high",
      title: "Claim verification submitted",
      body: "Your ownership proof was sent securely for review.",
      path: "/messages",
    });

    showSnackbar("Verification submitted for review.");
  };

  const handleReportUser = () => {
    if (!activeConversation) {
      return;
    }

    if (activeConversation.reported) {
      showSnackbar("This conversation is already reported.");
      return;
    }

    updateConversationFlags(activeConversation.id, { reported: true });
    createNotification({
      type: "safety",
      priority: "high",
      title: "User reported",
      body: "Your safety report was submitted to admin for review.",
      path: "/messages",
    });
    setConversations(getConversations());
    showSnackbar("Report sent to admin.");
  };

  const handleToggleBlock = () => {
    if (!activeConversation) {
      return;
    }

    const nextBlocked = !activeConversation.blocked;
    updateConversationFlags(activeConversation.id, { blocked: nextBlocked });
    setConversations(getConversations());
    showSnackbar(nextBlocked ? "Conversation blocked." : "Conversation unblocked.");
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

          <ul className="messages-conversation-list">
            {filteredConversations.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`messages-conversation-item ${entry.id === activeConversation?.id ? "messages-conversation-item-active" : ""}`}
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

              <button type="button" className="messages-claim-button" onClick={() => setShowVerification((open) => !open)}>
                <FontAwesomeIcon icon={faCircleCheck} /> This is my item (claim verification)
              </button>

              {showVerification ? (
                <div className="messages-verify-box">
                  <label>
                    Describe the item
                    <input
                      type="text"
                      value={verification.description}
                      onChange={(event) => setVerification((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Add recognizable details"
                    />
                  </label>
                  <label>
                    Proof of ownership
                    <textarea
                      value={verification.proof}
                      onChange={(event) => setVerification((current) => ({ ...current, proof: event.target.value }))}
                      placeholder="Serial number, receipt detail, or unique mark"
                      rows={3}
                    />
                  </label>
                  <button type="button" className="hero-button hero-button-lost" onClick={submitVerification}>
                    Submit verification
                  </button>
                </div>
              ) : null}

              <div className="messages-thread" role="log" aria-live="polite">
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
              <p>No conversations yet.</p>
              <small>New secure chats will appear here when a match is created.</small>
            </div>
          )}
        </section>
      </div>

      {snackbar.visible ? <div className="details-snackbar">{snackbar.message}</div> : null}
    </section>
  );
};

export default Messages;
