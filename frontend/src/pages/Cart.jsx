import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export default function Cart() {
  const [cart, setCart] = useState(readCart);

  function updateCart(items) {
    setCart(items);
    localStorage.setItem("cart", JSON.stringify(items));
    window.dispatchEvent(new Event("cartUpdated"));
  }

  function changeQuantity(id, amount) {
    const updated = cart.map((item) => {
      if (item.id !== id) return item;

      return {
        ...item,
        quantity: Math.max(
          1,
          Math.min(item.stock, item.quantity + amount)
        )
      };
    });

    updateCart(updated);
  }

  function removeProduct(id) {
    updateCart(cart.filter((item) => item.id !== id));
  }

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  );

  return (
    <main className="shopping-page">
      <h1><ShoppingBag /> My Shopping Cart</h1>

      {cart.length === 0 ? (
        <div className="empty-state">
          <h2>Your cart is empty</h2>
          <Link to="/" className="primary-btn">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="shopping-layout">
          <div className="shopping-items">
            {cart.map((item) => (
              <div className="shopping-item" key={item.id}>
                <img src={item.image_url} alt={item.name} />

                <div className="shopping-item-info">
                  <Link to={`/product/${item.id}`}>
                    <h3>{item.name}</h3>
                  </Link>

                  <p>₹{Number(item.price).toLocaleString("en-IN")}</p>

                  <div className="quantity-controls">
                    <button onClick={() => changeQuantity(item.id, -1)}>
                      <Minus size={16} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      disabled={item.quantity >= item.stock}
                      onClick={() => changeQuantity(item.id, 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <button
                    className="remove-btn"
                    onClick={() => removeProduct(item.id)}
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className="order-summary">
            <h2>Order Summary</h2>
            <p>Subtotal <strong>₹{total.toLocaleString("en-IN")}</strong></p>
            <p>Shipping <span>Calculated at checkout</span></p>
            <hr />
            <h3>Total <span>₹{total.toLocaleString("en-IN")}</span></h3>
            <Link to="/checkout" className="primary-btn">
              Proceed to Checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}