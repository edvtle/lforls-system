import { createNotification } from "./notificationStore";

const CONVERSATIONS_KEY = "lforls:conversations";
const MESSAGES_KEY = "lforls:messages";

const defaultConversations = [
  {
    id: "conv-wallet-001",
    title: "Finder - Wallet Case",
    context: "Black Leather Wallet",
    maskedIdentity: "finder_2***",
    unreadCount: 1,
    blocked: false,
    reported: false,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "conv-keys-008",
    title: "Lost Owner - Keys",
    context: "Room Keys Set",
    maskedIdentity: "owner_7***",
    unreadCount: 0,
    blocked: false,
    reported: false,
    updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
  },
];

const defaultMessages = {
  "conv-wallet-001": [
    {
      id: "m1",
      sender: "other",
      text: "I found a wallet near the library entrance. Can you describe one unique mark?",
      time: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    },
  ],
  "conv-keys-008": [
    {
      id: "m2",
      sender: "me",
      text: "Can you confirm if the key tag is green?",
      time: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "m3",
      sender: "other",
      text: "Yes, green tag and three keys.",
      time: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    },
  ],
};

const parse = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value || fallback;
  } catch {
    return fallback;
  }
};

const save = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("lforls:messages-updated"));
};

const ensureSeed = () => {
  const existingConversations = parse(CONVERSATIONS_KEY, null);
  const existingMessages = parse(MESSAGES_KEY, null);

  if (!existingConversations) {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(defaultConversations));
  }

  if (!existingMessages) {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(defaultMessages));
  }
};

export const getConversations = () => {
  ensureSeed();
  return parse(CONVERSATIONS_KEY, defaultConversations).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
};

export const getConversationMessages = (conversationId) => {
  ensureSeed();
  const messagesByConversation = parse(MESSAGES_KEY, defaultMessages);
  return messagesByConversation[conversationId] || [];
};

export const markConversationRead = (conversationId) => {
  const next = getConversations().map((entry) =>
    entry.id === conversationId ? { ...entry, unreadCount: 0 } : entry
  );
  save(CONVERSATIONS_KEY, next);
};

export const updateConversationFlags = (conversationId, patch) => {
  const next = getConversations().map((entry) =>
    entry.id === conversationId ? { ...entry, ...patch } : entry
  );
  save(CONVERSATIONS_KEY, next);
};

export const sendMessage = (conversationId, text, sender = "me") => {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const allMessages = parse(MESSAGES_KEY, defaultMessages);
  const current = allMessages[conversationId] || [];

  const message = {
    id: `m-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    sender,
    text: trimmed,
    time: new Date().toISOString(),
  };

  const nextMessages = {
    ...allMessages,
    [conversationId]: [...current, message],
  };

  save(MESSAGES_KEY, nextMessages);

  const nextConversations = getConversations().map((entry) =>
    entry.id === conversationId
      ? {
          ...entry,
          updatedAt: message.time,
          unreadCount: sender === "other" ? entry.unreadCount + 1 : entry.unreadCount,
        }
      : entry
  );

  save(CONVERSATIONS_KEY, nextConversations);

  if (sender === "other") {
    createNotification({
      type: "message",
      title: `New message from ${nextConversations.find((entry) => entry.id === conversationId)?.maskedIdentity || "user"}`,
      body: trimmed.length > 68 ? `${trimmed.slice(0, 68)}...` : trimmed,
      priority: "normal",
      path: "/messages",
    });
  }
};

export const sendAutoReply = (conversationId) => {
  const replies = [
    "Thanks. Please share one unique identifier so we can verify ownership.",
    "Received. I can continue through this in-app chat for safety.",
    "Can you confirm a detail only the owner would know?",
  ];

  const reply = replies[Math.floor(Math.random() * replies.length)];
  sendMessage(conversationId, reply, "other");
};
