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
  minimumStock: 0,
}

function ProductVariantFields({ prefix, variant = {} }) {
  return (
    <div className="form-grid">
      <label className="form-field">
        Variant name
        <input defaultValue={variant.variant ?? ""} maxLength="100" name={`${prefix}-variant`} placeholder="e.g. 50 cm, Small, Premium" required />
      </label>
      <label className="form-field">
        Product code
        <input defaultValue={variant.productCode ?? ""} maxLength="100" name={`${prefix}-productCode`} placeholder="Optional, unique per variant" />
      </label>
      <label className="form-field">
        Unit
        <select defaultValue={variant.unit ?? "piece"} name={`${prefix}-unit`}>
          <option value="kg">Kilogram (kg)</option><option value="gram">Gram</option><option value="piece">Piece</option><option value="bundle">Bundle</option><option value="box">Box</option><option value="length">Length</option>
        </select>
      </label>
      <label className="form-field">Units per product<input defaultValue={variant.noOfUnits ?? 1} min="0.01" name={`${prefix}-noOfUnits`} required step="any" type="number" /></label>
      <label className="form-field">Opening stock<input defaultValue={variant.stock ?? 0} min="0" name={`${prefix}-stock`} required step="any" type="number" /></label>
      <label className="form-field">Minimum stock<input defaultValue={variant.minimumStock ?? 0} min="0" name={`${prefix}-minimumStock`} required step="any" type="number" /></label>
      <label className="form-field">MRP (₹)<input defaultValue={variant.mrp ?? 0} min="0" name={`${prefix}-mrp`} required step="0.01" type="number" /></label>
      <label className="form-field">Purchase price (₹)<input defaultValue={variant.purchasePrice ?? 0} min="0" name={`${prefix}-purchasePrice`} required step="0.01" type="number" /></label>
      <label className="form-field">Selling price (₹)<input defaultValue={variant.sellingPrice ?? 0} min="0" name={`${prefix}-sellingPrice`} required step="0.01" type="number" /></label>
    </div>
  )
}

function Products() {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editingProduct, setEditingProduct] = useState(null)
  const [imageDataUrl, setImageDataUrl] = useState(null)
  const [imageChanged, setImageChanged] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const [variantRows, setVariantRows] = useState([0])
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

  const productGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const groups = new Map()
    products.forEach((product) => {
      const key = product.name.trim().toLocaleLowerCase()
      const group = groups.get(key) ?? { key, name: product.name, variants: [] }
      group.variants.push(product)
      groups.set(key, group)
    })
    return [...groups.values()]
      .map((group) => {
        const variants = group.variants.sort((left, right) => left.variant.localeCompare(right.variant))
        return { ...variants[0], ...group, variants }
      })
      .filter((group) => {
        const matchesStatus = group.variants.some((product) =>
          statusFilter === "all" || product.active === (statusFilter === "active"),
        )
        const matchesQuery = group.variants.some((product) =>
          [product.name, product.variant, product.category, product.productCode]
            .some((value) => value?.toLowerCase().includes(normalizedQuery)),
        )
        return matchesStatus && matchesQuery
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [products, query, statusFilter])

  function openCreateForm() {
    setEditingProduct(null)
    setVariantRows([0])
    setImageDataUrl(null)
    setImageChanged(false)
    setRemoveImage(false)
    setError("")
    setShowForm(true)
  }

  function openEditForm(productGroup) {
    setEditingProduct(productGroup)
    setVariantRows([])
    setImageDataUrl(productGroup.variants[0]?.imageDataUrl ?? null)
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
      name: String(form.get("name")).trim(),
      category: String(form.get("category")).trim(),
      imageDataUrl: imageChanged ? imageDataUrl : null,
      removeImage: imageChanged && removeImage,
    }

    try {
      let savedProducts
      if (editingProduct) {
        const updatedVariants = []
        for (const variant of editingProduct.variants) {
          const prefix = `existing-${variant.id}`
          updatedVariants.push(await productService.update({
            ...variant,
            ...product,
            id: variant.id,
            productCode: String(form.get(`${prefix}-productCode`)).trim(),
            variant: String(form.get(`${prefix}-variant`)).trim(),
            unit: String(form.get(`${prefix}-unit`)),
            noOfUnits: Number(form.get(`${prefix}-noOfUnits`)),
            mrp: Number(form.get(`${prefix}-mrp`)),
            purchasePrice: Number(form.get(`${prefix}-purchasePrice`)),
            sellingPrice: Number(form.get(`${prefix}-sellingPrice`)),
            stock: Number(form.get(`${prefix}-stock`)),
            minimumStock: Number(form.get(`${prefix}-minimumStock`)),
          }))
        }
        const addedVariants = variantRows.map((row) => ({
          ...product,
          productCode: String(form.get(`new-${row}-productCode`)).trim(),
          variant: String(form.get(`new-${row}-variant`)).trim(),
          unit: String(form.get(`new-${row}-unit`)),
          noOfUnits: Number(form.get(`new-${row}-noOfUnits`)),
          mrp: Number(form.get(`new-${row}-mrp`)),
          purchasePrice: Number(form.get(`new-${row}-purchasePrice`)),
          sellingPrice: Number(form.get(`new-${row}-sellingPrice`)),
          stock: Number(form.get(`new-${row}-stock`)),
          minimumStock: Number(form.get(`new-${row}-minimumStock`)),
          imageDataUrl,
        }))
        const createdVariants = addedVariants.length > 1
          ? await productService.createMany(addedVariants)
          : addedVariants.length === 1
            ? [await productService.create(addedVariants[0])]
            : []
        savedProducts = [...updatedVariants, ...createdVariants]
      } else {
        const variants = variantRows.map((row) => ({
          ...product,
          productCode: String(form.get(`new-${row}-productCode`)).trim(),
          variant: String(form.get(`new-${row}-variant`)).trim(),
          unit: String(form.get(`new-${row}-unit`)),
          noOfUnits: Number(form.get(`new-${row}-noOfUnits`)),
          mrp: Number(form.get(`new-${row}-mrp`)),
          purchasePrice: Number(form.get(`new-${row}-purchasePrice`)),
          sellingPrice: Number(form.get(`new-${row}-sellingPrice`)),
          stock: Number(form.get(`new-${row}-stock`)),
          minimumStock: Number(form.get(`new-${row}-minimumStock`)),
          imageDataUrl,
        }))
        savedProducts = variants.length > 1
          ? await productService.createMany(variants)
          : [await productService.create(variants[0])]
      }
      setProducts((current) => {
        const next = [...current]
        for (const savedProduct of savedProducts) {
          const exists = next.some((item) => item.id === savedProduct.id)
          if (exists) {
            const index = next.findIndex((item) => item.id === savedProduct.id)
            next[index] = savedProduct
          } else {
            next.push(savedProduct)
          }
        }
        return next.sort((left, right) =>
          left.name.localeCompare(right.name) || left.variant.localeCompare(right.variant),
        )
      })
      setSavedMessage(editingProduct
        ? `${savedProducts[0].name} updated${savedProducts.length > 1 ? `; added ${savedProducts.length - 1} variant${savedProducts.length === 2 ? "" : "s"}` : ""}.`
        : `${savedProducts.length} ${savedProducts.length === 1 ? "product variant" : "product variants"} added for ${product.name}.`)
      setShowForm(false)
      setEditingProduct(null)
    } catch (saveError) {
      setError(saveError.message || "Unable to save this product.")
      try {
        setProducts(await productService.list())
      } catch (refreshError) {
        setError(`${saveError.message || "Unable to save this product."} Also unable to refresh the product list: ${refreshError.message || "Unknown error."}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function changeProductStatus(product) {
    const nextActive = product.variants.some((variant) => !variant.active)
    const label = product.name
    const action = nextActive ? "reactivate" : "deactivate"
    const confirmation = nextActive
      ? `Reactivate all ${product.variants.length} variants of ${label}?`
      : `Deactivate all ${product.variants.length} variants of ${label}? Product records and sales history will be kept.`
    if (!window.confirm(confirmation)) return

    setError("")
    setSavedMessage("")
    setUpdatingStatusId(product.key)
    try {
      const updatedProducts = []
      for (const variant of product.variants) {
        if (variant.active !== nextActive) {
          updatedProducts.push(await productService.setActive(variant.id, nextActive))
        }
      }
      setProducts((current) => current.map((item) =>
        updatedProducts.find((updated) => updated.id === item.id) ?? item,
      ))
      setSavedMessage(`${label} variants ${action}d. Product records and sales history have been kept.`)
    } catch (statusError) {
      setError(statusError.message || `Unable to ${action} this product.`)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const formProduct = editingProduct ?? EMPTY_PRODUCT
  const existingVariantCount = editingProduct?.variants.length ?? 0
  const maxAdditionalVariants = Math.max(0, 4 - existingVariantCount)
  const activeProductNames = new Set(products.filter((product) => product.active).map((product) => product.name.trim().toLocaleLowerCase()))
  const allProductNames = new Set(products.map((product) => product.name.trim().toLocaleLowerCase()))
  const activeProductCount = activeProductNames.size
  const inactiveProductCount = [...allProductNames].filter((name) => !activeProductNames.has(name)).length

  return (
    <div className="screen">
      <PageTitle
        description="Keep your flower catalogue, prices and available stock up to date."
        title="Products"
        action={<button className="button button-primary" onClick={openCreateForm} type="button"><Plus size={17} /> Add product</button>}
      />

      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Flower2} label="Active products" value={activeProductCount} note="Products available for new sales" />
        <StatCard icon={Flower2} label="Inactive products" value={inactiveProductCount} note="Product records retained" tone="orange" />
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
          <span className="results-count">{productGroups.length} products · {products.length} variants</span>
        </div>
        {error && !showForm && <p className="error-banner product-error" role="alert">{error}</p>}
        {savedMessage && <p className="inline-success" role="status">{savedMessage}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Product</th><th>Category</th><th>Unit</th><th>Purchase price</th><th>Selling price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {productGroups.map((product) => {
                const activeCount = product.variants.filter((variant) => variant.active).length
                const allActive = activeCount === product.variants.length
                const allInactive = activeCount === 0
                return (
                <tr className={allInactive ? "inactive-product-row" : ""} key={product.key}>
                  <td>
                    <div className="table-product">
                      {product.imageDataUrl
                        ? <img alt="" className="product-thumbnail" src={product.imageDataUrl} />
                        : <div className="flower-avatar">{product.name.slice(0, 1)}</div>}
                      <div className="product-name-cell">
                        <strong>{product.name}</strong>
                        {product.variants.map((variant) => (
                          <span className="product-variant-summary" key={variant.id}>
                            {variant.variant || "Standard"} · {variant.noOfUnits > 1 ? `${variant.noOfUnits} ` : ""}{variant.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>{product.category || "—"}</td>
                  <td><div className="product-variant-values">{product.variants.map((variant) => <span key={variant.id}>{variant.noOfUnits > 1 ? `${variant.noOfUnits} ` : ""}{variant.unit}</span>)}</div></td>
                  <td><div className="product-variant-values">{product.variants.map((variant) => <span key={variant.id}>{formatCurrency(variant.purchasePrice)}</span>)}</div></td>
                  <td className="amount-cell"><div className="product-variant-values">{product.variants.map((variant) => <span key={variant.id}>{formatCurrency(variant.sellingPrice)}</span>)}</div></td>
                  <td><div className="product-variant-values">{product.variants.map((variant) => <Badge key={variant.id} tone={variant.stock < 10 ? "warning" : "success"}>{variant.stock} {variant.unit}</Badge>)}</div></td>
                  <td><Badge tone={allActive ? "success" : allInactive ? "neutral" : "warning"}>{allActive ? "Active" : allInactive ? "Inactive" : `${activeCount}/${product.variants.length} active`}</Badge></td>
                  <td>
                    <div className="product-row-actions">
                      <button aria-label={`Edit ${product.name} and its variants`} className="icon-button" onClick={() => openEditForm(product)} type="button"><Pencil size={15} /></button>
                      <button
                        aria-label={`${allActive ? "Deactivate" : "Reactivate"} all ${product.name} variants`}
                        className={`icon-button ${allActive ? "danger-icon" : "activate-icon"}`}
                        disabled={updatingStatusId === product.key}
                        onClick={() => changeProductStatus(product)}
                        title={allActive ? "Deactivate all variants" : "Reactivate all variants"}
                        type="button"
                      >
                        {allActive ? <Archive size={16} /> : <RotateCcw size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
              {!loading && productGroups.length === 0 && (
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
            <label className="form-field">Flower name<input autoFocus defaultValue={formProduct.name} name="name" placeholder="e.g. Yellow Tulip" required /></label>
            <label className="form-field">Category<input defaultValue={formProduct.category} name="category" placeholder="e.g. Seasonal" /></label>
            {editingProduct ? (
              <div className="span-2 product-variant-editor">
                <div className="product-variant-heading">
                  <div><strong>Variants for {editingProduct.name}</strong><small>Edit each variant here; name and category are shared by all variants.</small></div>
                  <button
                    className="button button-secondary"
                    disabled={saving || variantRows.length >= maxAdditionalVariants}
                    onClick={() => setVariantRows((current) => [...current, (current.length ? Math.max(...current) : -1) + 1])}
                    type="button"
                  >
                    <Plus size={15} /> Add variant
                  </button>
                </div>
                {editingProduct.variants.map((variant) => (
                  <section className="product-variant-row" key={variant.id}>
                    <div className="product-variant-row-heading">
                      <strong>{variant.variant || "Standard variant"}</strong>
                      <Badge tone={variant.active ? "success" : "neutral"}>{variant.active ? "Active" : "Inactive"}</Badge>
                    </div>
                    <ProductVariantFields prefix={`existing-${variant.id}`} variant={variant} />
                  </section>
                ))}
                {variantRows.map((row, index) => (
                  <section className="product-variant-row" key={`new-${row}`}>
                    <div className="product-variant-row-heading">
                      <strong>New variant {index + 1}</strong>
                      <button aria-label={`Remove new variant ${index + 1}`} className="icon-button danger-icon" disabled={saving} onClick={() => setVariantRows((current) => current.filter((item) => item !== row))} type="button"><X size={15} /></button>
                    </div>
                    <ProductVariantFields prefix={`new-${row}`} />
                  </section>
                ))}
              </div>
            ) : (
              <div className="span-2 product-variant-editor">
                <div className="product-variant-heading">
                  <div><strong>Product variants</strong><small>Each variant has its own unit, code, price and stock.</small></div>
                  <button
                    className="button button-secondary"
                    disabled={saving || variantRows.length >= 4}
                    onClick={() => setVariantRows((current) => [...current, Math.max(...current) + 1])}
                    type="button"
                  >
                    <Plus size={15} /> Add variant
                  </button>
                </div>
                {variantRows.map((row, index) => (
                  <section className="product-variant-row" key={row}>
                    <div className="product-variant-row-heading">
                      <strong>Variant {index + 1}</strong>
                      {variantRows.length > 1 && (
                        <button
                          aria-label={`Remove variant ${index + 1}`}
                          className="icon-button danger-icon"
                          disabled={saving}
                          onClick={() => setVariantRows((current) => current.filter((item) => item !== row))}
                          type="button"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    <ProductVariantFields prefix={`new-${row}`} />
                  </section>
                ))}
              </div>
            )}
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
