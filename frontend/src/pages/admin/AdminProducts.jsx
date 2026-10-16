
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Package,
  RefreshCw,
  Save,
  X,
  Gem,
  UploadCloud,
  ImageIcon
} from "lucide-react";

import "./Admin.css";
import "./AdminProducts.css";

const API = "http://localhost:5000";

const emptyProduct = {
  name: "",
  slug: "",
  description: "",
  price: "",
  stock: "",
  image_url: "",
  category_id: "",
  is_active: true
};

function ProductImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <Gem size={28} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function AdminProducts() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);

  const request = useCallback(async (path = "", options = {}) => {
    const token = sessionStorage.getItem("jc_admin_token");

    if (!token) {
      throw new Error("ADMIN_LOGIN_REQUIRED");
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
      `${API}/api/admin/products${path}`,
      {
        ...options,
        headers
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("Invalid server response.");
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error("ADMIN_LOGIN_REQUIRED");
    }

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }, []);

  const handleError = useCallback(
    (err) => {
      if (err.message === "ADMIN_LOGIN_REQUIRED") {
        sessionStorage.removeItem("jc_admin_token");
        sessionStorage.removeItem("jc_admin");

        navigate("/admin/login", { replace: true });
        return;
      }

      setError(err.message || "Something went wrong.");
    },
    [navigate]
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await request();

      setProducts(
        Array.isArray(data.products) ? data.products : []
      );
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [request, handleError]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "image_url") {
      setPreviewFailed(false);
      setImageError("");
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function openAddForm() {
    setEditingId(null);
    setForm({ ...emptyProduct });
    setError("");
    setImageError("");
    setMessage("");
    setPreviewFailed(false);
    setShowForm(true);
  }

  function openEditForm(product) {
    setEditingId(product.id);

    setForm({
      name: product.name || "",
      slug: product.slug || "",
      description: product.description || "",
      price: product.price ?? "",
      stock: product.stock ?? "",
      image_url: product.image_url || "",
      category_id: product.category_id ?? "",
      is_active: product.is_active !== false
    });

    setError("");
    setImageError("");
    setMessage("");
    setPreviewFailed(false);
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function closeForm() {
    if (uploadingImage || saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyProduct });
    setImageError("");
    setPreviewFailed(false);
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setImageError("");
    setPreviewFailed(false);

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
      setImageError(
        "Only JPG, PNG and WebP images are allowed."
      );
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError(
        "Image size must be 5 MB or smaller."
      );
      event.target.value = "";
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const data = await request("/upload-image", {
        method: "POST",
        body: formData
      });

      if (!data.image_url) {
        throw new Error("Image URL missing in upload response.");
      }

      setForm((prev) => ({
        ...prev,
        image_url: data.image_url
      }));

      setPreviewFailed(false);
      setImageError("");
      setMessage("Image uploaded successfully!");
    } catch (err) {
      if (err.message === "ADMIN_LOGIN_REQUIRED") {
        handleError(err);
      } else {
        setImageError(
          err.message || "Image upload failed."
        );
      }
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function saveProduct(e) {
    e.preventDefault();

    if (saving || uploadingImage) return;

    setError("");
    setMessage("");

    if (form.name.trim().length < 2) {
      setError("Product name must contain at least 2 characters.");
      return;
    }

    if (
      form.price === "" ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) <= 0
    ) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    if (
      form.stock === "" ||
      !Number.isSafeInteger(Number(form.stock)) ||
      Number(form.stock) < 0
    ) {
      setError("Enter a valid stock quantity.");
      return;
    }

    if (form.image_url.trim()) {
      try {
        const url = new URL(form.image_url.trim());

        if (url.protocol !== "https:") {
          throw new Error("Invalid protocol");
        }
      } catch {
        setError("Enter a valid HTTPS image URL.");
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      slug:
        form.slug.trim() ||
        form.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      description: form.description.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      image_url: form.image_url.trim() || null,
      category_id:
        form.category_id === ""
          ? null
          : Number(form.category_id),
      is_active: form.is_active
    };

    setSaving(true);

    try {
      const isEditing = editingId !== null;

      await request(
        isEditing ? `/${editingId}` : "",
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload)
        }
      );

      closeFormAfterSave();

      await loadProducts();

      setMessage(
        isEditing
          ? "Product updated successfully!"
          : "Product added successfully!"
      );
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  function closeFormAfterSave() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyProduct });
    setImageError("");
    setPreviewFailed(false);
  }

  async function deleteProduct(product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await request(`/${product.id}`, {
        method: "DELETE"
      });

      await loadProducts();

      setMessage("Product removed from storefront!");
    } catch (err) {
      handleError(err);
    }
  }

  const filteredProducts = products.filter((product) =>
    String(product.name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="admin-products-page">
      <div className="admin-products-container">

        <div className="admin-products-top">
          <div>
            <Link
              to="/admin/dashboard"
              className="admin-products-back"
            >
              <ArrowLeft size={17} />
              Back to Dashboard
            </Link>

            <span className="admin-products-eyebrow">
              JEWELLERY CART ADMIN
            </span>

            <h1>Product Management</h1>

            <p>
              Add, update and manage your jewellery collection.
            </p>
          </div>

          <button
            className="admin-products-add-btn"
            onClick={openAddForm}
            type="button"
            disabled={uploadingImage || saving}
          >
            <Plus size={19} />
            Add New Product
          </button>
        </div>

        {error && (
          <div className="admin-products-alert error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="admin-products-alert success">
            {message}
          </div>
        )}

        {showForm && (
          <section className="admin-products-form-card">

            <div className="admin-products-form-heading">
              <h2>
                {editingId !== null
                  ? "Edit Jewellery Product"
                  : "Add Jewellery Product"}
              </h2>

              <button
                type="button"
                onClick={closeForm}
                disabled={uploadingImage || saving}
                aria-label="Close form"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={saveProduct}>
              <div className="admin-products-form-grid">

                <label>
                  Product Name
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Elegant Diamond Ring"
                    required
                    maxLength={200}
                  />
                </label>

                <label>
                  Product Slug
                  <input
                    name="slug"
                    value={form.slug}
                    onChange={handleChange}
                    placeholder="elegant-diamond-ring"
                  />
                </label>

                <label>
                  Price (₹)
                  <input
                    name="price"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="2499"
                    required
                  />
                </label>

                <label>
                  Stock Quantity
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={handleChange}
                    placeholder="20"
                    required
                  />
                </label>

                <div className="admin-products-image-upload">
                  <label>
                    Product Image URL
                    <input
                      name="image_url"
                      type="url"
                      value={form.image_url}
                      onChange={handleChange}
                      placeholder="https://example.com/ring.jpg"
                    />
                  </label>

                  <div className="admin-products-upload-divider">
                    OR
                  </div>

                  <label>
                    <span>
                      <UploadCloud size={18} />
                      Upload Image from Computer
                    </span>

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      disabled={uploadingImage || saving}
                    />
                  </label>

                  {uploadingImage && (
                    <p className="admin-products-uploading">
                      Uploading image to Cloudinary...
                    </p>
                  )}

                  {imageError && (
                    <p
                      className="admin-products-image-error"
                      role="alert"
                    >
                      {imageError}
                    </p>
                  )}

                  {form.image_url && (
                    <div className="admin-products-image-preview">
                      {!previewFailed ? (
                        <img
                          src={form.image_url}
                          alt="Product preview"
                          onError={() => setPreviewFailed(true)}
                        />
                      ) : (
                        <div className="admin-products-preview-fallback">
                          <ImageIcon size={30} />
                          <span>
                            Image could not be loaded.
                            Check the URL.
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {form.image_url && (
                    <button
                      type="button"
                      className="admin-products-remove-image"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          image_url: ""
                        }));
                        setPreviewFailed(false);
                        setImageError("");
                      }}
                      disabled={uploadingImage || saving}
                    >
                      <X size={15} />
                      Remove Image
                    </button>
                  )}
                </div>

                <label>
                  Category ID (optional)
                  <input
                    name="category_id"
                    type="number"
                    min="1"
                    step="1"
                    value={form.category_id}
                    onChange={handleChange}
                    placeholder="1"
                  />
                </label>

                <label className="admin-products-full">
                  Description
                  <textarea
                    name="description"
                    rows="4"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe your jewellery product..."
                  />
                </label>

                <label className="admin-products-checkbox">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={handleChange}
                  />
                  Product is active and visible in store
                </label>
              </div>

              <div className="admin-products-form-actions">
                <button
                  type="button"
                  className="admin-products-cancel-btn"
                  onClick={closeForm}
                  disabled={uploadingImage || saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-products-save-btn"
                  disabled={saving || uploadingImage}
                >
                  <Save size={18} />

                  {uploadingImage
                    ? "Uploading Image..."
                    : saving
                    ? "Saving..."
                    : editingId !== null
                    ? "Update Product"
                    : "Save Product"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="admin-products-list-card">

          <div className="admin-products-list-header">
            <div>
              <h2>
                <Package size={22} />
                All Products
              </h2>

              <p>
                {products.length} products in your store
              </p>
            </div>

            <div className="admin-products-tools">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
              />

              <button
                type="button"
                onClick={loadProducts}
                title="Refresh products"
                aria-label="Refresh products"
              >
                <RefreshCw size={19} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-products-empty">
              Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="admin-products-empty">
              <Gem size={45} />

              <h3>No Products Found</h3>

              <p>
                Add a product to start managing your collection.
              </p>
            </div>
          ) : (
            <div className="admin-products-table-wrap">
              <table className="admin-products-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-products-product">
                          <div className="admin-products-image">
                            <ProductImage
                              src={product.image_url}
                              alt={product.name}
                            />
                          </div>

                          <div>
                            <strong>{product.name}</strong>
                            <small>ID: {product.id}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        ₹
                        {Number(product.price).toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td>{product.stock}</td>

                      <td>
                        <span
                          className={
                            product.is_active !== false
                              ? "admin-products-status active"
                              : "admin-products-status inactive"
                          }
                        >
                          {product.is_active !== false
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="admin-products-row-actions">
                          <button
                            type="button"
                            onClick={() => openEditForm(product)}
                            title="Edit product"
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil size={18} />
                          </button>

                          <button
                            type="button"
                            className="delete"
                            onClick={() => deleteProduct(product)}
                            title="Delete product"
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
