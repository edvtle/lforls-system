import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import AnimatedContent from "../components/AnimatedContent";
import Button from "../components/ui/Button";
import InputText from "../components/ui/InputText";
import Radar from "../components/Radar";
import { authenticateLogin, saveStoredUser, TEMP_ADMIN_ACCOUNT } from "../utils/authSession";
import "../styles/Auth.css";

const Auth = () => {
  const magnifierSrc = "/logo.png";
  const navigate = useNavigate();
  const [mode, setMode] = useState("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ name: "", email: "", password: "" });
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  const isSignup = mode === "signup";

  useEffect(() => {
    if (!snackbar.open) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSnackbar({ open: false, message: "" });
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [snackbar.open]);

  const showSnackbar = (message) => {
    setSnackbar({ open: true, message });
  };

  const handleAuthSubmit = (event) => {
    event.preventDefault();

    if (isSignup) {
      const hasEmptyField = !signupData.name.trim() || !signupData.email.trim() || !signupData.password.trim();

      if (hasEmptyField) {
        showSnackbar("Please fill in all signup fields.");
        return;
      }

      saveStoredUser(signupData);
      setLoginData({ email: signupData.email, password: "" });
      setMode("login");
      setShowPassword(false);
      showSnackbar("Signup successful. Please log in to continue.");
      return;
    }

    const loginResult = authenticateLogin(loginData);
    if (!loginResult.ok) {
      showSnackbar("Invalid login credentials.");
      return;
    }

    navigate(loginResult.redirectPath, { replace: true });
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
              <p className="auth-brand-small">PLP-L&F</p>
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
                <h2 className="auth-form-title">
                  {isSignup ? "Create an account" : "Login your account"}
                </h2>
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

                  <div className="auth-button-group">
                    {isSignup ? (
                      <>
                        <Button type="submit" variant="primary">
                          Sign up
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setMode("login")}>
                          Login
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="submit" variant="primary">
                          Login
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setMode("signup")}>
                          Sign Up
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
                ) : (
                  <p className="auth-helper-text">
                    Forgot Password?{" "}
                    <button type="button" className="auth-inline-link" onClick={(event) => event.preventDefault()}>
                      Reset Password
                    </button>
                  </p>
                )}
              </AnimatedContent>

              {!isSignup ? (
                <AnimatedContent distance={18} delay={0.28} className="auth-motion-block">
                  <p className="auth-helper-text">
                    Temp admin: {TEMP_ADMIN_ACCOUNT.email} / {TEMP_ADMIN_ACCOUNT.password}
                  </p>
                </AnimatedContent>
              ) : null}

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
