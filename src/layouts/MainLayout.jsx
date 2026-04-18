import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import Navbar from "../components/Navbar";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import "../styles/AppShell.css";

const getStoredThemeMode = () => localStorage.getItem("lforls:themeMode") || "dark";

const MainLayout = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const location = useLocation();
  const isHomeRoute = location.pathname === "/" || location.pathname === "/home";
  const [themeMode, setThemeMode] = useState(getStoredThemeMode());
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    const applyTheme = () => {
      const nextThemeMode = getStoredThemeMode();
      setThemeMode(nextThemeMode);
      document.documentElement.dataset.theme = nextThemeMode;
    };

    applyTheme();
    window.addEventListener("storage", applyTheme);
    window.addEventListener("lforls:theme-updated", applyTheme);

    return () => {
      window.removeEventListener("storage", applyTheme);
      window.removeEventListener("lforls:theme-updated", applyTheme);
    };
  }, []);

  useEffect(() => {
    if (!profile?.id || profile?.role === "admin") {
      return;
    }

    const promptKey = `lforls:profile-setup-prompted:${profile.id}`;
    const hasPrompted = window.localStorage.getItem(promptKey) === "1";
    const isIncomplete = !profile?.collegeDept?.trim() || !profile?.programYear?.trim();

    if (isIncomplete && !hasPrompted) {
      setShowProfilePrompt(true);
      window.localStorage.setItem(promptKey, "1");
    }
  }, [profile]);

  useEffect(() => {
    const mainElement = mainRef.current;
    if (!mainElement) {
      return undefined;
    }

    const topLevelTargets = Array.from(mainElement.children);
    const targets =
      topLevelTargets.length === 1
        ? Array.from(topLevelTargets[0].children).length
          ? Array.from(topLevelTargets[0].children)
          : topLevelTargets
        : topLevelTargets;

    if (!targets.length) {
      return undefined;
    }

    const tween = gsap.fromTo(
      targets,
      { y: 18, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.06,
        clearProps: "transform,opacity",
      },
    );

    return () => tween.kill();
  }, [location.pathname]);

  return (
    <div className={`app-shell app-shell-${themeMode} ${isHomeRoute ? "app-shell-home" : ""}`}>
      <Navbar />

      <main ref={mainRef} className={`app-main ${isHomeRoute ? "app-main-home" : ""}`}>
        <Outlet />
      </main>

      <Modal
        isOpen={showProfilePrompt}
        onClose={() => setShowProfilePrompt(false)}
        ariaLabel="Complete profile"
        overlayClassName="app-profile-prompt-backdrop"
        panelClassName="app-profile-prompt-panel"
      >
        <h3>Complete Your Profile</h3>
        <p>
          Welcome. Please set up your profile details first so matching and reports are more accurate.
        </p>
        <div className="app-profile-prompt-actions">
          <button
            type="button"
            className="app-profile-prompt-skip"
            onClick={() => setShowProfilePrompt(false)}
          >
            Later
          </button>
          <button
            type="button"
            className="app-profile-prompt-go"
            onClick={() => {
              setShowProfilePrompt(false);
              navigate("/profile");
            }}
          >
            Edit Profile Now
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MainLayout;
