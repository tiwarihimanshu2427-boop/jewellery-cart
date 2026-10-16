import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Trash2, Gem } from "lucide-react";

function readWishlist() {
  try {
    const value = JSON.parse(localStorage.getItem("wishlist") || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function Wishlist() {
  const [wishlist, setWishlist] = useState(readWishlist);

  function removeItem(id) {
    const updated = wishlist.filter(
      (item) => String(item.id) !== String(id)
    );

    setWishlist(updated);
    localStorage.setItem("wishlist", JSON.stringify(updated));
    window.dispatchEvent(new Event("wishlistUpdated"));
  }

  return (
    <main className="shopping-page">
      <h1>
        <Heart size={30} />
        My Wishlist
      </h1>

      {wishlist.length === 0 ? (
        <div className="empty-state">
          <h2>Your wishlist is empty</h2>
          <p>Save your favourite jewellery here.</p>

          <Link to="/" className="primary-btn">
            Explore Jewellery
          </Link>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map((item) => (
            <article className="product-card" key={item.id}>
              <Link to={`/product/${item.id}`}>
                <div className="product-image">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                    />
                  ) : (
                    <Gem size={70} />
                  )}
                </div>
              </Link>

              <div className="product-info">
                <span className="product-label">
                  JEWELLERY CART
                </span>

                <Link to={`/product/${item.id}`}>
                  <h3>{item.name}</h3>
                </Link>

                <p className="price">
                  ₹{Number(item.price).toLocaleString("en-IN")}
                </p>

                <Link
                  to={`/product/${item.id}`}
                  className="product-view-btn"
                >
                  View Product
                </Link>

                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeItem(item.id)}
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}