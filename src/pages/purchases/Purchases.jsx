import { useEffect, useRef, useState } from "react"
import { Check, Mail, MessageCircle, Plus, Printer, RotateCcw, Search, Trash2, Truck } from "lucide-react"
import { Badge, Modal, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import SupplierFormModal from "../../components/suppliers/SupplierFormModal"
import { formatCurrency } from "../../data/demoData"
import { productService } from "../../services/product.service"
import { purchaseService } from "../../services/purchase.service"
import { supplierService } from "../../services/supplier.service"

function getLocalDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatPurchaseDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function getPurchaseStatus(purchase) {
  const quantity = purchase.items.reduce((sum, item) => sum + item.quantity, 0)
  const returned = purchase.items.reduce((sum, item) => sum + item.returnedQuantity, 0)
  if (quantity > 0 && returned >= quantity) return "Returned"
  return returned > 0 ? "Partially returned" : "Received"
}

function toReceiptPurchase(purchase) {
  return {
    ...purchase,
    id: purchase.purchaseNumber,
    date: formatPurchaseDate(purchase.createdAt),
    lines: purchase.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      variant: item.variant,
      unit: item.unit,
      quantity: item.quantity,
      purchaseRate: item.purchaseRate,
      taxRate: item.taxRate,
      sellingPrice: item.sellingPrice,
      subtotal: item.subtotal,
      taxAmount: item.taxAmount,
      amount: item.total,
    })),
    subtotal: purchase.items.reduce((sum, item) => sum + item.subtotal, 0),
    tax: purchase.items.reduce((sum, item) => sum + item.taxAmount, 0),
  }
}

function createPurchaseLine(id) {
  return {
    id,
    productId: "",
    quantity: "1",
    purchaseRate: "",
    taxRate: "0",
    sellingPrice: "",
  }
}

function getLineAmounts(line) {
  const quantity = Number(line.quantity) || 0
  const purchaseRate = Number(line.purchaseRate) || 0
  const taxRate = Number(line.taxRate) || 0
  const subtotal = quantity * purchaseRate
  const taxAmount = subtotal * taxRate / 100
  return { subtotal, taxAmount, amount: subtotal + taxAmount }
}

function Purchases() {
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date()
    return {
      from: getLocalDateValue(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: getLocalDateValue(today),
    }
  })
  const [purchases, setPurchases] = useState([])
  console.log("purchases", purchases)
  const [purchasesLoading, setPurchasesLoading] = useState(true)
  const [purchaseError, setPurchaseError] = useState("")
  const [query, setQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState("")
  const [suppliers, setSuppliers] = useState([])
  const [supplierError, setSupplierError] = useState("")
  const [savedPurchase, setSavedPurchase] = useState(null)
  const [receiptActionError, setReceiptActionError] = useState("")
  const [products, setProducts] = useState([])
  const [productError, setProductError] = useState("")
  const [productsLoading, setProductsLoading] = useState(true)
  const [purchaseLines, setPurchaseLines] = useState([createPurchaseLine(0)])
  const nextLineId = useRef(1)
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [supplierSaving, setSupplierSaving] = useState(false)
  const [supplierFormError, setSupplierFormError] = useState("")
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [purchaseSaving, setPurchaseSaving] = useState(false)
  const [purchaseToReturn, setPurchaseToReturn] = useState(null)
  const [returnQuantities, setReturnQuantities] = useState({})
  const [returnError, setReturnError] = useState("")
  const [returnSaving, setReturnSaving] = useState(false)

  useEffect(() => {
    let active = true
    purchaseService.list(dateRange)
      .then((rows) => {
        if (active) setPurchases(rows)
      })
      .catch((error) => {
        if (active) setPurchaseError(error.message || "Unable to load purchases.")
      })
      .finally(() => {
        if (active) setPurchasesLoading(false)
      })
    return () => {
      active = false
    }
  }, [dateRange])

  useEffect(() => {
    supplierService.list()
      .then((rows) => setSuppliers(rows.filter((supplier) => supplier.active)))
      .catch((error) => setSupplierError(error.message || "Unable to load suppliers."))

    productService.list()
      .then((rows) => setProducts(rows.filter((product) => product.active)))
      .catch((error) => setProductError(error.message || "Unable to load products."))
      .finally(() => setProductsLoading(false))
  }, [])

  async function addPurchase(event) {
    event.preventDefault()
    setPurchaseError("")
    setSupplierError("")
    setProductError("")
    const selectedSupplier = suppliers.find((supplier) => String(supplier.id) === selectedSupplierId)
    if (!selectedSupplier) {
      setSupplierError("Select an active supplier before saving the purchase.")
      return
    }
    if (!purchaseLines.length || purchaseLines.some((line) => !products.some((product) => String(product.id) === line.productId))) {
      setProductError("Select an active product for every purchase line.")
      return
    }

    setPurchaseSaving(true)
    try {
      const purchase = await purchaseService.create({
        supplierId: selectedSupplier.id,
        items: purchaseLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          purchaseRate: line.purchaseRate,
          taxRate: line.taxRate,
          sellingPrice: line.sellingPrice,
        })),
      })
      setPurchases((current) => [purchase, ...current])
      const receipt = toReceiptPurchase(purchase)
      setSavedPurchase(receipt)
      setReceiptActionError("")
      setMessage(`${receipt.id} saved to the database for ${formatCurrency(purchase.total)}.`)
      setShowForm(false)
    } catch (error) {
      setPurchaseError(error.message || "Unable to save the purchase.")
    } finally {
      setPurchaseSaving(false)
    }
  }

  function openReturnForm(purchase) {
    setPurchaseToReturn(purchase)
    setReturnQuantities(Object.fromEntries(purchase.items.map((item) => [item.id, "0"])))
    setReturnError("")
  }

  async function submitPurchaseReturn(event) {
    event.preventDefault()
    const items = purchaseToReturn.items
      .map((item) => ({ purchaseItemId: item.id, quantity: Number(returnQuantities[item.id]) || 0 }))
      .filter((item) => item.quantity > 0)
    if (items.length === 0) {
      setReturnError("Enter a return quantity for at least one item.")
      return
    }
    setReturnSaving(true)
    setReturnError("")
    try {
      const result = await purchaseService.createReturn(purchaseToReturn.id, items)
      setPurchases((current) => current.map((purchase) => (
        purchase.id === result.purchase.id ? result.purchase : purchase
      )))
      setMessage(`${result.returnNumber} saved. Returned value: ${formatCurrency(result.total)}.`)
      setPurchaseToReturn(null)
    } catch (error) {
      setReturnError(error.message || "Unable to save the purchase return.")
    } finally {
      setReturnSaving(false)
    }
  }

  function printPurchaseReceipt() {
    if (savedPurchase) window.requestAnimationFrame(() => window.print())
  }

  async function sharePurchaseOnWhatsApp() {
    if (!savedPurchase) return
    const lines = savedPurchase.lines.map((line) =>
      `• ${line.productName}${line.variant ? ` (${line.variant})` : ""} — ${line.quantity} ${line.unit} × ${formatCurrency(line.purchaseRate)} = ${formatCurrency(line.amount)}`,
    )
    const text = [
      `*Purchase ${savedPurchase.id} — Offline POS*`,
      `Supplier: ${savedPurchase.supplier}`,
      `Date: ${savedPurchase.date}`,
      "",
      ...lines,
      "",
      `Subtotal: ${formatCurrency(savedPurchase.subtotal)}`,
      `Tax: ${formatCurrency(savedPurchase.tax)}`,
      `*Total: ${formatCurrency(savedPurchase.total)}*`,
    ].join("\n")
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    setReceiptActionError("")
    try {
      if (window.desktopAPI?.openExternal) {
        await window.desktopAPI.openExternal(url)
      } else {
        const shareWindow = window.open(url, "_blank")
        if (!shareWindow) throw new Error("The browser blocked the WhatsApp window. Allow pop-ups and try again.")
      }
    } catch (error) {
      setReceiptActionError(error.message || "Unable to open WhatsApp.")
    }
  }

  async function emailPurchaseReceipt() {
    if (!savedPurchase?.supplierEmail) return
    const subject = `Purchase receipt ${savedPurchase.id}`
    const body = [
      `Purchase receipt ${savedPurchase.id}`,
      `Supplier: ${savedPurchase.supplier}`,
      `Date: ${savedPurchase.date}`,
      "",
      ...savedPurchase.lines.map((line) =>
        `${line.productName}${line.variant ? ` (${line.variant})` : ""}: ${line.quantity} ${line.unit} x ${formatCurrency(line.purchaseRate)} = ${formatCurrency(line.amount)}`,
      ),
      "",
      `Subtotal: ${formatCurrency(savedPurchase.subtotal)}`,
      `Tax: ${formatCurrency(savedPurchase.tax)}`,
      `Total: ${formatCurrency(savedPurchase.total)}`,
    ].join("\n")
    setReceiptActionError("")
    try {
      if (window.desktopAPI?.openEmail) {
        await window.desktopAPI.openEmail(savedPurchase.supplierEmail, subject, body)
      } else {
        window.location.href = `mailto:${encodeURIComponent(savedPurchase.supplierEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      }
    } catch (error) {
      setReceiptActionError(error.message || "Unable to open the email application.")
    }
  }

  function updatePurchaseLine(lineId, field, value) {
    setPurchaseLines((current) => current.map((line) => (
      line.id === lineId ? { ...line, [field]: value } : line
    )))
  }

  function selectProduct(lineId, productId) {
    const product = products.find((item) => String(item.id) === productId)
    setPurchaseLines((current) => current.map((line) => (
      line.id === lineId
        ? {
            ...line,
            productId,
            purchaseRate: product ? String(product.purchasePrice ?? 0) : "",
            sellingPrice: product ? String(product.sellingPrice ?? 0) : "",
          }
        : line
    )))
    setProductError("")
  }

  function addPurchaseLine() {
    setPurchaseLines((current) => [...current, createPurchaseLine(nextLineId.current++)])
  }

  function removePurchaseLine(lineId) {
    setPurchaseLines((current) => current.length > 1
      ? current.filter((line) => line.id !== lineId)
      : current)
  }

  const purchaseSubtotal = purchaseLines.reduce((sum, line) => sum + getLineAmounts(line).subtotal, 0)
  const purchaseTax = purchaseLines.reduce((sum, line) => sum + getLineAmounts(line).taxAmount, 0)
  const purchaseTotal = purchaseSubtotal + purchaseTax
  async function saveSupplier(event) {
    event.preventDefault()
    setSupplierSaving(true)
    setSupplierFormError("")
    const form = new FormData(event.currentTarget)
    const supplier = {
      name: String(form.get("name")).trim(),
      phone: String(form.get("phone")).trim(),
      email: String(form.get("email")).trim(),
      address: String(form.get("address")).trim(),
      state: String(form.get("state")).trim(),
      pincode: String(form.get("pincode")).trim(),
    }
    try {
      const savedSupplier = await supplierService.create(supplier)
      setSuppliers((current) => [...current, savedSupplier].sort((left, right) => left.name.localeCompare(right.name)))
      setSelectedSupplierId(String(savedSupplier.id))
      setShowSupplierForm(false)
    } catch (error) {
      setSupplierFormError(error.message || "Unable to save supplier.")
    } finally {
      setSupplierSaving(false)
    }
  }

  const filtered = purchases.filter((purchase) => (
    `${purchase.purchaseNumber} ${purchase.supplier}`.toLowerCase().includes(query.toLowerCase())
  ))
  const purchaseRangeTotal = purchases.reduce((sum, purchase) => sum + purchase.total, 0)
  const returnedTotal = purchases.reduce((sum, purchase) => sum + purchase.returnedTotal, 0)

  return (
    <div className="screen">
      <PageTitle description="Record supplier deliveries, review purchase history, and manage returns." title="Purchases" action={<button className="button button-primary" onClick={() => { setSelectedSupplierId(""); setPurchaseLines([createPurchaseLine(nextLineId.current++)]); setProductError(""); setPurchaseError(""); setShowForm(true) }} type="button"><Plus size={17} /> Record purchase</button>} />
      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Truck} label="Purchases in selected dates" value={formatCurrency(purchaseRangeTotal)} note={`${purchases.length} purchase orders`} />
        <StatCard icon={Truck} label="Purchase orders" value={purchases.length} note="In selected date range" tone="blue" />
        <StatCard icon={RotateCcw} label="Returned value" value={formatCurrency(returnedTotal)} note="In selected date range" tone="orange" />
      </div>
      {savedPurchase && (
        <Panel
          className="receipt-actions-panel"
          description={`Purchase ${savedPurchase.id} · ${savedPurchase.supplier} · Total ${formatCurrency(savedPurchase.total)}`}
          title="Purchase saved"
          action={<Check className="completed-check" size={20} />}
        >
          <p className="receipt-actions-hint">Purchase details are ready to print or share with the supplier.</p>
          <div className="receipt-actions">
            <button className="button button-primary" onClick={printPurchaseReceipt} type="button"><Printer size={17} /> Print purchase</button>
            <button className="button button-whatsapp" onClick={sharePurchaseOnWhatsApp} type="button"><MessageCircle size={17} /> Share on WhatsApp</button>
            <button className="button button-secondary" disabled={!savedPurchase.supplierEmail} onClick={emailPurchaseReceipt} type="button"><Mail size={17} /> Email supplier</button>
          </div>
          {!savedPurchase.supplierEmail && <p className="muted-text">Add an email address to this supplier to enable email sharing.</p>}
          {receiptActionError && <p className="error-banner" role="alert">{receiptActionError}</p>}
        </Panel>
      )}
      <Panel className="table-panel">
        <div className="purchase-filters">
          <label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search purchase or supplier..." value={query} /></label>
          <label className="purchase-date-filter">From<input aria-label="Purchase date from" max={dateRange.to || undefined} onChange={(event) => { setPurchaseError(""); setPurchasesLoading(true); setDateRange((current) => ({ ...current, from: event.target.value })) }} type="date" value={dateRange.from} /></label>
          <label className="purchase-date-filter">To<input aria-label="Purchase date to" min={dateRange.from || undefined} onChange={(event) => { setPurchaseError(""); setPurchasesLoading(true); setDateRange((current) => ({ ...current, to: event.target.value })) }} type="date" value={dateRange.to} /></label>
          <span className="results-count">{filtered.length} orders</span>
        </div>
        {message && <p className="inline-success" role="status">{message}</p>}
        {purchaseError && <p className="error-banner product-error" role="alert">{purchaseError}</p>}
        <div className="table-wrap"><table><thead><tr><th>Purchase ID</th><th>Supplier</th><th>Date</th><th>Line items</th><th>UOM</th><th>Total</th><th>Returned</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map((purchase) => {
          const status = getPurchaseStatus(purchase)
          const canReturn = purchase.items.some((item) => item.availableToReturn > 0)
          return (
            <tr key={purchase.id}>
              <td><strong>{purchase.purchaseNumber}</strong></td>
              <td>{purchase.supplier}</td>
              <td>{formatPurchaseDate(purchase.createdAt)}</td>
              <td>{purchase.itemCount} products</td>
              <td>{purchase.uom}</td>
              <td className="amount-cell">{formatCurrency(purchase.total)}</td>
              <td>{formatCurrency(purchase.returnedTotal)}</td>
              <td><Badge tone={status === "Received" ? "success" : status === "Returned" ? "neutral" : "warning"}>{status}</Badge></td>
              <td><button className="button button-secondary purchase-return-button" disabled={!canReturn} onClick={() => openReturnForm(purchase)} type="button"><RotateCcw size={14} /> Return</button></td>
            </tr>
          )
        })}{!purchasesLoading && filtered.length === 0 && <tr><td className="empty-table" colSpan="9">{purchaseError ? "Purchase data could not be loaded." : "No purchases found for the selected dates."}</td></tr>}{purchasesLoading && <tr><td className="empty-table" colSpan="9">Loading purchases from the local database…</td></tr>}</tbody></table></div>
      </Panel>
      {showForm && <Modal className="purchase-modal-card" onClose={() => !purchaseSaving && setShowForm(false)} title="Record a purchase"><form className="form-grid" onSubmit={addPurchase}>
        {purchaseError && <p className="error-banner span-2" role="alert">{purchaseError}</p>}
        <div className="supplier-selection-row span-2">
          <label className="form-field">Supplier<select onChange={(event) => setSelectedSupplierId(event.target.value)} value={selectedSupplierId} required><option value="">Choose supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <button className="button button-secondary supplier-add-button" onClick={() => { setSupplierFormError(""); setShowSupplierForm(true) }} type="button"><Plus size={15} /> Add supplier</button>
        </div>
        {supplierError && <p className="error-banner span-2" role="alert">{supplierError}</p>}
        {!suppliers.length && !supplierError && <p className="muted-text span-2">Add a supplier before recording a purchase.</p>}
        <section className="purchase-line-items span-2">
          <div className="purchase-line-heading">
            <div><h4>Purchase items</h4><p>Choose a product from your active product list.</p></div>
            <button className="button button-secondary" disabled={productsLoading || products.length === 0} onClick={addPurchaseLine} type="button"><Plus size={15} /> Add item</button>
          </div>
          {productsLoading && <p className="muted-text">Loading products from the database…</p>}
          {productError && <p className="error-banner" role="alert">{productError}</p>}
          {!productsLoading && !productError && products.length === 0 && <p className="muted-text">No active products found. Add or activate products before recording a purchase.</p>}
          {products.length > 0 && (
            <div className="purchase-lines-scroll">
              <table className="purchase-lines-table">
                <thead><tr><th>Product Name</th><th>Variant</th><th>UOM</th><th>Qty</th><th>Pur Rate / unit</th><th>Tax (%)</th><th>Amount</th><th>Selling Price</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {purchaseLines.map((line) => {
                    const product = products.find((item) => String(item.id) === line.productId)
                    const amounts = getLineAmounts(line)
                    return (
                      <tr key={line.id}>
                        <td><select aria-label="Product Name" onChange={(event) => selectProduct(line.id, event.target.value)} required value={line.productId}><option value="">Select product</option>{products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.variant ? ` - ${item.variant}` : ""}</option>)}</select></td>
                        <td>{product?.variant || "—"}</td>
                        <td>{product?.unit || "—"}</td>
                        <td><input aria-label="Quantity" min="0.01" onChange={(event) => updatePurchaseLine(line.id, "quantity", event.target.value)} required step="any" type="number" value={line.quantity} /></td>
                        <td><input aria-label="Purchase rate per unit" min="0" onChange={(event) => updatePurchaseLine(line.id, "purchaseRate", event.target.value)} required step="0.01" type="number" value={line.purchaseRate} /></td>
                        <td><input aria-label="Tax percentage" max="100" min="0" onChange={(event) => updatePurchaseLine(line.id, "taxRate", event.target.value)} required step="0.01" type="number" value={line.taxRate} /></td>
                        <td className="purchase-line-amount">{formatCurrency(amounts.amount)}</td>
                        <td><input aria-label="Selling price" min="0" onChange={(event) => updatePurchaseLine(line.id, "sellingPrice", event.target.value)} required step="0.01" type="number" value={line.sellingPrice} /></td>
                        <td><button aria-label="Remove item" className="icon-button purchase-remove-line" disabled={purchaseLines.length === 1} onClick={() => removePurchaseLine(line.id)} type="button"><Trash2 size={15} /></button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <div className="purchase-totals span-2">
          <span>Subtotal <strong>{formatCurrency(purchaseSubtotal)}</strong></span>
          <span>Tax <strong>{formatCurrency(purchaseTax)}</strong></span>
          <span className="purchase-grand-total">Total amount <strong>{formatCurrency(purchaseTotal)}</strong></span>
        </div>
        <div className="form-actions span-2"><button className="button button-secondary" disabled={purchaseSaving} onClick={() => setShowForm(false)} type="button">Cancel</button><button className="button button-primary" disabled={purchaseSaving || productsLoading || products.length === 0} type="submit">{purchaseSaving ? "Saving…" : "Save purchase"}</button></div>
      </form></Modal>}
      {purchaseToReturn && (
        <Modal className="purchase-modal-card" onClose={() => !returnSaving && setPurchaseToReturn(null)} title={`Return items from ${purchaseToReturn.purchaseNumber}`}>
          <form className="form-grid" onSubmit={submitPurchaseReturn}>
            <p className="muted-text span-2">Return quantities are limited by the quantity purchased and the stock currently available.</p>
            {returnError && <p className="error-banner span-2" role="alert">{returnError}</p>}
            <div className="purchase-lines-scroll span-2">
              <table className="purchase-lines-table purchase-return-table">
                <thead><tr><th>Product</th><th>Purchased</th><th>Already returned</th><th>Available</th><th>Return quantity</th></tr></thead>
                <tbody>{purchaseToReturn.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}{item.variant ? ` (${item.variant})` : ""}</td>
                    <td>{item.quantity} {item.unit}</td>
                    <td>{item.returnedQuantity} {item.unit}</td>
                    <td>{item.availableToReturn} {item.unit}</td>
                    <td><input
                      aria-label={`Return quantity for ${item.productName}`}
                      disabled={item.availableToReturn <= 0}
                      max={item.availableToReturn}
                      min="0"
                      onChange={(event) => setReturnQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                      step="any"
                      type="number"
                      value={returnQuantities[item.id] ?? "0"}
                    /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="form-actions span-2">
              <button className="button button-secondary" disabled={returnSaving} onClick={() => setPurchaseToReturn(null)} type="button">Cancel</button>
              <button className="button button-primary" disabled={returnSaving} type="submit">{returnSaving ? "Saving return…" : "Save purchase return"}</button>
            </div>
          </form>
        </Modal>
      )}
      {showSupplierForm && <SupplierFormModal error={supplierFormError} onClose={() => setShowSupplierForm(false)} onSubmit={saveSupplier} saving={supplierSaving} title="Add supplier" submitLabel="Save supplier" />}
      {savedPurchase && (
        <article className="print-receipt purchase-print-receipt">
          <header>
            <h1>Offline POS Purchase Receipt</h1>
            <p>Supplier purchase record</p>
          </header>
          <div className="receipt-meta"><span>Purchase</span><strong>{savedPurchase.id}</strong></div>
          <div className="receipt-meta"><span>Date</span><span>{savedPurchase.date}</span></div>
          <div className="receipt-meta"><span>Supplier</span><span>{savedPurchase.supplier}</span></div>
          <hr />
          <div className="receipt-lines">
            {savedPurchase.lines.map((line, index) => (
              <div className="receipt-line" key={`${line.productId}-${index}`}>
                <span>{line.productName}{line.variant ? ` (${line.variant})` : ""}<small>{line.quantity} {line.unit} × {formatCurrency(line.purchaseRate)} · Tax {line.taxRate}%</small></span>
                <strong>{formatCurrency(line.amount)}</strong>
              </div>
            ))}
          </div>
          <hr />
          <div className="receipt-meta"><span>Subtotal</span><span>{formatCurrency(savedPurchase.subtotal)}</span></div>
          <div className="receipt-meta"><span>Tax</span><span>{formatCurrency(savedPurchase.tax)}</span></div>
          <div className="receipt-meta receipt-grand-total"><strong>Total</strong><strong>{formatCurrency(savedPurchase.total)}</strong></div>
        </article>
      )}
    </div>
  )
}

export default Purchases
