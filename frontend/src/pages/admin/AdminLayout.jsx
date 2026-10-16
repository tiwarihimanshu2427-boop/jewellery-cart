
import { Navigate, Outlet } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";

export default function AdminLayout() {
  const token = sessionStorage.getItem("jc_admin_token");

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <>
      <AdminNavbar />
      <Outlet />
    </>
  );
}
