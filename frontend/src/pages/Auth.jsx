import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../Auth.css";
import {
  Gem,
  Mail,
  LockKeyhole,
  UserRound,
  Eye,
  EyeOff,
  ArrowRight
} from "lucide-react";

const API = "http://localhost:5000";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();

  const isRegister = location.pathname === "/register";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const endpoint = isRegister ? "register" : "login";

      const payload = isRegister
        ? form
        : {
            email: form.email,
            password: form.password
          };

      const response = await fetch(
        `${API}/api/auth/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Authentication failed"
        );
      }

      sessionStorage.setItem("jc_token", data.token);
      sessionStorage.setItem(
        "jc_user",
        JSON.stringify(data.user)
      );

      window.dispatchEvent(new Event("authUpdated"));

      const destination =
        location.state?.from === "/checkout" ? "/checkout" : "/account";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-container">
        <div className="auth-showcase">
          <div className="auth-showcase-content">
            <Gem size={55} strokeWidth={1} />

            <span>JEWELLERY CART</span>

            <h2>
              Timeless Beauty,
              <br />
              Beautiful Moments
            </h2>

            <p>
              Discover elegant jewellery designed
              for your special moments.
            </p>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <span className="auth-eyebrow">
              WELCOME TO JEWELLERY CART
            </span>

            <h1>
              {isRegister
                ? "Create Account"
                : "Welcome Back"}
            </h1>

            <p className="auth-subtitle">
              {isRegister
                ? "Join our jewellery collection."
                : "Sign in to your account."}
            </p>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {isRegister && (
                <div className="auth-field">
                  <label>Full Name</label>

                  <div className="auth-input-wrap">
                    <UserRound size={19} />

                    <input
                      type="text"
                      name="name"
                      placeholder="Enter your name"
                      value={form.name}
                      onChange={handleChange}
                      minLength={2}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="auth-field">
                <label>Email Address</label>

                <div className="auth-input-wrap">
                  <Mail size={19} />

                  <input
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label>Password</label>

                <div className="auth-input-wrap">
                  <LockKeyhole size={19} />

                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange}
                    minLength={isRegister ? 8 : undefined}
                    required
                  />

                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                  >
                    {showPassword
                      ? <EyeOff size={19} />
                      : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isRegister
                    ? "CREATE ACCOUNT"
                    : "SIGN IN"}

                <ArrowRight size={19} />
              </button>
            </form>

            <p className="auth-switch">
              {isRegister
                ? "Already have an account?"
                : "New to Jewellery Cart?"}

              {" "}

              <Link
                to={isRegister ? "/login" : "/register"}
              >
                {isRegister
                  ? "Sign In"
                  : "Create Account"}
              </Link>
            </p>

            <Link to="/" className="auth-back">
              ← Back to Jewellery Collection
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}