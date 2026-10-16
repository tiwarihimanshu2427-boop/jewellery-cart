
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PackageCheck,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ArrowRight,
  MapPin
} from "lucide-react";

import "./OrderPages.css";
import "./OrderTracking.css";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const STEPS = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered"
];

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function TrackingTimeline({ status }) {
  if (status === "Cancelled") {
    return (
      <div className="jc-tracking-cancelled">
        <XCircle size={19} />
        <span>This order has been cancelled.</span>
      </div>
    );
  }

  const currentIndex = STEPS.indexOf(status);

  if (currentIndex === -1) {
    return (
      <p className="orders-message">
        Current status: {status || "Not available"}
      </p>
    );
  }

  return (
    <div className="jc-tracking-timeline">
      {STEPS.map((step, index) => {
        const completed = currentIndex >= index;
        const current = currentIndex === index;

        return (
          <div
            key={step}
            className={`jc-tracking-step ${
              completed ? "completed" : ""
            } ${current ? "current" : ""}`}
          >
            <div className="jc-tracking-step-icon">
              {completed ? (
                <CheckCircle2 size={17} />
              ) : (
                <Clock size={17} />
              )}
            </div>

            <span>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function MyOrders() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(
    async ({ refresh = false, signal } = {}) => {
      const token = sessionStorage.getItem("jc_token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await fetch(
          `${API}/api/orders/my`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal
          }
        );

        const data = await response.json();

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          sessionStorage.removeItem("jc_token");

          navigate("/login", { replace: true });
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Could not load your orders."
          );
        }

        if (!signal?.aborted) {
          setOrders(
            Array.isArray(data.orders) ? data.orders : []
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message || "Could not load your orders."
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [navigate]
  );

  useEffect(() => {
    const controller = new AbortController();

    loadOrders({ signal: controller.signal });

    return () => controller.abort();
  }, [loadOrders]);

  return (
    <main className="orders-page">
      <div className="orders-container">
        <header className="orders-heading">
          <span>JEWELLERY CART</span>

          <h1>My Orders</h1>

          <p>
            Review your jewellery purchases and track
            their delivery status.
          </p>
        </header>

        <div className="jc-my-orders-toolbar">
          <div>
            <strong>Order History</strong>
            <p>
              {orders.length}{" "}
              {orders.length === 1 ? "order" : "orders"}
            </p>
          </div>

          <button
            type="button"
            className="jc-my-orders-refresh"
            onClick={() => loadOrders({ refresh: true })}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing ? "jc-refresh-spinning" : ""
              }
            />

            {refreshing ? "Refreshing..." : "Refresh Orders"}
          </button>
        </div>

        {loading ? (
          <p className="orders-message">
            Loading your orders...
          </p>
        ) : error && orders.length === 0 ? (
          <p
            className="orders-message orders-error"
            role="alert"
          >
            {error}
          </p>
        ) : orders.length === 0 ? (
          <section className="orders-empty">
            <PackageCheck size={42} />

            <h2>No orders yet</h2>

            <p>
              Your orders will appear here after checkout.
            </p>

            <Link to="/" className="orders-action">
              Explore the collection
            </Link>
          </section>
        ) : (
          <div className="jc-my-orders-list">
            {error && (
              <p
                className="orders-message orders-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {orders.map((order) => (
              <article
                className="jc-my-order-card"
                key={order.id}
              >
                <div className="jc-my-order-top">
                  <div>
                    <span className="order-label">
                      ORDER #{order.id}
                    </span>

                    <p>
                      {formatDate(order.created_at)}
                    </p>
                  </div>

                  <span className="jc-my-order-status">
                    {order.status}
                  </span>
                </div>

                <div className="jc-my-order-price">
                  <Package size={19} />

                  <strong>
                    {formatPrice(order.total_amount)}
                  </strong>

                  <span>
                    {order.payment_method || "COD"}
                  </span>
                </div>

                <TrackingTimeline status={order.status} />

                {(order.courier_name ||
                  order.tracking_number) && (
                  <div className="jc-my-order-courier">
                    <Truck size={21} />

                    <div>
                      <span>Courier Partner</span>

                      <strong>
                        {order.courier_name ||
                          "Not assigned yet"}
                      </strong>
                    </div>

                    <div>
                      <span>Tracking Number</span>

                      <strong>
                        {order.tracking_number ||
                          "Not available yet"}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="jc-my-order-actions">
                  <Link
                    className="jc-my-order-details-link"
                    to={`/order-success/${order.id}`}
                  >
                    <PackageCheck size={17} />
                    View Order Details
                  </Link>

                  <Link
                    className="jc-my-order-track-btn"
                    to={`/track-order?id=${order.id}`}
                  >
                    <MapPin size={17} />
                    Track Order
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <Link to="/account" className="orders-back">
          Back to account
        </Link>
      </div>
    </main>
  );
}
