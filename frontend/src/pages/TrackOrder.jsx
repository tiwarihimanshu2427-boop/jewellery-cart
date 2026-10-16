
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  Search,
  Package,
  PackageCheck,
  CheckCircle2,
  Clock3,
  Truck,
  MapPin,
  RefreshCw,
  ArrowLeft,
  XCircle,
  Gem,
  Copy,
  Check,
  Link2,
} from "lucide-react";

import "./TrackOrder.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const STEPS = [
  { name: "Pending", label: "Order Placed" },
  { name: "Confirmed", label: "Confirmed" },
  { name: "Processing", label: "Processing" },
  { name: "Shipped", label: "Shipped" },
  { name: "Delivered", label: "Delivered" },
];

function getOrderIdFromInput(value) {
  const input = String(value || "")
    .trim()
    .toUpperCase();

  let numericId = input;

  if (/^JC-AWB-\d+$/.test(input)) {
    numericId = input.slice(7);
  } else if (/^JC-\d+$/.test(input)) {
    numericId = input.slice(3);
  }

  if (!/^\d+$/.test(numericId)) {
    return null;
  }

  const id = Number(numericId);

  return Number.isSafeInteger(id) && id > 0
    ? String(id)
    : null;
}

function getTrackingId(order) {
  if (!order) return "";

  return (
    order.tracking_id ||
    `JC-${String(order.id).padStart(8, "0")}`
  );
}

function getActualAWB(order) {
  if (!order) return "";

  const number = String(
    order.actual_awb ||
    order.tracking_number ||
    ""
  ).trim();

  if (
    !number ||
    /^JC-AWB-\d+$/i.test(number)
  ) {
    return "";
  }

  return number;
}

function getCourierName(order) {
  if (!order || !getActualAWB(order)) {
    return "Not assigned yet";
  }

  const name = String(
    order.actual_courier_name ||
    order.courier_name ||
    ""
  ).trim();

  if (
    !name ||
    name === "JEWELLERY CART Demo Tracking"
  ) {
    return "Not assigned yet";
  }

  return name;
}

function money(value) {
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

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusTimeline({ status }) {
  if (status === "Cancelled") {
    return (
      <div className="track-cancelled">
        <XCircle size={22} />
        <div>
          <strong>Order Cancelled</strong>
          <p>This order has been cancelled.</p>
        </div>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex(
    (step) => step.name === status
  );

  if (currentIndex < 0) {
    return (
      <p className="track-unknown-status">
        Current status: {status || "Unknown"}
      </p>
    );
  }

  return (
    <div className="track-timeline">
      {STEPS.map((step, index) => {
        const complete = currentIndex >= index;
        const current = currentIndex === index;

        return (
          <div
            key={step.name}
            className={`track-step ${
              complete ? "completed" : ""
            } ${current ? "current" : ""}`}
          >
            <div className="track-step-circle">
              {complete ? (
                <CheckCircle2 size={21} />
              ) : (
                <Clock3 size={21} />
              )}
            </div>

            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function TrackOrder() {
  const navigate = useNavigate();

  const [searchParams, setSearchParams] =
    useSearchParams();

  const urlOrderId = searchParams.get("id") || "";

  const [orderId, setOrderId] = useState(
    urlOrderId
  );

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const requestNumber = useRef(0);
  const orderRef = useRef(null);
  const loadingRef = useRef(false);

  const loadOrder = useCallback(
    async (
      id,
      { silent = false, signal } = {}
    ) => {
      const token =
        sessionStorage.getItem("jc_token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const requestId =
        ++requestNumber.current;

      loadingRef.current = true;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setOrder(null);
        setError("");
      }

      try {
        const response = await fetch(
          `${API}/api/orders/${encodeURIComponent(id)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal,
            cache: "no-store",
          }
        );

        if (response.status === 401) {
          navigate("/login", {
            replace: true,
          });
          return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
            "Could not load tracking details."
          );
        }

        if (
          signal?.aborted ||
          requestId !== requestNumber.current
        ) {
          return;
        }

        setOrder(data.order);
        orderRef.current = data.order;
        setError("");
        setLastUpdated(new Date());
      } catch (err) {
        if (
          err.name === "AbortError" ||
          signal?.aborted ||
          requestId !== requestNumber.current
        ) {
          return;
        }

        if (!silent) {
          setOrder(null);
          orderRef.current = null;
        }

        setError(
          err.message ||
          "Could not load tracking details."
        );
      } finally {
        if (
          !signal?.aborted &&
          requestId === requestNumber.current
        ) {
          loadingRef.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [navigate]
  );

  // Load when URL order ID changes.
  useEffect(() => {
    setOrderId(urlOrderId);
    setCopyMessage("");

    if (!urlOrderId) {
      setOrder(null);
      orderRef.current = null;
      setError("");
      return;
    }

    const parsedId =
      getOrderIdFromInput(urlOrderId);

    if (!parsedId) {
      setOrder(null);
      orderRef.current = null;
      setError(
        "Please enter a valid Order ID or Website Tracking ID."
      );
      return;
    }

    const controller = new AbortController();

    loadOrder(parsedId, {
      signal: controller.signal,
    });

    return () => {
      controller.abort();
      requestNumber.current += 1;
      loadingRef.current = false;
    };
  }, [urlOrderId, loadOrder]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  // Refresh order status from database every 30 seconds.
  useEffect(() => {
    const parsedId =
      getOrderIdFromInput(urlOrderId);

    if (!parsedId) return;

    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        orderRef.current &&
        !loadingRef.current
      ) {
        loadOrder(parsedId, {
          silent: true,
        });
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [urlOrderId, loadOrder]);

  function handleSearch(event) {
    event.preventDefault();

    const id = getOrderIdFromInput(orderId);

    if (!id) {
      setError(
        "Enter a valid Order ID or Website Tracking ID."
      );
      setOrder(null);
      return;
    }

    setError("");
    setCopyMessage("");

    if (
      id === getOrderIdFromInput(urlOrderId)
    ) {
      loadOrder(id);
    } else {
      setSearchParams({ id });
    }
  }

  async function copyText(value, message) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        String(value)
      );

      setCopyMessage(message);
    } catch {
      setCopyMessage(
        "Copy failed. Please copy manually."
      );
    }
  }

  function copyAWB() {
    const awb = getActualAWB(order);

    if (!awb) return;

    copyText(
      awb,
      "AWB number copied successfully!"
    );
  }

  function copyTrackingLink() {
    if (!order) return;

    const url =
      `${window.location.origin}/track-order?id=` +
      encodeURIComponent(order.id);

    copyText(
      url,
      "Tracking page link copied!"
    );
  }

  const actualAWB = getActualAWB(order);
  const courierName = getCourierName(order);

  return (
    <main className="track-page">
      <div className="track-container">

        {/* HEADER */}
        <header className="track-header">
          <Link
            to="/my-orders"
            className="track-back"
          >
            <ArrowLeft size={17} />
            My Orders
          </Link>

          <div className="track-brand">
            <Gem size={23} />
            JEWELLERY CART
          </div>

          <span className="track-eyebrow">
            ORDER TRACKING
          </span>

          <h1>Track Your Order</h1>

          <p>
            Track your jewellery order using
            your Order ID or Website Tracking ID.
          </p>
        </header>

        {/* SEARCH */}
        <form
          className="track-search"
          onSubmit={handleSearch}
        >
          <div className="track-search-input">
            <Search size={20} />

            <input
              type="text"
              inputMode="text"
              placeholder="Enter Order ID or JC Tracking ID"
              value={orderId}
              onChange={(event) =>
                setOrderId(event.target.value)
              }
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Searching..."
              : "Track Order"}
          </button>
        </form>

        {/* ERROR */}
        {error && (
          <div
            className="track-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div className="track-loading">
            Loading tracking information...
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !order && !error && (
          <section className="track-placeholder">
            <Package size={48} />

            <h2>Find Your Order</h2>

            <p>
              Enter your Order ID or Website
              Tracking ID to see delivery progress.
            </p>
          </section>
        )}

        {/* TRACKING RESULTS */}
        {!loading && order && (
          <div className="track-results">

            {/* ORDER PROGRESS */}
            <section className="track-card">
              <div className="track-card-header">
                <div>
                  <span className="track-eyebrow">
                    YOUR ORDER
                  </span>

                  <h2>Order #{order.id}</h2>

                  <p>
                    Placed on{" "}
                    {formatDate(order.created_at)}
                  </p>
                </div>

                <span className="track-status">
                  {order.status}
                </span>
              </div>

              <h3 className="track-section-title">
                <PackageCheck size={21} />
                Delivery Progress
              </h3>

              <StatusTimeline
                status={order.status}
              />

              <p className="track-note">
                This progress reflects the order
                status updated by JEWELLERY CART.
                It is not live courier GPS tracking.
              </p>

              <div className="track-refresh">
                <span className="jc-tracking-update-time">
                  {lastUpdated
                    ? `Last checked: ${formatDate(
                        lastUpdated
                      )}`
                    : ""}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    loadOrder(String(order.id), {
                      silent: true,
                    })
                  }
                  disabled={
                    loading || refreshing
                  }
                >
                  <RefreshCw size={17} />

                  {refreshing
                    ? "Updating..."
                    : "Refresh Tracking"}
                </button>
              </div>
            </section>

            {/* COURIER + ADDRESS */}
            <div className="track-info-grid">

              {/* COURIER DETAILS */}
              <section className="track-card">
                <h3 className="track-section-title">
                  <Truck size={21} />
                  Courier Information
                </h3>

                <div className="track-info-row">
                  <span>Courier Company</span>
                  <strong>{courierName}</strong>
                </div>

                <div className="track-info-row">
                  <span>Website Tracking ID</span>

                  <strong>
                    {getTrackingId(order)}
                  </strong>
                </div>

                <div className="track-info-row">
                  <span>Courier AWB Number</span>

                  {actualAWB ? (
                    <div className="jc-awb-actions">
                      <strong className="jc-awb-number">
                        {actualAWB}
                      </strong>

                      <button
                        type="button"
                        className="jc-copy-awb"
                        onClick={copyAWB}
                      >
                        <Copy size={16} />
                        Copy AWB
                      </button>
                    </div>
                  ) : (
                    <strong>
                      Awaiting courier assignment
                    </strong>
                  )}
                </div>

                <div className="jc-tracking-link-actions">
                  <button
                    type="button"
                    className="jc-copy-tracking-link"
                    onClick={copyTrackingLink}
                  >
                    <Link2 size={16} />
                    Copy Tracking Page Link
                  </button>
                </div>

                {copyMessage && (
                  <p
                    className="jc-awb-copy-message"
                    role="status"
                  >
                    {copyMessage.startsWith(
                      "Copy failed"
                    ) ? (
                      copyMessage
                    ) : (
                      <>
                        <Check size={15} />
                        {copyMessage}
                      </>
                    )}
                  </p>
                )}

                <p className="track-note">
                  {actualAWB
                    ? "Courier details have been saved by the admin. For live shipment events, check the courier's official tracking service."
                    : "Your website tracking ID is active. An actual courier AWB will appear here after the admin assigns one."}
                </p>

                <p className="track-note">
                  Order information refreshes
                  automatically every 30 seconds
                  while this page is open.
                </p>
              </section>

              {/* DELIVERY ADDRESS */}
              <section className="track-card">
                <h3 className="track-section-title">
                  <MapPin size={21} />
                  Delivery Address
                </h3>

                <strong>
                  {order.full_name}
                </strong>

                <p className="track-address">
                  {order.address}
                  <br />
                  {order.city}, {order.state}
                  <br />
                  PIN: {order.pincode}
                  <br />
                  Phone: {order.phone}
                </p>
              </section>
            </div>

            {/* ORDERED PRODUCTS */}
            <section className="track-card">
              <h3 className="track-section-title">
                <Package size={21} />
                Ordered Products
              </h3>

              <div className="track-items">
                {(order.items || []).map(
                  (item, index) => (
                    <div
                      className="track-item"
                      key={`${item.product_id}-${index}`}
                    >
                      <div>
                        <strong>
                          {item.product_name}
                        </strong>

                        <span>
                          Quantity: {item.quantity}
                        </span>
                      </div>

                      <strong>
                        {money(
                          Number(item.price) *
                          Number(item.quantity)
                        )}
                      </strong>
                    </div>
                  )
                )}
              </div>

              <div className="track-total">
                <span>Total Amount</span>

                <strong>
                  {money(order.total_amount)}
                </strong>
              </div>

              <div className="track-payment">
                Payment Method:{" "}
                {order.payment_method}
              </div>
            </section>

            {/* BOTTOM ACTIONS */}
            <div className="track-actions">
              <Link
                to={`/order-success/${order.id}`}
                className="track-primary-link"
              >
                View Order Details
              </Link>

              <Link
                to="/my-orders"
                className="track-secondary-link"
              >
                All My Orders
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
