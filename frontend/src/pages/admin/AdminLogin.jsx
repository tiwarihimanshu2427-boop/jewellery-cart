import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Gem, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import "./Admin.css";

const API = "http://localhost:5000";

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Admin login failed.");
      }

      sessionStorage.setItem("jc_admin_token", data.token);
      sessionStorage.setItem(
        "jc_admin",
        JSON.stringify(data.admin)
      );

      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-auth-page">
      <div className="admin-auth-shell">
        <div className="admin-auth-brand">
          <Gem size={64} strokeWidth={1} />
          <span>JEWELLERY CART</span>
          <h1>Elegance Meets Management.</h1>
          <p>
            A dedicated space to manage your jewellery business.
          </p>
          <div className="admin-brand-line" />
          <small>PRIVATE ADMINISTRATION PORTAL</small>
        </div>

        <div className="admin-auth-form-panel">
          <div className="admin-auth-eyebrow">
            <ShieldCheck size={17} />
            SECURE ADMIN ACCESS
          </div>

          <h2>Admin Sign In</h2>
          <p>Enter your administrator credentials.</p>

          {error && <div className="admin-error">{error}</div>}

          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Admin Email</label>
            <div className="admin-input-wrap">
              <Mail size={19} />
              <input
                id="admin-email"
                type="email"
                placeholder="Enter admin email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <label htmlFor="admin-password">Password</label>
            <div className="admin-input-wrap">
              <LockKeyhole size={19} />
              <input
                id="admin-password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              className="admin-primary-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? "SIGNING IN..." : "SIGN IN TO DASHBOARD"}
            </button>
          </form>

          <Link className="admin-back-link" to="/">
            ← Back to Jewellery Cart
          </Link>

          <p className="admin-customer-link">
            Shopping as a customer? <Link to="/login">User Login</Link>
          </p>
        </div>
      </div>
    </main>
  );
}