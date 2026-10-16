
import { NavLink, useNavigate } from "react-router-dom";
import {
  Gem,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  LogOut
} from "lucide-react";
import "./AdminNavbar.css";

export default function AdminNavbar() {
  const navigate = useNavigate();

  const admin = (() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("jc_admin") || "null"
      );
    } catch {
      return null;
    }
  })();

  function handleLogout() {
    sessionStorage.removeItem("jc_admin_token");
    sessionStorage.removeItem("jc_admin");
    navigate("/admin/login", { replace: true });
  }

  return (
    <header className="jc-admin-navbar">
      <div className="jc-admin-navbar-inner">
        <NavLink
          to="/admin/dashboard"
          className="jc-admin-logo"
        >
          <Gem size={28} />
          <span>JEWELLERY CART</span>
          <small>ADMIN</small>
        </NavLink>

        <nav className="jc-admin-nav-links">
          <NavLink
            to="/admin/dashboard"
            className={({ isActive }) =>
              isActive ? "jc-admin-nav-active" : ""
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          <NavLink
            to="/admin/products"
            className={({ isActive }) =>
              isActive ? "jc-admin-nav-active" : ""
            }
          >
            <Package size={18} />
            Products
          </NavLink>

          <NavLink
            to="/admin/orders"
            className={({ isActive }) =>
              isActive ? "jc-admin-nav-active" : ""
            }
          >
            <ShoppingBag size={18} />
            Orders
          </NavLink>

          <NavLink
            to="/admin/customers"
            className={({ isActive }) =>
              isActive ? "jc-admin-nav-active" : ""
            }
          >
            <Users size={18} />
            Customers
          </NavLink>
        </nav>

        <div className="jc-admin-nav-right">
          <span className="jc-admin-welcome">
            {admin?.name || "Admin"}
          </span>

          <button
            type="button"
            onClick={handleLogout}
            className="jc-admin-logout"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
