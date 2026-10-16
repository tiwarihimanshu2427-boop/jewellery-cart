
import { useEffect, useState } from "react";
import {
  Users,
  Search,
  Eye,
  X,
  ShoppingBag,
  RefreshCw
} from "lucide-react";

import "./AdminCustomers.css";

const API = "http://localhost:5000";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const token = sessionStorage.getItem("jc_admin_token");

  const money = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN")}`;

  async function loadCustomers() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/admin/customers`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load customers");
      }

      setCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function viewCustomer(customer) {
    setSelected(customer);
    setOrders([]);
    setDetailsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/admin/customers/${customer.id}/orders`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load order history");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailsLoading(false);
    }
  }

  const filtered = customers.filter((customer) => {
    const text = `${customer.name || ""} ${customer.email || ""}`;
    return text.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <main className="jc-customers-page">
      <div className="jc-customers-container">
        <div className="jc-customers-header">
          <div>
            <span className="jc-customers-eyebrow">
              JEWELLERY CART ADMIN
            </span>
            <h1>Customer Management</h1>
            <p>View registered customers and their orders.</p>
          </div>

          <button
            type="button"
            className="jc-customers-refresh"
            onClick={loadCustomers}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        </div>

        <div className="jc-customers-stats">
          <Users size={30} />
          <div>
            <span>Total Registered Customers</span>
            <strong>{customers.length}</strong>
          </div>
        </div>

        <div className="jc-customers-card">
          <div className="jc-customers-toolbar">
            <h2>All Customers</h2>

            <div className="jc-customers-search">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="jc-customers-error">{error}</p>}

          {loading ? (
            <p className="jc-customers-message">
              Loading customers...
            </p>
          ) : filtered.length === 0 ? (
            <p className="jc-customers-message">
              No customers found.
            </p>
          ) : (
            <div className="jc-customers-table-scroll">
              <table className="jc-customers-table">
                <thead>
                  <tr>
                    <th>Customer ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Orders</th>
                    <th>Total Spent</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((customer) => (
                    <tr key={customer.id}>
                      <td>#{customer.id}</td>
                      <td className="jc-customers-name">
                        {customer.name}
                      </td>
                      <td>{customer.email}</td>
                      <td>{customer.total_orders}</td>
                      <td>{money(customer.total_spent)}</td>
                      <td>
                        <button
                          type="button"
                          className="jc-customers-view"
                          onClick={() => viewCustomer(customer)}
                        >
                          <Eye size={16} />
                          View Orders
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <div className="jc-customer-details">
            <div className="jc-customer-details-header">
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.email}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close customer details"
              >
                <X size={20} />
              </button>
            </div>

            <h3>
              <ShoppingBag size={19} />
              Order History
            </h3>

            {detailsLoading ? (
              <p>Loading order history...</p>
            ) : orders.length === 0 ? (
              <p>No orders placed yet.</p>
            ) : (
              <div className="jc-customers-table-scroll">
                <table className="jc-customers-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>{money(order.total_amount)}</td>
                        <td>{order.status}</td>
                        <td>
                          {new Date(order.created_at)
                            .toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
