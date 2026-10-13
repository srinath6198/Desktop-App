import { useEffect, useMemo, useState } from "react"
import { Archive, Flower2, ImagePlus, Pencil, Plus, RotateCcw, Search, X } from "lucide-react"
import { Badge, Modal, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import { productService } from "../../services/product.service"

const EMPTY_PRODUCT = {
  productCode: "",
  name: "",
  variant: "",
  category: "",
  unit: "kg",
  noOfUnits: 1,
  mrp: 0,
  purchasePrice: 0,
  sellingPrice: 0,
  stock: 0,
}

function Products() {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editingProduct, setEditingProduct] = useState(null)
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [imageChanged, setImageChanged] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [error, setError] = useState("")
  const [savedMessage, setSavedMessage] = useState("")

  useEffect(() => {
    let active = true

    productService.list()
      .then((rows) => {
        if (active) setProducts(rows)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load products.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return products.filter((product) =>
      (statusFilter === "all" || product.active === (statusFilter === "active")) &&
      [product.name, product.variant, product.category, product.productCode]
        .some((value) => value?.toLowerCase().includes(normalizedQuery)),
    )
  }, [products, query, statusFilter])

  function openCreateForm() {
    setEditingProduct(null)
    setImageDataUrl(null)
    setImageChanged(false)
    setRemoveImage(false)
    setError("")
    setShowForm(true)
  }

  function openEditForm(product) {
    setEditingProduct(product)
    setImageDataUrl(product.imageDataUrl)
    setImageChanged(false)
    setRemoveImage(false)
    setError("")
    setShowForm(true)
  }

  async function chooseProductImage() {
    setError("")
    try {
      const selectedImage = await productService.selectImage()
      if (selectedImage) {
        setImageDataUrl(selectedImage)
        setImageChanged(true)
        setRemoveImage(false)
      }
    } catch (imageError) {
      setError(imageError.message || "Unable to select product image.")
    }
  }

  async function saveProduct(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setSavedMessage("")

    const form = new FormData(event.currentTarget)
    const product = {
      id: editingProduct?.id,
      productCode: String(form.get("productCode")).trim(),
      name: String(form.get("name")).trim(),
      variant: String(form.get("variant")).trim(),
      category: String(form.get("category")).trim(),
      unit: String(form.get("unit")),
      noOfUnits: Number(form.get("noOfUnits")),
      mrp: Number(form.get("mrp")),
      purchasePrice: Number(form.get("purchasePrice")),
      sellingPrice: Number(form.get("sellingPrice")),
      stock: Number(form.get("stock")),
      imageDataUrl: imageChanged ? imageDataUrl : null,
      removeImage: imageChanged && removeImage,
    }

    try {
      const savedProduct = editingProduct
        ? await productService.update(product)
        : await productService.create(product)
      setProducts((current) => {
        const exists = current.some((item) => item.id === savedProduct.id)
        return exists
          ? current.map((item) => item.id === savedProduct.id ? savedProduct : item)
          : [...current, savedProduct].sort((left, right) =>
            left.name.localeCompare(right.name) || left.variant.localeCompare(right.variant),
          )
      })
      setSavedMessage(`${savedProduct.name}${savedProduct.variant ? ` (${savedProduct.variant})` : ""} ${editingProduct ? "updated" : "added"}.`)
      setShowForm(false)
      setEditingProduct(null)
    } catch (saveError) {
      setError(saveError.message || "Unable to save this product.")
    } finally {
      setSaving(false)
    }
  }

  async function changeProductStatus(product) {
    const nextActive = !product.active
    const label = `${product.name}${product.variant ? ` (${product.variant})` : ""}`
    const action = nextActive ? "reactivate" : "deactivate"
    const confirmation = nextActive
      ? `Reactivate ${label}? It will be available for new sales again.`
      : `Deactivate ${label}? The product record and its sales history will be kept.`
    if (!window.confirm(confirmation)) return

    setError("")
    setSavedMessage("")
    setUpdatingStatusId(product.id)
    try {
      const updatedProduct = await productService.setActive(product.id, nextActive)
      setProducts((current) => current.map((item) => item.id === updatedProduct.id ? updatedProduct : item))
      setSavedMessage(`${label} ${action}d. Its database record has been kept.`)
    } catch (statusError) {
      setError(statusError.message || `Unable to ${action} this product.`)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const formProduct = editingProduct ?? EMPTY_PRODUCT

  return (
    <div className="screen">
      <PageTitle
        description="Keep your flower catalogue, prices and available stock up to date."
        title="Products"
        action={<button className="button button-primary" onClick={openCreateForm} type="button"><Plus size={17} /> Add product</button>}
      />

      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Flower2} label="Active products" value={products.filter((product) => product.active).length} note="Available for new sales" />
        <StatCard icon={Flower2} label="Inactive products" value={products.filter((product) => !product.active).length} note="Records retained" tone="orange" />
        <StatCard icon={Flower2} label="Categories" value={new Set(products.map((product) => product.category).filter(Boolean)).size} note="Flower varieties" tone="purple" />
        <StatCard icon={Flower2} label="Low stock items" value={products.filter((product) => product.stock < 10).length} note="Need restocking" tone="red" />
      </div>

      <Panel className="table-panel">
        <div className="toolbar">
          <label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." value={query} /></label>
          <select aria-label="Product status filter" className="select-control" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="active">Active products</option>
            <option value="inactive">Inactive products</option>
            <option value="all">All products</option>
          </select>
          <span className="results-count">{filteredProducts.length} products</span>
        </div>
        {error && !showForm && <p className="error-banner product-error" role="alert">{error}</p>}
        {savedMessage && <p className="inline-success" role="status">{savedMessage}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Category</th><th>Unit</th><th>Purchase price</th><th>Selling price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr className={product.active ? "" : "inactive-product-row"} key={product.id}>
                  <td>
                    <div className="table-product">
                      {product.imageDataUrl
                        ? <img alt="" className="product-thumbnail" src={product.imageDataUrl} />
                        : <div className="flower-avatar">{product.name.slice(0, 1)}</div>}
                      <div className="product-name-cell"><strong>{product.name}</strong>{product.variant && <span>{product.variant}</span>}</div>
                    </div>
                  </td>
                  <td>{product.category || "—"}</td>
                  <td>{product.noOfUnits > 1 ? `${product.noOfUnits} ` : ""}{product.unit}</td>
                  <td>{formatCurrency(product.purchasePrice)}</td>
                  <td className="amount-cell">{formatCurrency(product.sellingPrice)}</td>
                  <td><Badge tone={product.stock < 10 ? "warning" : "success"}>{product.stock} {product.unit}</Badge></td>
                  <td><Badge tone={product.active ? "success" : "neutral"}>{product.active ? "Active" : "Inactive"}</Badge></td>
                  <td>
                    <div className="product-row-actions">
                      <button aria-label={`Edit ${product.name}${product.variant ? ` ${product.variant}` : ""}`} className="icon-button" onClick={() => openEditForm(product)} type="button"><Pencil size={15} /></button>
                      <button
                        aria-label={`${product.active ? "Deactivate" : "Reactivate"} ${product.name}${product.variant ? ` ${product.variant}` : ""}`}
                        className={`icon-button ${product.active ? "danger-icon" : "activate-icon"}`}
                        disabled={updatingStatusId === product.id}
                        onClick={() => changeProductStatus(product)}
                        title={product.active ? "Deactivate product" : "Reactivate product"}
                        type="button"
                      >
                        {product.active ? <Archive size={16} /> : <RotateCcw size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredProducts.length === 0 && (
                <tr><td className="empty-table" colSpan="8">{query ? "No products match your search." : statusFilter === "inactive" ? "No inactive products." : "No products yet. Add a product to get started."}</td></tr>
              )}
              {loading && <tr><td className="empty-table" colSpan="8">Loading products from the local database…</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="demo-notice">Products are stored in this device’s local SQLite database. Deactivating a product keeps its record and sales history.</p>
      </Panel>

      {showForm && (
        <Modal onClose={() => !saving && setShowForm(false)} title={editingProduct ? "Edit product" : "Add a product"}>
          <form className="form-grid" onSubmit={saveProduct}>
            {error && <p className="error-banner span-2" role="alert">{error}</p>}
            <div className="form-field span-2">
              <span>Product image</span>
              <div className="product-image-editor">
                {imageDataUrl
                  ? <img alt="Selected product preview" className="product-image-preview" src={imageDataUrl} />
                  : <div className="product-image-placeholder"><ImagePlus size={22} /><span>No image selected</span></div>}
                <div className="product-image-controls">
                  <button className="button button-secondary" onClick={chooseProductImage} type="button"><ImagePlus size={16} /> Choose image</button>
                  {imageDataUrl && <button className="button button-secondary remove-image-button" onClick={() => { setImageDataUrl(null); setImageChanged(true); setRemoveImage(true) }} type="button"><X size={15} /> Remove image</button>}
                  <small>JPG, PNG or WebP · maximum 5 MB</small>
                </div>
              </div>
            </div>
            <label className="form-field">Product code<input defaultValue={formProduct.productCode} name="productCode" placeholder="Optional" /></label>
            <label className="form-field">Flower name<input autoFocus defaultValue={formProduct.name} name="name" placeholder="e.g. Yellow Tulip" required /></label>
            <label className="form-field">Variant<input defaultValue={formProduct.variant} name="variant" placeholder="e.g. Premium" /></label>
            <label className="form-field">Category<input defaultValue={formProduct.category} name="category" placeholder="e.g. Seasonal" /></label>
            <label className="form-field">Unit<select defaultValue={formProduct.unit} name="unit"><option value="kg">Kilogram (kg)</option><option value="gram">Gram</option><option value="piece">Piece</option><option value="bundle">Bundle</option><option value="box">Box</option><option value="length">Length</option></select></label>
            <label className="form-field">Units per product<input defaultValue={formProduct.noOfUnits} min="0.01" name="noOfUnits" required step="any" type="number" /></label>
            <label className="form-field">Opening stock<input defaultValue={formProduct.stock} min="0" name="stock" required step="any" type="number" /></label>
            <label className="form-field">MRP (₹)<input defaultValue={formProduct.mrp} min="0" name="mrp" required step="0.01" type="number" /></label>
            <label className="form-field">Purchase price (₹)<input defaultValue={formProduct.purchasePrice} min="0" name="purchasePrice" required step="0.01" type="number" /></label>
            <label className="form-field">Selling price (₹)<input defaultValue={formProduct.sellingPrice} min="0" name="sellingPrice" required step="0.01" type="number" /></label>
            <div className="form-actions span-2">
              <button className="button button-secondary" disabled={saving} onClick={() => setShowForm(false)} type="button">Cancel</button>
              <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : editingProduct ? "Save changes" : "Add product"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default Products
