import { supabase, isSupabaseConfigured } from "../services/supabaseClient";

const MESSAGES_UPDATED_EVENT = "lforls:messages-updated";

const notifyUpdated = () => {
  window.dispatchEvent(new Event(MESSAGES_UPDATED_EVENT));
};

const assertSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }
};

const toConversationCard = (row) => ({
  id: row.id,
  itemId: row.item_id || null,
  itemType: row.item_type || null,
  reporterId: row.reporter_id || null,
  title: row.title || "Secure conversation",
  context: row.context || "Item discussion",
  maskedIdentity: row.masked_identity || "user_***",
  unreadCount: Number(row.unread_count || 0),
  blocked: Boolean(row.blocked),
  reported: Boolean(row.reported),
  updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  preview: row.preview || "No messages yet",
  previewTime: row.preview_time || row.updated_at || new Date().toISOString(),
});

export const messagesUpdatedEventName = MESSAGES_UPDATED_EVENT;

export const getConversations = async ({ userId }) => {
  assertSupabase();
  if (!userId) {
    return [];
  }

  const primaryParticipants = await supabase
    .from("message_participants")
    .select(
      "unread_count, archived_at, deleted_at, message_conversations(id, item_id, title, context, masked_identity, blocked, reported, updated_at, created_at)",
    )
    .eq("user_id", userId);

  let participants = primaryParticipants.data;
  let participantError = primaryParticipants.error;

  // Backward-compatible fallback while archived/deleted columns are not deployed yet.
  if (participantError) {
    const fallbackParticipants = await supabase
      .from("message_participants")
      .select(
        "unread_count, message_conversations(id, item_id, title, context, masked_identity, blocked, reported, updated_at, created_at)",
      )
      .eq("user_id", userId);

    participants = fallbackParticipants.data;
    participantError = fallbackParticipants.error;
  }

  if (participantError) {
    throw participantError;
  }

  const baseRows = (participants || [])
    .map((entry) => {
      const conversation = entry.message_conversations;
      if (!conversation) {
        return null;
      }

      return {
        ...conversation,
        unread_count: entry.unread_count,
        archived_at: entry.archived_at || null,
        deleted_at: entry.deleted_at || null,
      };
    })
    .filter(Boolean)
    .filter((entry) => !entry.deleted_at)
    .filter((entry) => !entry.archived_at);

  if (!baseRows.length) {
    return [];
  }

  const itemIds = Array.from(
    new Set(baseRows.map((entry) => entry.item_id).filter(Boolean)),
  );

  let itemInfoMap = new Map();
  if (itemIds.length) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("id, type, reporter_id")
      .in("id", itemIds);

    itemInfoMap = new Map((itemRows || []).map((row) => [row.id, row]));
  }

  const conversationIds = baseRows.map((entry) => entry.id);
  const { data: latestMessages, error: messageError } = await supabase
    .from("message_messages")
    .select("conversation_id, body, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  if (messageError) {
    throw messageError;
  }

  const previewMap = new Map();
  (latestMessages || []).forEach((entry) => {
    if (!previewMap.has(entry.conversation_id)) {
      previewMap.set(entry.conversation_id, {
        preview: entry.body || "No messages yet",
        preview_time: entry.created_at,
      });
    }
  });

  return baseRows
    .map((entry) => {
      const item = entry.item_id ? itemInfoMap.get(entry.item_id) : null;
      return toConversationCard({
        ...entry,
        item_type: item?.type || null,
        reporter_id: item?.reporter_id || null,
        ...(previewMap.get(entry.id) || {}),
      });
    })
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
};

export const archiveConversation = async ({ conversationId, userId }) => {
  assertSupabase();
  if (!conversationId || !userId) {
    return;
  }

  const { error: rpcError } = await supabase.rpc(
    "messaging_archive_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (rpcError) {
    const { error } = await supabase
      .from("message_participants")
      .update({ archived_at: new Date().toISOString(), deleted_at: null })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(
        rpcError.message || error.message || "Unable to archive conversation.",
      );
    }
  }

  notifyUpdated();
};

export const deleteConversation = async ({ conversationId, userId }) => {
  assertSupabase();
  if (!conversationId || !userId) {
    return;
  }

  const { error: rpcError } = await supabase.rpc(
    "messaging_delete_conversation",
    {
      p_conversation_id: conversationId,
    },
  );

  if (rpcError) {
    const { error } = await supabase
      .from("message_participants")
      .update({ deleted_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(
        rpcError.message || error.message || "Unable to delete conversation.",
      );
    }
  }

  notifyUpdated();
};

export const reportConversation = async ({
  conversationId,
  itemId,
  itemName,
  userId,
  details,
}) => {
  assertSupabase();

  if (!conversationId || !userId) {
    return;
  }

  const payload = {
    user_id: userId,
    item_id: itemId || null,
    item_name: itemName || "Conversation",
    reason: "Messaging safety report",
    target: `conversation:${conversationId}`,
    body: details || "User reported from messaging tab.",
    severity: "high",
    status: "open",
  };

  const { error } = await supabase.from("reports").insert(payload);
  if (error) {
    throw error;
  }

  await updateConversationFlags(conversationId, { reported: true });
};

export const getConversationMessages = async ({
  conversationId,
  currentUserId,
}) => {
  assertSupabase();
  if (!conversationId) {
    return [];
  }

  const { data, error } = await supabase
    .from("message_messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((entry) => ({
    id: entry.id,
    sender: entry.sender_id === currentUserId ? "me" : "other",
    text: entry.body || "",
    time: entry.created_at || new Date().toISOString(),
  }));
};

export const markConversationRead = async ({ conversationId, userId }) => {
  assertSupabase();
  if (!conversationId || !userId) {
    return;
  }

  const { error } = await supabase
    .from("message_participants")
    .update({ unread_count: 0, last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  notifyUpdated();
};

export const updateConversationFlags = async (conversationId, patch = {}) => {
  assertSupabase();
  if (!conversationId) {
    return;
  }

  const updates = {
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.blocked === "boolean") {
    updates.blocked = patch.blocked;
  }

  if (typeof patch.reported === "boolean") {
    updates.reported = patch.reported;
  }

  if (typeof patch.title === "string") {
    updates.title = patch.title;
  }

  if (typeof patch.context === "string") {
    updates.context = patch.context;
  }

  if (typeof patch.maskedIdentity === "string") {
    updates.masked_identity = patch.maskedIdentity;
  }

  const { error } = await supabase
    .from("message_conversations")
    .update(updates)
    .eq("id", conversationId);

  if (error) {
    throw error;
  }

  notifyUpdated();
};

export const createOrGetConversation = async ({
  id,
  title,
  context,
  maskedIdentity,
  itemId,
  currentUserId,
  otherUserId,
}) => {
  assertSupabase();

  const conversationId =
    id || `conv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const { data: rpcConversation, error: rpcError } = await supabase.rpc(
    "messaging_start_contact",
    {
      p_conversation_id: conversationId,
      p_item_id: itemId || null,
      p_title: title || "Secure conversation",
      p_context: context || "Item discussion",
      p_masked_identity: maskedIdentity || "user_***",
      p_other_user_id: otherUserId || null,
    },
  );

  if (rpcError) {
    throw new Error(
      rpcError.message ||
        "Unable to start contact conversation. Verify messaging RPC migration is applied.",
    );
  }

  if (!Array.isArray(rpcConversation) || !rpcConversation[0]) {
    throw new Error("Unable to initialize messaging conversation.");
  }

  notifyUpdated();
  return toConversationCard(rpcConversation[0]);
};

export const sendMessage = async ({ conversationId, text, senderId }) => {
  assertSupabase();

  const trimmed = String(text || "").trim();
  if (!conversationId || !senderId || !trimmed) {
    return;
  }

  const { error: rpcError } = await supabase.rpc("messaging_send_message", {
    p_conversation_id: conversationId,
    p_body: trimmed,
  });

  if (rpcError) {
    throw new Error(
      rpcError.message ||
        "Unable to send message. Verify messaging RPC migration is applied.",
    );
  }

  notifyUpdated();
};

export const sendAutoReply = async () => {
  return null;
};
