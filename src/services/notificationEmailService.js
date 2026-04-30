const resetApiBaseUrl =
  import.meta.env.VITE_RESET_API_BASE_URL || "http://localhost:4001";

const postNotificationEmail = async (payload) => {
  try {
    const response = await fetch(`${resetApiBaseUrl}/api/admin/send-notification-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    return response.ok ? body : null;
  } catch {
    return null;
  }
};

export const sendAccountStatusEmail = async ({ userId, status, suspensionEndsAt }) => {
  if (!userId || !status) {
    return null;
  }

  return postNotificationEmail({
    kind: "status",
    userId,
    status,
    suspensionEndsAt: suspensionEndsAt || "",
  });
};

export const sendReportNotificationEmail = async ({
  itemId,
  conversationId,
  reporterUserId,
  reportedUserId,
  reason,
  message,
}) => {
  if (!itemId && !conversationId) {
    return null;
  }

  return postNotificationEmail({
    kind: "report",
    itemId: itemId || null,
    conversationId: conversationId || null,
    reporterUserId: reporterUserId || null,
    reportedUserId: reportedUserId || null,
    reason: reason || "",
    message: message || "",
  });
};

export const sendClaimDecisionEmail = async ({ claimId, status }) => {
  if (!claimId || !status) {
    return null;
  }

  return postNotificationEmail({
    kind: "claim",
    claimId,
    status,
  });
};