import { useMemo, useState } from "react"
import { Check, MessageCircle, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react"
import { Badge, Modal, PageTitle, Panel } from "../../components/ui/PageUI"
import { demoCustomers, demoProducts, formatCurrency } from "../../data/demoData"

function createReceipt(items, customer, payment, subtotal, tax) {
  return {
    invoiceNumber: "INV-1049",
    customer: customer || "Walk-in customer",
    payment,
    date: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date()),
    items: items.map((item) => ({
      name: item.product.name,
      variant: item.variant?.name,
      unit: item.variant?.unit ?? item.product.unit,
      quantity: item.quantity,
      unitPrice: item.variant?.sellingPrice ?? item.product.sellingPrice,
    })),
    subtotal,
    tax,
    total: subtotal + tax,
  }
}

function NewBill() {
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState([{ productId: 1, quantity: 2 }, { productId: 4, quantity: 1 }])
  const [customer, setCustomer] = useState("")
  const [payment, setPayment] = useState("UPI")
  const [completed, setCompleted] = useState(false)
  const [variantProduct, setVariantProduct] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [actionError, setActionError] = useState("")
  const items = useMemo(() => cart.map((item) => {
    const product = demoProducts.find((entry) => entry.id === item.productId)
    const variant = product?.variants?.find((entry) => entry.id === item.variantId)
    return { ...item, product, variant }
  }).filter((item) => item.product), [cart])
  const subtotal = items.reduce((sum, item) => sum + (item.variant?.sellingPrice ?? item.product.sellingPrice) * item.quantity, 0)
  const tax = Math.round(subtotal * 0.05)

  function addToCart(productId, variantId) {
    setCompleted(false)
    setReceipt(null)
    setActionError("")
    setCart((current) => {
      const existing = current.find((item) => item.productId === productId && item.variantId === variantId)
      return existing
        ? current.map((item) => item.productId === productId && item.variantId === variantId ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { productId, variantId, quantity: 1 }]
    })
  }

  function selectProduct(product) {
    if (product.variants?.length) {
      setVariantProduct(product)
      return
    }
    addToCart(product.id)
  }

  function updateQuantity(productId, variantId, change) {
    setCart((current) => current.map((item) => item.productId === productId && item.variantId === variantId ? { ...item, quantity: item.quantity + change } : item).filter((item) => item.quantity > 0))
  }

  function finishBill(receiptData) {
    setReceipt(receiptData)
    setCompleted(true)
    setActionError("")
    setCart([])
  }

  function completeBill() {
    if (!items.length) return
    const receiptData = createReceipt(items, customer, payment, subtotal, tax)
    if (receiptData) finishBill(receiptData)
  }

  function printReceipt() {
    if (!receipt) return
    window.requestAnimationFrame(() => window.print())
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
      `Tax: ${formatCurrency(receipt.tax)}`,
      `*Total: ${formatCurrency(receipt.total)}*`,
      `Payment: ${receipt.payment}`,
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

  const visibleProducts = demoProducts.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="screen">
      <PageTitle description="Select flowers, add a customer and complete the sale." title="Create a bill" action={<Badge tone="neutral">Invoice # INV-1049</Badge>} />
      <div className="billing-layout">
        <Panel className="catalog-panel">
          <div className="panel-heading"><div><h3>Choose flowers</h3><p>Tap a product to add it to the bill</p></div><Badge tone="neutral">{visibleProducts.length} items</Badge></div>
          <label className="field-search billing-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Find a flower..." value={query} /></label>
          <div className="product-picker">
            {visibleProducts.map((product) => (
              <button className="picker-product" key={product.id} onClick={() => selectProduct(product)} type="button">
                <div className="picker-flower">{product.name.slice(0, 1)}</div><strong>{product.name}</strong><span>{formatCurrency(product.sellingPrice)} / {product.unit}</span><small>{product.stock} in stock</small><span className="picker-add"><Plus size={16} /></span>
                {product.variants?.length > 0 && <span className="picker-variant-hint">{product.variants.length} options</span>}
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="bill-panel">
          <div className="panel-heading"><div><h3><ShoppingCart size={18} /> Current bill</h3><p>{items.length} different products</p></div><button className="text-button" onClick={() => setCart([])} type="button">Clear</button></div>
          <label className="form-field">Customer<select onChange={(event) => setCustomer(event.target.value)} value={customer}><option value="">Walk-in customer</option>{demoCustomers.filter((item) => item.name !== "Walk-in customer").map((item) => <option key={item.id}>{item.name}</option>)}</select></label>
          <div className="bill-items">
            {items.map((item) => (
              <div className="bill-item" key={`${item.productId}-${item.variantId ?? "default"}`}>
                <div className="flower-avatar">{item.product.name.slice(0, 1)}</div><div className="bill-item-copy"><strong>{item.product.name}</strong>{item.variant && <span className="bill-variant-name">{item.variant.name}</span>}<span>{formatCurrency(item.variant?.sellingPrice ?? item.product.sellingPrice)} each</span></div>
                <div className="quantity-control"><button aria-label={`Decrease ${item.product.name} quantity`} onClick={() => updateQuantity(item.productId, item.variantId, -1)} type="button"><Minus size={13} /></button><span>{item.quantity}</span><button aria-label={`Increase ${item.product.name} quantity`} onClick={() => updateQuantity(item.productId, item.variantId, 1)} type="button"><Plus size={13} /></button></div>
                <strong className="line-total">{formatCurrency((item.variant?.sellingPrice ?? item.product.sellingPrice) * item.quantity)}</strong>
                <button aria-label={`Remove ${item.product.name}`} className="icon-button danger-icon" onClick={() => setCart((current) => current.filter((row) => row.productId !== item.productId || row.variantId !== item.variantId))} type="button"><Trash2 size={15} /></button>
              </div>
            ))}
            {!items.length && <div className="empty-cart"><ShoppingCart size={26} /><strong>Your bill is empty</strong><span>Choose flowers from the catalogue to get started.</span></div>}
          </div>
          <div className="bill-summary">
            <div><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div><span>Tax (5%)</span><span>{formatCurrency(tax)}</span></div>
            <div className="bill-total"><strong>Total due</strong><strong>{formatCurrency(subtotal + tax)}</strong></div>
          </div>
          <label className="form-field payment-field">Payment method<select onChange={(event) => setPayment(event.target.value)} value={payment}><option>UPI</option><option>Cash</option><option>Card</option><option>Credit / due</option></select></label>
          <button className="button button-primary checkout-button" disabled={!items.length} onClick={completeBill} type="button"><Check size={17} /> Complete bill</button>
        </Panel>
      </div>
      {completed && receipt && (
        <Panel
          className="receipt-actions-panel"
          description={`Invoice ${receipt.invoiceNumber} · ${receipt.customer} · Total ${formatCurrency(receipt.total)}`}
          title="Bill completed"
          action={<Check className="completed-check" size={20} />}
        >
          <p className="receipt-actions-hint">Your bill is ready. Print it or share it with your customer.</p>
          <div className="receipt-actions">
            <button className="button button-primary" onClick={printReceipt} type="button"><Printer size={17} /> Print bill</button>
            <button className="button button-whatsapp" onClick={shareOnWhatsApp} type="button"><MessageCircle size={17} /> Share on WhatsApp</button>
          </div>
          {actionError && <p className="error-banner" role="alert">{actionError}</p>}
        </Panel>
      )}
      <p className="demo-notice">Demo billing screen · Totals use sample prices; sales are not saved until database integration.</p>
      {receipt && (
        <article className="print-receipt">
          <header>
            <h1>FlowerPOS Flower Shop</h1>
            <p>12 Market Road, Bengaluru</p>
            <p>Thank you for your purchase</p>
          </header>
          <div className="receipt-meta"><span>Invoice</span><strong>{receipt.invoiceNumber}</strong></div>
          <div className="receipt-meta"><span>Date</span><span>{receipt.date}</span></div>
          <div className="receipt-meta"><span>Customer</span><span>{receipt.customer}</span></div>
          <hr />
          <div className="receipt-lines">
            {receipt.items.map((item, index) => (
              <div className="receipt-line" key={`${item.name}-${item.variant ?? "default"}-${index}`}>
                <span>{item.name}{item.variant ? ` (${item.variant})` : ""}<small>{item.quantity} × {formatCurrency(item.unitPrice)}</small></span>
                <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <hr />
          <div className="receipt-meta"><span>Subtotal</span><span>{formatCurrency(receipt.subtotal)}</span></div>
          <div className="receipt-meta"><span>Tax (5%)</span><span>{formatCurrency(receipt.tax)}</span></div>
          <div className="receipt-meta receipt-grand-total"><strong>Total</strong><strong>{formatCurrency(receipt.total)}</strong></div>
          <div className="receipt-meta"><span>Payment</span><span>{receipt.payment}</span></div>
          <footer>Visit us again!</footer>
        </article>
      )}
      {variantProduct && (
        <Modal onClose={() => setVariantProduct(null)} title={`Choose ${variantProduct.name} option`}>
          <p className="variant-dialog-description">Select the option to add to this bill.</p>
          <div className="variant-options">
            {variantProduct.variants.map((variant) => (
              <button
                className="variant-option"
                key={variant.id}
                onClick={() => {
                  addToCart(variantProduct.id, variant.id)
                  setVariantProduct(null)
                }}
                type="button"
              >
                <span className="variant-option-copy"><strong>{variant.name}</strong><small>{variant.stock} {variant.unit} in stock</small></span>
                <strong className="variant-option-price">{formatCurrency(variant.sellingPrice)}</strong>
                <Plus size={17} />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default NewBill
