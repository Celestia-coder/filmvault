// components/RequireAdmin.jsx
// Route guard for every /admin/* page except /admin/login (see App.jsx).
// Only a logged-in admin (role "admin" with a branch) gets through; anyone else,
// including someone who just typed the URL, is sent to the admin login.
//
// NOTE: this only protects the pages. The session lives in localStorage and the
// API trusts ?branchId=, so it is not real security (see the TODO in api/session.js).

import { Navigate, Outlet, useLocation } from "react-router";
import { getAdminSession } from "../api/admin.js";

export default function RequireAdmin() {
  const location = useLocation();

  if (!getAdminSession()) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
