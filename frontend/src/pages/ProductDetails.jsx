
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Heart,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RotateCcw,
  Minus,
  Plus,
  ArrowLeft,
  Gem,
  CheckCircle2,
  PackageCheck,
} from "lucide-react";
import "./ProductDetails.css";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function readStorage(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function getImage(product) {
  const image =
    product?.image_url ||
    product?.image ||
    product?.imageUrl ||
    product?.images?.[0];

  if (!image) return "";

  const value =
    typeof image === "string"
      ? image
      : image?.url || image?.image_url || "";

  if (!value) return "";

  if (value.startsWith("http") || value.startsWith("data:")) {
    return value;
  }

  return `${API_URL}/${value.replace(/^\/+/, "")}`;
}

export default function ProductDetails() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      setError("");
      setProduct(null);
      setQuantity(1);

      try {
        let response = await fetch(
          `${API_URL}/api/products/${id}`
        );

        let result = null;

        if (response.ok) {
          result = await response.json();
        }

        let found =
          result?.product ||
          result?.data ||
          (result?.id ? result : null);

        if (!found) {
          response = await fetch(`${API_URL}/api/products`);

          if (!response.ok) {
            throw new Error("Products load nahi ho paaye.");
          }

          result = await response.json();

          const products = Array.isArray(result)
            ? result
            : result.products || result.data || [];

          found = products.find(
            (item) => String(item.id) === String(id)
          );
        }

        if (!found) {
          throw new Error("Product nahi mila.");
        }

        if (active) {
          setProduct(found);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Something went wrong.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProduct();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!product) return;

    const saved = readStorage("wishlist");

    setWishlisted(
      saved.some(
        (item) => String(item.id) === String(product.id)
      )
    );
  }, [product]);

  function addToCart() {
    if (!product) return;

    const cart = readStorage("cart");

    const index = cart.findIndex(
      (item) => String(item.id) === String(product.id)
    );

    if (index >= 0) {
      cart[index] = {
        ...cart[index],
        quantity:
          Number(cart[index].quantity || 1) + quantity,
      };
    } else {
      cart.push({
        ...product,
        quantity,
      });
    }

    localStorage.setItem("cart", JSON.stringify(cart));

    window.dispatchEvent(new Event("storage"));

    setMessage(`${quantity} item added to your cart!`);
  }

  function toggleWishlist() {
    if (!product) return;

    const wishlist = readStorage("wishlist");

    const exists = wishlist.some(
      (item) => String(item.id) === String(product.id)
    );

    const updated = exists
      ? wishlist.filter(
          (item) => String(item.id) !== String(product.id)
        )
      : [...wishlist, product];

    localStorage.setItem(
      "wishlist",
      JSON.stringify(updated)
    );

    window.dispatchEvent(new Event("storage"));

    setWishlisted(!exists);

    setMessage(
      exists
        ? "Removed from wishlist"
        : "Added to wishlist!"
    );
  }

  if (loading) {
    return (
      <div className="pd-status">
        <Gem size={35} />
        <h2>Loading your jewellery...</h2>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pd-status">
        <h2>{error || "Product not found"}</h2>
        <Link to="/" className="pd-main-btn">
          Back to Shop
        </Link>
      </div>
    );
  }

  const name = product.name || product.title || "Jewellery";
  const price = Number(product.price || 0);

  const formattedPrice = price.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const image = getImage(product);

  const stockValue = product.stock ?? product.stock_quantity;
  const inStock =
    product.is_active !== false &&
    product.in_stock !== false &&
    (stockValue == null || Number(stockValue) > 0);

  const category = product.category || "Fine Jewellery";

  return (
    <main className="pd-page">
      <div className="pd-container">
        <nav className="pd-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/#collections">Collections</Link>
          <span>/</span>
          <strong>{name}</strong>
        </nav>

        <div className="pd-layout">
          <div className="pd-gallery">
            <div className="pd-main-image">
              <span className="pd-image-badge">
                EXCLUSIVE COLLECTION
              </span>

              {image ? (
                <img src={image} alt={name} />
              ) : (
                <div className="pd-image-placeholder">
                  <Gem size={100} strokeWidth={1} />
                </div>
              )}
            </div>

            <div className="pd-image-caption">
              <Gem size={17} />
              Thoughtfully selected for timeless elegance
            </div>
          </div>

          <div className="pd-info">
            <div className="pd-overline">
              <span className="pd-line" />
              JEWELLERY CART COLLECTION
            </div>

            <h1>{name}</h1>

            <div className="pd-rating">
              <span>✦ FINE JEWELLERY</span>
              <span className="pd-dot">•</span>
              <span>{category}</span>
            </div>

            <div className="pd-price">{formattedPrice}</div>

            <p className="pd-tax">
              Inclusive of all applicable taxes
            </p>

            <div
              className={`pd-stock ${
                inStock ? "available" : "unavailable"
              }`}
            >
              <CheckCircle2 size={17} />
              {inStock ? "In Stock & Ready to Order" : "Out of Stock"}
            </div>

            <div className="pd-divider" />

            <p className="pd-description">
              {product.description ||
                "Discover timeless elegance with this beautifully selected piece of jewellery. Designed to add a refined touch to your everyday style and special moments."}
            </p>

            <div className="pd-quantity-section">
              <label>QUANTITY</label>

              <div className="pd-quantity">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((value) => Math.max(1, value - 1))
                  }
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>

                <span>{quantity}</span>

                <button
                  type="button"
                  onClick={() =>
                    setQuantity((value) => value + 1)
                  }
                  disabled={
                    stockValue != null &&
                    quantity >= Number(stockValue)
                  }
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div className="pd-actions">
              <button
                type="button"
                className="pd-main-btn"
                onClick={addToCart}
                disabled={!inStock}
              >
                <ShoppingBag size={19} />
                ADD TO CART
              </button>

              <button
                type="button"
                className={`pd-wishlist-btn ${
                  wishlisted ? "active" : ""
                }`}
                onClick={toggleWishlist}
              >
                <Heart
                  size={19}
                  fill={wishlisted ? "currentColor" : "none"}
                />
                {wishlisted
                  ? "SAVED TO WISHLIST"
                  : "ADD TO WISHLIST"}
              </button>
            </div>

            {message && (
              <div className="pd-success">
                <CheckCircle2 size={18} />
                {message}
              </div>
            )}

            <div className="pd-quick-links">
              <Link to="/cart">
                View Shopping Cart →
              </Link>

              <Link to="/wishlist">
                View Wishlist →
              </Link>
            </div>

            <div className="pd-benefits">
              <div>
                <Truck size={23} />
                <span>
                  <strong>Reliable Delivery</strong>
                  <small>Delivery details at checkout</small>
                </span>
              </div>

              <div>
                <ShieldCheck size={23} />
                <span>
                  <strong>Secure Checkout</strong>
                  <small>Protected payment process</small>
                </span>
              </div>

              <div>
                <PackageCheck size={23} />
                <span>
                  <strong>Careful Packaging</strong>
                  <small>Thoughtful jewellery presentation</small>
                </span>
              </div>
            </div>
          </div>
        </div>

        <section className="pd-bottom">
          <div className="pd-bottom-heading">
            <span>THE JEWELLERY CART EXPERIENCE</span>
            <h2>Every Detail Matters</h2>
            <p>
              Discover jewellery that complements your personal
              style, from everyday essentials to statement pieces.
            </p>
          </div>

          <div className="pd-bottom-grid">
            <div>
              <Gem size={30} />
              <h3>Elegant Designs</h3>
              <p>Beautiful pieces for memorable moments.</p>
            </div>

            <div>
              <Truck size={30} />
              <h3>Delivery Support</h3>
              <p>Order updates and tracking information.</p>
            </div>

            <div>
              <RotateCcw size={30} />
              <h3>Customer Assistance</h3>
              <p>Help with your order and product queries.</p>
            </div>
          </div>

          <Link to="/" className="pd-back-link">
            <ArrowLeft size={18} />
            CONTINUE SHOPPING
          </Link>
        </section>
      </div>
    </main>
  );
}
