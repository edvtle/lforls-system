import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { gsap } from "gsap";
import Navbar from "../components/Navbar";
import "../styles/AppShell.css";

const getStoredThemeMode = () => localStorage.getItem("lforls:themeMode") || "dark";

const MainLayout = () => {
  const location = useLocation();
  const isHomeRoute = location.pathname === "/" || location.pathname === "/home";
  const [themeMode, setThemeMode] = useState(getStoredThemeMode());
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
    </div>
  );
};

export default MainLayout;
