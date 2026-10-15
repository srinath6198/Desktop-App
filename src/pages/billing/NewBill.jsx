import { useEffect, useMemo, useState } from "react"
import { Check, MessageCircle, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react"
import { Badge, PageTitle, Panel } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import { customerService } from "../../services/customer.service"
import { productService } from "../../services/product.service"
import { salesService } from "../../services/sales.service"

function formatDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function NewBill() {
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [cart, setCart] = useState([])
  const [customerId, setCustomerId] = useState("")
  const [payment, setPayment] = useState("UPI")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [actionError, setActionError] = useState("")

  useEffect(() => {
    let mounted = true
    Promise.all([productService.list(), customerService.list()])
      .then(([productRows, customerRows]) => {
        if (!mounted) return
        setProducts(productRows.filter((product) => product.active))
        setCustomers(customerRows)
      })
      .catch((loadError) => {
        if (mounted) setActionError(loadError.message || "Unable to load billing data from the local database.")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const items = useMemo(() => cart.map((cartItem) => ({
    ...cartItem,
    product: products.find((product) => product.id === cartItem.productId),
  })).filter((item) => item.product), [cart, products])
  const subtotal = items.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0)
  const tax = Math.round(subtotal * 0.05)
  const total = subtotal + tax
  const visibleProducts = products.filter((product) => (
    `${product.name} ${product.variant} ${product.productCode} ${product.category}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase())
  ))

  function addToCart(product) {
    setActionError("")
    setCompleted(false)
    setReceipt(null)
    const existing = cart.find((item) => item.productId === product.id)
    if ((existing?.quantity ?? 0) >= product.stock) {
      setActionError(`Only ${product.stock} ${product.unit} of ${product.name} are available.`)
      return
    }
    setCart((current) => {
      const currentItem = current.find((item) => item.productId === product.id)
      return currentItem
        ? current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { productId: product.id, quantity: 1 }]
    })
  }

  function updateQuantity(productId, change) {
    setActionError("")
    setCart((current) => current.map((item) => {
      if (item.productId !== productId) return item
      const product = products.find((row) => row.id === productId)
      return { ...item, quantity: Math.min(item.quantity + change, product?.stock ?? item.quantity) }
    }).filter((item) => item.quantity > 0))
  }

  function buildReceipt(sale) {
    return {
      invoiceNumber: sale.invoice_number,
      customer: sale.customer_name,
      payment: sale.payment_method,
      paymentStatus: sale.payment_status,
      amountPaid: sale.amount_paid,
      date: formatDate(sale.created_at),
      items: sale.items.map((item) => ({
        name: item.product_name,
        variant: item.variant,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.price,
      })),
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.total,
    }
  }

  async function completeBill() {
    if (!items.length || saving) return
    if (payment === "Credit / due" && !customerId) {
      setActionError("Select a customer before creating a credit bill.")
      return
    }

    setSaving(true)
    setActionError("")
    try {
      const savedSale = await salesService.create({
        customerId: customerId || null,
        paymentMethod: payment,
        items,
      })
      const savedReceipt = buildReceipt(savedSale)
      setReceipt(savedReceipt)
      setCompleted(true)
      setCart([])
      setCustomerId("")
      setProducts((current) => current.map((product) => {
        const sold = items.find((item) => item.productId === product.id)
        return sold ? { ...product, stock: product.stock - sold.quantity } : product
      }))
    } catch (saveError) {
      setActionError(saveError.message || "Unable to save this bill.")
    } finally {
      setSaving(false)
    }
  }

  function printReceipt() {
    if (receipt) window.requestAnimationFrame(() => window.print())
  }

  async function shareOnWhatsApp() {
    if (!receipt) return
    const lines = receipt.items.map((item) =>
      `• ${item.name}${item.variant ? ` (${item.variant})` : ""} x${item.quantity} — ${formatCurrency(item.unitPrice * item.quantity)}`,
    )
    const message = [
      `*${receipt.invoiceNumber} — FlowerPOS*`,
      `Customer: ${receipt.customer}`,
      `Date: ${receipt.date}`,
      "",
      ...lines,
      "",
      `Subtotal: ${formatCurrency(receipt.subtotal)}`,
      `Tax (5%): ${formatCurrency(receipt.tax)}`,
      `*Total: ${formatCurrency(receipt.total)}*`,
      `Payment: ${receipt.payment}`,
      `Status: ${receipt.paymentStatus === "paid" ? "Paid" : `Due ${formatCurrency(receipt.total - receipt.amountPaid)}`}`,
      "",
      "Thank you for your purchase!",
    ].join("\n")
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    try {
      if (window.desktopAPI?.openExternal) {
        await window.desktopAPI.openExternal(whatsappUrl)
      } else {
        const whatsappWindow = window.open(whatsappUrl, "_blank")
        if (!whatsappWindow) throw new Error("The browser blocked the WhatsApp window. Allow pop-ups and try again.")
      }
    } catch (error) {
      setActionError(error.message || "Unable to open WhatsApp. Please try again.")
    }
  }

  return (
    <div className="screen">
      <PageTitle
        description="Select products and customers from your local database, then save and pay for the bill."
        title="Create a bill"
        action={<Badge tone="neutral">{receipt ? `Invoice # ${receipt.invoiceNumber}` : "SQLite billing"}</Badge>}
      />
      {actionError && <p className="error-banner" role="alert">{actionError}</p>}

      <div className="billing-layout">
        <Panel className="catalog-panel">
          <div className="panel-heading">
            <div><h3>Choose products</h3><p>Tap a product to add it to the bill</p></div>
            <Badge tone="neutral">{visibleProducts.length} products</Badge>
          </div>
          <label className="field-search billing-search">
            <Search size={17} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search product, code or category..." value={query} />
          </label>
          <div className="product-picker">
            {visibleProducts.map((product) => (
              <button
                className="picker-product"
                disabled={product.stock <= 0}
                key={product.id}
                onClick={() => addToCart(product)}
                type="button"
              >
                {product.imageDataUrl
                  ? <img alt={product.name} className="picker-product-image" src={product.imageDataUrl} />
                  : <div className="picker-flower">{product.name.slice(0, 1)}</div>}
                <strong>{product.name}{product.variant ? ` (${product.variant})` : ""}</strong>
                <span>{formatCurrency(product.sellingPrice)} / {product.unit}</span>
                <small>{product.stock} {product.unit} in stock</small>
                <span className="picker-add"><Plus size={16} /></span>
              </button>
            ))}
            {!loading && visibleProducts.length === 0 && (
              <div className="empty-cart">
                <ShoppingCart size={26} />
                <strong>{products.length ? "No matching products" : "No active products"}</strong>
                <span>{products.length ? "Try a different search." : "Add and activate products before creating a bill."}</span>
              </div>
            )}
            {loading && <div className="empty-cart">Loading products from the local database…</div>}
          </div>
        </Panel>

        <Panel className="bill-panel">
          <div className="panel-heading">
            <div><h3><ShoppingCart size={18} /> Current bill</h3><p>{items.length} different products</p></div>
            <button className="text-button" disabled={!items.length || saving} onClick={() => setCart([])} type="button">Clear</button>
          </div>
          <label className="form-field">
            Customer
            <select disabled={loading || saving} onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
              <option value="">Walk-in customer</option>
              {customers.map((item) => <option key={item.id} value={item.id}>{item.name}{item.phone ? ` · ${item.phone}` : ""}</option>)}
            </select>
          </label>
          <div className="bill-items">
            {items.map((item) => (
              <div className="bill-item" key={item.productId}>
                {item.product.imageDataUrl
                  ? <img alt="" className="bill-product-image" src={item.product.imageDataUrl} />
                  : <div className="flower-avatar">{item.product.name.slice(0, 1)}</div>}
                <div className="bill-item-copy">
                  <strong>{item.product.name}</strong>
                  {item.product.variant && <span className="bill-variant-name">{item.product.variant}</span>}
                  <span>{formatCurrency(item.product.sellingPrice)} / {item.product.unit}</span>
                </div>
                <div className="quantity-control">
                  <button aria-label={`Decrease ${item.product.name} quantity`} disabled={saving} onClick={() => updateQuantity(item.productId, -1)} type="button"><Minus size={13} /></button>
                  <span>{item.quantity}</span>
                  <button aria-label={`Increase ${item.product.name} quantity`} disabled={saving || item.quantity >= item.product.stock} onClick={() => updateQuantity(item.productId, 1)} type="button"><Plus size={13} /></button>
                </div>
                <strong className="line-total">{formatCurrency(item.product.sellingPrice * item.quantity)}</strong>
                <button aria-label={`Remove ${item.product.name}`} className="icon-button danger-icon" disabled={saving} onClick={() => setCart((current) => current.filter((row) => row.productId !== item.productId))} type="button"><Trash2 size={15} /></button>
              </div>
            ))}
            {!items.length && <div className="empty-cart"><ShoppingCart size={26} /><strong>Your bill is empty</strong><span>Choose products from the catalogue to get started.</span></div>}
          </div>
          <div className="bill-summary">
            <div><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div><span>Tax (5%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="bill-total"><strong>Total due</strong><strong>{formatCurrency(total)}</strong></div>
          </div>
          <label className="form-field payment-field">
            Payment method
            <select disabled={saving} onChange={(event) => setPayment(event.target.value)} value={payment}>
              <option>UPI</option><option>Cash</option><option>Card</option><option>Credit / due</option>
            </select>
          </label>
          {payment === "Credit / due" && <p className="muted-text">This invoice will be added to the selected customer’s outstanding credit.</p>}
          <button className="button button-primary checkout-button" disabled={!items.length || loading || saving} onClick={completeBill} type="button">
            <Check size={17} /> {saving ? "Saving bill..." : "Complete bill"}
          </button>
        </Panel>
      </div>

      {completed && receipt && (
        <Panel
          action={<Check className="completed-check" size={20} />}
          className="receipt-actions-panel"
          description={`Invoice ${receipt.invoiceNumber} · ${receipt.customer} · Total ${formatCurrency(receipt.total)}`}
          title="Bill saved"
        >
          <p className="receipt-actions-hint">
            {receipt.paymentStatus === "paid" ? "Payment recorded." : `Credit balance recorded: ${formatCurrency(receipt.total - receipt.amountPaid)}.`}
            {" "}Print the bill or share it with your customer.
          </p>
          <div className="receipt-actions">
            <button className="button button-primary" onClick={printReceipt} type="button"><Printer size={17} /> Print bill</button>
            <button className="button button-whatsapp" onClick={shareOnWhatsApp} type="button"><MessageCircle size={17} /> Share on WhatsApp</button>
          </div>
        </Panel>
      )}

      {receipt && (
        <article className="print-receipt">
          <header>
            <h1>FlowerPOS Flower Shop</h1>
            <p>Thank you for your purchase</p>
          </header>
          <div className="receipt-meta"><span>Invoice</span><strong>{receipt.invoiceNumber}</strong></div>
          <div className="receipt-meta"><span>Date</span><span>{receipt.date}</span></div>
          <div className="receipt-meta"><span>Customer</span><span>{receipt.customer}</span></div>
          <hr />
          <div className="receipt-lines">
            {receipt.items.map((item, index) => (
              <div className="receipt-line" key={`${item.name}-${item.variant}-${index}`}>
                <span>{item.name}{item.variant ? ` (${item.variant})` : ""}<small>{item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}</small></span>
                <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <hr />
          <div className="receipt-meta"><span>Subtotal</span><span>{formatCurrency(receipt.subtotal)}</span></div>
          <div className="receipt-meta"><span>Tax (5%)</span><span>{formatCurrency(receipt.tax)}</span></div>
          <div className="receipt-meta receipt-grand-total"><strong>Total</strong><strong>{formatCurrency(receipt.total)}</strong></div>
          <div className="receipt-meta"><span>Payment</span><span>{receipt.payment}</span></div>
          <div className="receipt-meta"><span>Status</span><span>{receipt.paymentStatus === "paid" ? "Paid" : `Due ${formatCurrency(receipt.total - receipt.amountPaid)}`}</span></div>
          <footer>Visit us again!</footer>
        </article>
      )}
    </div>
  )
}

export default NewBill
