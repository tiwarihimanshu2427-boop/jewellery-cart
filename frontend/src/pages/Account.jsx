
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  UserRound,
  Mail,
  LogOut,
  Heart,
  ShoppingBag,
  Gem,
  Package,
  Truck,
  ArrowRight,
  Clock3,
  CheckCircle2,
  MapPin,
  RefreshCw,
} from "lucide-react";

import "./Account.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusIcon(status) {
  if (status === "Delivered") {
    return <CheckCircle2 size={16} />;
  }

  if (status === "Shipped") {
    return <Truck size={16} />;
  }

  return <Clock3 size={16} />;
}

export default function Account() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] =
    useState(true);

  const [ordersError, setOrdersError] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const token =
      sessionStorage.getItem("jc_token");

    if (!token) {
      navigate("/login", {
        replace: true,
      });
      return;
    }

    async function loadAccount() {
      try {
        const response = await fetch(
          `${API}/api/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (response.status === 401) {
          sessionStorage.removeItem("jc_token");
          sessionStorage.removeItem("jc_user");

          window.dispatchEvent(
            new Event("authUpdated")
          );

          navigate("/login", {
            replace: true,
          });

          return;
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
            "Unable to load account."
          );
        }

        setUser(data.user);
        setError("");
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        setError(
          err.message ||
          "Unable to load account."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    return () => controller.abort();
  }, [navigate]);

  async function loadOrders(
    { silent = false } = {}
  ) {
    const token =
      sessionStorage.getItem("jc_token");

    if (!token) {
      navigate("/login", {
        replace: true,
      });
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setOrdersLoading(true);
    }

    try {
      const response = await fetch(
        `${API}/api/orders/my`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        sessionStorage.removeItem("jc_token");
        sessionStorage.removeItem("jc_user");

        window.dispatchEvent(
          new Event("authUpdated")
        );

        navigate("/login", {
          replace: true,
        });

        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
          "Unable to load your orders."
        );
      }

      setOrders(
        Array.isArray(data.orders)
          ? data.orders
          : []
      );

      setOrdersError("");
    } catch (err) {
      setOrdersError(
        err.message ||
        "Unable to load your orders."
      );
    } finally {
      setOrdersLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!user) return;

    loadOrders();

    // Refresh recent orders when user returns to this tab.
    function handleVisibility() {
      if (
        document.visibilityState === "visible"
      ) {
        loadOrders({ silent: true });
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [user]);

  function handleLogout() {
    sessionStorage.removeItem("jc_token");
    sessionStorage.removeItem("jc_user");

    window.dispatchEvent(
      new Event("authUpdated")
    );

    navigate("/login", {
      replace: true,
    });
  }

  if (loading) {
    return (
      <main className="account-page">
        <div className="account-container">
          <p>Loading your account...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="account-page">
        <div className="account-container">
          <p role="alert">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="account-page">
      <div className="account-container">

        {/* ACCOUNT HEADER */}
        <div className="account-heading">
          <span>
            JEWELLERY CART ACCOUNT
          </span>

          <h1>
            Welcome, {user?.name}!
          </h1>

          <p>
            Manage your jewellery shopping
            account and track your orders.
          </p>
        </div>

        {/* PROFILE */}
        <div className="account-profile-card">
          <div className="account-avatar">
            <UserRound size={35} />
          </div>

          <div>
            <h2>{user?.name}</h2>

            <p>
              <Mail size={17} />
              {user?.email}
            </p>
          </div>

          <button
            type="button"
            className="account-logout"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

        {/* ACCOUNT LINKS */}
        <div className="account-links">

          <Link to="/my-orders">
            <Package size={30} />
            <h3>My Orders</h3>
            <p>
              View your order history
            </p>
          </Link>

          <Link to="/track-order">
            <Truck size={30} />
            <h3>Track My Order</h3>
            <p>
              Check your delivery progress
            </p>
          </Link>

          <Link to="/cart">
            <ShoppingBag size={30} />
            <h3>My Cart</h3>
            <p>
              View your shopping cart
            </p>
          </Link>

          <Link to="/wishlist">
            <Heart size={30} />
            <h3>My Wishlist</h3>
            <p>
              View saved jewellery
            </p>
          </Link>

          <Link to="/">
            <Gem size={30} />
            <h3>Shop Jewellery</h3>
            <p>
              Explore our collections
            </p>
          </Link>
        </div>

        {/* RECENT ORDERS */}
        <section
          style={{
            marginTop: "45px",
            background: "#fff",
            border: "1px solid #ead7c2",
            borderRadius: "18px",
            padding: "28px",
            boxShadow:
              "0 10px 35px rgba(80, 47, 20, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div>
              <span
                style={{
                  color: "#aa7b4d",
                  fontSize: "11px",
                  letterSpacing: "3px",
                  fontWeight: 700,
                }}
              >
                YOUR PURCHASES
              </span>

              <h2
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "28px",
                  margin: "8px 0",
                  color: "#33251c",
                }}
              >
                Recent Orders
              </h2>

              <p
                style={{
                  color: "#887767",
                  margin: 0,
                }}
              >
                View and track your latest
                jewellery purchases.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  loadOrders({
                    silent: true,
                  })
                }
                disabled={refreshing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "11px 14px",
                  background: "#fff",
                  border:
                    "1px solid #e4c9ac",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "#946d45",
                }}
              >
                <RefreshCw size={16} />
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>

              <Link
                to="/my-orders"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 16px",
                  background: "#33251c",
                  color: "#fff",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontSize: "13px",
                }}
              >
                View All
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {ordersLoading ? (
            <p>Loading your orders...</p>
          ) : ordersError ? (
            <p
              role="alert"
              style={{
                color: "#b42318",
              }}
            >
              {ordersError}
            </p>
          ) : orders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "45px 20px",
              }}
            >
              <ShoppingBag
                size={42}
                color="#b48a61"
              />

              <h3
                style={{
                  marginTop: "15px",
                  color: "#33251c",
                }}
              >
                No Orders Yet
              </h3>

              <p
                style={{
                  color: "#887767",
                }}
              >
                Your jewellery orders
                will appear here.
              </p>

              <Link
                to="/"
                style={{
                  display: "inline-block",
                  marginTop: "10px",
                  padding: "12px 20px",
                  background: "#33251c",
                  color: "#fff",
                  borderRadius: "8px",
                  textDecoration: "none",
                }}
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "14px",
              }}
            >
              {orders.slice(0, 5).map(
                (order) => (
                  <div
                    key={order.id}
                    style={{
                      border:
                        "1px solid #eee0d0",
                      borderRadius: "12px",
                      padding: "20px",
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: "0 0 7px",
                          color: "#33251c",
                        }}
                      >
                        Order #{order.id}
                      </h3>

                      <p
                        style={{
                          color: "#887767",
                          fontSize: "13px",
                          margin: 0,
                        }}
                      >
                        {formatDate(
                          order.created_at
                        )}
                      </p>

                      <strong
                        style={{
                          display: "block",
                          marginTop: "10px",
                          color: "#33251c",
                        }}
                      >
                        {formatMoney(
                          order.total_amount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "7px",
                          padding: "9px 13px",
                          borderRadius: "30px",
                          background:
                            order.status ===
                            "Delivered"
                              ? "#e9f7ef"
                              : order.status ===
                                "Cancelled"
                              ? "#fff0f0"
                              : "#fff5e7",
                          color:
                            order.status ===
                            "Delivered"
                              ? "#267849"
                              : order.status ===
                                "Cancelled"
                              ? "#b42318"
                              : "#996527",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        {statusIcon(
                          order.status
                        )}
                        {order.status}
                      </span>
                    </div>

                    <Link
                      to={`/track-order?id=${order.id}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "12px 17px",
                        borderRadius: "8px",
                        background: "#33251c",
                        color: "#fff",
                        textDecoration: "none",
                        fontSize: "13px",
                      }}
                    >
                      <MapPin size={16} />
                      Track Order
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
