import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Boxes, MessageCircle, PackagePlus, Printer, Search } from "lucide-react"
import { Badge, Modal, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { stockService } from "../../services/stock.service"

const PAGE_SIZE = 10

function getStockStatus(product) {
  if (!product.active) return { label: "Inactive", tone: "neutral" }
  if (product.stock <= 0) return { label: "Out of stock", tone: "warning" }
  if (product.stock <= product.minimumStock) return { label: "Low stock", tone: "warning" }
  return { label: "In stock", tone: "success" }
}

function StockEntry() {
  const [reportGeneratedAt] = useState(() => new Date())
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [query, setQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [stockFilter, setStockFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    let mounted = true
    stockService.listProducts()
      .then((rows) => {
        if (mounted) setProducts(rows)
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || "Unable to load products.")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category.trim()).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return products.filter((product) => {
      const matchesSearch = [product.name, product.productCode]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery))
      const matchesCategory = !categoryFilter || product.category === categoryFilter
      const isLowStock = product.active && product.stock <= product.minimumStock
      const matchesStock = stockFilter === "all"
        || (stockFilter === "low" && isLowStock)
        || (stockFilter === "in-stock" && product.active && !isLowStock)
        || (stockFilter === "inactive" && !product.active)
      return matchesSearch && matchesCategory && matchesStock
    })
  }, [categoryFilter, products, query, stockFilter])

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const visibleProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const lowStockCount = products.filter((product) => product.active && product.stock <= product.minimumStock).length
  const totalOnHand = products.filter((product) => product.active).reduce((sum, product) => sum + product.stock, 0)

  function printStockReport() {
    window.requestAnimationFrame(() => window.print())
  }

  async function shareStockReport() {
    const reportDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())
    const lines = filteredProducts.map((product) => {
      const status = getStockStatus(product).label
      return `• ${product.name}${product.variant ? ` (${product.variant})` : ""} | SKU: ${product.productCode || "—"} | ${product.category || "Uncategorized"} | Stock: ${product.stock} ${product.unit} | Minimum: ${product.minimumStock} ${product.unit} | ${status}`
    })
    const text = [
      "*FlowerPOS — Stock Report*",
      `Generated: ${reportDate}`,
      `Products: ${filteredProducts.length}`,
      `Total active stock: ${totalOnHand}`,
      `Low stock products: ${lowStockCount}`,
      "",
      ...lines,
    ].join("\n")
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    setError("")
    try {
      if (window.desktopAPI?.openExternal) {
        await window.desktopAPI.openExternal(url)
      } else {
        const shareWindow = window.open(url, "_blank")
        if (!shareWindow) throw new Error("The browser blocked the WhatsApp window. Allow pop-ups and try again.")
      }
    } catch (shareError) {
      setError(shareError.message || "Unable to open WhatsApp to share the stock report.")
    }
  }

  function changeFilter(update) {
    setPage(1)
    update()
  }

  async function saveStockEntry(event) {
    event.preventDefault()
    if (!selectedProduct) return
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const updatedProduct = await stockService.addStock({
        productId: selectedProduct.id,
        quantity: form.get("quantity"),
        minimumStock: form.get("minimumStock"),
        notes: String(form.get("notes") ?? "").trim(),
      })
      setProducts((current) => current.map((product) => (
        product.id === updatedProduct.id ? updatedProduct : product
      )))
      setMessage(`${updatedProduct.name} stock updated successfully.`)
      setSelectedProduct(null)
    } catch (saveError) {
      setError(saveError.message || "Unable to add stock.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <PageTitle
        description="View product stock levels, identify items to replenish, and add received stock."
        title="Stock Entry"
        action={(
          <div className="stock-report-actions">
            <button className="button button-secondary" disabled={loading || filteredProducts.length === 0} onClick={printStockReport} type="button"><Printer size={16} /> Print report</button>
            <button className="button button-whatsapp" disabled={loading || filteredProducts.length === 0} onClick={shareStockReport} type="button"><MessageCircle size={16} /> Share report</button>
          </div>
        )}
      />

      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Boxes} label="Active products" value={products.filter((product) => product.active).length} note="From the product database" />
        <StatCard icon={PackagePlus} label="Total stock on hand" value={totalOnHand} note="Active products combined" tone="blue" />
        <StatCard icon={Boxes} label="Low-stock products" value={lowStockCount} note="At or below minimum level" tone="orange" />
      </div>

      <Panel className="table-panel">
        <div className="stock-entry-toolbar">
          <label className="field-search">
            <Search size={17} />
            <input
              onChange={(event) => changeFilter(() => setQuery(event.target.value))}
              placeholder="Search product name or code..."
              value={query}
            />
          </label>
          <select
            aria-label="Filter products by category"
            className="select-control"
            onChange={(event) => changeFilter(() => setCategoryFilter(event.target.value))}
            value={categoryFilter}
          >
            <option value="">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select
            aria-label="Filter by stock status"
            className="select-control"
            onChange={(event) => changeFilter(() => setStockFilter(event.target.value))}
            value={stockFilter}
          >
            <option value="all">All stock statuses</option>
            <option value="low">Low stock</option>
            <option value="in-stock">In stock</option>
            <option value="inactive">Inactive products</option>
          </select>
          <span className="results-count">{filteredProducts.length} products</span>
        </div>
        {error && !selectedProduct && <p className="error-banner product-error" role="alert">{error}</p>}
        {message && <p className="inline-success stock-entry-message" role="status">{message}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Product Code / SKU</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Minimum Stock</th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => {
                const status = getStockStatus(product)
                return (
                  <tr className={product.active ? "" : "inactive-product-row"} key={product.id}>
                    <td><strong>{product.name}{product.variant ? ` (${product.variant})` : ""}</strong></td>
                    <td>{product.productCode || "—"}</td>
                    <td>{product.category || "—"}</td>
                    <td><strong>{product.stock} {product.unit}</strong></td>
                    <td>{product.minimumStock} {product.unit}</td>
                    <td><Badge tone={status.tone}>{status.label}</Badge></td>
                    <td>
                      <button
                        className="button button-secondary stock-add-button"
                        disabled={!product.active}
                        onClick={() => { setError(""); setSelectedProduct(product) }}
                        type="button"
                      >
                        <PackagePlus size={15} /> Add stock
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!loading && visibleProducts.length === 0 && (
                <tr>
                  <td className="empty-table" colSpan="7">
                    {products.length === 0
                      ? "No products exist yet. Add products on the Products page to manage their stock."
                      : "No products match these search and filter settings."}
                  </td>
                </tr>
              )}
              {loading && <tr><td className="empty-table" colSpan="7">Loading products from the local database…</td></tr>}
            </tbody>
          </table>
        </div>
        {filteredProducts.length > PAGE_SIZE && (
          <div className="stock-entry-pagination">
            <span>Page {page} of {pageCount}</span>
            <div>
              <button
                aria-label="Previous page"
                className="button button-secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              ><ArrowLeft size={15} /> Previous</button>
              <button
                aria-label="Next page"
                className="button button-secondary"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                type="button"
              >Next <ArrowRight size={15} /></button>
            </div>
          </div>
        )}
      </Panel>

      <section aria-label="Printable stock report" className="stock-report-print">
        <header>
          <h1>FlowerPOS Stock Report</h1>
          <p>Generated {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(reportGeneratedAt)}</p>
          <p>{filteredProducts.length} products · {totalOnHand} active units on hand · {lowStockCount} low-stock products</p>
        </header>
        <table>
          <thead>
            <tr><th>Product Name</th><th>Product Code / SKU</th><th>Category</th><th>Current Stock</th><th>Minimum Stock</th><th>Stock Status</th></tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.name}{product.variant ? ` (${product.variant})` : ""}</td>
                <td>{product.productCode || "—"}</td>
                <td>{product.category || "—"}</td>
                <td>{product.stock} {product.unit}</td>
                <td>{product.minimumStock} {product.unit}</td>
                <td>{getStockStatus(product).label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selectedProduct && (
        <Modal
          onClose={() => !saving && setSelectedProduct(null)}
          title={`Add stock — ${selectedProduct.name}${selectedProduct.variant ? ` (${selectedProduct.variant})` : ""}`}
        >
          <form className="form-grid" onSubmit={saveStockEntry}>
            {error && <p className="error-banner span-2" role="alert">{error}</p>}
            <p className="muted-text span-2">
              Current stock: <strong>{selectedProduct.stock} {selectedProduct.unit}</strong>
            </p>
            <label className="form-field span-2">
              Quantity to add ({selectedProduct.unit})
              <input autoFocus min="0.01" name="quantity" required step="any" type="number" />
            </label>
            <label className="form-field span-2">
              Minimum stock ({selectedProduct.unit})
              <input defaultValue={selectedProduct.minimumStock} min="0" name="minimumStock" required step="any" type="number" />
            </label>
            <label className="form-field span-2">
              Note (optional)
              <input maxLength="250" name="notes" placeholder="e.g. Supplier delivery or stock correction" />
            </label>
            <div className="form-actions span-2">
              <button className="button button-secondary" disabled={saving} onClick={() => setSelectedProduct(null)} type="button">Cancel</button>
              <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Add stock"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default StockEntry
