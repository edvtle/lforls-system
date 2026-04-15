import { supabase, isSupabaseConfigured } from "./supabaseClient";

const assertSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Authentication service is not configured.");
  }
};

const normalizeProfile = (profile, fallbackEmail = "") => ({
  id: profile?.id || "",
  fullName: profile?.full_name || "",
  email: profile?.email || fallbackEmail,
  collegeDept: profile?.college_dept || "",
  programYear: profile?.program_year || "",
  role: profile?.role || "user",
  status: profile?.status || "active",
  avatarUrl: profile?.avatar_url || "",
});

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const resetApiBaseUrl = import.meta.env.VITE_RESET_API_BASE_URL || "";
const resetTokensByEmail = new Map();
const resetTokenStorageKey = (email) => `reset_token_${normalizeEmail(email)}`;

const getStoredResetToken = (email) => {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(resetTokenStorageKey(email)) || "";
};

const setStoredResetToken = (email, token) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(resetTokenStorageKey(email), token);
};

const clearStoredResetToken = (email) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(resetTokenStorageKey(email));
};

const callResetApi = async (path, payload) => {
  let response;
  try {
    response = await fetch(`${resetApiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Password reset service is offline. Start the app with npm run dev and try again.",
    );
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error || "Password reset request failed.");
  }

  return body;
};

export const getSession = async () => {
  assertSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const signIn = async ({ email, password }) => {
  assertSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signUp = async ({ fullName, email, password }) => {
  assertSupabase();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) throw error;

  const user = data.user;
  if (!user) {
    throw new Error("Unable to create user account.");
  }

  return data;
};

export const checkPasswordResetEmailExists = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  const { exists } = await callResetApi("/api/password-reset/email-exists", {
    email: normalizedEmail,
  });
  return Boolean(exists);
};

export const signOut = async () => {
  assertSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const requestPasswordResetCode = async ({ email }) => {
  const normalizedEmail = normalizeEmail(email);
  await callResetApi("/api/password-reset/request", {
    email: normalizedEmail,
  });
  resetTokensByEmail.delete(normalizedEmail);
  clearStoredResetToken(normalizedEmail);
};

export const verifyPasswordResetCode = async ({ email, code }) => {
  const normalizedEmail = normalizeEmail(email);
  const { resetToken } = await callResetApi("/api/password-reset/verify", {
    email: normalizedEmail,
    code,
  });
  resetTokensByEmail.set(normalizedEmail, resetToken);
  setStoredResetToken(normalizedEmail, resetToken);
  return { resetToken };
};

export const updatePasswordAfterReset = async ({
  email,
  newPassword,
  resetToken: providedResetToken,
}) => {
  const normalizedEmail = normalizeEmail(email);
  const resetToken =
    providedResetToken ||
    resetTokensByEmail.get(normalizedEmail) ||
    getStoredResetToken(normalizedEmail);

  if (!resetToken) {
    throw new Error("Reset session not found. Verify the code again.");
  }

  await callResetApi("/api/password-reset/reset", {
    email: normalizedEmail,
    resetToken,
    newPassword,
  });
  resetTokensByEmail.delete(normalizedEmail);
  clearStoredResetToken(normalizedEmail);
};

export const fetchProfileById = async (userId, fallbackEmail = "") => {
  assertSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, college_dept, program_year, role, status, avatar_url",
    )
    .eq("id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    return normalizeProfile(
      { id: userId, email: fallbackEmail, role: "user", status: "active" },
      fallbackEmail,
    );
  }

  return normalizeProfile(data, fallbackEmail);
};

export const onAuthStateChange = (callback) => {
  assertSupabase();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session || null);
  });

  return () => {
    data.subscription.unsubscribe();
  };
};
