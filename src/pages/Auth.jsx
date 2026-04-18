import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import AnimatedContent from "../components/AnimatedContent";
import Button from "../components/ui/Button";
import InputText from "../components/ui/InputText";
import Radar from "../components/Radar";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

const RESET_CODE_LENGTH = 6;
const RESET_CODE_EXPIRY_SECONDS = 180;
const RESET_CODE_RESEND_SECONDS = 60;

const Auth = () => {
  const magnifierSrc = "/logo.png";
  const navigate = useNavigate();
  const {
    signIn,
    signUp,
    checkPasswordResetEmailExists,
    requestPasswordResetCode,
    verifyPasswordResetCode,
    updatePasswordAfterReset,
    isSupabaseConfigured,
  } = useAuth();

  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ name: "", email: "", password: "" });
  const [resetData, setResetData] = useState({
    email: "",
    code: "",
    resetToken: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetResendSeconds, setResetResendSeconds] = useState(0);
  const [resetReturnSeconds, setResetReturnSeconds] = useState(0);

  const isSignup = mode === "signup";
  const isLogin = mode === "login";
  const isResetRequest = mode === "reset-request";
  const isResetCode = mode === "reset-code";
  const isResetPassword = mode === "reset-password";
  const isResetSuccess = mode === "reset-success";

  const titleByMode = {
    signup: "Create an account",
    login: "Login your account",
    "reset-request": "Reset your password",
    "reset-code": "Verify your code",
    "reset-password": "Reset your password",
    "reset-success": "Password updated",
  };

  useEffect(() => {
    if (!snackbar.open) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSnackbar({ open: false, message: "" });
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [snackbar.open]);

  useEffect(() => {
    if (!isResetCode || resetResendSeconds <= 0) return undefined;

    const intervalId = window.setInterval(() => {
      setResetResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isResetCode, resetResendSeconds]);

  useEffect(() => {
    if (!isResetSuccess || resetReturnSeconds <= 0) return undefined;

    const intervalId = window.setInterval(() => {
      setResetReturnSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setMode("login");
          setShowPassword(false);
          setResetResendSeconds(0);
          setResetData({ email: "", code: "", resetToken: "", newPassword: "", confirmPassword: "" });
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isResetSuccess, resetReturnSeconds]);

  const showSnackbar = (message) => {
    setSnackbar({ open: true, message });
  };

  const normalizeEmail = (value = "") => value.trim().toLowerCase();

  const goBackToLogin = () => {
    setMode("login");
    setShowPassword(false);
    setResetResendSeconds(0);
    setResetReturnSeconds(0);
    setResetData({ email: "", code: "", resetToken: "", newPassword: "", confirmPassword: "" });
  };

  const sendResetCode = async ({ email, isResend = false }) => {
    const normalizedEmail = normalizeEmail(email);
    const exists = await checkPasswordResetEmailExists({ email: normalizedEmail });

    if (!exists) {
      showSnackbar("We could not find that email in the system.");
      return false;
    }

    await requestPasswordResetCode({ email: normalizedEmail });
    setResetData((current) => ({ ...current, email: normalizedEmail, code: "", resetToken: "" }));
    setMode("reset-code");
    setResetResendSeconds(RESET_CODE_RESEND_SECONDS);
    setResetReturnSeconds(0);
    setShowPassword(false);
    showSnackbar(
      isResend
        ? `A new ${RESET_CODE_LENGTH}-digit code was sent to your email. It expires in 3 minutes.`
        : `Verification code sent. Check your inbox for the ${RESET_CODE_LENGTH}-digit code. It expires in 3 minutes.`,
    );
    return true;
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    if (!isSupabaseConfigured) {
      showSnackbar("Authentication is not configured. Contact the system administrator.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const hasEmptyField = !signupData.name.trim() || !signupData.email.trim() || !signupData.password.trim();

        if (hasEmptyField) {
          showSnackbar("Please fill in all signup fields.");
          return;
        }

        const signupResult = await signUp({
          fullName: signupData.name,
          email: normalizeEmail(signupData.email),
          password: signupData.password,
        });

        if (signupResult.requiresEmailVerification) {
          showSnackbar("Signup successful. Check your email to verify your account.");
          setMode("login");
          setLoginData({ email: signupData.email.trim(), password: "" });
          setShowPassword(false);
          return;
        }

        navigate(signupResult.profile?.role === "admin" ? "/admin" : "/home", { replace: true });
        return;
      }

      if (isResetRequest) {
        const email = resetData.email.trim();

        if (!email) {
          showSnackbar("Please enter your email.");
          return;
        }

        await sendResetCode({ email });
        return;
      }

      if (isResetCode) {
        const email = resetData.email.trim();
        const code = resetData.code.trim();

        if (!email) {
          showSnackbar("Please enter your email.");
          return;
        }

        if (!new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`).test(code)) {
          showSnackbar(`Enter the ${RESET_CODE_LENGTH}-digit verification code.`);
          return;
        }

        const { resetToken } = await verifyPasswordResetCode({ email, code });
        setResetData((current) => ({ ...current, resetToken }));
        setMode("reset-password");
        setShowPassword(false);
        showSnackbar("Code verified. Set your new password.");
        return;
      }

      if (isResetPassword) {
        const email = resetData.email.trim();
        const newPassword = resetData.newPassword;
        const confirmPassword = resetData.confirmPassword;

        if (!email || !newPassword || !confirmPassword) {
          showSnackbar("Please fill in all reset fields.");
          return;
        }

        if (newPassword.length < 6) {
          showSnackbar("New password must be at least 6 characters.");
          return;
        }

        if (newPassword !== confirmPassword) {
          showSnackbar("Password confirmation does not match.");
          return;
        }

        await updatePasswordAfterReset({ email, newPassword, resetToken: resetData.resetToken });
        setMode("reset-success");
        setResetReturnSeconds(8);
        setShowPassword(false);
        setLoginData({ email, password: "" });
        setResetData({ email, code: "", resetToken: "", newPassword: "", confirmPassword: "" });
        showSnackbar("Password updated successfully.");
        return;
      }

      if (isResetSuccess) {
        goBackToLogin();
        return;
      }

      if (!loginData.email.trim() || !loginData.password.trim()) {
        showSnackbar("Please enter your email and password.");
        return;
      }

      const loginResult = await signIn({
        email: normalizeEmail(loginData.email),
        password: loginData.password,
      });

      if (loginResult.profile?.status && loginResult.profile.status !== "active") {
        showSnackbar(`Account is ${loginResult.profile.status}. Contact an administrator.`);
        return;
      }

      navigate(loginResult.profile?.role === "admin" ? "/admin" : "/home", { replace: true });
    } catch (error) {
      showSnackbar(error?.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-layout">
        <aside className="auth-brand-panel">
          <div className="auth-radar-bg">
            <Radar
              speed={1}
              scale={0.5}
              ringCount={10}
              spokeCount={10}
              ringThickness={0.05}
              spokeThickness={0.01}
              sweepSpeed={1}
              sweepWidth={2}
              sweepLobes={1}
              color="#60d02b"
              backgroundColor="#0f0f0f"
              falloff={2}
              brightness={0.95}
              enableMouseInteraction
              mouseInfluence={0.1}
            />
          </div>
          <div className="auth-radar-overlay" />
          <div className="auth-brand-content">
            <AnimatedContent distance={36} delay={0.05} className="auth-motion-block">
              <p className="auth-brand-small">PLP</p>
            </AnimatedContent>

            <AnimatedContent distance={44} delay={0.12} className="auth-motion-block">
              <h1 className="auth-brand-title">
                LOST AND
                <br />
                FOUND
              </h1>
            </AnimatedContent>

            <AnimatedContent distance={28} delay={0.18} className="auth-motion-block">
              <p className="auth-brand-description">
                Report items, view AI-assisted matches, and process claims in one calm and reliable flow.
              </p>
            </AnimatedContent>
          </div>
        </aside>

        <section className="auth-form-panel">
          <div className="auth-form-shell">
            <div className="auth-form-wrap">
              <AnimatedContent distance={28} delay={0.05} className="auth-motion-block">
                <img src={magnifierSrc} alt="Magnifying icon" className="auth-icon" />
              </AnimatedContent>

              <AnimatedContent distance={34} delay={0.12} className="auth-motion-block">
                <h2 className="auth-form-title">{titleByMode[mode]}</h2>
              </AnimatedContent>

              <AnimatedContent distance={40} delay={0.18} className="auth-motion-block auth-form-motion">
                <form className="auth-form" onSubmit={handleAuthSubmit}>
                  {isSignup && (
                    <InputText
                      name="name"
                      label="Name"
                      value={signupData.name}
                      onChange={(event) => setSignupData((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Enter your full name"
                    />
                  )}

                  {(isSignup || isLogin) && (
                    <>
                      <InputText
                        name="email"
                        label="Email"
                        value={isSignup ? signupData.email : loginData.email}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          if (isSignup) {
                            setSignupData((current) => ({ ...current, email: nextValue }));
                            return;
                          }
                          setLoginData((current) => ({ ...current, email: nextValue }));
                        }}
                        placeholder="Enter your email address"
                      />

                      <InputText
                        name="password"
                        label="Password"
                        type={showPassword ? "text" : "password"}
                        value={isSignup ? signupData.password : loginData.password}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          if (isSignup) {
                            setSignupData((current) => ({ ...current, password: nextValue }));
                            return;
                          }
                          setLoginData((current) => ({ ...current, password: nextValue }));
                        }}
                        placeholder="Enter your password"
                        trailing={<FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="auth-eye-icon" aria-hidden="true" focusable="false" />}
                        onTrailingClick={() => setShowPassword((current) => !current)}
                      />
                    </>
                  )}

                  {isResetRequest && (
                    <InputText
                      name="reset-email"
                      label="Email"
                      value={resetData.email}
                      onChange={(event) => setResetData((current) => ({ ...current, email: event.target.value }))}
                      placeholder="Enter your account email"
                    />
                  )}

                  {isResetCode && (
                    <>
                      <InputText
                        name="verify-email"
                        label="Email"
                        value={resetData.email}
                        onChange={(event) => setResetData((current) => ({ ...current, email: event.target.value }))}
                        placeholder="Enter your account email"
                        disabled
                      />
                      <InputText
                        name="verification-code"
                        label="Verification Code"
                        value={resetData.code}
                        onChange={(event) =>
                          setResetData((current) => ({
                            ...current,
                            code: event.target.value.replace(/\D/g, "").slice(0, RESET_CODE_LENGTH),
                          }))
                        }
                        placeholder={`Enter the ${RESET_CODE_LENGTH}-digit code`}
                        maxLength={RESET_CODE_LENGTH}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern={`\\d{${RESET_CODE_LENGTH}}`}
                      />
                      <div className="auth-helper-text text-left text-sm text-[#b8d3af]">
                        Enter the {RESET_CODE_LENGTH}-digit code from your email. It expires in{" "}
                        {Math.floor(RESET_CODE_EXPIRY_SECONDS / 60)} minutes. Resend unlocks in {resetResendSeconds}s.
                      </div>
                    </>
                  )}

                  {isResetPassword && (
                    <>
                      <InputText
                        name="reset-email-confirmed"
                        label="Email"
                        value={resetData.email}
                        onChange={(event) => setResetData((current) => ({ ...current, email: event.target.value }))}
                        placeholder="Enter your account email"
                        disabled
                      />
                      <InputText
                        name="new-password"
                        label="New Password"
                        type={showPassword ? "text" : "password"}
                        value={resetData.newPassword}
                        onChange={(event) => setResetData((current) => ({ ...current, newPassword: event.target.value }))}
                        placeholder="Enter your new password"
                        trailing={<FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="auth-eye-icon" aria-hidden="true" focusable="false" />}
                        onTrailingClick={() => setShowPassword((current) => !current)}
                      />
                      <InputText
                        name="confirm-password"
                        label="Confirm Password"
                        type={showPassword ? "text" : "password"}
                        value={resetData.confirmPassword}
                        onChange={(event) => setResetData((current) => ({ ...current, confirmPassword: event.target.value }))}
                        placeholder="Confirm your new password"
                      />
                    </>
                  )}

                  {isResetSuccess && (
                    <div className="rounded-md border border-[#5DD62C] bg-[#0f0f0f] px-4 py-4 text-left text-[#F8F8F8]">
                      <p className="text-[16px] font-semibold">Your password has been updated.</p>
                      <p className="mt-2 text-sm text-[#b8d3af]">
                        Returning to Login in {resetReturnSeconds} seconds.
                      </p>
                    </div>
                  )}

                  <div className="auth-button-group">
                    {isSignup ? (
                      <>
                        <Button type="submit" variant="primary" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Sign up"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setMode("login")}>
                          Login
                        </Button>
                      </>
                    ) : isLogin ? (
                      <>
                        <Button type="submit" variant="primary" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Login"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setMode("signup")}>
                          Sign Up
                        </Button>
                      </>
                    ) : isResetRequest ? (
                      <>
                        <Button type="submit" variant="primary" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Send Verification Code"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={goBackToLogin}>
                          Back to Login
                        </Button>
                      </>
                    ) : isResetCode ? (
                      <>
                        <Button type="submit" variant="primary" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Verify Code"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              setIsSubmitting(true);
                              await sendResetCode({ email: resetData.email, isResend: true });
                            } finally {
                              setIsSubmitting(false);
                            }
                          }}
                          disabled={isSubmitting || resetResendSeconds > 0}
                        >
                          {resetResendSeconds > 0 ? `Resend Code (${resetResendSeconds}s)` : "Resend Code"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={goBackToLogin}>
                          Back to Login
                        </Button>
                      </>
                    ) : isResetPassword ? (
                      <>
                        <Button type="submit" variant="primary" disabled={isSubmitting}>
                          {isSubmitting ? "Submitting..." : "Reset Password"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={goBackToLogin}>
                          Back to Login
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="primary" onClick={goBackToLogin}>
                          Back to Login
                        </Button>
                      </>
                    )}
                  </div>
                </form>
              </AnimatedContent>

              <AnimatedContent distance={22} delay={0.24} className="auth-motion-block">
                {isSignup ? (
                  <p className="auth-helper-text">
                    Already have an account?{" "}
                    <button type="button" onClick={() => setMode("login")} className="auth-inline-link">
                      Log in
                    </button>
                  </p>
                ) : isLogin ? (
                  <p className="auth-helper-text">
                    Forgot Password?{" "}
                    <button
                      type="button"
                      className="auth-inline-link"
                      onClick={() => {
                        setResetData((current) => ({ ...current, email: loginData.email }));
                        setMode("reset-request");
                        setShowPassword(false);
                      }}
                    >
                      Reset Password
                    </button>
                  </p>
                ) : isResetSuccess ? (
                  <p className="auth-helper-text">
                    Returning to login automatically. You can also click the button above.
                  </p>
                ) : (
                  <p className="auth-helper-text">
                    Remembered your password?{" "}
                    <button type="button" onClick={goBackToLogin} className="auth-inline-link">
                      Back to Login
                    </button>
                  </p>
                )}
              </AnimatedContent>

              {snackbar.open && (
                <div className="auth-snackbar" role="status" aria-live="polite">
                  {snackbar.message}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
};

export default Auth;
