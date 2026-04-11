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
import { getAuthSession } from "../utils/authSession";

const PublicAuthRoute = ({ children }) => {
  const session = getAuthSession();

  if (!session) {
    return children;
  }

  return <Navigate to={session.role === "admin" ? "/admin" : "/home"} replace />;
};

const RequireRole = ({ roles, children }) => {
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (!roles.includes(session.role)) {
    return <Navigate to={session.role === "admin" ? "/admin" : "/home"} replace />;
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
