import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import AdminPanel from "../pages/AdminPanel";
import Auth from "../pages/Auth";
import BrowseItems from "../pages/BrowseItems";
import Details from "../pages/Details";
import Home from "../pages/Home";
import MatchResults from "../pages/MatchResults";
import Messages from "../pages/Messages";
import Notifications from "../pages/Notifications";
import Profile from "../pages/Profile";
import ReportFoundItem from "../pages/ReportFoundItem";
import ReportLostItem from "../pages/ReportLostItem";
import { useAuth } from "../context/AuthContext";

const resolveHomePath = (role) => (role === "admin" ? "/admin" : "/home");

const RouteLoading = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#0c120e] text-[#d7e9d0]">
    Loading session...
  </div>
);

const PublicAuthRoute = ({ children }) => {
  const { isInitializing, isAuthenticated, profile } = useAuth();

  if (isInitializing) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return children;
  }

  const status = String(profile?.status || "active").toLowerCase();
  if (status === "suspended" || status === "banned") {
    return children;
  }

  return <Navigate to={resolveHomePath(profile?.role || "user")} replace />;
};

const RequireRole = ({ roles, children }) => {
  const { isInitializing, isAuthenticated, profile } = useAuth();

  if (isInitializing) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const role = profile?.role || "user";
  const status = profile?.status || "active";

  if (status !== "active") {
    return <Navigate to="/auth" replace />;
  }

  if (!roles.includes(role)) {
    return <Navigate to={resolveHomePath(role)} replace />;
  }

  return children;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={(
            <PublicAuthRoute>
              <Auth />
            </PublicAuthRoute>
          )}
        />
        <Route
          path="/auth"
          element={(
            <PublicAuthRoute>
              <Auth />
            </PublicAuthRoute>
          )}
        />
        <Route
          path="/admin"
          element={(
            <RequireRole roles={["admin"]}>
              <AdminPanel />
            </RequireRole>
          )}
        />
        <Route
          element={(
            <RequireRole roles={["user"]}>
              <MainLayout />
            </RequireRole>
          )}
        >
          <Route path="/home" element={<Home />} />
          <Route path="/details/:itemId" element={<Details />} />
          <Route path="/report/lost" element={<ReportLostItem />} />
          <Route path="/report/found" element={<ReportFoundItem />} />
          <Route path="/browse" element={<BrowseItems />} />
          <Route path="/matches" element={<MatchResults />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
