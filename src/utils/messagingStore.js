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

  const { data: participants, error: participantError } = await supabase
    .from("message_participants")
    .select(
      "unread_count, message_conversations(id, item_id, title, context, masked_identity, blocked, reported, updated_at, created_at)",
    )
    .eq("user_id", userId);

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
      };
    })
    .filter(Boolean);

  if (!baseRows.length) {
    return [];
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
    .map((entry) =>
      toConversationCard({ ...entry, ...(previewMap.get(entry.id) || {}) }),
    )
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
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

  const { data: existingConversation, error: existingError } = await supabase
    .from("message_conversations")
    .select(
      "id, item_id, title, context, masked_identity, blocked, reported, updated_at, created_at",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existingConversation) {
    const { error: insertError } = await supabase
      .from("message_conversations")
      .insert({
        id: conversationId,
        item_id: itemId || null,
        title: title || "Secure conversation",
        context: context || "Item discussion",
        masked_identity: maskedIdentity || "user_***",
        created_by: currentUserId || null,
        blocked: false,
        reported: false,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      throw insertError;
    }
  }

  const participants = [currentUserId, otherUserId]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .map((userId) => ({
      conversation_id: conversationId,
      user_id: userId,
      unread_count: 0,
      last_read_at: new Date().toISOString(),
    }));

  if (participants.length) {
    const { error: participantError } = await supabase
      .from("message_participants")
      .upsert(participants, { onConflict: "conversation_id,user_id" });

    if (participantError) {
      throw participantError;
    }
  }

  notifyUpdated();

  return toConversationCard({
    ...(existingConversation || {
      id: conversationId,
      item_id: itemId || null,
      title,
      context,
      masked_identity: maskedIdentity,
      blocked: false,
      reported: false,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }),
    unread_count: 0,
  });
};

export const sendMessage = async ({ conversationId, text, senderId }) => {
  assertSupabase();

  const trimmed = String(text || "").trim();
  if (!conversationId || !senderId || !trimmed) {
    return;
  }

  const timestamp = new Date().toISOString();

  const { error: insertError } = await supabase
    .from("message_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
      created_at: timestamp,
    });

  if (insertError) {
    throw insertError;
  }

  const { error: updateConversationError } = await supabase
    .from("message_conversations")
    .update({ updated_at: timestamp })
    .eq("id", conversationId);

  if (updateConversationError) {
    throw updateConversationError;
  }

  const { data: participants, error: participantQueryError } = await supabase
    .from("message_participants")
    .select("conversation_id, user_id, unread_count")
    .eq("conversation_id", conversationId);

  if (participantQueryError) {
    throw participantQueryError;
  }

  const targetRows = (participants || []).filter(
    (entry) => entry.user_id !== senderId,
  );

  if (targetRows.length) {
    const updates = targetRows.map((entry) =>
      supabase
        .from("message_participants")
        .update({ unread_count: Number(entry.unread_count || 0) + 1 })
        .eq("conversation_id", entry.conversation_id)
        .eq("user_id", entry.user_id),
    );

    await Promise.all(updates);
  }

  notifyUpdated();
};

export const sendAutoReply = async () => {
  return null;
};
