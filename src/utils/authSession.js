const AUTH_USER_KEY = "lforls-auth-user";
const AUTH_SESSION_KEY = "lforls-auth-session";

export const TEMP_ADMIN_ACCOUNT = {
  name: "System Admin",
  email: "admin@gmail.com",
  password: "admin123",
  role: "admin",
};

const sanitizeEmail = (value) => value.trim().toLowerCase();

export const getStoredUser = () => {
  const raw = window.localStorage.getItem(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveStoredUser = ({ name, email, password }) => {
  const user = {
    name: name.trim(),
    email: sanitizeEmail(email),
    password: password.trim(),
    role: "user",
  };

  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  return user;
};

export const getAuthSession = () => {
  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveAuthSession = ({ name, email, role }) => {
  const session = {
    name,
    email,
    role,
    signedInAt: new Date().toISOString(),
  };

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
};

export const clearAuthSession = () => {
  window.localStorage.removeItem(AUTH_SESSION_KEY);
};

export const authenticateLogin = ({ email, password }) => {
  const submittedEmail = sanitizeEmail(email);
  const submittedPassword = password.trim();

  if (
    submittedEmail === TEMP_ADMIN_ACCOUNT.email &&
    submittedPassword === TEMP_ADMIN_ACCOUNT.password
  ) {
    return {
      ok: true,
      session: saveAuthSession({
        name: TEMP_ADMIN_ACCOUNT.name,
        email: TEMP_ADMIN_ACCOUNT.email,
        role: TEMP_ADMIN_ACCOUNT.role,
      }),
      redirectPath: "/admin",
    };
  }

  const storedUser = getStoredUser();
  if (!storedUser) {
    return { ok: false };
  }

  const isUserValid =
    sanitizeEmail(storedUser.email || "") === submittedEmail &&
    (storedUser.password || "").trim() === submittedPassword;

  if (!isUserValid) {
    return { ok: false };
  }

  return {
    ok: true,
    session: saveAuthSession({
      name: storedUser.name || "User",
      email: sanitizeEmail(storedUser.email || submittedEmail),
      role: "user",
    }),
    redirectPath: "/home",
  };
};
