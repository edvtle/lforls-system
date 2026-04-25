import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  checkPasswordResetEmailExists as authCheckPasswordResetEmailExists,
  clearExpiredSuspension,
  fetchProfileById,
  getSession,
  onAuthStateChange,
  requestPasswordResetCode as authRequestPasswordResetCode,
  signIn as authSignIn,
  signOut as authSignOut,
  signUp as authSignUp,
  updatePasswordAfterReset as authUpdatePasswordAfterReset,
  verifyPasswordResetCode as authVerifyPasswordResetCode,
} from "../services/authService";
import { isSupabaseConfigured } from "../services/supabaseClient";

const AuthContext = createContext(null);

const normalizeAuth = async (session) => {
  if (!session?.user) {
    return { session: null, profile: null };
  }

  const profile = await fetchProfileById(session.user.id, session.user.email || "");

  const status = String(profile?.status || "active").toLowerCase();
  const suspendedUntil = String(profile?.suspendedUntil || "");
  const suspendedUntilMs = suspendedUntil ? Date.parse(suspendedUntil) : Number.NaN;

  if (status === "suspended" && Number.isFinite(suspendedUntilMs) && suspendedUntilMs <= Date.now()) {
    try {
      await clearExpiredSuspension(session.user.id);
      return {
        session,
        profile: {
          ...profile,
          status: "active",
          suspendedUntil: "",
        },
      };
    } catch {
      // Keep current profile when automatic status reconciliation fails.
    }
  }

  return { session, profile };
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setIsInitializing(false);
      return undefined;
    }

    const init = async () => {
      try {
        const currentSession = await getSession();
        const normalized = await normalizeAuth(currentSession);

        if (!mounted) return;
        setSession(normalized.session);
        setProfile(normalized.profile);
      } catch (error) {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    };

    init();

    const unsubscribe = onAuthStateChange(async (nextSession) => {
      if (!mounted) return;

      if (!nextSession) {
        setSession(null);
        setProfile(null);
        return;
      }

      try {
        const normalized = await normalizeAuth(nextSession);
        if (!mounted) return;
        setSession(normalized.session);
        setProfile(normalized.profile);
      } catch {
        if (!mounted) return;
        setSession(nextSession);
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    const { session: nextSession } = await authSignIn({ email, password });
    let normalized = await normalizeAuth(nextSession);

    let status = String(normalized.profile?.status || "active").toLowerCase();
    const suspendedUntil = String(normalized.profile?.suspendedUntil || "");
    const suspendedUntilMs = suspendedUntil ? Date.parse(suspendedUntil) : Number.NaN;

    if (status === "suspended" && Number.isFinite(suspendedUntilMs) && suspendedUntilMs <= Date.now()) {
      try {
        await clearExpiredSuspension(normalized.profile?.id || nextSession?.user?.id);
      } catch {
        // Continue with local active status so the user can proceed when the suspension already expired.
      }

      normalized = {
        ...normalized,
        profile: {
          ...normalized.profile,
          status: "active",
          suspendedUntil: "",
        },
      };
      status = "active";
    }

    if (status === "suspended" || status === "banned") {
      await authSignOut();
      setSession(null);
      setProfile(null);
      const error = new Error(
        status === "banned"
          ? "Your account has been banned. Please contact an administrator."
          : "Your account is suspended.",
      );
      error.code = "ACCOUNT_BLOCKED";
      error.accountStatus = status;
      error.suspensionEndsAt =
        status === "suspended" && Number.isFinite(suspendedUntilMs) && suspendedUntilMs > Date.now()
          ? suspendedUntil
          : "";
      throw error;
    }

    setSession(normalized.session);
    setProfile(normalized.profile);
    return normalized;
  };

  const signUp = async ({ fullName, email, password }) => {
    const { session: nextSession } = await authSignUp({ fullName, email, password });

    if (!nextSession) {
      return {
        session: null,
        profile: null,
        requiresEmailVerification: true,
      };
    }

    const normalized = await normalizeAuth(nextSession);
    setSession(normalized.session);
    setProfile(normalized.profile);
    return { ...normalized, requiresEmailVerification: false };
  };

  const signOut = async () => {
    await authSignOut();
    setSession(null);
    setProfile(null);
  };

  const requestPasswordResetCode = async ({ email }) => {
    await authRequestPasswordResetCode({ email });
  };

  const checkPasswordResetEmailExists = async ({ email }) => {
    return authCheckPasswordResetEmailExists({ email });
  };

  const verifyPasswordResetCode = async ({ email, code }) => {
    return authVerifyPasswordResetCode({ email, code });
  };

  const updatePasswordAfterReset = async ({ email, newPassword, resetToken }) => {
    const result = await authUpdatePasswordAfterReset({ email, newPassword, resetToken });
    setSession(null);
    setProfile(null);
    return result;
  };

  const value = useMemo(
    () => ({
      session,
      profile,
      isAuthenticated: Boolean(session),
      isInitializing,
      isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      checkPasswordResetEmailExists,
      requestPasswordResetCode,
      verifyPasswordResetCode,
      updatePasswordAfterReset,
    }),
    [session, profile, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
