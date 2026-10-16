
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams
} from "react-router-dom";

import {
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Gift,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Truck
} from "lucide-react";

import "./OrderPages.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const STEPS = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered"
];

const STEP_LABELS = [
  "Order Placed",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered"
];

function getToken() {
  return (
    sessionStorage.getItem("jc_token") ||
    localStorage.getItem("jc_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("authToken")
  );
}

function formatPrice(value) {
  return `₹${Number(value || 0).toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  )}`;
}

export default function OrderSuccess() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const token = getToken();

    if (!token) {
      navigate("/login", {
        replace: true,
        state: {
          from: `/order-success/${id}`
        }
      });
      return;
    }

    const controller = new AbortController();

    async function loadOrder() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API}/api/orders/${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal,
            cache: "no-store"
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "Could not load order details."
          );
        }

        if (!controller.signal.aborted) {
          setOrder(data.order);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message ||
              "Unable to load your order."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadOrder();

    return () => controller.abort();
  }, [id, navigate]);

  async function copyText(value, label) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        String(value)
      );

      setCopied(`${label} copied!`);
    } catch {
      setCopied("Could not copy automatically.");
    }
  }

  const trackingId =
    order?.tracking_id ||
    (order?.id
      ? `JC-${String(order.id).padStart(8, "0")}`
      : "");

  const awbNumber =
    order?.tracking_number || "";

  const isCOD =
    String(order?.payment_method).toUpperCase() ===
    "COD";

  const paymentLabel = isCOD
    ? "Cash on Delivery"
    : order?.payment_method === "UPI"
    ? "Razorpay UPI Test Payment"
    : order?.payment_method === "CARD"
    ? "Razorpay Card Test Payment"
    : order?.payment_method || "Online Payment";

  const currentStep = STEPS.indexOf(order?.status);

  return (
    <main
      className="orders-page"
      style={{
        background:
          "linear-gradient(180deg, #fffaf4 0%, #f8efe5 100%)",
        minHeight: "80vh"
      }}
    >
      <div className="orders-container">
        {loading ? (
          <div
            className="orders-message"
            style={{
              textAlign: "center",
              padding: "90px 20px"
            }}
          >
            Loading your order confirmation...
          </div>
        ) : error ? (
          <section
            className="orders-empty orders-error"
            role="alert"
          >
            <h1>Unable to show your order</h1>
            <p>{error}</p>

            <Link
              to="/my-orders"
              className="orders-action"
            >
              View My Orders
            </Link>
          </section>
        ) : !order ? (
          <div className="orders-message">
            Order not found.
          </div>
        ) : (
          <section
            className="order-confirmation"
            style={{
              maxWidth: 850,
              margin: "35px auto",
              textAlign: "center"
            }}
          >
            {/* THANK YOU HEADER */}

            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                margin: "0 auto 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#e8f6eb",
                color: "#27824d",
                boxShadow:
                  "0 12px 35px rgba(39,130,77,0.12)"
              }}
            >
              <Check size={45} strokeWidth={3} />
            </div>

            <span
              style={{
                display: "inline-block",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                color: "#a47a49",
                marginBottom: 12
              }}
            >
              JEWELLERY CART • ORDER CONFIRMED
            </span>

            <h1
              style={{
                fontSize: "clamp(30px, 5vw, 44px)",
                fontWeight: 800,
                color: "#30221b",
                marginBottom: 12
              }}
            >
              Thank You for Your Order!
            </h1>

            <p
              style={{
                fontSize: 16,
                color: "#75675c",
                lineHeight: 1.7,
                maxWidth: 560,
                margin: "0 auto 28px"
              }}
            >
              Your jewellery order has been
              successfully placed. Thank you
              for shopping with JEWELLERY CART.
            </p>

            {/* ORDER DETAILS */}

            <div
              className="order-detail-card"
              style={{
                textAlign: "left",
                background: "#fff",
                border: "1px solid #eadccc",
                borderRadius: 18,
                padding: "26px",
                boxShadow:
                  "0 15px 40px rgba(60,35,20,0.06)"
              }}
            >
              <div className="order-detail-heading">
                <PackageCheck size={27} />

                <div>
                  <strong>
                    Order #{order.id}
                  </strong>

                  <span className="order-status">
                    {order.status}
                  </span>
                </div>
              </div>

              {/* PAYMENT INFORMATION */}

              <div
                style={{
                  margin: "22px 0",
                  padding: 18,
                  borderRadius: 12,
                  background: "#f7f9f6",
                  border: "1px solid #e2e9df"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10
                  }}
                >
                  <CreditCard
                    size={22}
                    color="#328052"
                  />

                  <strong>
                    Payment Information
                  </strong>
                </div>

                <p>
                  Method: <strong>{paymentLabel}</strong>
                </p>

                <p>
                  Payment:{" "}
                  <strong
                    style={{
                      color: isCOD
                        ? "#9b6b29"
                        : "#27824d"
                    }}
                  >
                    {isCOD
                      ? "Pay on Delivery"
                      : "Test Payment Confirmed"}
                  </strong>
                </p>

                <p>
                  Total:{" "}
                  <strong>
                    {formatPrice(order.total_amount)}
                  </strong>
                </p>

                {!isCOD && (
                  <small
                    style={{
                      color: "#777",
                      display: "block",
                      marginTop: 8
                    }}
                  >
                    Razorpay Test Mode — no real
                    money was charged.
                  </small>
                )}
              </div>

              {/* TRACKING ID */}

              <div
                style={{
                  padding: 20,
                  background: "#fbf5ed",
                  border: "1px solid #e6d6c3",
                  borderRadius: 12,
                  marginBottom: 22
                }}
              >
                <strong
                  style={{
                    display: "block",
                    marginBottom: 10,
                    color: "#57402e"
                  }}
                >
                  Your Automatic Tracking ID
                </strong>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap"
                  }}
                >
                  <code
                    style={{
                      fontSize: 19,
                      fontWeight: 800,
                      color: "#30221b",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {trackingId}
                  </code>

                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        trackingId,
                        "Tracking ID"
                      )
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 15px",
                      background: "#30221b",
                      color: "#fff",
                      border: 0,
                      borderRadius: 8,
                      cursor: "pointer"
                    }}
                  >
                    <Copy size={16} />
                    Copy
                  </button>
                </div>

                <small
                  style={{
                    display: "block",
                    marginTop: 12,
                    color: "#765c48"
                  }}
                >
                  This is your website order
                  tracking reference.
                </small>
              </div>

              {/* COURIER DETAILS */}

              <div
                style={{
                  padding: "18px 0",
                  borderTop:
                    "1px solid #eadfce"
                }}
              >
                <h3
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 12
                  }}
                >
                  <Truck size={21} />
                  Courier Details
                </h3>

                <p>
                  Courier:{" "}
                  <strong>
                    {order.courier_name ||
                      "Not assigned yet"}
                  </strong>
                </p>

                <p>
                  AWB:{" "}
                  <strong>
                    {awbNumber ||
                      "Awaiting courier booking"}
                  </strong>
                </p>

                {awbNumber && (
                  <button
                    type="button"
                    onClick={() =>
                      copyText(awbNumber, "AWB")
                    }
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "9px 14px",
                      marginTop: 10,
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      background: "#fff",
                      cursor: "pointer"
                    }}
                  >
                    <Copy size={15} />
                    Copy AWB
                  </button>
                )}

                {awbNumber.startsWith("JC-AWB-") && (
                  <small
                    style={{
                      display: "block",
                      marginTop: 10,
                      color: "#856b52"
                    }}
                  >
                    This is a demo AWB, not a
                    real courier tracking number.
                  </small>
                )}

                {copied && (
                  <p
                    role="status"
                    style={{
                      color: "#27824d",
                      marginTop: 10
                    }}
                  >
                    {copied}
                  </p>
                )}
              </div>

              {/* DELIVERY TIMELINE */}

              <div
                style={{
                  borderTop:
                    "1px solid #eadfce",
                  paddingTop: 22,
                  marginTop: 8
                }}
              >
                <h3
                  style={{
                    marginBottom: 18,
                    display: "flex",
                    alignItems: "center",
                    gap: 10
                  }}
                >
                  <PackageCheck size={21} />
                  Delivery Timeline
                </h3>

                {order.status === "Cancelled" ? (
                  <p>
                    This order has been cancelled.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 13
                    }}
                  >
                    {STEPS.map((step, index) => {
                      const completed =
                        index <= currentStep;

                      return (
                        <div
                          key={step}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            color: completed
                              ? "#27824d"
                              : "#9b9189"
                          }}
                        >
                          {completed ? (
                            <CheckCircle2
                              size={21}
                            />
                          ) : (
                            <Clock3 size={21} />
                          )}

                          <span
                            style={{
                              fontWeight:
                                index === currentStep
                                  ? 800
                                  : 500
                            }}
                          >
                            {STEP_LABELS[index]}
                          </span>

                          {index === currentStep && (
                            <small>
                              (Current)
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ORDER ITEMS */}

              <div
                style={{
                  borderTop:
                    "1px solid #eadfce",
                  marginTop: 24,
                  paddingTop: 20
                }}
              >
                <h3
                  style={{
                    marginBottom: 16
                  }}
                >
                  Your Items
                </h3>

                <div className="order-items">
                  {(order.items || []).map(
                    (item, index) => (
                      <div
                        className="order-item"
                        key={`${item.product_id}-${index}`}
                      >
                        <span>
                          {item.product_name} ×{" "}
                          {item.quantity}
                        </span>

                        <strong>
                          {formatPrice(
                            Number(item.price) *
                              Number(item.quantity)
                          )}
                        </strong>
                      </div>
                    )
                  )}
                </div>

                <div className="order-total">
                  <span>Order Total</span>

                  <strong>
                    {formatPrice(
                      order.total_amount
                    )}
                  </strong>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}

            <div
              className="order-actions"
              style={{
                marginTop: 28
              }}
            >
              <Link
                to={`/track-order?id=${order.id}`}
                className="orders-action"
              >
                <Truck size={18} />
                Track My Order
              </Link>

              <Link
                to="/my-orders"
                className="orders-secondary-action"
              >
                <PackageCheck size={18} />
                My Orders
              </Link>

              <Link
                to="/"
                className="orders-secondary-action"
              >
                <ShoppingBag size={18} />
                Continue Shopping
              </Link>
            </div>

            <div
              style={{
                marginTop: 35,
                color: "#977c5f",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 9
              }}
            >
              <Gift size={20} />

              <span>
                Thank you for choosing
                JEWELLERY CART!
              </span>

              <ShieldCheck size={19} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
