
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Search,
  Heart,
  ShoppingBag,
  UserRound,
  Truck,
  ShieldCheck,
  Gift,
  Package,
  Menu,
  X,
  ArrowRight,
  Gem,
  Sparkles,
  Camera,
  Globe,
} from "lucide-react";

import Auth from "./pages/Auth";
import Account from "./pages/Account";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import MyOrders from "./pages/MyOrders";
import TrackOrder from "./pages/TrackOrder";
import Collections from "./Collections";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCustomers from "./pages/admin/AdminCustomers";

import "./App.css";
import "./ZarkanInspired.css";
import "./StoryPremium.css";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

const collectionUrl = (category) =>
  category && category !== "All"
    ? `/collections?category=${encodeURIComponent(category)}`
    : "/collections";

function getItems(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function productImage(product) {
  const image = product.image_url || product.image || "";
  const url = typeof image === "string" ? image : image?.url || "";

  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API}/${url.replace(/^\/+/, "")}`;
}

const CATEGORIES = [
  {
    name: "Rings",
    subtitle: "Timeless sparkle",
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=700&auto=format&fit=crop&q=85",
  },
  {
    name: "Earrings",
    subtitle: "Elegant details",
    image:
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=700&auto=format&fit=crop&q=85",
  },
  {
    name: "Necklaces",
    subtitle: "Statement beauty",
    image:
      "https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=700&auto=format&fit=crop&q=85",
  },
  {
    name: "Bracelets",
    subtitle: "Everyday luxury",
    image:
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=700&auto=format&fit=crop&q=85",
  },
];

const SLIDES = [
  {
    title: "One Promise",
    subtitle: "ELEGANCE IN EVERY TOUCH",
    image:
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?w=1800&auto=format&fit=crop&q=90",
    category: "Rings",
  },
  {
    title: "Forever Shine",
    subtitle: "DISCOVER TIMELESS BEAUTY",
    image:
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1800&auto=format&fit=crop&q=90",
    category: "Necklaces",
  },
  {
    title: "Signature Style",
    subtitle: "JEWELLERY MADE TO TREASURE",
    image:
      "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1800&auto=format&fit=crop&q=90",
    category: "Rings",
  },
];

const REVIEWS = [
  {
    name: "Sample Customer",
    text: "Beautiful designs and a lovely shopping experience.",
  },
  {
    name: "Jewellery Lover",
    text: "I love the elegant collection and simple checkout.",
  },
  {
    name: "Sample Shopper",
    text: "So many lovely pieces to explore for special occasions.",
  },
];

function PremiumHeroSlider() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % SLIDES.length);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  function changeSlide(direction) {
    setActive(
      (current) =>
        (current + direction + SLIDES.length) % SLIDES.length
    );
  }

  return (
    <section className="jc-hero-slider">
      {SLIDES.map((slide, index) => (
        <div
          key={slide.title}
          className={`jc-slide ${
            active === index ? "jc-slide-active" : ""
          }`}
          aria-hidden={active !== index}
        >
          <img src={slide.image} alt={slide.title} />

          <div className="jc-slide-shade" />

          <div className="jc-slide-copy">
            <span>JEWELLERY CART COLLECTION</span>
            <h1>{slide.title}</h1>
            <p>{slide.subtitle}</p>

            <Link
              to={collectionUrl(slide.category)}
              className="jc-slide-cta"
              tabIndex={active === index ? 0 : -1}
            >
              SHOP NOW
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="jc-slider-arrow jc-prev"
        onClick={() => changeSlide(-1)}
        aria-label="Previous slide"
      >
        ‹
      </button>

      <button
        type="button"
        className="jc-slider-arrow jc-next"
        onClick={() => changeSlide(1)}
        aria-label="Next slide"
      >
        ›
      </button>

      <div className="jc-slide-dots">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            className={active === index ? "active" : ""}
            onClick={() => setActive(index)}
            aria-label={`Show slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

function Home() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wishlist, setWishlist] = useState(() =>
    getItems("wishlist")
  );
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API}/api/products`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Products API unavailable");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setProducts(
            Array.isArray(data)
              ? data
              : Array.isArray(data.products)
                ? data.products
                : Array.isArray(data.data)
                  ? data.data
                  : []
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            "Products load nahi ho paaye. Backend aur PostgreSQL check karo."
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProducts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const syncWishlist = () => setWishlist(getItems("wishlist"));

    window.addEventListener("wishlistUpdated", syncWishlist);
    window.addEventListener("storage", syncWishlist);

    return () => {
      window.removeEventListener("wishlistUpdated", syncWishlist);
      window.removeEventListener("storage", syncWishlist);
    };
  }, []);

  function selectCategory(name) {
    navigate(collectionUrl(name));
  }

  function toggleWishlist(product) {
    const existing = getItems("wishlist");

    const saved = existing.some(
      (item) => String(item.id) === String(product.id)
    );

    const updated = saved
      ? existing.filter(
          (item) => String(item.id) !== String(product.id)
        )
      : [...existing, product];

    localStorage.setItem("wishlist", JSON.stringify(updated));
    setWishlist(updated);

    window.dispatchEvent(new Event("wishlistUpdated"));
    window.dispatchEvent(new Event("storage"));
  }

  function addToCart(product) {
    if (
      product.stock != null &&
      Number(product.stock) <= 0
    ) {
      return;
    }

    const existing = getItems("cart");
    const index = existing.findIndex(
      (item) => String(item.id) === String(product.id)
    );

    if (index >= 0) {
      const quantity = Number(existing[index].quantity) || 1;

      if (
        product.stock != null &&
        quantity >= Number(product.stock)
      ) {
        return;
      }

      existing[index] = {
        ...existing[index],
        quantity: quantity + 1,
      };
    } else {
      existing.push({ ...product, quantity: 1 });
    }

    localStorage.setItem("cart", JSON.stringify(existing));

    window.dispatchEvent(new Event("cartUpdated"));
    window.dispatchEvent(new Event("storage"));
  }

  function changeReview(direction) {
    setReviewIndex(
      (current) =>
        (current + direction + REVIEWS.length) % REVIEWS.length
    );
  }

  return (
    <main>
      <PremiumHeroSlider />

      <section className="luxury-feature-strip">
        <div>
          <Gem size={23} />
          <span>Elegant Designs</span>
        </div>

        <div>
          <ShieldCheck size={23} />
          <span>Secure Shopping</span>
        </div>

        <div>
          <Gift size={23} />
          <span>Beautiful Gifting</span>
        </div>

        <div>
          <Truck size={23} />
          <span>Track Your Order</span>
        </div>
      </section>

      {/* SHOP BY CATEGORY */}
      <section className="luxury-section" id="categories">
        <div className="section-heading">
          <span className="luxury-eyebrow">
            DISCOVER YOUR STYLE
          </span>

          <h2>
            Shop by <em>Category</em>
          </h2>

          <p>Explore jewellery for every special moment.</p>
        </div>

        <div className="luxury-category-grid">
          {CATEGORIES.map((item, index) => (
            <button
              type="button"
              key={item.name}
              className={`luxury-category-card category-${index + 1}`}
              onClick={() => selectCategory(item.name)}
            >
              <div className="luxury-category-art">
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                />
              </div>

              <div className="luxury-category-info">
                <h3>{item.name}</h3>
                <p>{item.subtitle}</p>

                <span className="category-explore">
                  EXPLORE
                  <ArrowRight size={15} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* PREMIUM EDITORIAL COLLECTIONS */}
      <section className="jc-editorial-section">
        <div className="jc-section-head">
          <span>JEWELLERY CART EDIT</span>
          <h2>Discover Your Signature Style</h2>
        </div>

        <div className="jc-duo-grid">
          <Link
            to={collectionUrl("Necklaces")}
            className="jc-editorial-tile"
          >
            <img
              src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1000&auto=format&fit=crop&q=85"
              alt="Jewellery for her"
              loading="lazy"
            />

            <div>
              <span>THE ELEGANT EDIT</span>
              <h3>For Her</h3>
              <span>EXPLORE COLLECTION →</span>
            </div>
          </Link>

          <Link
            to={collectionUrl("Rings")}
            className="jc-editorial-tile"
          >
            <img
              src="https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=1000&auto=format&fit=crop&q=85"
              alt="Signature rings"
              loading="lazy"
            />

            <div>
              <span>THE SIGNATURE EDIT</span>
              <h3>Statement Rings</h3>
              <span>EXPLORE COLLECTION →</span>
            </div>
          </Link>
        </div>

        <Link
          to={collectionUrl("Necklaces")}
          className="jc-wide-banner"
        >
          <img
            src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1600&auto=format&fit=crop&q=85"
            alt="Luxury necklace collection"
            loading="lazy"
          />

          <div>
            <span>TIMELESS JEWELLERY</span>
            <h2>Forever Shine</h2>
            <p>The perfect finishing touch.</p>

            <span className="jc-wide-button">
              SHOP NOW <ArrowRight size={16} />
            </span>
          </div>
        </Link>
      </section>

      {/* PROMOTIONAL BANNER */}
      <section className="luxury-promo">
        <span>THE JEWELLERY CART EDIT</span>

        <h2>
          A Little Sparkle,
          <br />
          <em>A Lot of Love.</em>
        </h2>

        <p>
          Beautiful pieces for everyday moments and
          unforgettable celebrations.
        </p>

        <Link to="/collections" className="promo-link">
          DISCOVER THE COLLECTION
          <ArrowRight size={17} />
        </Link>
      </section>

      {/* FEATURED PRODUCTS */}
      <section
        className="luxury-section luxury-products"
        id="products"
      >
        <div className="section-heading">
          <span className="luxury-eyebrow">
            CURATED FOR YOU
          </span>

          <h2>
            Our <em>Collection</em>
          </h2>

          <p>Explore your favourite jewellery pieces.</p>
        </div>

        <div className="collection-toolbar">
          <div className="collection-filters">
            {["All", ...CATEGORIES.map((c) => c.name)].map(
              (name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => selectCategory(name)}
                >
                  {name === "All" ? "All Jewellery" : name}
                </button>
              )
            )}
          </div>

          <Link
            to="/collections"
            className="jc-view-all-collections"
          >
            VIEW ALL COLLECTIONS
            <ArrowRight size={17} />
          </Link>
        </div>

        {loading && (
          <div className="collection-message">
            Loading beautiful jewellery...
          </div>
        )}

        {error && (
          <div className="collection-message collection-error">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="luxury-product-grid">
              {products.slice(0, 8).map((product) => {
                const saved = wishlist.some(
                  (item) =>
                    String(item.id) === String(product.id)
                );

                const available =
                  product.stock == null ||
                  Number(product.stock) > 0;

                return (
                  <article
                    className="luxury-product-card"
                    key={product.id}
                  >
                    <div className="luxury-product-image">
                      <Link to={`/product/${product.id}`}>
                        {productImage(product) ? (
                          <img
                            src={productImage(product)}
                            alt={product.name}
                            loading="lazy"
                          />
                        ) : (
                          <div className="product-placeholder">
                            <Gem size={75} />
                          </div>
                        )}
                      </Link>

                      <span className="product-badge">
                        {available
                          ? "OUR COLLECTION"
                          : "SOLD OUT"}
                      </span>

                      <button
                        type="button"
                        className={`product-heart ${
                          saved ? "saved" : ""
                        }`}
                        onClick={() => toggleWishlist(product)}
                        aria-label="Toggle wishlist"
                      >
                        <Heart
                          size={19}
                          fill={saved ? "currentColor" : "none"}
                        />
                      </button>
                    </div>

                    <div className="luxury-product-info">
                      <span className="product-mini-label">
                        JEWELLERY CART
                      </span>

                      <Link to={`/product/${product.id}`}>
                        <h3>{product.name}</h3>
                      </Link>

                      <div className="product-price-row">
                        <strong>{money(product.price)}</strong>

                        <span
                          className={
                            available
                              ? "available"
                              : "unavailable"
                          }
                        >
                          {available
                            ? "In Stock"
                            : "Out of Stock"}
                        </span>
                      </div>

                      <div className="product-card-actions">
                        <Link
                          to={`/product/${product.id}`}
                          className="product-outline-btn"
                        >
                          VIEW DETAILS
                        </Link>

                        <button
                          type="button"
                          className="product-add-btn"
                          onClick={() => addToCart(product)}
                          disabled={!available}
                          aria-label="Add to cart"
                        >
                          <ShoppingBag size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {products.length === 0 && (
              <div className="collection-message">
                No products available yet.
              </div>
            )}

            {products.length > 0 && (
              <div className="jc-all-products-action">
                <Link to="/collections" className="luxury-btn">
                  EXPLORE ALL PRODUCTS
                  <ArrowRight size={17} />
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {/* PREMIUM STORY */}
      <section className="luxury-story-premium">
        <div className="luxury-story-premium-inner">
          <div className="luxury-story-premium-visual">
            <img
              src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=90"
              alt="Luxury gold jewellery collection"
              loading="lazy"
            />

            <span className="luxury-story-premium-stamp">
              <Gem size={17} />
              THE ART OF ELEGANCE
            </span>
          </div>

          <div className="luxury-story-premium-content">
            <span className="luxury-story-premium-eyebrow">
              <Sparkles size={16} />
              THE JEWELLERY CART STORY
            </span>

            <h2>
              Designed to Be
              <em>Remembered.</em>
            </h2>

            <div className="luxury-story-premium-rule" />

            <p>
              Every piece tells a story. Discover jewellery
              that celebrates your individuality, meaningful
              moments, and the beauty of timeless design.
            </p>

            <p>
              From delicate everyday favourites to statement
              pieces, find something that feels uniquely yours.
            </p>

            <Link
              to="/collections"
              className="luxury-story-premium-button"
            >
              EXPLORE OUR COLLECTION
              <ArrowRight size={18} />
            </Link>

            <div className="luxury-story-premium-footnote">
              <Gem size={18} />
              ELEGANCE FOR EVERY OCCASION
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="jc-reviews">
        <div className="jc-section-head">
          <span>WORDS THAT INSPIRE US</span>
          <h2>Our Customers Speak</h2>
        </div>

        <div className="jc-review-box">
          <button
            type="button"
            onClick={() => changeReview(-1)}
            aria-label="Previous review"
          >
            ‹
          </button>

          <div className="jc-review-content">
            <div className="jc-review-stars">★★★★★</div>

            <p>“{REVIEWS[reviewIndex].text}”</p>

            <strong>{REVIEWS[reviewIndex].name}</strong>
            <small>Sample testimonial</small>
          </div>

          <button
            type="button"
            onClick={() => changeReview(1)}
            aria-label="Next review"
          >
            ›
          </button>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="luxury-benefits">
        <div>
          <Truck size={30} />
          <h3>Order Tracking</h3>
          <p>Follow your order journey online.</p>
        </div>

        <div>
          <ShieldCheck size={30} />
          <h3>Secure Checkout</h3>
          <p>Shop with a secure checkout experience.</p>
        </div>

        <div>
          <Gift size={30} />
          <h3>Made for Gifting</h3>
          <p>Jewellery for special moments.</p>
        </div>
      </section>
    </main>
  );
}

const NAV_LINKS = [
  { label: "SHOP BY CATEGORY", to: "/collections" },
  { label: "DIAMOND RINGS", to: collectionUrl("Rings") },
  {
    label: "LUXURY JEWELLERY SET",
    to: collectionUrl("Luxury Jewellery Set"),
  },
  { label: "CHAIN RING", to: collectionUrl("Chain Ring") },
  {
    label: "NEW ARRIVALS",
    to: collectionUrl("New Arrivals"),
  },
  { label: "TRACK MY ORDER", to: "/track-order" },
  { label: "MY ORDERS", to: "/my-orders" },
];

function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    function updateCounts() {
      const cart = getItems("cart");
      const wishlist = getItems("wishlist");

      setCartCount(
        cart.reduce(
          (total, item) =>
            total + (Number(item.quantity) || 1),
          0
        )
      );

      setWishlistCount(wishlist.length);
    }

    updateCounts();

    window.addEventListener("cartUpdated", updateCounts);
    window.addEventListener("wishlistUpdated", updateCounts);
    window.addEventListener("storage", updateCounts);

    return () => {
      window.removeEventListener("cartUpdated", updateCounts);
      window.removeEventListener("wishlistUpdated", updateCounts);
      window.removeEventListener("storage", updateCounts);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);

    if (!location.hash) {
      window.scrollTo(0, 0);
    }
  }, [
    location.pathname,
    location.search,
    location.hash,
  ]);

  function submitHeaderSearch(event) {
    event.preventDefault();

    const term = headerSearch.trim();

    navigate(
      term
        ? `/collections?search=${encodeURIComponent(term)}`
        : "/collections"
    );

    setSearchOpen(false);
  }

  return (
    <>
      <div className="luxury-topbar">
        <Sparkles size={14} />
        DISCOVER TIMELESS ELEGANCE AT JEWELLERY CART
        <Sparkles size={14} />
      </div>

      <header className="luxury-header">
        <div className="header-inner">
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={
              menuOpen ? "Close menu" : "Open menu"
            }
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={25} /> : <Menu size={25} />}
          </button>

          <Link to="/" className="luxury-brand">
            <span className="brand-icon">
              <Gem size={24} strokeWidth={1.4} />
            </span>

            <span>
              JEWELLERY CART
              <small>TIMELESS ELEGANCE</small>
            </span>
          </Link>

          <nav
            className={`luxury-navigation ${
              menuOpen ? "menu-open" : ""
            }`}
          >
            {NAV_LINKS.map((item) => (
              <Link key={item.label} to={item.to}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="luxury-header-icons">
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Search products"
            >
              <Search size={21} />
            </button>

            <Link
              to="/account"
              aria-label="My Account"
              className="desktop-account"
            >
              <UserRound size={21} />
            </Link>

            <Link
              to="/wishlist"
              className="nav-icon-link"
              aria-label="Wishlist"
            >
              <Heart size={21} />

              {wishlistCount > 0 && (
                <span className="nav-count">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link
              to="/cart"
              className="nav-icon-link"
              aria-label="Shopping Cart"
            >
              <ShoppingBag size={21} />

              {cartCount > 0 && (
                <span className="nav-count">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {searchOpen && (
          <form
            className="header-search-panel"
            onSubmit={submitHeaderSearch}
          >
            <Search size={20} />

            <input
              type="search"
              value={headerSearch}
              onChange={(e) =>
                setHeaderSearch(e.target.value)
              }
              placeholder="Search rings, necklaces, earrings..."
              autoFocus
            />

            <button type="submit">SEARCH</button>
          </form>
        )}
      </header>

      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          path="/collections"
          element={<Collections />}
        />

        <Route
          path="/product/:id"
          element={<ProductDetails />}
        />

        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />

        <Route path="/register" element={<Auth />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/account" element={<Account />} />

        <Route path="/checkout" element={<Checkout />} />

        <Route
          path="/order-success/:id"
          element={<OrderSuccess />}
        />

        <Route
          path="/my-orders"
          element={<MyOrders />}
        />

        <Route
          path="/track-order"
          element={<TrackOrder />}
        />

        <Route
          path="*"
          element={
            <div className="not-found-page">
              <Gem size={55} />
              <h1>Page Not Found</h1>

              <Link to="/" className="luxury-btn">
                BACK TO HOME
              </Link>
            </div>
          }
        />
      </Routes>

      <footer className="luxury-footer">
        <div className="footer-main">
          <div className="footer-about">
            <Link to="/" className="footer-brand">
              JEWELLERY CART
            </Link>

            <p>
              Discover jewellery that celebrates your style
              and life's most beautiful moments.
            </p>

            <div className="footer-socials">
              <span title="Social media">
                <Camera size={19} />
              </span>

              <span title="Website">
                <Globe size={19} />
              </span>
            </div>
          </div>

          <div className="footer-column">
            <h3>EXPLORE</h3>
            <Link to="/">Home</Link>
            <Link to="/collections">All Collections</Link>
            <Link to={collectionUrl("Rings")}>Rings</Link>
            <Link to={collectionUrl("Earrings")}>Earrings</Link>
            <Link to="/wishlist">Wishlist</Link>
          </div>

          <div className="footer-column">
            <h3>MY ACCOUNT</h3>
            <Link to="/account">My Account</Link>
            <Link to="/cart">Shopping Cart</Link>
            <Link to="/my-orders">My Orders</Link>
            <Link to="/track-order">Track Order</Link>
          </div>

          <div className="footer-column">
            <h3>SHOP WITH US</h3>

            <p>
              <ShieldCheck size={16} />
              Secure Checkout
            </p>

            <p>
              <Package size={16} />
              Order Management
            </p>

            <p>
              <Gift size={16} />
              Beautiful Jewellery
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © 2026 JEWELLERY CART. All rights reserved.
          </span>

          <span>MADE WITH ELEGANCE ✦</span>
        </div>
      </footer>
    </>
  );
}

export default function App() {
  const location = useLocation();

  const isAdminPage =
    location.pathname === "/admin" ||
    location.pathname.startsWith("/admin/");

  if (isAdminPage) {
    return (
      <Routes>
        <Route
          path="/admin"
          element={<AdminLogin />}
        />

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        <Route element={<AdminLayout />}>
          <Route
            path="/admin/dashboard"
            element={<AdminDashboard />}
          />

          <Route
            path="/admin/products"
            element={<AdminProducts />}
          />

          <Route
            path="/admin/orders"
            element={<AdminOrders />}
          />

          <Route
            path="/admin/customers"
            element={<AdminCustomers />}
          />
        </Route>

        <Route
          path="*"
          element={
            <div className="not-found-page">
              <h2>Admin Page Not Found</h2>

              <Link to="/admin/dashboard">
                Go to Admin Dashboard
              </Link>
            </div>
          }
        />
      </Routes>
    );
  }

  return <CustomerLayout />;
}
