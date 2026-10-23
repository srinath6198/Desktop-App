
import { useEffect, useMemo, useState } from "react"
import {
  History,
  Pencil,
  Search,
  TrendingDown,
  TrendingUp,
  Package,
} from "lucide-react"
import { Modal, PageTitle, Panel } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import { productService } from "../../services/product.service"
import "./PriceChanges.css"

function getProductsApi() {
  const api = window.desktopAPI?.products

  if (!api) {
    throw new Error("Price management is only available in the desktop app.")
  }

  return api
}

function formatDate(value) {
  if (!value) return "—"

  const date = new Date(`${String(value).replace(" ", "T")}Z`)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function PriceDiff({ oldPrice, newPrice }) {
  const diff = Number(newPrice) - Number(oldPrice)

  if (diff === 0) {
    return <span className="price-diff-neutral">No change</span>
  }

  return diff > 0 ? (
    <span className="price-diff-up">
      <TrendingUp size={13} /> +{formatCurrency(diff)}
    </span>
  ) : (
    <span className="price-diff-down">
      <TrendingDown size={13} /> −{formatCurrency(Math.abs(diff))}
    </span>
  )
}

function PriceChanges() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // Variants modal
  const [selectedGroup, setSelectedGroup] = useState(null)

  // Edit price modal
  const [editingProduct, setEditingProduct] = useState(null)
  const [newPrice, setNewPrice] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState("")

  // Price history modal
  const [historyProduct, setHistoryProduct] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState("")

  useEffect(() => {
    let mounted = true

    productService
      .list()
      .then((rows) => {
        if (mounted) {
          setProducts(rows.filter((product) => product.active))
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Unable to load products.")
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const categories = useMemo(
    () =>
      [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products],
  )

  // Search and category filters
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    return products
      .filter((product) => {
        const matchQuery =
          !q ||
          [
            product.name,
            product.variant,
            product.category,
            product.productCode,
          ].some((value) => String(value ?? "").toLowerCase().includes(q))

        const matchCategory =
          !categoryFilter || product.category === categoryFilter

        return matchQuery && matchCategory
      })
      .sort(
        (a, b) =>
          String(a.name ?? "").localeCompare(String(b.name ?? "")) ||
          String(a.variant ?? "").localeCompare(String(b.variant ?? "")),
      )
  }, [products, query, categoryFilter])

  // Group variants by product name and category
  const groupedProducts = useMemo(() => {
    const groups = new Map()

    filtered.forEach((product) => {
      const key = JSON.stringify([
        product.name,
        product.category || "",
      ])

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: product.name,
          category: product.category,
          products: [],
        })
      }

      groups.get(key).products.push(product)
    })

    return Array.from(groups.values())
  }, [filtered])

  // Find the latest product data for the selected group
  const activeGroup = useMemo(() => {
    if (!selectedGroup) return null

    return {
      ...selectedGroup,
      products: selectedGroup.products
        .map((item) => products.find((product) => product.id === item.id))
        .filter(Boolean),
    }
  }, [selectedGroup, products])

  function openEdit(product) {
    setEditingProduct(product)
    setNewPrice(String(product.sellingPrice))
    setReason("")
    setEditError("")
  }

  function closeEdit() {
    setEditingProduct(null)
    setNewPrice("")
    setReason("")
    setEditError("")
  }

  async function savePrice(event) {
    event.preventDefault()

    if (!editingProduct) return

    const price = Number(newPrice)

    if (!Number.isFinite(price) || price < 0) {
      setEditError("Enter a valid selling price (₹0 or more).")
      return
    }

    setSaving(true)
    setEditError("")

    try {
      const updated = await getProductsApi().updatePrice({
        productId: editingProduct.id,
        newPrice: price,
        reason: reason.trim() || null,
      })

      const updatedSellingPrice = Number(updated?.selling_price ?? price)

      setProducts((previous) =>
        previous.map((product) =>
          product.id === editingProduct.id
            ? { ...product, sellingPrice: updatedSellingPrice }
            : product,
        ),
      )

      const label =
        editingProduct.name +
        (editingProduct.variant ? ` (${editingProduct.variant})` : "")

      setSuccessMsg(
        `Price updated for ${label}: ${formatCurrency(
          editingProduct.sellingPrice,
        )} → ${formatCurrency(updatedSellingPrice)}`,
      )

      setTimeout(() => setSuccessMsg(""), 5000)
      closeEdit()
    } catch (err) {
      setEditError(err.message || "Unable to update price.")
    } finally {
      setSaving(false)
    }
  }

  async function openHistory(product) {
    setSelectedGroup(null)
    setHistoryProduct(product)
    setHistory([])
    setHistoryError("")
    setHistoryLoading(true)

    try {
      const rows = await getProductsApi().priceHistory({
        productId: product.id,
        limit: 100,
      })

      setHistory(rows)
    } catch (err) {
      setHistoryError(err.message || "Unable to load price history.")
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="screen">
      <PageTitle
        eyebrow="Management"
        title="Price Changes"
        description="Manage product variants, update selling prices, and track price history."
      />

      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}

      {successMsg && (
        <p className="success-banner" role="status">
          {successMsg}
        </p>
      )}

      {/* Search and filters */}
      <div className="price-changes-filters">
        <label className="field-search">
          <Search size={16} />

          <input
            autoComplete="off"
            placeholder="Search product, variant, category..."
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <select
          className="price-select-filter"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All categories</option>

          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <p className="price-changes-count">
        {loading
          ? "Loading products..."
          : `${groupedProducts.length} product${
              groupedProducts.length !== 1 ? "s" : ""
            } · ${filtered.length} variant${
              filtered.length !== 1 ? "s" : ""
            }`}
      </p>

      {/* Main table: one row per product */}
      <Panel>
        <div className="price-changes-table-wrap">
          <table className="price-changes-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="col-center">Variants</th>
                <th className="col-right">Price range</th>
                <th className="col-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading && groupedProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-cell">
                    No products found.
                  </td>
                </tr>
              )}

              {groupedProducts.map((group) => {
                const prices = group.products.map((product) =>
                  Number(product.sellingPrice || 0),
                )

                const minimumPrice = Math.min(...prices)
                const maximumPrice = Math.max(...prices)

                return (
                  <tr key={group.key}>
                    <td>
                      <strong>{group.name}</strong>
                    </td>

                    <td>
                      {group.category || (
                        <span className="text-muted">—</span>
                      )}
                    </td>

                    <td className="col-center">
                      <span className="product-variant-tag">
                        {group.products.length} variant
                        {group.products.length !== 1 ? "s" : ""}
                      </span>
                    </td>

                    <td className="col-right">
                      <strong className="selling-price-value">
                        {minimumPrice === maximumPrice
                          ? formatCurrency(minimumPrice)
                          : `${formatCurrency(minimumPrice)} – ${formatCurrency(
                              maximumPrice,
                            )}`}
                      </strong>
                    </td>

                    <td className="col-center">
                      <div className="price-row-actions">
                        <button
                          className="button button-secondary button-sm"
                          type="button"
                          onClick={() => setSelectedGroup(group)}
                        >
                          <Package size={13} />
                          View Variants
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* All variants for the selected product */}
      {activeGroup && (
        <Modal
          title={`${activeGroup.name} — Variants`}
          onClose={() => setSelectedGroup(null)}
          className="price-edit-modal"
        >
          <p className="loading-note">
            {activeGroup.products.length} variant
            {activeGroup.products.length !== 1 ? "s" : ""} available
          </p>

          <div className="price-changes-table-wrap">
            <table className="price-changes-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Product code</th>
                  <th className="col-right">MRP</th>
                  <th className="col-right">Purchase</th>
                  <th className="col-right">Selling price</th>
                  <th className="col-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {activeGroup.products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.variant || "Default"}</strong>
                    </td>

                    <td>
                      {product.productCode || "—"}
                    </td>

                    <td className="col-right">
                      {product.mrp > 0
                        ? formatCurrency(product.mrp)
                        : "—"}
                    </td>

                    <td className="col-right">
                      {product.purchasePrice > 0
                        ? formatCurrency(product.purchasePrice)
                        : "—"}
                    </td>

                    <td className="col-right">
                      <strong className="selling-price-value">
                        {formatCurrency(product.sellingPrice)}
                      </strong>
                    </td>

                    <td className="col-center">
                      <div className="price-row-actions">
                        <button
                          className="button button-secondary button-sm"
                          type="button"
                          title="Update variant price"
                          onClick={() => openEdit(product)}
                        >
                          <Pencil size={13} />
                          Update
                        </button>

                        <button
                          className="button button-secondary button-sm"
                          type="button"
                          title="View variant price history"
                          onClick={() => openHistory(product)}
                        >
                          <History size={13} />
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Update price modal */}
      {editingProduct && (
        <Modal
          title="Update selling price"
          onClose={closeEdit}
          className="price-edit-modal"
        >
          <form onSubmit={savePrice}>
            <div className="price-edit-product-info">
              <strong>
                {editingProduct.name}
                {editingProduct.variant
                  ? ` (${editingProduct.variant})`
                  : ""}
              </strong>

              <span>
                Current:{" "}
                <strong>
                  {formatCurrency(editingProduct.sellingPrice)}
                </strong>

                {editingProduct.mrp > 0 &&
                  ` · MRP: ${formatCurrency(editingProduct.mrp)}`}

                {editingProduct.purchasePrice > 0 &&
                  ` · Purchase: ${formatCurrency(
                    editingProduct.purchasePrice,
                  )}`}
              </span>
            </div>

            <label className="form-field">
              New selling price (₹)

              <input
                autoFocus
                min="0"
                required
                step="0.01"
                type="number"
                value={newPrice}
                onChange={(event) => setNewPrice(event.target.value)}
              />
            </label>

            <label className="form-field">
              Reason{" "}
              <span className="field-optional">(optional)</span>

              <input
                maxLength={300}
                placeholder="e.g. Seasonal price increase, supplier rate change..."
                type="text"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            {editError && (
              <p className="error-banner" role="alert">
                {editError}
              </p>
            )}

            <div className="form-actions">
              <button
                className="button button-secondary"
                onClick={closeEdit}
                type="button"
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="button button-primary"
                disabled={saving}
                type="submit"
              >
                {saving ? "Saving..." : "Save price"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Price history modal */}
      {historyProduct && (
        <Modal
          title={`Price history — ${historyProduct.name}${
            historyProduct.variant ? ` (${historyProduct.variant})` : ""
          }`}
          onClose={() => setHistoryProduct(null)}
          className="price-history-modal"
        >
          {historyLoading && (
            <p className="loading-note">Loading price history...</p>
          )}

          {historyError && (
            <p className="error-banner" role="alert">
              {historyError}
            </p>
          )}

          {!historyLoading &&
            !historyError &&
            history.length === 0 && (
              <p className="empty-note">
                No price changes recorded yet for this product.
              </p>
            )}

          {!historyLoading && history.length > 0 && (
            <div className="price-history-list">
              {history.map((entry) => (
                <div className="price-history-entry" key={entry.id}>
                  <div className="price-history-row">
                    <span className="price-history-prices">
                      <span className="old-price">
                        {formatCurrency(entry.old_price)}
                      </span>

                      <span className="price-arrow">→</span>

                      <strong className="new-price">
                        {formatCurrency(entry.new_price)}
                      </strong>
                    </span>

                    <PriceDiff
                      oldPrice={Number(entry.old_price)}
                      newPrice={Number(entry.new_price)}
                    />
                  </div>

                  <div className="price-history-meta">
                    <span className="price-history-date">
                      {formatDate(entry.changed_at)}
                    </span>

                    {entry.reason && (
                      <span className="price-history-reason">
                        "{entry.reason}"
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

export default PriceChanges
