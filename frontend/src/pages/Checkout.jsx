
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  LockKeyhole,
  MapPin,
  ShoppingBag,
  LoaderCircle,
  CheckCircle2,
  Banknote,
  Smartphone,
  CreditCard,
  ShieldCheck
} from "lucide-react";

import "./Checkout.css";

const API = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const PAYMENT_OPTIONS = [
  {
    id: "COD",
    title: "Cash on Delivery",
    description: "Pay when your order arrives.",
    icon: Banknote
  },
  {
    id: "UPI",
    title: "UPI Payment",
    description: "Pay using Razorpay Test Mode.",
    icon: Smartphone
  },
  {
    id: "CARD",
    title: "Debit / Credit Card",
    description: "Pay using Razorpay Test Mode.",
    icon: CreditCard
  }
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

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[data-razorpay-checkout="true"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), {
        once: true
      });
      existing.addEventListener(
        "error",
        () => reject(new Error("Razorpay could not load.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";

    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Razorpay could not load."));

    document.body.appendChild(script);
  });
}

async function apiPost(path, payload, token) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "Something went wrong."
    );
  }

  return data;
}

export default function Checkout() {
  const navigate = useNavigate();
  const submittingRef = useRef(false);

  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });

  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);

  useEffect(() => {
    try {
      const items = JSON.parse(
        localStorage.getItem("cart") || "[]"
      );

      setCart(Array.isArray(items) ? items : []);
    } catch {
      setCart([]);
    }

    try {
      const user = JSON.parse(
        localStorage.getItem("user") || "null"
      );

      if (user?.name) {
        setForm((prev) => ({
          ...prev,
          full_name: user.name
        }));
      }
    } catch {
      // Ignore invalid saved user data.
    }
  }, []);

  useEffect(() => {
    const pin = form.pincode.trim();

    setPinError("");
    setPinSuccess(false);

    if (!/^\d{6}$/.test(pin)) {
      setPinLoading(false);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setPinLoading(true);

      try {
        const response = await fetch(
          `https://api.postalpincode.in/pincode/${pin}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("PIN service unavailable.");
        }

        const data = await response.json();
        const result = data?.[0];

        if (
          result?.Status !== "Success" ||
          !Array.isArray(result.PostOffice) ||
          !result.PostOffice.length
        ) {
          setPinError(
            "Invalid PIN Code. Please check and try again."
          );

          setForm((prev) =>
            prev.pincode === pin
              ? { ...prev, city: "", state: "" }
              : prev
          );

          return;
        }

        const office = result.PostOffice[0];

        setForm((prev) =>
          prev.pincode === pin
            ? {
                ...prev,
                city: office.District || "",
                state: office.State || ""
              }
            : prev
        );

        setPinSuccess(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          setPinError(
            "Could not detect location. Enter city and state manually."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setPinLoading(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.pincode]);

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        Number(item.quantity || 1),
    0
  );

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "pincode") {
      setPinError("");
      setPinSuccess(false);

      setForm((prev) => ({
        ...prev,
        pincode: value.replace(/\D/g, "").slice(0, 6),
        city: "",
        state: ""
      }));

      return;
    }

    if (name === "phone") {
      setForm((prev) => ({
        ...prev,
        phone: value.replace(/\D/g, "").slice(0, 10)
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value
    }));
  }

  function finishOrder(order) {
    if (!order?.id) {
      throw new Error("Order ID missing.");
    }

    localStorage.removeItem("cart");
    window.dispatchEvent(new Event("cartUpdated"));

    navigate(`/order-success/${order.id}`, {
      replace: true
    });
  }

  async function handleOnlinePayment(payload, token) {
    await loadRazorpayScript();

    const created = await apiPost(
      "/api/payments/create-order",
      payload,
      token
    );

    if (
      !created.key?.startsWith("rzp_test_") ||
      !created.order?.id
    ) {
      throw new Error(
        "Razorpay Test Mode is not configured correctly."
      );
    }

    // The server calculates the final amount.
    const razorpayOrder = created.order;

    return new Promise((resolve, reject) => {
      let verificationStarted = false;

      const checkout = new window.Razorpay({
        key: created.key,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: "JEWELLERY CART",
        description: "Test Mode Payment",
        order_id: razorpayOrder.id,

        prefill: {
          name: form.full_name,
          contact: form.phone
        },

        notes: {
          mode: "TEST"
        },

        theme: {
          color: "#8b5e3c"
        },

        modal: {
          ondismiss: () => {
            if (!verificationStarted) {
              reject(
                new Error(
                  "Payment window closed. No order was confirmed."
                )
              );
            }
          }
        },

        handler: async (response) => {
          verificationStarted = true;

          try {
            const verified = await apiPost(
              "/api/payments/verify",
              {
                razorpay_order_id:
                  response.razorpay_order_id,
                razorpay_payment_id:
                  response.razorpay_payment_id,
                razorpay_signature:
                  response.razorpay_signature
              },
              token
            );

            resolve(verified.order);
          } catch (err) {
            reject(
              new Error(
                `${err.message} If payment succeeded, do not pay again. Contact support with your Razorpay payment ID.`
              )
            );
          }
        }
      });

      checkout.on("payment.failed", (response) => {
        reject(
          new Error(
            response?.error?.description ||
              "Test payment failed. Please try again."
          )
        );
      });

      try {
        checkout.open();
      } catch (err) {
        reject(err);
      }
    });
  }

  async function placeOrder(event) {
    event.preventDefault();

    if (submittingRef.current) return;

    setError("");

    if (!cart.length) {
      setError("Your cart is empty.");
      return;
    }

    if (
      !form.full_name.trim() ||
      !form.address.trim() ||
      !form.city.trim() ||
      !form.state.trim()
    ) {
      setError("Please complete all delivery details.");
      return;
    }

    if (!/^\d{10}$/.test(form.phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    if (!/^\d{6}$/.test(form.pincode)) {
      setError("Enter a valid 6-digit PIN Code.");
      return;
    }

    const token = getToken();

    if (!token) {
      navigate("/login", {
        state: { from: "/checkout" }
      });
      return;
    }

    const payload = {
      ...form,
      payment_method: paymentMethod,
      items: cart.map((item) => ({
        id: item.id ?? item.product_id,
        quantity: Number(item.quantity || 1)
      }))
    };

    submittingRef.current = true;
    setLoading(true);

    try {
      if (paymentMethod === "COD") {
        const data = await apiPost(
          "/api/orders",
          payload,
          token
        );

        finishOrder(data.order);
      } else {
        const order = await handleOnlinePayment(
          payload,
          token
        );

        finishOrder(order);
      }
    } catch (err) {
      setError(
        err.message || "Something went wrong."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="checkout-page">
      <div className="checkout-container">
        <Link to="/cart" className="checkout-back">
          <ArrowLeft size={17} />
          Back to Cart
        </Link>

        <div className="checkout-heading">
          <span>
            JEWELLERY CART • SECURE CHECKOUT
          </span>

          <h1>Complete Your Order</h1>

          <p>
            A beautiful piece of jewellery is almost yours.
          </p>
        </div>

        <div className="checkout-layout">
          <form
            className="checkout-card"
            onSubmit={placeOrder}
          >
            <h2>
              <MapPin size={23} />
              Delivery Details
            </h2>

            {error && (
              <p
                className="checkout-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="checkout-fields">
              <label className="checkout-full">
                Full Name
                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  required
                  maxLength={150}
                  placeholder="Enter your full name"
                  autoComplete="name"
                />
              </label>

              <label className="checkout-full">
                Mobile Number
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                />
              </label>

              <label className="checkout-full">
                Complete Address
                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  required
                  rows={3}
                  placeholder="House number, street, area, landmark"
                  autoComplete="street-address"
                />
              </label>

              <label className="checkout-full">
                PIN Code

                <div className="checkout-pin-wrapper">
                  <input
                    name="pincode"
                    type="text"
                    value={form.pincode}
                    onChange={handleChange}
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="Enter 6-digit PIN Code"
                    autoComplete="postal-code"
                  />

                  {pinLoading && (
                    <LoaderCircle
                      size={19}
                      className="checkout-pin-spinner"
                    />
                  )}

                  {pinSuccess && !pinLoading && (
                    <CheckCircle2
                      size={20}
                      className="checkout-pin-check"
                    />
                  )}
                </div>

                {pinLoading && (
                  <span className="checkout-pin-loading">
                    Finding your city and state...
                  </span>
                )}

                {pinError && (
                  <span className="checkout-pin-error">
                    {pinError}
                  </span>
                )}

                {pinSuccess && !pinLoading && (
                  <span className="checkout-pin-success">
                    City and state detected successfully!
                  </span>
                )}
              </label>

              <label>
                City / District
                <input
                  name="city"
                  value={form.city}
                  onChange={handleChange}
                  required
                  placeholder="Auto-filled from PIN Code"
                  autoComplete="address-level2"
                />
              </label>

              <label>
                State
                <input
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  required
                  placeholder="Auto-filled from PIN Code"
                  autoComplete="address-level1"
                />
              </label>
            </div>

            <h2 className="checkout-payment-heading">
              <LockKeyhole size={22} />
              Payment Method
            </h2>

            <div className="jc-payment-methods">
              {PAYMENT_OPTIONS.map((method) => {
                const Icon = method.icon;
                const selected =
                  paymentMethod === method.id;

                return (
                  <label
                    key={method.id}
                    className={`jc-payment-option ${
                      selected ? "selected" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={selected}
                      disabled={loading}
                      onChange={() => {
                        setPaymentMethod(method.id);
                        setError("");
                      }}
                    />

                    <div className="jc-payment-icon">
                      <Icon size={23} />
                    </div>

                    <div className="jc-payment-content">
                      <strong>{method.title}</strong>
                      <p>{method.description}</p>

                      {method.id !== "COD" && (
                        <span className="jc-payment-soon">
                          Test Mode
                        </span>
                      )}
                    </div>

                    {selected && (
                      <CheckCircle2
                        size={21}
                        className="jc-payment-selected-icon"
                      />
                    )}
                  </label>
                );
              })}
            </div>

            {paymentMethod !== "COD" && (
              <div className="jc-payment-notice">
                <ShieldCheck size={20} />

                <p>
                  Razorpay Test Mode: simulated
                  payment only. No real money
                  will be deducted.
                </p>
              </div>
            )}

            <button
              className="checkout-submit"
              type="submit"
              disabled={
                loading ||
                pinLoading ||
                cart.length === 0
              }
            >
              {loading ? (
                <LoaderCircle
                  size={19}
                  className="checkout-pin-spinner"
                />
              ) : (
                <ShoppingBag size={19} />
              )}

              {loading
                ? "PROCESSING..."
                : paymentMethod === "COD"
                ? "PLACE ORDER"
                : `PAY ₹${subtotal.toLocaleString(
                    "en-IN"
                  )} (TEST)`}
            </button>

            <p className="jc-checkout-security">
              <LockKeyhole size={15} />
              Payment amounts are verified by
              the server.
            </p>
          </form>

          <aside className="checkout-summary">
            <h2>Order Summary</h2>

            {cart.length === 0 ? (
              <p>
                Your cart is empty.{" "}
                <Link to="/">Shop Now</Link>
              </p>
            ) : (
              cart.map((item) => (
                <div
                  className="checkout-product"
                  key={item.id ?? item.product_id}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p>
                      Quantity: {item.quantity || 1}
                    </p>
                  </div>

                  <strong>
                    ₹
                    {(
                      Number(item.price) *
                      Number(item.quantity || 1)
                    ).toLocaleString("en-IN")}
                  </strong>
                </div>
              ))
            )}

            <div className="checkout-total">
              <span>Estimated Subtotal</span>
              <strong>
                ₹{subtotal.toLocaleString("en-IN")}
              </strong>
            </div>

            <div className="jc-summary-payment">
              <span>Selected Payment</span>

              <strong>
                {paymentMethod === "COD"
                  ? "Cash on Delivery"
                  : paymentMethod === "UPI"
                  ? "UPI Test Payment"
                  : "Card Test Payment"}
              </strong>
            </div>

            <p className="checkout-note">
              Final amount and stock are verified
              by our server when you place your order.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
