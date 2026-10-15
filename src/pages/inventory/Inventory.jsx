import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Boxes, PackageCheck, Search, SlidersHorizontal } from "lucide-react"
import { Badge, Modal, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { stockService } from "../../services/stock.service"

const PAGE_SIZE = 10

function getStockStatus(product) {
  if (!product.active) return { label: "Inactive", tone: "neutral" }
  if (product.stock <= 0) return { label: "Out of stock", tone: "warning" }
  if (product.stock <= product.minimumStock) return { label: "Low stock", tone: "warning" }
  return { label: "In stock", tone: "success" }
}

function formatQuantity(quantity) {
  return Number(quantity).toLocaleString("en-IN", { maximumFractionDigits: 3 })
}

function formatMovementDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function getMovementLabel(type) {
  if (type === "sale") return "Sale"
  if (type === "purchase") return "Purchase"
  if (type === "purchase_return") return "Purchase return"
  if (type === "adjustment") return "Adjustment"
  return type
}

function Inventory() {
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [movementCountThisMonth, setMovementCountThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [stockFilter, setStockFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false)
  const [adjustmentProductId, setAdjustmentProductId] = useState("")

  useEffect(() => {
    let mounted = true
    stockService.getInventoryReport()
      .then((report) => {
        if (!mounted) return
        setProducts(report.products)
        setMovements(report.movements)
        setMovementCountThisMonth(report.movementCountThisMonth)
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || "Unable to load inventory.")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const activeProducts = products.filter((product) => product.active)
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    [products],
  )
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return products.filter((product) => {
      const matchesSearch = [product.name, product.productCode, product.variant]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))
      const matchesCategory = !categoryFilter || product.category === categoryFilter
      const isLowStock = product.active && product.stock <= product.minimumStock
      const matchesStock = stockFilter === "all"
        || (stockFilter === "low" && isLowStock)
        || (stockFilter === "in-stock" && product.active && product.stock > product.minimumStock)
        || (stockFilter === "out" && product.active && product.stock <= 0)
        || (stockFilter === "inactive" && !product.active)
      return matchesSearch && matchesCategory && matchesStock
    })
  }, [categoryFilter, products, query, stockFilter])
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const visibleProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const lowStockCount = activeProducts.filter((product) => product.stock <= product.minimumStock).length
  const selectedProduct = activeProducts.find((product) => String(product.id) === adjustmentProductId)

  function changeFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  function openAdjustmentForm() {
    const firstProduct = activeProducts[0]
    setError("")
    setMessage("")
    setAdjustmentProductId(firstProduct ? String(firstProduct.id) : "")
    setShowAdjustmentForm(true)
  }

  async function saveAdjustment(event) {
    event.preventDefault()
    if (!selectedProduct) {
      setError("Choose an active product to adjust.")
      return
    }

    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const updatedProduct = await stockService.adjustStock({
        productId: selectedProduct.id,
        direction: form.get("direction"),
        quantity: form.get("quantity"),
        notes: String(form.get("notes") ?? "").trim(),
      })
      setProducts((current) => current.map((product) => (
        product.id === updatedProduct.id ? { ...product, ...updatedProduct } : product
      )))
      setMessage(`${updatedProduct.name} inventory adjusted successfully.`)
      setShowAdjustmentForm(false)
      try {
        const report = await stockService.getInventoryReport()
        setProducts(report.products)
        setMovements(report.movements)
        setMovementCountThisMonth(report.movementCountThisMonth)
      } catch (refreshError) {
        setError(`Adjustment saved, but inventory could not be refreshed: ${refreshError.message || "Database error"}`)
      }
    } catch (saveError) {
      setError(saveError.message || "Unable to record the stock adjustment.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <PageTitle
        description="Monitor flower levels, recent stock changes and items to replenish."
        title="Inventory"
        action={(
          <button
            className="button button-secondary"
            disabled={loading || activeProducts.length === 0}
            onClick={openAdjustmentForm}
            type="button"
          >
            <SlidersHorizontal size={16} /> Record adjustment
          </button>
        )}
      />

      {error && !showAdjustmentForm && <p className="error-banner product-error" role="alert">{error}</p>}
      {message && <p className="inline-success stock-entry-message" role="status">{message}</p>}

      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Boxes} label="Active products" value={activeProducts.length} note="From the product database" />
        <StatCard icon={PackageCheck} label="Low-stock items" value={lowStockCount} note="At or below minimum stock" tone="orange" />
        <StatCard icon={Boxes} label="Movements this month" value={movementCountThisMonth} note="Purchases, returns and adjustments" tone="blue" />
      </div>

      <Panel className="table-panel">
        <div className="panel-heading">
          <div><h3>Stock levels</h3><p>Current quantity by product</p></div>
          {!loading && <Badge tone="neutral">{filteredProducts.length} products</Badge>}
        </div>
        <div className="inventory-toolbar">
          <label className="field-search">
            <Search size={17} />
            <input
              onChange={(event) => changeFilter(setQuery, event.target.value)}
              placeholder="Search product name or code..."
              value={query}
            />
          </label>
          <select
            aria-label="Filter products by category"
            className="select-control"
            onChange={(event) => changeFilter(setCategoryFilter, event.target.value)}
            value={categoryFilter}
          >
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select
            aria-label="Filter products by stock status"
            className="select-control"
            onChange={(event) => changeFilter(setStockFilter, event.target.value)}
            value={stockFilter}
          >
            <option value="all">All stock</option>
            <option value="low">Low stock</option>
            <option value="in-stock">In stock</option>
            <option value="out">Out of stock</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Product</th><th>Category</th><th>Available</th><th>Stock level</th><th>Reorder at</th><th>Status</th></tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const status = getStockStatus(product)
                const target = Math.max(product.minimumStock * 2, 1)
                const fill = Math.min((product.stock / target) * 100, 100)
                return (
                  <tr className={product.active ? "" : "inactive-product-row"} key={product.id}>
                    <td>
                      <div className="table-product">
                        <div className="flower-avatar">{product.name.slice(0, 1)}</div>
                        <div><strong>{product.name}{product.variant ? ` (${product.variant})` : ""}</strong><small>{product.productCode || "No product code"}</small></div>
                      </div>
                    </td>
                    <td>{product.category || "—"}</td>
                    <td><strong>{formatQuantity(product.stock)} {product.unit}</strong></td>
                    <td><div aria-label={`${Math.round(fill)}% of stock target`} className="stock-meter"><span style={{ width: `${fill}%` }} /></div></td>
                    <td>{formatQuantity(product.minimumStock)} {product.unit}</td>
                    <td><Badge tone={status.tone}>{status.label}</Badge></td>
                  </tr>
                )
              })}
              {!loading && visibleProducts.length === 0 && (
                <tr><td className="empty-table" colSpan="6">
                  {error
                    ? "Inventory could not be loaded. Check the database connection and try again."
                    : products.length === 0
                    ? "No products exist yet. Add products on the Products page to manage their stock."
                    : "No products match these search and filter settings."}
                </td></tr>
              )}
              {loading && <tr><td className="empty-table" colSpan="6">Loading inventory from the local database…</td></tr>}
            </tbody>
          </table>
        </div>
        {filteredProducts.length > PAGE_SIZE && (
          <div className="stock-entry-pagination">
            <span>Page {page} of {pageCount}</span>
            <div>
              <button aria-label="Previous page" className="button button-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><ArrowLeft size={15} /> Previous</button>
              <button aria-label="Next page" className="button button-secondary" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">Next <ArrowRight size={15} /></button>
            </div>
          </div>
        )}
      </Panel>

      <Panel className="table-panel movement-panel" title="Recent stock movements" description="Purchases, purchase returns and manual adjustments">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Details</th><th>Product</th><th>Type</th><th>Quantity</th><th>Date</th></tr></thead>
            <tbody>
              {movements.map((movement) => {
                const incoming = movement.quantity > 0
                const tone = movement.movement_type === "purchase" || (movement.movement_type === "adjustment" && incoming)
                  ? "success"
                  : movement.movement_type === "purchase_return" || movement.movement_type === "adjustment"
                    ? "warning"
                    : "neutral"
                return (
                  <tr key={movement.id}>
                    <td><strong>{movement.notes || "Stock movement"}</strong></td>
                    <td>{movement.product_name}{movement.product_variant ? ` (${movement.product_variant})` : ""}</td>
                    <td><Badge tone={tone}>{getMovementLabel(movement.movement_type)}</Badge></td>
                    <td className={incoming ? "positive-quantity" : "negative-quantity"}>
                      {incoming ? "+" : ""}{formatQuantity(movement.quantity)} {movement.unit}
                    </td>
                    <td>{formatMovementDate(movement.created_at)}</td>
                  </tr>
                )
              })}
              {!loading && movements.length === 0 && (
                <tr><td className="empty-table" colSpan="5">No stock movements have been recorded yet.</td></tr>
              )}
              {loading && <tr><td className="empty-table" colSpan="5">Loading recent movements…</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      {showAdjustmentForm && (
        <Modal className="purchase-modal-card" onClose={() => !saving && setShowAdjustmentForm(false)} title="Record stock adjustment">
          <form className="stacked-form" onSubmit={saveAdjustment}>
            {error && <p className="error-banner" role="alert">{error}</p>}
            <div className="form-grid">
              <label className="form-field span-2">
                Product
                <select
                  className="input-control"
                  onChange={(event) => setAdjustmentProductId(event.target.value)}
                  required
                  value={adjustmentProductId}
                >
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}{product.variant ? ` (${product.variant})` : ""} — {formatQuantity(product.stock)} {product.unit}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Adjustment
                <select className="input-control" name="direction" required>
                  <option value="add">Add stock</option>
                  <option value="remove">Remove stock</option>
                </select>
              </label>
              <label className="form-field">
                Quantity
                <input min="0.001" name="quantity" required step="any" type="number" />
              </label>
              <label className="form-field span-2">
                Notes (optional)
                <textarea maxLength="250" name="notes" placeholder="Reason for this adjustment" />
              </label>
            </div>
            {selectedProduct && <p className="muted-text">Current stock: {formatQuantity(selectedProduct.stock)} {selectedProduct.unit}</p>}
            <div className="form-actions">
              <button className="button button-secondary" disabled={saving} onClick={() => setShowAdjustmentForm(false)} type="button">Cancel</button>
              <button className="button button-primary" disabled={saving || !selectedProduct} type="submit">{saving ? "Saving..." : "Save adjustment"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default Inventory
