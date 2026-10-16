
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Search,
  Heart,
  ShoppingBag,
  SlidersHorizontal,
  X,
  Gem,
  ChevronDown,
} from "lucide-react";
import "./Collections.css";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

const CATEGORIES = [
  "Rings",
  "Luxury Jewellery Set",
  "Necklaces",
  "Pendant Set",
  "Bracelets",
  "Chain Ring",
  "Earrings",
  "Mangalsutra",
  "Toe Ring",
  "Mens Ring",
  "Nose Pin",
  "Gift Combo",
  "New Arrivals",
];

function getItems(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function imageUrl(product) {
  const raw = product.image_url || product.image || "";
  const url = typeof raw === "string" ? raw : raw?.url || "";

  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url)) return url;

  return `${API}/${url.replace(/^\/+/, "")}`;
}

function matchesCategory(product, category) {
  if (!category) return true;

  const name = String(product.name || "").toLowerCase();
  const productCategory = String(
    product.category_name ||
      product.category ||
      product.categoryName ||
      ""
  ).toLowerCase();

  const target = category.toLowerCase();

  if (target === "new arrivals") return true;

  const aliases = {
    rings: ["ring"],
    necklaces: ["necklace", "necklaces", "pendant"],
    earrings: ["earring"],
    bracelets: ["bracelet"],
    "chain ring": ["chain ring"],
    "luxury jewellery set": ["jewellery set", "jewelry set"],
    "pendant set": ["pendant set"],
    mangalsutra: ["mangalsutra"],
    "toe ring": ["toe ring"],
    "mens ring": ["mens ring", "men's ring", "men ring"],
    "nose pin": ["nose pin"],
    "gift combo": ["gift combo", "gift set"],
  };

  const terms = aliases[target] || [target];

  return terms.some(
    (term) => name.includes(term) || productCategory.includes(term)
  );
}

export default function Collections() {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedCategory = searchParams.get("category") || "";
  const initialSearch = searchParams.get("search") || "";

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState("newest");
  const [availability, setAvailability] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [wishlist, setWishlist] = useState(() =>
    getItems("wishlist")
  );

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API}/api/products`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load products");
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

    fetchProducts();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sync = () => setWishlist(getItems("wishlist"));

    window.addEventListener("wishlistUpdated", sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener("wishlistUpdated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const highestPrice = useMemo(() => {
    const prices = products.map((p) => Number(p.price) || 0);
    return Math.max(10000, ...prices);
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch = String(product.name || "")
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      const matchesSelectedCategory = matchesCategory(
        product,
        selectedCategory
      );

      const inStock =
        product.stock == null || Number(product.stock) > 0;

      const matchesAvailability =
        availability === "all" ||
        (availability === "in" && inStock) ||
        (availability === "out" && !inStock);

      const matchesPrice =
        !maxPrice ||
        Number(product.price || 0) <= Number(maxPrice);

      return (
        matchesSearch &&
        matchesSelectedCategory &&
        matchesAvailability &&
        matchesPrice
      );
    });

    if (sort === "low") {
      result.sort(
        (a, b) => Number(a.price || 0) - Number(b.price || 0)
      );
    } else if (sort === "high") {
      result.sort(
        (a, b) => Number(b.price || 0) - Number(a.price || 0)
      );
    } else if (sort === "name") {
      result.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    } else {
      result.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    }

    return result;
  }, [
    products,
    selectedCategory,
    search,
    availability,
    maxPrice,
    sort,
  ]);

  function chooseCategory(category) {
    const params = new URLSearchParams(searchParams);

    if (!category || category === selectedCategory) {
      params.delete("category");
    } else {
      params.set("category", category);
    }

    setSearchParams(params);
    setMobileFilters(false);
  }

  function toggleWishlist(product) {
    const items = getItems("wishlist");

    const exists = items.some(
      (item) => String(item.id) === String(product.id)
    );

    const updated = exists
      ? items.filter(
          (item) => String(item.id) !== String(product.id)
        )
      : [...items, product];

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

    const cart = getItems("cart");

    const index = cart.findIndex(
      (item) => String(item.id) === String(product.id)
    );

    if (index >= 0) {
      const quantity = Number(cart[index].quantity) || 1;

      if (
        product.stock != null &&
        quantity >= Number(product.stock)
      ) {
        return;
      }

      cart[index] = {
        ...cart[index],
        quantity: quantity + 1,
      };
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    localStorage.setItem("cart", JSON.stringify(cart));

    window.dispatchEvent(new Event("cartUpdated"));
    window.dispatchEvent(new Event("storage"));
  }

  function clearFilters() {
    setSearch("");
    setAvailability("all");
    setMaxPrice("");
    setSort("newest");
    setSearchParams({});
  }

  return (
    <main className="jc-collection-page">
      <div className="jc-collection-breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Collections</span>
        {selectedCategory && (
          <>
            <span>/</span>
            <strong>{selectedCategory}</strong>
          </>
        )}
      </div>

      <div className="jc-collection-heading">
        <span>JEWELLERY CART COLLECTION</span>
        <h1>
          {selectedCategory || "All Jewellery"}
        </h1>
        <p>
          Discover elegant jewellery for every occasion.
        </p>
      </div>

      <div className="jc-collection-mobile-toolbar">
        <button
          type="button"
          onClick={() => setMobileFilters(true)}
        >
          <SlidersHorizontal size={18} />
          Filters
        </button>

        <span>{filteredProducts.length} Products</span>
      </div>

      <div className="jc-collection-layout">
        {mobileFilters && (
          <button
            type="button"
            className="jc-filter-backdrop"
            onClick={() => setMobileFilters(false)}
            aria-label="Close filters"
          />
        )}

        <aside
          className={`jc-collection-sidebar ${
            mobileFilters ? "jc-filters-open" : ""
          }`}
        >
          <div className="jc-sidebar-heading">
            <h3>FILTERS</h3>
            <button
              type="button"
              onClick={() => setMobileFilters(false)}
              aria-label="Close filters"
            >
              <X size={20} />
            </button>
          </div>

          <div className="jc-filter-section">
            <h3>
              COLLECTION
              <ChevronDown size={16} />
            </h3>

            <div className="jc-filter-options">
              {CATEGORIES.map((category) => (
                <label key={category}>
                  <input
                    type="checkbox"
                    checked={selectedCategory === category}
                    onChange={() => chooseCategory(category)}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="jc-filter-section">
            <h3>
              AVAILABILITY
              <ChevronDown size={16} />
            </h3>

            <div className="jc-filter-options">
              <label>
                <input
                  type="radio"
                  name="availability"
                  checked={availability === "all"}
                  onChange={() => setAvailability("all")}
                />
                <span>All Products</span>
              </label>

              <label>
                <input
                  type="radio"
                  name="availability"
                  checked={availability === "in"}
                  onChange={() => setAvailability("in")}
                />
                <span>In Stock</span>
              </label>

              <label>
                <input
                  type="radio"
                  name="availability"
                  checked={availability === "out"}
                  onChange={() => setAvailability("out")}
                />
                <span>Out of Stock</span>
              </label>
            </div>
          </div>

          <div className="jc-filter-section">
            <h3>
              PRICE
              <ChevronDown size={16} />
            </h3>

            <p className="jc-price-caption">
              Maximum price
            </p>

            <input
              type="range"
              min="0"
              max={highestPrice}
              step="100"
              value={maxPrice || highestPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="jc-price-range"
            />

            <div className="jc-price-labels">
              <span>₹0</span>
              <strong>{money(maxPrice || highestPrice)}</strong>
            </div>
          </div>

          <button
            type="button"
            className="jc-clear-filters"
            onClick={clearFilters}
          >
            CLEAR ALL FILTERS
          </button>
        </aside>

        <section className="jc-collection-results">
          <div className="jc-collection-toolbar">
            <div className="jc-sort-control">
              <label htmlFor="jc-sort">Sort:</label>

              <select
                id="jc-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Date, new to old</option>
                <option value="low">Price, low to high</option>
                <option value="high">Price, high to low</option>
                <option value="name">Name, A to Z</option>
              </select>
            </div>

            <span className="jc-products-count">
              Showing {filteredProducts.length} products
            </span>
          </div>

          <div className="jc-collection-search">
            <Search size={19} />

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jewellery..."
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={17} />
              </button>
            )}
          </div>

          {loading && (
            <div className="jc-collection-status">
              Loading jewellery collection...
            </div>
          )}

          {error && (
            <div className="jc-collection-status">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="jc-collection-grid">
                {filteredProducts.map((product) => {
                  const saved = wishlist.some(
                    (item) =>
                      String(item.id) === String(product.id)
                  );

                  const inStock =
                    product.stock == null ||
                    Number(product.stock) > 0;

                  return (
                    <article
                      className="jc-collection-card"
                      key={product.id}
                    >
                      <div className="jc-collection-image">
                        <Link to={`/product/${product.id}`}>
                          {imageUrl(product) ? (
                            <img
                              src={imageUrl(product)}
                              alt={product.name}
                              loading="lazy"
                            />
                          ) : (
                            <div className="jc-collection-placeholder">
                              <Gem size={60} />
                            </div>
                          )}
                        </Link>

                        <span className="jc-collection-badge">
                          {inStock ? "NEW" : "SOLD OUT"}
                        </span>

                        <button
                          type="button"
                          className={`jc-collection-heart ${
                            saved ? "saved" : ""
                          }`}
                          onClick={() => toggleWishlist(product)}
                          aria-label="Toggle wishlist"
                        >
                          <Heart
                            size={19}
                            fill={
                              saved ? "currentColor" : "none"
                            }
                          />
                        </button>
                      </div>

                      <div className="jc-collection-card-info">
                        <Link to={`/product/${product.id}`}>
                          <h3>{product.name}</h3>
                        </Link>

                        <div className="jc-collection-price">
                          {money(product.price)}
                        </div>

                        <button
                          type="button"
                          className="jc-collection-cart-btn"
                          onClick={() => addToCart(product)}
                          disabled={!inStock}
                        >
                          <ShoppingBag size={17} />
                          {inStock
                            ? "ADD TO CART"
                            : "OUT OF STOCK"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="jc-collection-empty">
                  <Gem size={40} />
                  <h2>No jewellery found</h2>
                  <p>
                    Try another category or clear your filters.
                  </p>

                  <button
                    type="button"
                    onClick={clearFilters}
                  >
                    VIEW ALL PRODUCTS
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
