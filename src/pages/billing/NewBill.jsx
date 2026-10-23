import { useEffect, useMemo, useState } from "react"
import { Check, FileText, MessageCircle, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react"
import { Badge, Modal, PageTitle, Panel } from "../../components/ui/PageUI"
import BillTerms from "../../components/billing/BillTerms"
import ToastContainer from "../../components/ui/ToastContainer"
import PrintableBill, { printBill } from "../../components/billing/PrintableBill"
import { formatCurrency } from "../../data/demoData"
import { customerService } from "../../services/customer.service"
import { productService } from "../../services/product.service"
import Reprint from "../Reprint/Reprint"
import { salesService } from "../../services/sales.service"
import { settingsService } from "../../services/settings.service"
import { toBillReceipt } from "../../utils/billReceipt"
import { shareBillPdf as saveAndOpenBillPdf } from "../../utils/shareBillPdf"
import AddCustomer from "../customers/AddCustomer"
import ExtraChargeModal, { ExtraChargeSummary } from "../../components/billing/ExtraCharge"
import CustomerSearchSelect from "../../components/billing/CustomerSearchSelect"

const DEFAULT_CHARGES = { parcelCharge: 0, travelCharge: 0, deliveryCharge: 0, otherCharge: 0, otherChargeLabel: "Other" }
const WALK_IN_CUSTOMER = "__walk_in_customer__"

function NewBill() {
  const [query, setQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [products, setProducts] = useState([])
  const [variantProduct, setVariantProduct] = useState(null)
  const [customers, setCustomers] = useState([])
  const [shopSettings, setShopSettings] = useState(null)
  const [cart, setCart] = useState([])
  const [customerId, setCustomerId] = useState("")
  const [payment, setPayment] = useState("UPI")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [actionError, setActionError] = useState("")
  const [shareMessage, setShareMessage] = useState("")
  const [showSavedBills, setShowSavedBills] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [toast, setToast] = useState(null)
  const [charges, setCharges] = useState(DEFAULT_CHARGES)
  const [showChargeModal, setShowChargeModal] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([productService.list(), customerService.list(), settingsService.get()])
      .then(([productRows, customerRows, savedSettings]) => {
        if (!mounted) return
        setProducts(productRows.filter((product) => product.active))
        setCustomers(customerRows)
        setShopSettings(savedSettings)
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
  const taxRate = shopSettings?.taxRate ?? 5
  const tax = Math.round(subtotal * taxRate / 100 * 100) / 100
  const extraTotal = charges.parcelCharge + charges.travelCharge + charges.deliveryCharge + charges.otherCharge
  const total = subtotal + tax + extraTotal
  const categories = [...new Set(products.map((product) => product.category.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleProductGroups = useMemo(() => {
    const groups = new Map()
    products.forEach((product) => {
      const key = product.name.trim().toLocaleLowerCase()
      const group = groups.get(key) ?? { key, name: product.name, variants: [] }
      group.variants.push(product)
      groups.set(key, group)
    })
    return [...groups.values()]
      .map((group) => ({
        ...group,
        variants: group.variants.sort((left, right) => left.variant.localeCompare(right.variant)),
      }))
      .filter((group) => {
        const candidateVariants = selectedCategory
          ? group.variants.filter((product) => product.category.trim() === selectedCategory)
          : group.variants
        if (candidateVariants.length === 0) return false
        if (!normalizedQuery) return true
        return candidateVariants.some((product) =>
          `${product.name} ${product.variant} ${product.productCode} ${product.category}`
            .toLocaleLowerCase()
            .includes(normalizedQuery),
        )
      })
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [products, normalizedQuery, selectedCategory])
  const customerOptions = useMemo(() => [
    { value: WALK_IN_CUSTOMER, label: "Walk-in customer" },
    ...customers.map((customer) => ({
      value: String(customer.id),
      label: `${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}`,
    })),
  ], [customers])
  function showToast(message, type = "success") {
    setToast({ message, type })
  }

  function addToCart(product) {
    setActionError("")
    setCompleted(false)
    setReceipt(null)
    const existing = cart.find((item) => item.productId === product.id)
    if ((existing?.quantity ?? 0) >= product.stock) {
      setActionError(`Only ${product.stock} ${product.unit} of ${product.name} are available.`)
      return false
    }
    setCart((current) => {
      const currentItem = current.find((item) => item.productId === product.id)
      return currentItem
        ? current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { productId: product.id, quantity: 1 }]
    })
    return true
  }

  function chooseProduct(group) {
    if (group.variants.length > 1) {
      setActionError("")
      setVariantProduct(group)
      return
    }
    addToCart(group.variants[0])
  }

  function chooseVariant(product) {
    if (addToCart(product)) setVariantProduct(null)
  }

  function updateQuantity(productId, change) {
    setActionError("")
    setCart((current) => current.map((item) => {
      if (item.productId !== productId) return item
      const product = products.find((row) => row.id === productId)
      return { ...item, quantity: Math.min(item.quantity + change, product?.stock ?? item.quantity) }
    }).filter((item) => item.quantity > 0))
  }

  async function completeBill() {
    if (!items.length || saving) return
    if (payment === "Credit / due" && !customerId) {
      showToast("Select a customer before creating a credit bill.", "error")
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
        ...charges,
      })
      const savedReceipt = toBillReceipt(savedSale, shopSettings ?? savedSale.settings)
      setReceipt(savedReceipt)
      setCompleted(true)
      setCart([])
      setCustomerId("")
      setCharges(DEFAULT_CHARGES)
      setProducts((current) => current.map((product) => {
        const sold = items.find((item) => item.productId === product.id)
        return sold ? { ...product, stock: product.stock - sold.quantity } : product
      }))
    } catch (saveError) {
      const message = saveError.message || "Unable to save this bill."
      setActionError(message)
      showToast(message, "error")
    } finally {
      setSaving(false)
    }
  }

  async function printReceipt() {
    if (!receipt) return
    try {
      await printBill(receipt)
      showToast("Bill sent to the default print dialog.")
    } catch (printError) {
      const message = printError.message || "Unable to print this bill."
      setActionError(message)
      showToast(message, "error")
    }
  }

  async function saveAsPDF() {
    if (!receipt) return
    setActionError("")
    const savePdf = window.desktopAPI?.saveBillPdf
    if (!savePdf) {
      showToast("PDF saving is only available in the desktop app.", "error")
      return
    }
    try {
      const result = await savePdf(receipt)
      if (!result.canceled) showToast(`PDF saved to ${result.filePath}`)
    } catch (error) {
      const message = error.message || "Unable to save the invoice PDF."
      setActionError(message)
      showToast(message, "error")
    }
  }

  async function shareOnWhatsApp() {
    if (!receipt) return
    setActionError("")
    setShareMessage("")
    try {
      const filePath = await saveAndOpenBillPdf(receipt)
      if (filePath) {
        const message = `PDF saved to ${filePath}. Attach it in the WhatsApp chat that was opened.`
        setShareMessage(message)
        showToast(message)
      }
    } catch (error) {
      const message = error.message || "Unable to save and share the invoice PDF."
      setActionError(message)
      showToast(message, "error")
    }
  }

  async function saveCustomer(customer) {
    try {
      const saved = await customerService.create(customer)
      setCustomers((current) => [...current, saved].sort((left, right) => left.name.localeCompare(right.name)))
      setCustomerId(String(saved.id))
      setShowCustomerForm(false)
      showToast(`${saved.name} added successfully.`)
    } catch (error) {
      showToast(error.message || "Unable to add customer.", "error")
      throw error
    }
  }

  return (
    <div className="screen">
      <PageTitle
        // description="Select products and customers from your local database, then save and pay for the bill."
        // title="Create a bill"
        action={(
          <div className="billing-page-actions">
            <button aria-label="Reprint a saved bill" className="button button-secondary" onClick={() => setShowSavedBills(true)} type="button">
              <Printer size={16} /> Reprint
            </button>
            <button aria-label="Add customer" className="button button-secondary" onClick={() => setShowCustomerForm(true)} type="button">
              <Plus size={16} /> Add customer
            </button>
            <button aria-label="Extra charges" className="button button-secondary" onClick={() => setShowChargeModal(true)} type="button">
              <Plus size={16} /> Extra charge
            </button>
            <Badge tone="neutral">{receipt ? `Invoice # ${receipt.invoiceNumber}` : "SQLite billing"}</Badge>
          </div>
        )}
      />
      {actionError && <p className="error-banner" role="alert">{actionError}</p>}

      <div className="billing-layout">
        <Panel className="catalog-panel">
          <label className="field-search billing-search">
            <Search size={17} />
            <input onChange={(event) => setQuery(event.target.value)} placeholder="Search product, code or category..." value={query} />
          </label>
          <div className="panel-heading">
            <div><h3>Choose products</h3>
            {/* <p>Tap a product to add it to the bill</p> */}
            </div>
            <Badge tone="neutral">{visibleProductGroups.length} products</Badge>
          </div>
          <div aria-label="Filter products by category" className="product-category-list" role="group">
            <button
              aria-pressed={!selectedCategory}
              className={`category-filter-button${!selectedCategory ? " active" : ""}`}
              onClick={() => setSelectedCategory("")}
              type="button"
            >
              All
            </button>
            {categories.map((category) => (
              <button
                aria-pressed={selectedCategory === category}
                className={`category-filter-button${selectedCategory === category ? " active" : ""}`}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>

          <div className="product-picker">
            {visibleProductGroups.map((group) => {
              const firstProduct = group.variants[0]
              const lowestPrice = Math.min(...group.variants.map((product) => product.sellingPrice))
              const availableStock = group.variants.some((product) => product.stock > 0)
              return (
                <button
                  className="picker-product"
                  disabled={!availableStock}
                  key={group.key}
                  onClick={() => chooseProduct(group)}
                  type="button"
                >
                  {firstProduct.imageDataUrl
                    ? <img alt={group.name} className="picker-product-image" src={firstProduct.imageDataUrl} />
                    : <div className="picker-flower">{group.name.slice(0, 1)}</div>}
                  <strong>{group.name}</strong>
                  <span style={{ color: '#0d1620',fontSize: '11px', fontWeight: 500}}>{group.variants.length > 1 ? `${group.variants.length} variants · From ${formatCurrency(lowestPrice)}` : `${formatCurrency(firstProduct.sellingPrice)} / ${firstProduct.unit}`}</span>
                  <small style={{ color: '#1e80ff',fontSize: '11px', fontWeight: 500}}>
                    {group.variants.length > 1 ? "Choose a variant" : `${firstProduct.stock} ${firstProduct.unit} in stock`}
                  </small>
                  <span className="picker-add"><Plus size={16} /></span>
                </button>
              )
            })}
            {!loading && visibleProductGroups.length === 0 && (
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
          <div className="bill-checkout">

            {payment === "Credit / due" && <p className="muted-text">This invoice will be added to the selected customer’s outstanding credit.</p>}
            <div className="bill-summary">
              <div><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              <div><span>Tax ({taxRate}%)</span><span>{formatCurrency(tax)}</span></div>
              {charges.parcelCharge > 0 && <div><span>Parcel charge</span><span>{formatCurrency(charges.parcelCharge)}</span></div>}
              {charges.travelCharge > 0 && <div><span>Travel charge</span><span>{formatCurrency(charges.travelCharge)}</span></div>}
              {charges.deliveryCharge > 0 && <div><span>Delivery charge</span><span>{formatCurrency(charges.deliveryCharge)}</span></div>}
              {charges.otherCharge > 0 && <div><span>{charges.otherChargeLabel || "Other"}</span><span>{formatCurrency(charges.otherCharge)}</span></div>}
              <div className="bill-total"><strong>Total due</strong><strong>{formatCurrency(total)}</strong></div>
            </div>
            <ExtraChargeSummary
              charges={charges}
              onEdit={() => setShowChargeModal(true)}
              onRemove={(key) => setCharges((c) => ({ ...c, [key]: 0 }))}
            />
            <div className="bill-checkout-fields">
              <label className="form-field">
                Customer
                <CustomerSearchSelect
                  disabled={loading || saving}
                  onChange={(value) => setCustomerId(value === WALK_IN_CUSTOMER ? "" : value)}
                  options={customerOptions}
                  value={customerId || WALK_IN_CUSTOMER}
                />
              </label>
              <label className="form-field payment-field">
                Payment method
                <select disabled={saving} onChange={(event) => setPayment(event.target.value)} value={payment}>
                  <option>UPI</option><option>Cash</option><option>Card</option><option>Credit / due</option>
                </select>
              </label>
            </div>

            <button className="button button-primary checkout-button" disabled={!items.length || loading || saving} onClick={completeBill} type="button">
              <Check size={17} /> {saving ? "Saving bill..." : "Complete bill"}
            </button>
          </div>
        </Panel>
      </div>

      {variantProduct && (
        <Modal
          className="variant-picker-modal"
          onClose={() => setVariantProduct(null)}
          title={variantProduct.name}
        >
          <p className="variant-dialog-description">Select a variant to add to the bill.</p>
          {actionError && <p className="error-banner" role="alert">{actionError}</p>}
          <div className="variant-options">
            {variantProduct.variants.map((product) => (
              <button
                className="variant-option"
                disabled={product.stock <= 0}
                key={product.id}
                onClick={() => chooseVariant(product)}
                type="button"
              >
                <span className="variant-option-copy">
                  <strong>{product.variant || "Standard"}</strong>
                  <small>
                    {product.noOfUnits > 1 ? `${product.noOfUnits} ` : ""}{product.unit}
                    {product.productCode ? ` · ${product.productCode}` : ""}
                    {` · ${product.stock} in stock`}
                  </small>
                </span>
                <strong className="variant-option-price">{formatCurrency(product.sellingPrice)}</strong>
                <Plus size={16} />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {completed && receipt && (
        <Modal
          className="bill-saved-modal"
          onClose={() => setCompleted(false)}
          title="Bill saved"
        >
          <div className="bill-saved-confirmation">
            <span className="bill-saved-icon"><Check size={22} /></span>
            <strong>{receipt.invoiceNumber}</strong>
            <span>{receipt.customer} · {formatCurrency(receipt.total)}</span>
          </div>
          <p className="receipt-actions-hint">
            {receipt.paymentStatus === "paid"
              ? "Payment recorded."
              : `Credit balance recorded: ${formatCurrency(receipt.total - receipt.amountPaid)}.`}
            {" "}Print the bill or share it with your customer.
          </p>
          {actionError && <p className="error-banner" role="alert">{actionError}</p>}
          {shareMessage && <p className="success-banner" role="status">{shareMessage}</p>}
          <div className="receipt-actions">
            <button className="button button-primary" onClick={printReceipt} type="button">
              <Printer size={17} /> Print bill
            </button>
            <button className="button button-whatsapp" onClick={shareOnWhatsApp} type="button">
              <MessageCircle size={17} /> Save PDF & open WhatsApp
            </button>
            <button className="button button-secondary" onClick={saveAsPDF} type="button">
              <FileText size={17} /> Save as PDF
            </button>
          </div>
        </Modal>
      )}

      <PrintableBill bill={receipt} />

      {showChargeModal && (
        <ExtraChargeModal
          charges={charges}
          onApply={setCharges}
          onClose={() => setShowChargeModal(false)}
        />
      )}

      {showSavedBills && (
        <Reprint onClose={() => setShowSavedBills(false)} />
      )}
      {showCustomerForm && (
        <AddCustomer
          onClose={() => setShowCustomerForm(false)}
          onSave={saveCustomer}
        />
      )}
      <ToastContainer onClose={() => setToast(null)} toast={toast} />
    </div>
  )
}

export default NewBill
