
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ShoppingBag,
  RefreshCw,
  Package,
  Eye,
  Truck,
  Save,
  X,
  Search,
  BellRing,
  Copy,
  Check,
  Clock3,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
  MapPin,
  Phone,
  UserRound,
  Gem,
  Filter,
} from "lucide-react";

import "./AdminOrders.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

const STATUS_OPTIONS = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const AUTO_REFRESH_MS = 15000;

function money(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatus(value) {
  const raw = String(value || "Pending").toLowerCase();

  return (
    STATUS_OPTIONS.find(
      (status) => status.toLowerCase() === raw
    ) || "Pending"
  );
}

function statusStyle(status) {
  switch (getStatus(status)) {
    case "Delivered":
      return {
        color: "#20784e",
        background: "#e7f5ed",
      };

    case "Shipped":
      return {
        color: "#2866a5",
        background: "#eaf2ff",
      };

    case "Cancelled":
      return {
        color: "#b13d44",
        background: "#fcebec",
      };

    case "Confirmed":
      return {
        color: "#376a8b",
        background: "#eaf4f9",
      };

    case "Processing":
      return {
        color: "#8055a5",
        background: "#f1eafa",
      };

    default:
      return {
        color: "#9b671c",
        background: "#fff1d8",
      };
  }
}

// Internal website tracking reference.
// This is NOT a real courier AWB.
function getAWB(order) {
  if (!order) return "";

  return (
    order.tracking_number ||
    `JC-AWB-${String(order.id).padStart(8, "0")}`
  );
}

function hasSavedAWB(order) {
  return Boolean(
    String(order?.tracking_number || "").trim()
  );
}

function getTrackingId(order) {
  if (!order) return "";

  return (
    order.tracking_id ||
    `JC-${String(order.id).padStart(8, "0")}`
  );
}

function getToken() {
  return sessionStorage.getItem("jc_admin_token") || "";
}

async function request(path, options = {}) {
  const token = getToken();

  if (!token) {
    throw new Error(
      "Admin session expired. Please login again."
    );
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "Backend returned an invalid response."
    );
  }

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message ||
      `Request failed (${response.status}).`
    );
  }

  return data;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "gold",
}) {
  const tones = {
    gold: {
      background: "#f8eddd",
      color: "#a47739",
    },
    purple: {
      background: "#f2eafa",
      color: "#8b5aaf",
    },
    blue: {
      background: "#eaf2fb",
      color: "#477fb6",
    },
    green: {
      background: "#e6f4eb",
      color: "#27845b",
    },
  };

  return (
    <div style={styles.statCard}>
      <div style={styles.statTop}>
        <span
          style={{
            ...styles.statIcon,
            ...tones[tone],
          }}
        >
          <Icon size={22} />
        </span>

        <ArrowUpRight
          size={17}
          color="#b4a293"
        />
      </div>

      <span style={styles.statLabel}>
        {label}
      </span>

      <strong style={styles.statValue}>
        {value}
      </strong>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoIcon}>
        <Icon size={17} />
      </span>

      <div style={styles.infoText}>
        <span>{label}</span>
        <strong>{value || "—"}</strong>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");
  const [dateFilter, setDateFilter] =
    useState("all");

  const [updatingId, setUpdatingId] =
    useState(null);

  const [selectedOrder, setSelectedOrder] =
    useState(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [savingTracking, setSavingTracking] =
    useState(false);

  const [courierName, setCourierName] =
    useState("");

  const [trackingNumber, setTrackingNumber] =
    useState("");

  const [newOrders, setNewOrders] = useState([]);
  const [copiedAWB, setCopiedAWB] = useState("");
  const [lastUpdated, setLastUpdated] =
    useState(null);

  const knownOrderIds = useRef(new Set());
  const initialized = useRef(false);
  const fetching = useRef(false);
  const mounted = useRef(false);
  const requestController = useRef(null);

  // =====================================
  // LOAD ORDERS
  // =====================================

  const loadOrders = useCallback(
    async (silent = false) => {
      if (fetching.current) return;

      fetching.current = true;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError("");
      }

      const controller = new AbortController();
      requestController.current = controller;

      try {
        const data = await request(
          "/api/admin/orders",
          { signal: controller.signal }
        );

        if (
          !mounted.current ||
          controller.signal.aborted
        ) {
          return;
        }

        if (!Array.isArray(data.orders)) {
          throw new Error(
            "Orders API returned an invalid list."
          );
        }

        const incoming = data.orders;

        const incomingIds = new Set(
          incoming.map((order) =>
            String(order.id)
          )
        );

        if (initialized.current) {
          const newlyArrived = incoming.filter(
            (order) =>
              !knownOrderIds.current.has(
                String(order.id)
              )
          );

          if (newlyArrived.length > 0) {
            setNewOrders((previous) => {
              const ids = new Set(
                previous.map((order) =>
                  String(order.id)
                )
              );

              return [
                ...newlyArrived.filter(
                  (order) =>
                    !ids.has(String(order.id))
                ),
                ...previous,
              ];
            });
          }
        }

        knownOrderIds.current = incomingIds;
        initialized.current = true;

        setOrders(incoming);
        setLastUpdated(new Date());
        setError("");
      } catch (err) {
        if (
          err.name !== "AbortError" &&
          mounted.current
        ) {
          setError(
            err.message ||
            "Failed to load orders."
          );
        }
      } finally {
        fetching.current = false;

        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mounted.current = true;

    loadOrders();

    const interval = window.setInterval(() => {
      if (
        document.visibilityState === "visible"
      ) {
        loadOrders(true);
      }
    }, AUTO_REFRESH_MS);

    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      requestController.current?.abort();
    };
  }, [loadOrders]);

  // =====================================
  // UPDATE ORDER STATUS
  // =====================================

  async function updateStatus(orderId, status) {
    const previousOrder = orders.find(
      (order) =>
        String(order.id) === String(orderId)
    );

    if (!previousOrder) return;

    if (
      getStatus(previousOrder.status) === status
    ) {
      return;
    }

    setUpdatingId(orderId);
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/admin/orders/${orderId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      const savedStatus =
        data.order?.status || status;

      setOrders((previous) =>
        previous.map((order) =>
          String(order.id) ===
          String(orderId)
            ? {
                ...order,
                status: savedStatus,
              }
            : order
        )
      );

      setSelectedOrder((previous) =>
        String(previous?.id) ===
        String(orderId)
          ? {
              ...previous,
              status: savedStatus,
            }
          : previous
      );

      setMessage(
        `Order #${orderId} status updated to ${savedStatus}.`
      );
    } catch (err) {
      setError(
        err.message ||
        "Could not update order status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // =====================================
  // OPEN ORDER DETAILS
  // =====================================

  async function viewOrder(orderId) {
    setDetailsLoading(true);
    setError("");
    setMessage("");
    setSelectedOrder(null);
    setCopiedAWB("");

    try {
      const data = await request(
        `/api/admin/orders/${orderId}`
      );

      const order = data.order;

      if (!order) {
        throw new Error(
          "Order details not found."
        );
      }

      setSelectedOrder(order);

      setCourierName(
        order.courier_name || ""
      );

      setTrackingNumber(
        order.tracking_number || ""
      );

      setNewOrders((previous) =>
        previous.filter(
          (item) =>
            String(item.id) !==
            String(orderId)
        )
      );
    } catch (err) {
      setError(
        err.message ||
        "Could not load order details."
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  // =====================================
  // SAVE TRACKING DETAILS
  // =====================================

  async function saveTracking() {
    if (!selectedOrder) return;

    const courier = courierName.trim();
    const awb = trackingNumber.trim();

    if (!courier || !awb) {
      setError(
        "Please enter both courier company and tracking number."
      );
      return;
    }

    setSavingTracking(true);
    setError("");
    setMessage("");

    try {
      const data = await request(
        `/api/admin/orders/${selectedOrder.id}/tracking`,
        {
          method: "PATCH",
          body: JSON.stringify({
            courier_name: courier,
            tracking_number: awb,
          }),
        }
      );

      const updated = {
        ...selectedOrder,
        ...data.order,
        courier_name: courier,
        tracking_number: awb,
      };

      setSelectedOrder(updated);

      setOrders((previous) =>
        previous.map((order) =>
          String(order.id) ===
          String(selectedOrder.id)
            ? {
                ...order,
                courier_name: courier,
                tracking_number: awb,
              }
            : order
        )
      );

      setMessage(
        "Courier tracking details saved successfully."
      );
    } catch (err) {
      setError(
        err.message ||
        "Could not save tracking details."
      );
    } finally {
      setSavingTracking(false);
    }
  }

  // =====================================
  // COPY TRACKING NUMBER
  // =====================================

  async function copyAWB(value) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(
        String(value)
      );

      setCopiedAWB(String(value));
      setError("");
    } catch {
      setError(
        "Could not copy tracking number."
      );
    }
  }

  // =====================================
  // FILTERS
  // =====================================

  const filteredOrders = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    const now = Date.now();

    return orders
      .filter((order) => {
        const text = [
          order.id,
          order.customer_name,
          order.full_name,
          order.phone,
          order.status,
          order.tracking_id,
          order.tracking_number,
          getAWB(order),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          text.includes(query);

        const matchesStatus =
          statusFilter === "All" ||
          getStatus(order.status) ===
            statusFilter;

        let matchesDate = true;

        if (dateFilter !== "all") {
          const date = new Date(
            order.created_at
          );

          const days = Number(dateFilter);

          matchesDate =
            !Number.isNaN(date.getTime()) &&
            date.getTime() <= now &&
            date.getTime() >=
              now -
                days * 24 * 60 * 60 * 1000;
        }

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDate
        );
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
  }, [
    orders,
    search,
    statusFilter,
    dateFilter,
  ]);

  const stats = useMemo(
    () => ({
      total: orders.length,

      pending: orders.filter(
        (order) =>
          ["Pending", "Confirmed", "Processing"].includes(
            getStatus(order.status)
          )
      ).length,

      shipped: orders.filter(
        (order) =>
          getStatus(order.status) ===
          "Shipped"
      ).length,

      delivered: orders.filter(
        (order) =>
          getStatus(order.status) ===
          "Delivered"
      ).length,
    }),
    [orders]
  );

  const selectedStatus = selectedOrder
    ? getStatus(selectedOrder.status)
    : "";

  const selectedAWB = selectedOrder
    ? getAWB(selectedOrder)
    : "";

  // =====================================
  // PAGE
  // =====================================

  return (
    <main className="jc-orders-page">
      <div className="jc-orders-container">
        {/* PAGE HEADER */}

        <header
          className="jc-orders-header"
          style={styles.pageHeader}
        >
          <div>
            <span style={styles.eyebrow}>
              <Gem size={15} />
              JEWELLERY CART ADMIN
            </span>

            <h1 style={styles.pageTitle}>
              Order Management
            </h1>

            <p style={styles.subtitle}>
              Manage customer orders, shipping,
              tracking and fulfilment.
            </p>

            <div style={styles.liveLine}>
              <span style={styles.liveDot} />
              Auto-refresh every 15 seconds

              {lastUpdated && (
                <span>
                  {" "}
                  · Last checked:{" "}
                  {formatDate(lastUpdated)}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="jc-orders-refresh"
            onClick={() =>
              loadOrders(false)
            }
            disabled={
              loading || refreshing
            }
          >
            <RefreshCw size={17} />

            {refreshing
              ? "Checking..."
              : "Refresh Orders"}
          </button>
        </header>

        {/* PREMIUM BANNER */}

        <section style={styles.banner}>
          <div style={styles.bannerContent}>
            <span style={styles.bannerEyebrow}>
              ORDER CONTROL CENTER
            </span>

            <h2 style={styles.bannerTitle}>
              Every order deserves
              exceptional care.
            </h2>

            <p style={styles.bannerText}>
              Review purchases, update delivery
              progress and manage courier
              information from one dashboard.
            </p>
          </div>

          <Gem
            size={100}
            strokeWidth={0.8}
            color="#c5a16b"
          />
        </section>

        {/* STAT CARDS */}

        <div style={styles.statsGrid}>
          <StatCard
            icon={ShoppingBag}
            label="Total Orders"
            value={stats.total}
          />

          <StatCard
            icon={Clock3}
            label="Pending / Processing"
            value={stats.pending}
            tone="purple"
          />

          <StatCard
            icon={Truck}
            label="Shipped Orders"
            value={stats.shipped}
            tone="blue"
          />

          <StatCard
            icon={CheckCircle2}
            label="Delivered Orders"
            value={stats.delivered}
            tone="green"
          />
        </div>

        {/* NEW ORDER NOTIFICATIONS */}

        {newOrders.length > 0 && (
          <section
            style={styles.notification}
          >
            <div
              style={styles.notificationHeader}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <BellRing size={21} />

                <strong>
                  {newOrders.length} New Order
                  {newOrders.length > 1
                    ? "s"
                    : ""}{" "}
                  Received!
                </strong>
              </div>

              <button
                type="button"
                onClick={() =>
                  setNewOrders([])
                }
                style={styles.textButton}
              >
                Dismiss
              </button>
            </div>

            {newOrders.map((order) => (
              <div
                key={order.id}
                style={styles.newOrderRow}
              >
                <div>
                  <strong>
                    Order #{order.id}
                  </strong>

                  <span>
                    {order.customer_name ||
                      "Customer"}{" "}
                    ·{" "}
                    {money(
                      order.total_amount
                    )}
                  </span>
                </div>

                <button
                  type="button"
                  className="jc-orders-view-btn"
                  onClick={() =>
                    viewOrder(order.id)
                  }
                >
                  <Eye size={16} />
                  View Order
                </button>
              </div>
            ))}
          </section>
        )}

        {/* FEEDBACK */}

        {error && (
          <div
            className="jc-orders-error"
            role="alert"
            style={styles.feedback}
          >
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {message && (
          <div
            className="jc-orders-success"
            role="status"
            style={styles.feedback}
          >
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}

        {/* ALL ORDERS */}

        <section
          className="jc-orders-table-card"
          style={styles.panel}
        >
          <div
            className="jc-orders-table-title"
            style={styles.tableHeader}
          >
            <div>
              <h2 style={styles.sectionTitle}>
                All Customer Orders
              </h2>

              <p style={styles.sectionSubtitle}>
                {filteredOrders.length} orders
                matching your filters
              </p>
            </div>

            <div style={styles.filters}>
              <div
                className="jc-orders-search"
              >
                <Search size={17} />

                <input
                  type="search"
                  placeholder="Search order, customer or AWB..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />
              </div>

              <div style={styles.selectWrap}>
                <Filter size={16} />

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value
                    )
                  }
                  style={styles.filterSelect}
                >
                  <option value="All">
                    All Status
                  </option>

                  {STATUS_OPTIONS.map(
                    (status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div style={styles.selectWrap}>
                <CalendarDays size={16} />

                <select
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(
                      event.target.value
                    )
                  }
                  style={styles.filterSelect}
                >
                  <option value="all">
                    All Time
                  </option>

                  <option value="7">
                    Last 7 Days
                  </option>

                  <option value="30">
                    Last 30 Days
                  </option>

                  <option value="90">
                    Last 90 Days
                  </option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div
              className="jc-orders-empty"
            >
              Loading customer orders...
            </div>
          ) : filteredOrders.length ===
            0 ? (
            <div
              className="jc-orders-empty"
            >
              <ShoppingBag size={42} />

              <h2>No Orders Found</h2>

              <p>
                No customer orders match
                your current filters.
              </p>
            </div>
          ) : (
            <div
              className="jc-orders-table-scroll"
            >
              <table className="jc-orders-table">
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>PHONE</th>
                    <th>AMOUNT</th>
                    <th>ITEMS</th>
                    <th>DATE</th>
                    <th>STATUS</th>
                    <th>TRACKING</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map(
                    (order) => {
                      const isNew =
                        newOrders.some(
                          (item) =>
                            String(
                              item.id
                            ) ===
                            String(
                              order.id
                            )
                        );

                      const awb =
                        getAWB(order);

                      const savedAWB =
                        hasSavedAWB(
                          order
                        );

                      return (
                        <tr
                          key={
                            order.id
                          }
                        >
                          <td
                            className="jc-orders-id"
                          >
                            <strong>
                              #
                              {
                                order.id
                              }
                            </strong>

                            {isNew && (
                              <span
                                style={
                                  styles.newBadge
                                }
                              >
                                NEW
                              </span>
                            )}
                          </td>

                          <td
                            className="jc-orders-customer"
                          >
                            {order.customer_name ||
                              order.full_name ||
                              "Customer"}
                          </td>

                          <td>
                            {order.phone ||
                              "—"}
                          </td>

                          <td
                            className="jc-orders-total"
                          >
                            {money(
                              order.total_amount
                            )}
                          </td>

                          <td>
                            {order.total_items ??
                              "—"}
                          </td>

                          <td>
                            {formatDate(
                              order.created_at
                            )}
                          </td>

                          <td>
                            <select
                              className="jc-orders-status"
                              style={{
                                ...styles.statusSelect,
                                ...statusStyle(
                                  order.status
                                ),
                              }}
                              value={getStatus(
                                order.status
                              )}
                              disabled={
                                updatingId ===
                                order.id
                              }
                              onChange={(
                                event
                              ) =>
                                updateStatus(
                                  order.id,
                                  event
                                    .target
                                    .value
                                )
                              }
                            >
                              {STATUS_OPTIONS.map(
                                (
                                  status
                                ) => (
                                  <option
                                    key={
                                      status
                                    }
                                    value={
                                      status
                                    }
                                  >
                                    {
                                      status
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </td>

                          <td>
                            <div
                              style={
                                styles.awbCell
                              }
                            >
                              <div>
                                <strong
                                  style={
                                    styles.awbText
                                  }
                                >
                                  {
                                    awb
                                  }
                                </strong>

                                <small
                                  style={
                                    styles.awbCaption
                                  }
                                >
                                  {savedAWB
                                    ? "Saved tracking number"
                                    : "Internal demo reference"}
                                </small>
                              </div>

                              <button
                                type="button"
                                title="Copy tracking reference"
                                aria-label={`Copy tracking reference for order ${order.id}`}
                                onClick={() =>
                                  copyAWB(
                                    awb
                                  )
                                }
                                style={
                                  styles.iconButton
                                }
                              >
                                {copiedAWB ===
                                awb ? (
                                  <Check
                                    size={
                                      16
                                    }
                                  />
                                ) : (
                                  <Copy
                                    size={
                                      16
                                    }
                                  />
                                )}
                              </button>
                            </div>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="jc-orders-view-btn"
                              onClick={() =>
                                viewOrder(
                                  order.id
                                )
                              }
                              disabled={
                                detailsLoading
                              }
                            >
                              <Eye
                                size={
                                  16
                                }
                              />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {detailsLoading && (
          <p className="jc-orders-loading">
            Loading order details...
          </p>
        )}

        {/* SELECTED ORDER DETAILS */}

        {selectedOrder && (
          <section
            className="jc-order-details"
            style={styles.detailsPanel}
          >
            <div
              className="jc-order-details-header"
              style={styles.detailsHeader}
            >
              <div>
                <span style={styles.eyebrow}>
                  ORDER DETAILS
                </span>

                <h2
                  style={styles.detailsTitle}
                >
                  <Package size={25} />
                  Order #
                  {selectedOrder.id}
                </h2>

                <span
                  style={{
                    ...styles.statusBadge,
                    ...statusStyle(
                      selectedStatus
                    ),
                  }}
                >
                  {selectedStatus}
                </span>
              </div>

              <button
                type="button"
                className="jc-order-details-close"
                onClick={() =>
                  setSelectedOrder(null)
                }
              >
                <X size={17} />
                Close
              </button>
            </div>

            {/* CUSTOMER AND DELIVERY INFO */}

            <div style={styles.detailsGrid}>
              <div style={styles.detailCard}>
                <h3
                  style={styles.detailCardTitle}
                >
                  <UserRound size={19} />
                  Customer Information
                </h3>

                <div style={styles.infoGrid}>
                  <InfoItem
                    icon={UserRound}
                    label="Customer Name"
                    value={
                      selectedOrder.full_name ||
                      selectedOrder.customer_name
                    }
                  />

                  <InfoItem
                    icon={Phone}
                    label="Phone Number"
                    value={
                      selectedOrder.phone
                    }
                  />

                  <InfoItem
                    icon={CreditCard}
                    label="Payment Method"
                    value={
                      selectedOrder.payment_method
                    }
                  />

                  <InfoItem
                    icon={ShoppingBag}
                    label="Order Total"
                    value={money(
                      selectedOrder.total_amount
                    )}
                  />
                </div>
              </div>

              <div style={styles.detailCard}>
                <h3
                  style={styles.detailCardTitle}
                >
                  <MapPin size={19} />
                  Delivery Information
                </h3>

                <InfoItem
                  icon={MapPin}
                  label="Delivery Address"
                  value={[
                    selectedOrder.address,
                    selectedOrder.city,
                    selectedOrder.state,
                    selectedOrder.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />

                <InfoItem
                  icon={CalendarDays}
                  label="Order Placed"
                  value={formatDate(
                    selectedOrder.created_at
                  )}
                />

                <InfoItem
                  icon={Truck}
                  label="Order Status"
                  value={selectedStatus}
                />
              </div>
            </div>

            {/* TRACKING CARD */}

            <div
              className="jc-tracking-admin"
              style={styles.trackingPanel}
            >
              <div
                style={styles.trackingHeader}
              >
                <div>
                  <h3
                    style={styles.detailCardTitle}
                  >
                    <Truck size={21} />
                    Courier Tracking
                  </h3>

                  <p
                    style={
                      styles.sectionSubtitle
                    }
                  >
                    Save real courier
                    details when your
                    shipment is booked.
                  </p>
                </div>

                <span
                  style={
                    styles.trackingBadge
                  }
                >
                  <Package size={14} />
                  SHIPPING MANAGEMENT
                </span>
              </div>

              <div
                style={styles.awbPreview}
              >
                <span
                  style={styles.awbPreviewLabel}
                >
                  {hasSavedAWB(
                    selectedOrder
                  )
                    ? "Saved Tracking Number"
                    : "Internal Demo Reference"}
                </span>

                <div
                  style={styles.awbPreviewRow}
                >
                  <strong
                    style={
                      styles.awbPreviewValue
                    }
                  >
                    {selectedAWB}
                  </strong>

                  <button
                    type="button"
                    className="jc-orders-view-btn"
                    onClick={() =>
                      copyAWB(
                        selectedAWB
                      )
                    }
                  >
                    {copiedAWB ===
                    selectedAWB ? (
                      <Check size={16} />
                    ) : (
                      <Copy size={16} />
                    )}

                    {copiedAWB ===
                    selectedAWB
                      ? "Copied!"
                      : "Copy"}
                  </button>
                </div>

                <p
                  style={
                    styles.trackingNote
                  }
                >
                  Website Tracking ID:{" "}
                  {getTrackingId(
                    selectedOrder
                  )}
                </p>

                {!hasSavedAWB(
                  selectedOrder
                ) && (
                  <p
                    style={
                      styles.trackingNote
                    }
                  >
                    This demo reference
                    is not a real
                    courier AWB.
                  </p>
                )}
              </div>

              <div
                className="jc-tracking-form"
                style={styles.trackingGrid}
              >
                <label
                  style={
                    styles.fieldLabel
                  }
                >
                  Courier Company

                  <input
                    type="text"
                    maxLength={150}
                    placeholder="e.g. Blue Dart"
                    value={courierName}
                    onChange={(
                      event
                    ) =>
                      setCourierName(
                        event.target.value
                      )
                    }
                    style={
                      styles.fieldInput
                    }
                  />
                </label>

                <label
                  style={
                    styles.fieldLabel
                  }
                >
                  AWB / Tracking Number

                  <input
                    type="text"
                    maxLength={150}
                    placeholder="Enter actual courier tracking number"
                    value={
                      trackingNumber
                    }
                    onChange={(
                      event
                    ) => {
                      setTrackingNumber(
                        event.target.value
                      );
                      setCopiedAWB(
                        ""
                      );
                    }}
                    style={
                      styles.fieldInput
                    }
                  />
                </label>
              </div>

              <div
                style={styles.trackingActions}
              >
                <button
                  type="button"
                  className="jc-orders-save-btn"
                  onClick={saveTracking}
                  disabled={
                    savingTracking
                  }
                >
                  <Save size={17} />

                  {savingTracking
                    ? "Saving..."
                    : "Save Tracking Details"}
                </button>

                <button
                  type="button"
                  className="jc-orders-view-btn"
                  onClick={() =>
                    copyAWB(
                      trackingNumber ||
                        selectedAWB
                    )
                  }
                >
                  <Copy size={16} />
                  Copy Number
                </button>
              </div>
            </div>

            {/* ORDERED PRODUCTS */}

            <div style={styles.productsSection}>
              <h3
                className="jc-order-products-title"
                style={styles.detailCardTitle}
              >
                <Package size={20} />
                Ordered Products
              </h3>

              <div className="jc-orders-table-scroll">
                <table className="jc-orders-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>QUANTITY</th>
                      <th>UNIT PRICE</th>
                      <th>SUBTOTAL</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(selectedOrder.items ||
                      []).map(
                      (item, index) => (
                        <tr
                          key={`${item.product_id}-${index}`}
                        >
                          <td>
                            <strong>
                              {
                                item.product_name
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              item.quantity
                            }
                          </td>

                          <td>
                            {money(
                              item.price
                            )}
                          </td>

                          <td>
                            <strong>
                              {money(
                                Number(
                                  item.price
                                ) *
                                  Number(
                                    item.quantity
                                  )
                              )}
                            </strong>
                          </td>
                        </tr>
                      )
                    )}

                    {(!selectedOrder.items ||
                      selectedOrder.items
                        .length ===
                        0) && (
                      <tr>
                        <td colSpan={4}>
                          No product details
                          available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div
                className="jc-order-details-total"
                style={styles.orderTotal}
              >
                <span>
                  Grand Total
                </span>

                <strong>
                  {money(
                    selectedOrder.total_amount
                  )}
                </strong>
              </div>
            </div>
          </section>
        )}

        <footer style={styles.footer}>
          <Gem size={15} />
          JEWELLERY CART — ORDER CONTROL CENTER
        </footer>
      </div>
    </main>
  );
}

// =====================================
// PREMIUM ADDITIONAL STYLES
// =====================================

const styles = {
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 22,
  },

  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1.8,
    color: "#ac7e44",
  },

  pageTitle: {
    fontFamily: "Georgia, serif",
    fontSize: "clamp(28px, 3vw, 38px)",
    fontWeight: 500,
    color: "#2d201b",
    margin: "10px 0 7px",
  },

  subtitle: {
    fontSize: 14,
    color: "#938578",
  },

  liveLine: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
    color: "#8e7c68",
    fontSize: 12,
  },

  liveDot: {
    width: 8,
    height: 8,
    background: "#3c9a6b",
    borderRadius: "50%",
  },

  banner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    padding: "30px clamp(22px, 4vw, 46px)",
    borderRadius: 20,
    marginBottom: 24,
    background:
      "linear-gradient(115deg, #241b18, #493428)",
    color: "#fff",
    overflow: "hidden",
  },

  bannerContent: {
    maxWidth: 550,
  },

  bannerEyebrow: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 2,
    color: "#d2aa70",
  },

  bannerTitle: {
    fontFamily: "Georgia, serif",
    fontSize: "clamp(23px, 3vw, 32px)",
    fontWeight: 500,
    margin: "12px 0",
    color: "#fff",
  },

  bannerText: {
    fontSize: 13,
    lineHeight: 1.8,
    color: "#e0d2c5",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 18,
    marginBottom: 25,
  },

  statCard: {
    padding: 23,
    border: "1px solid #ece3d9",
    borderRadius: 16,
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 15,
    boxShadow:
      "0 7px 24px rgba(57, 38, 21, 0.025)",
  },

  statTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statIcon: {
    width: 48,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: 13,
  },

  statLabel: {
    color: "#927f6e",
    fontSize: 13,
  },

  statValue: {
    fontSize: 29,
    fontWeight: 700,
    color: "#281c17",
  },

  notification: {
    border: "1px solid #e7c88f",
    borderRadius: 15,
    background: "#fff8eb",
    padding: 20,
    marginBottom: 22,
  },

  notificationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#875b21",
  },

  textButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "#875b21",
    textDecoration: "underline",
  },

  newOrderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    borderTop: "1px solid #eedbb8",
    paddingTop: 13,
    marginTop: 13,
  },

  feedback: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },

  panel: {
    background: "#fff",
    border: "1px solid #ece2d8",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 25,
  },

  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    padding: "23px 25px",
  },

  sectionTitle: {
    fontFamily: "Georgia, serif",
    fontSize: 23,
    fontWeight: 500,
    color: "#2f211b",
  },

  sectionSubtitle: {
    fontSize: 12,
    color: "#968574",
    marginTop: 7,
  },

  filters: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  selectWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #eadfd2",
    borderRadius: 9,
    background: "#fff",
    padding: "0 11px",
    color: "#977449",
  },

  filterSelect: {
    border: "none",
    outline: "none",
    background: "transparent",
    color: "#554335",
    fontSize: 12,
    padding: "11px 3px",
    cursor: "pointer",
  },

  statusSelect: {
    padding: "8px 9px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid transparent",
    cursor: "pointer",
  },

  newBadge: {
    display: "inline-block",
    marginLeft: 7,
    color: "#ad7b35",
    fontSize: 10,
    fontWeight: 800,
  },

  awbCell: {
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  awbText: {
    fontSize: 12,
    color: "#825e33",
    whiteSpace: "nowrap",
  },

  awbCaption: {
    display: "block",
    fontSize: 10,
    color: "#a29281",
    marginTop: 4,
  },

  iconButton: {
    width: 32,
    height: 32,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    border: "1px solid #ead8bf",
    borderRadius: 8,
    background: "#fff9f1",
    color: "#825e33",
    cursor: "pointer",
  },

  detailsPanel: {
    border: "1px solid #e9ddcf",
    borderRadius: 18,
    background: "#fff",
    padding: "clamp(18px, 3vw, 30px)",
    marginBottom: 25,
  },

  detailsHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 15,
    marginBottom: 25,
  },

  detailsTitle: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontFamily: "Georgia, serif",
    fontSize: 28,
    fontWeight: 500,
    color: "#30221b",
    margin: "10px 0",
  },

  statusBadge: {
    display: "inline-flex",
    borderRadius: 20,
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 700,
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 290px), 1fr))",
    gap: 18,
    marginBottom: 22,
  },

  detailCard: {
    background: "#fcfaf7",
    border: "1px solid #eee5dc",
    borderRadius: 14,
    padding: 21,
  },

  detailCardTitle: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontFamily: "Georgia, serif",
    fontSize: 20,
    fontWeight: 500,
    color: "#35251e",
    marginBottom: 19,
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 17,
  },

  infoItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 15,
  },

  infoIcon: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: 9,
    background: "#f5eadc",
    color: "#a17a4b",
  },

  infoText: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    minWidth: 0,
    overflowWrap: "anywhere",
    fontSize: 12,
    color: "#988674",
  },

  trackingPanel: {
    background: "#faf7f2",
    border: "1px solid #ebddca",
    borderRadius: 15,
    padding: "clamp(16px, 3vw, 24px)",
    marginBottom: 26,
  },

  trackingHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 15,
  },

  trackingBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 11px",
    background: "#efe2ce",
    color: "#946c39",
    borderRadius: 20,
    fontSize: 10,
    fontWeight: 800,
  },

  awbPreview: {
    padding: 19,
    background: "#fff",
    border: "1px solid #e9d9c4",
    borderRadius: 12,
    margin: "18px 0",
  },

  awbPreviewLabel: {
    display: "block",
    fontSize: 12,
    color: "#977c5c",
    marginBottom: 10,
  },

  awbPreviewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },

  awbPreviewValue: {
    fontSize: "clamp(17px, 2vw, 23px)",
    letterSpacing: 0.6,
    color: "#34241b",
    overflowWrap: "anywhere",
  },

  trackingNote: {
    marginTop: 10,
    color: "#93816d",
    fontSize: 12,
  },

  trackingGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
    gap: 15,
  },

  fieldLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    fontSize: 12,
    fontWeight: 700,
    color: "#715841",
  },

  fieldInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #e5d8c8",
    borderRadius: 9,
    background: "#fff",
    padding: "13px 14px",
    outlineColor: "#b38a53",
    fontSize: 13,
    color: "#392b22",
  },

  trackingActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },

  productsSection: {
    marginTop: 24,
  },

  orderTotal: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 20,
    padding: "20px 0",
    color: "#33241d",
  },

  footer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    color: "#aa9580",
    fontSize: 11,
    letterSpacing: 1,
    padding: "20px 0 30px",
  },
};
