
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee,
  ShoppingBag,
  Package,
  Users,
  TrendingUp,
  Clock3,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Search,
  Gem,
  CalendarDays,
  BarChart3,
  ShieldCheck,
  CreditCard,
  Award,
  Activity,
} from "lucide-react";

import "./AdminDashboard.css";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const money = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const number = (value) =>
  Number(value ?? 0).toLocaleString("en-IN");

function getAdminToken() {
  return (
    sessionStorage.getItem("jc_admin_token") ||
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    ""
  );
}

async function apiRequest(path, signal) {
  const token = getAdminToken();

  if (!token) {
    throw new Error("Admin login required. Please login again.");
  }

  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal,
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.message || `API request failed (${response.status})`
    );
  }

  return data;
}

function getOrderTotal(order) {
  const raw =
    order.total_amount ??
    order.total ??
    order.grand_total ??
    order.total_price;

  if (raw == null || raw === "") return null;

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getOrderDate(order) {
  const raw =
    order.created_at ||
    order.order_date ||
    order.createdAt;

  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getStatus(order) {
  return String(
    order.order_status || order.status || "Unknown"
  ).toLowerCase();
}

function statusClass(status) {
  if (["delivered", "completed", "paid"].includes(status)) {
    return "success";
  }

  if (["cancelled", "canceled", "failed"].includes(status)) {
    return "danger";
  }

  if (
    ["pending", "processing", "confirmed"].includes(status)
  ) {
    return "pending";
  }

  return "neutral";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  note,
  tone = "gold",
}) {
  return (
    <article className="ad-metric-card">
      <div className="ad-metric-top">
        <span className={`ad-metric-icon ${tone}`}>
          <Icon size={21} />
        </span>
        <ArrowUpRight size={17} className="ad-muted" />
      </div>

      <span className="ad-metric-label">{label}</span>
      <strong className="ad-metric-value">{value}</strong>
      <span className="ad-metric-note">{note}</span>
    </article>
  );
}

// =======================================
// PREMIUM BAR CHART
// =======================================

function SalesChart({ data, type = "daily" }) {
  const [hovered, setHovered] = useState(null);

  const rows = Array.isArray(data) ? data : [];

  const maxRevenue = Math.max(
    1,
    ...rows.map((item) => Number(item.revenue || 0))
  );

  if (!rows.length) {
    return (
      <div style={styles.empty}>
        No sales analytics available.
      </div>
    );
  }

  return (
    <div>
      <div style={styles.chartSummary}>
        <span>
          <span style={styles.legendDot} />
          Verified Test Revenue
        </span>
        <strong>
          {money(
            rows.reduce(
              (sum, item) => sum + Number(item.revenue || 0),
              0
            )
          )}
        </strong>
      </div>

      <div style={styles.chart}>
        {rows.map((item, index) => {
          const revenue = Number(item.revenue || 0);
          const height =
            revenue > 0
              ? Math.max(5, (revenue / maxRevenue) * 100)
              : 2;

          const label =
            type === "monthly"
              ? item.month
              : item.date;

          const showLabel =
            type === "monthly" ||
            index % 5 === 0 ||
            index === rows.length - 1;

          return (
            <div
              key={`${label}-${index}`}
              style={styles.barColumn}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              title={`${label}: ${money(revenue)} • ${
                item.orders || 0
              } orders`}
            >
              {hovered === index && (
                <div style={styles.tooltip}>
                  <strong>{label}</strong>
                  <span>{money(revenue)}</span>
                  <small>{item.orders || 0} paid orders</small>
                </div>
              )}

              <div style={styles.barTrack}>
                <div
                  style={{
                    ...styles.bar,
                    height: `${height}%`,
                    opacity: hovered === index ? 1 : 0.82,
                  }}
                />
              </div>

              <small style={styles.axisLabel}>
                {showLabel
                  ? type === "monthly"
                    ? label?.slice(5)
                    : label?.slice(8)
                  : ""}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =======================================
// TOP SELLING PRODUCTS
// =======================================

function TopProducts({ products }) {
  if (!Array.isArray(products) || !products.length) {
    return (
      <div style={styles.empty}>
        No paid product sales recorded yet.
      </div>
    );
  }

  const maxUnits = Math.max(
    1,
    ...products.map((product) =>
      Number(product.units_sold || 0)
    )
  );

  return (
    <div style={styles.productList}>
      {products.map((product, index) => (
        <div
          key={`${product.product_id}-${index}`}
          style={styles.productRow}
        >
          <span style={styles.rank}>
            {String(index + 1).padStart(2, "0")}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.productHeading}>
              <strong style={styles.productName}>
                {product.name}
              </strong>
              <span>
                {number(product.units_sold)} sold
              </span>
            </div>

            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${
                    (Number(product.units_sold || 0) /
                      maxUnits) *
                    100
                  }%`,
                }}
              />
            </div>

            <small style={styles.productRevenue}>
              {money(product.sales_amount)} sales
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

// =======================================
// MAIN DASHBOARD
// =======================================

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [chartType, setChartType] = useState("daily");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setErrors({});

      const requests = [
        {
          key: "dashboard",
          path: "/api/admin/dashboard",
        },
        {
          key: "orders",
          path: "/api/admin/orders",
        },
        {
          key: "analytics",
          path: "/api/admin/analytics",
        },
      ];

      const results = await Promise.allSettled(
        requests.map((request) =>
          apiRequest(request.path, controller.signal)
        )
      );

      if (controller.signal.aborted) return;

      const nextErrors = {};

      results.forEach((result, index) => {
        const key = requests[index].key;

        if (result.status === "rejected") {
          nextErrors[key] =
            result.reason?.message || "Unable to load data.";

          if (key === "dashboard") setDashboard(null);
          if (key === "orders") setOrders(null);
          if (key === "analytics") setAnalytics(null);

          return;
        }

        const data = result.value;

        if (key === "dashboard") {
          setDashboard(data);
        }

        if (key === "orders") {
          if (Array.isArray(data.orders)) {
            setOrders(data.orders);
          } else {
            setOrders(null);
            nextErrors.orders =
              "Orders API did not return an orders list.";
          }
        }

        if (key === "analytics") {
          if (data.summary && Array.isArray(data.daily_sales)) {
            setAnalytics(data);
          } else {
            setAnalytics(null);
            nextErrors.analytics =
              "Analytics API returned incomplete data.";
          }
        }
      });

      setErrors(nextErrors);
      setLoading(false);
    }

    loadDashboard();

    return () => controller.abort();
  }, [reloadKey]);

  const dbStats = dashboard?.stats ?? null;
  const summary = analytics?.summary ?? null;

  const periodOrders = useMemo(() => {
    if (!orders) return null;
    if (period === "all") return orders;

    const now = new Date();
    const days = Number(period);

    const cutoff = new Date(
      now.getTime() - days * 24 * 60 * 60 * 1000
    );

    return orders.filter((order) => {
      const date = getOrderDate(order);
      return date && date >= cutoff && date <= now;
    });
  }, [orders, period]);

  const orderStats = useMemo(() => {
    if (!periodOrders) return null;

    return {
      orders: periodOrders.length,

      pending: periodOrders.filter((order) =>
        ["pending", "processing", "confirmed"].includes(
          getStatus(order)
        )
      ).length,

      delivered: periodOrders.filter(
        (order) => getStatus(order) === "delivered"
      ).length,
    };
  }, [periodOrders]);

  const recentOrders = useMemo(() => {
    const source = periodOrders
      ? [...periodOrders]
      : period === "all" &&
          Array.isArray(dashboard?.recent_orders)
        ? [...dashboard.recent_orders]
        : [];

    return source
      .filter((order) => {
        const text = [
          order.id,
          order.order_number,
          order.customer_name,
          order.name,
          order.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(search.toLowerCase());
      })
      .sort(
        (a, b) =>
          (getOrderDate(b)?.getTime() || 0) -
          (getOrderDate(a)?.getTime() || 0)
      )
      .slice(0, 8);
  }, [periodOrders, dashboard, search, period]);

  const totalOrders =
    period === "all"
      ? dbStats?.orders ?? orderStats?.orders
      : orderStats?.orders;

  const pendingOrders =
    period === "all"
      ? orderStats?.pending ?? dbStats?.pending_orders
      : orderStats?.pending;

  const deliveredOrders =
    period === "all"
      ? orderStats?.delivered ?? dbStats?.delivered_orders
      : orderStats?.delivered;

  const totalProducts = dbStats?.products ?? null;
  const totalCustomers = dbStats?.customers ?? null;
  const lowStockCount = dbStats?.low_stock_products ?? null;

  const paidRevenue =
    period === "7"
      ? summary?.revenue_last_7_days
      : period === "30"
      ? summary?.revenue_last_30_days
      : summary?.total_revenue ?? dbStats?.paid_revenue;

  const paidOrders =
    period === "7"
      ? summary?.orders_last_7_days
      : period === "30"
      ? summary?.orders_last_30_days
      : summary?.paid_orders ?? dbStats?.paid_orders;

  const averageOrderValue =
    summary?.average_order_value ?? null;

  const hasErrors = Object.keys(errors).length > 0;

  const chartData =
    chartType === "daily"
      ? analytics?.daily_sales
      : analytics?.monthly_sales;

  return (
    <div className="ad-dashboard">
      {/* PAGE HEADING */}
      <div className="ad-page-heading">
        <div>
          <div className="ad-eyebrow">
            <Gem size={16} />
            JEWELLERY CART ADMIN
          </div>

          <h1>Dashboard Overview</h1>
          <p>
            Manage your jewellery store from one place.
          </p>
        </div>

        <div className="ad-heading-actions">
          <button
            type="button"
            className="ad-refresh-button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className={loading ? "ad-spinning" : ""}
            />
            Refresh
          </button>

          <Link
            to="/admin/products"
            className="ad-primary-button"
          >
            <Package size={17} />
            Manage Products
          </Link>
        </div>
      </div>

      {/* WELCOME BANNER */}
      <section className="ad-welcome-banner">
        <div>
          <span>YOUR STORE CONTROL CENTER</span>

          <h2>
            Every detail, beautifully managed.
          </h2>

          <p>
            View sales analytics, review orders,
            and manage your growing collection.
          </p>

          <Link to="/admin/orders">
            VIEW ALL ORDERS
            <ArrowRight size={17} />
          </Link>
        </div>

        <div className="ad-banner-art">
          <Gem size={120} strokeWidth={0.7} />
        </div>
      </section>

      {/* STORE PERFORMANCE */}
      <div className="ad-section-heading">
        <div>
          <h2>Store Performance</h2>
          <p>
            {period === "all"
              ? "All available order records"
              : `Last ${period} days`}
          </p>
        </div>

        <div className="ad-period-picker">
          <CalendarDays size={17} />

          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="all">All Time</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="ad-metrics-grid">
        <MetricCard
          icon={IndianRupee}
          label="Paid Revenue"
          value={
            paidRevenue != null
              ? money(paidRevenue)
              : "—"
          }
          note={
            paidRevenue != null
              ? "Verified Razorpay Test Payments"
              : "Awaiting payment analytics"
          }
        />

        <MetricCard
          icon={ShoppingBag}
          label="Total Orders"
          value={
            totalOrders != null
              ? number(totalOrders)
              : "—"
          }
          note="Orders in selected period"
          tone="purple"
        />

        <MetricCard
          icon={Package}
          label="Total Products"
          value={
            totalProducts != null
              ? number(totalProducts)
              : "—"
          }
          note="All products in database"
          tone="blue"
        />

        <MetricCard
          icon={Users}
          label="Total Customers"
          value={
            totalCustomers != null
              ? number(totalCustomers)
              : "—"
          }
          note="Registered customers"
          tone="green"
        />
      </div>

      {/* API WARNINGS */}
      {hasErrors && (
        <div className="ad-api-warning">
          <AlertCircle size={19} />

          <div>
            <strong>
              Some dashboard data is unavailable
            </strong>

            <p>
              {Object.entries(errors)
                .map(
                  ([key, message]) =>
                    `${key}: ${message}`
                )
                .join(" • ")}
            </p>

            <p>
              Check backend API, admin login and database connection.
            </p>
          </div>
        </div>
      )}

      {/* ADVANCED SALES ANALYTICS */}
      <section style={styles.analyticsSection}>
        <div className="ad-section-heading">
          <div>
            <h2>Sales Analytics</h2>
            <p>
              Revenue performance from verified test payments
            </p>
          </div>

          <span style={styles.testBadge}>
            <CreditCard size={14} />
            RAZORPAY TEST MODE
          </span>
        </div>

        <div style={styles.miniMetrics}>
          <div style={styles.miniCard}>
            <span style={styles.miniIcon}>
              <CheckCircle2 size={21} />
            </span>

            <span>Successful Payments</span>

            <strong>
              {paidOrders != null
                ? number(paidOrders)
                : "—"}
            </strong>

            <small>Selected period</small>
          </div>

          <div style={styles.miniCard}>
            <span style={styles.miniIcon}>
              <TrendingUp size={21} />
            </span>

            <span>Average Order Value</span>

            <strong>
              {averageOrderValue != null
                ? money(averageOrderValue)
                : "—"}
            </strong>

            <small>All-time paid orders</small>
          </div>

          <div style={styles.miniCard}>
            <span style={styles.miniIcon}>
              <Activity size={21} />
            </span>

            <span>Last 7 Days Revenue</span>

            <strong>
              {summary
                ? money(summary.revenue_last_7_days)
                : "—"}
            </strong>

            <small>Verified test revenue</small>
          </div>

          <div style={styles.miniCard}>
            <span style={styles.miniIcon}>
              <Award size={21} />
            </span>

            <span>Last 30 Days Revenue</span>

            <strong>
              {summary
                ? money(summary.revenue_last_30_days)
                : "—"}
            </strong>

            <small>Verified test revenue</small>
          </div>
        </div>

        <div style={styles.analyticsGrid}>
          {/* REVENUE GRAPH */}
          <section className="ad-panel">
            <div className="ad-panel-heading">
              <div>
                <h3>Revenue Overview</h3>
                <p>
                  {chartType === "daily"
                    ? "Last 30 calendar days"
                    : "Last 12 calendar months"}
                </p>
              </div>

              <BarChart3 size={21} />
            </div>

            <div style={styles.chartButtons}>
              <button
                type="button"
                onClick={() => setChartType("daily")}
                style={{
                  ...styles.chartButton,
                  ...(chartType === "daily"
                    ? styles.activeChartButton
                    : {}),
                }}
              >
                Daily
              </button>

              <button
                type="button"
                onClick={() => setChartType("monthly")}
                style={{
                  ...styles.chartButton,
                  ...(chartType === "monthly"
                    ? styles.activeChartButton
                    : {}),
                }}
              >
                Monthly
              </button>
            </div>

            {loading ? (
              <div style={styles.empty}>
                Loading sales chart...
              </div>
            ) : (
              <SalesChart
                data={chartData}
                type={chartType}
              />
            )}
          </section>

          {/* TOP PRODUCTS */}
          <section className="ad-panel">
            <div className="ad-panel-heading">
              <div>
                <h3>Top Selling Jewellery</h3>
                <p>
                  Top 5 products from paid orders
                </p>
              </div>

              <Award size={21} />
            </div>

            {loading ? (
              <div style={styles.empty}>
                Loading products...
              </div>
            ) : (
              <TopProducts
                products={analytics?.top_products}
              />
            )}
          </section>
        </div>
      </section>

      {/* ORDER INSIGHTS AND QUICK MANAGEMENT */}
      <div className="ad-insights-grid">
        <section className="ad-panel">
          <div className="ad-panel-heading">
            <div>
              <h3>Order Insights</h3>
              <p>Current order status summary</p>
            </div>

            <BarChart3 size={21} />
          </div>

          <div className="ad-insight-list">
            <div className="ad-insight-item">
              <span className="ad-insight-symbol amber">
                <Clock3 size={20} />
              </span>

              <div>
                <span>Pending / Processing</span>
                <strong>
                  {pendingOrders != null
                    ? number(pendingOrders)
                    : "—"}
                </strong>
              </div>
            </div>

            <div className="ad-insight-item">
              <span className="ad-insight-symbol green">
                <CheckCircle2 size={20} />
              </span>

              <div>
                <span>Delivered Orders</span>
                <strong>
                  {deliveredOrders != null
                    ? number(deliveredOrders)
                    : "—"}
                </strong>
              </div>
            </div>

            <div className="ad-insight-item">
              <span className="ad-insight-symbol rose">
                <AlertCircle size={20} />
              </span>

              <div>
                <span>Low Stock Products</span>
                <strong>
                  {lowStockCount != null
                    ? number(lowStockCount)
                    : "—"}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="ad-panel">
          <div className="ad-panel-heading">
            <div>
              <h3>Quick Management</h3>
              <p>Access your store tools</p>
            </div>

            <TrendingUp size={21} />
          </div>

          <div className="ad-quick-links">
            <Link to="/admin/products">
              <Package size={19} />
              <span>Manage Products</span>
              <ArrowUpRight size={17} />
            </Link>

            <Link to="/admin/orders">
              <ShoppingBag size={19} />
              <span>Manage Orders</span>
              <ArrowUpRight size={17} />
            </Link>

            <Link to="/admin/customers">
              <Users size={19} />
              <span>View Customers</span>
              <ArrowUpRight size={17} />
            </Link>

            <Link to="/">
              <ShieldCheck size={19} />
              <span>View Storefront</span>
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      </div>

      {/* RECENT ORDERS */}
      <section className="ad-panel ad-orders-panel">
        <div className="ad-panel-heading ad-orders-heading">
          <div>
            <h3>Recent Orders</h3>
            <p>Latest customer orders</p>
          </div>

          <div className="ad-orders-actions">
            <div className="ad-table-search">
              <Search size={17} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search orders..."
              />
            </div>

            <Link to="/admin/orders">
              View All
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="ad-table-scroll">
          <table className="ad-orders-table">
            <thead>
              <tr>
                <th>ORDER</th>
                <th>CUSTOMER</th>
                <th>DATE</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan="5"
                    className="ad-empty-table"
                  >
                    Loading dashboard...
                  </td>
                </tr>
              )}

              {!loading &&
                recentOrders.map((order, index) => {
                  const status = getStatus(order);
                  const date = getOrderDate(order);
                  const amount = getOrderTotal(order);

                  return (
                    <tr key={order.id ?? index}>
                      <td>
                        <strong>
                          #
                          {order.order_number ||
                            order.id ||
                            "—"}
                        </strong>
                      </td>

                      <td>
                        {order.customer_name ||
                          order.name ||
                          order.email ||
                          "Customer"}
                      </td>

                      <td>
                        {date
                          ? date.toLocaleDateString("en-IN")
                          : "—"}
                      </td>

                      <td>
                        {amount != null
                          ? money(amount)
                          : "—"}
                      </td>

                      <td>
                        <span
                          className={`ad-status ${statusClass(
                            status
                          )}`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              {!loading && recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    className="ad-empty-table"
                  >
                    {orders ||
                    (period === "all" &&
                      Array.isArray(dashboard?.recent_orders))
                      ? "No matching orders found."
                      : "Orders are not available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FOOTER */}
      <div className="ad-dashboard-footer">
        <Gem size={16} />
        JEWELLERY CART — ADMIN CONTROL CENTER
      </div>
    </div>
  );
}

// =======================================
// ADDITIONAL ANALYTICS STYLES
// =======================================

const styles = {
  analyticsSection: {
    marginTop: 34,
    marginBottom: 30,
  },

  testBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 13px",
    borderRadius: 20,
    background: "#f5ecdf",
    color: "#8c6534",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
  },

  miniMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 16,
    marginTop: 20,
    marginBottom: 22,
  },

  miniCard: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: 22,
    borderRadius: 16,
    background: "#fff",
    border: "1px solid #eee4d9",
    boxShadow: "0 6px 24px rgba(60, 36, 16, 0.025)",
  },

  miniIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "#f5ecdf",
    color: "#a7793d",
  },

  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 350px), 1fr))",
    gap: 22,
  },

  chartSummary: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 20,
    marginBottom: 16,
    fontSize: 13,
    color: "#897969",
  },

  legendDot: {
    display: "inline-block",
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "#b88b51",
    marginRight: 8,
  },

  chart: {
    display: "flex",
    alignItems: "stretch",
    gap: 5,
    height: 260,
    width: "100%",
    marginTop: 20,
  },

  barColumn: {
    position: "relative",
    flex: "1 1 0",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },

  barTrack: {
    flex: 1,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    width: "100%",
    borderBottom: "1px solid #e7ded4",
  },

  bar: {
    width: "70%",
    maxWidth: 30,
    minHeight: 2,
    background: "linear-gradient(180deg, #d8b57c, #a97739)",
    borderRadius: "5px 5px 0 0",
    transition: "height 0.3s ease, opacity 0.2s ease",
  },

  axisLabel: {
    display: "block",
    height: 24,
    paddingTop: 8,
    fontSize: 9,
    color: "#9b8b7b",
  },

  tooltip: {
    position: "absolute",
    zIndex: 5,
    bottom: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 110,
    padding: 10,
    background: "#2a1d18",
    color: "#fff",
    borderRadius: 8,
    fontSize: 11,
    pointerEvents: "none",
    whiteSpace: "nowrap",
  },

  chartButtons: {
    display: "flex",
    gap: 8,
    marginTop: 14,
  },

  chartButton: {
    padding: "9px 16px",
    border: "1px solid #e9dfd4",
    borderRadius: 9,
    background: "#fff",
    color: "#786454",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  activeChartButton: {
    background: "#a77d49",
    borderColor: "#a77d49",
    color: "#fff",
  },

  productList: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
    marginTop: 22,
  },

  productRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },

  rank: {
    display: "grid",
    placeItems: "center",
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: 10,
    background: "#f6ede1",
    color: "#a57945",
    fontWeight: 700,
    fontSize: 13,
  },

  productHeading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
    fontSize: 12,
  },

  productName: {
    color: "#392b23",
    overflowWrap: "anywhere",
  },

  progressTrack: {
    width: "100%",
    height: 7,
    borderRadius: 10,
    background: "#f3eee8",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 10,
    background: "linear-gradient(90deg, #b98d55, #dfc69f)",
  },

  productRevenue: {
    display: "block",
    marginTop: 7,
    color: "#9a8775",
  },

  empty: {
    padding: "55px 15px",
    textAlign: "center",
    color: "#a29486",
    fontSize: 13,
  },
};
