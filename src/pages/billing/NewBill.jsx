import { useEffect, useMemo, useState } from "react"
import { Check, FileText, MessageCircle, Plus, Printer } from "lucide-react"
import { Badge, Modal, PageTitle } from "../../components/ui/PageUI"
import ToastContainer from "../../components/ui/ToastContainer"
import PrintableBill, { printBill } from "../../components/billing/PrintableBill"
import { customerService } from "../../services/customer.service"
import { productService } from "../../services/product.service"
import { salesService } from "../../services/sales.service"
import { settingsService } from "../../services/settings.service"
import { toBillReceipt } from "../../utils/billReceipt"
import { shareBillPdf as saveAndOpenBillPdf } from "../../utils/shareBillPdf"
import { formatCurrency } from "../../data/demoData"
import AddCustomer from "../customers/AddCustomer"
import Reprint from "../Reprint/Reprint"
import CatalogPanel from "./CatalogPanel"
import CartPanel from "./CartPanel"

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
  const [showChargeModal, setShowChargeModal] = useState(false)
  const [toast, setToast] = useState(null)
  const [charges, setCharges] = useState(DEFAULT_CHARGES)

  useEffect(() => {
    let mounted = true
    Promise.all([productService.list(), customerService.list(), settingsService.get()])
      .then(([productRows, customerRows, savedSettings]) => {
        if (!mounted) return
        setProducts(productRows.filter((p) => p.active))
        setCustomers(customerRows)
        setShopSettings(savedSettings)
      })
      .catch((err) => { if (mounted) setActionError(err.message || "Unable to load billing data.") })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const items = useMemo(() =>
    cart.map((cartItem) => ({
      ...cartItem,
      product: products.find((p) => p.id === cartItem.productId),
    })).filter((item) => item.product),
    [cart, products]
  )

  const categories = useMemo(() =>
    [...new Set(products.map((p) => p.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  )

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
        variants: group.variants.sort((a, b) => a.variant.localeCompare(b.variant)),
      }))
      .filter((group) => {
        const candidates = selectedCategory
          ? group.variants.filter((p) => p.category.trim() === selectedCategory)
          : group.variants
        if (candidates.length === 0) return false
        if (!normalizedQuery) return true
        return candidates.some((p) =>
          `${p.name} ${p.variant} ${p.productCode} ${p.category}`.toLocaleLowerCase().includes(normalizedQuery)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, normalizedQuery, selectedCategory])

  const customerOptions = useMemo(() => [
    { value: WALK_IN_CUSTOMER, label: "Walk-in customer" },
    ...customers.map((c) => ({ value: String(c.id), label: `${c.name}${c.phone ? ` · ${c.phone}` : ""}` })),
  ], [customers])

  function showToast(message, type = "success") { setToast({ message, type }) }

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
      const found = current.find((item) => item.productId === product.id)
      return found
        ? current.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { productId: product.id, quantity: 1 }]
    })
    return true
  }

  function chooseProduct(group) {
    if (group.variants.length > 1) { setActionError(""); setVariantProduct(group); return }
    addToCart(group.variants[0])
  }

  function chooseVariant(product) {
    if (addToCart(product)) setVariantProduct(null)
  }

  function updateQuantity(productId, change) {
    setActionError("")
    setCart((current) => current.map((item) => {
      if (item.productId !== productId) return item
      const product = products.find((p) => p.id === productId)
      return { ...item, quantity: Math.min(item.quantity + change, product?.stock ?? item.quantity) }
    }).filter((item) => item.quantity > 0))
  }

  async function completeBill(discountAmount, customPrices) {
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
        discountAmount,
        customPrices,
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
    } catch (err) {
      const message = err.message || "Unable to save this bill."
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
    } catch (err) {
      showToast(err.message || "Unable to print this bill.", "error")
    }
  }

  async function saveAsPDF() {
    if (!receipt) return
    const savePdf = window.desktopAPI?.saveBillPdf
    if (!savePdf) { showToast("PDF saving is only available in the desktop app.", "error"); return }
    try {
      const result = await savePdf(receipt)
      if (!result.canceled) showToast(`PDF saved to ${result.filePath}`)
    } catch (err) {
      showToast(err.message || "Unable to save the invoice PDF.", "error")
    }
  }

  async function shareOnWhatsApp() {
    if (!receipt) return
    setShareMessage("")
    try {
      const filePath = await saveAndOpenBillPdf(receipt)
      if (filePath) {
        const message = `PDF saved to ${filePath}. Attach it in the WhatsApp chat that was opened.`
        setShareMessage(message)
        showToast(message)
      }
    } catch (err) {
      showToast(err.message || "Unable to save and share the invoice PDF.", "error")
    }
  }

  async function saveCustomer(customer) {
    try {
      const saved = await customerService.create(customer)
      setCustomers((current) => [...current, saved].sort((a, b) => a.name.localeCompare(b.name)))
      setCustomerId(String(saved.id))
      setShowCustomerForm(false)
      showToast(`${saved.name} added successfully.`)
    } catch (err) {
      showToast(err.message || "Unable to add customer.", "error")
      throw err
    }
  }

  return (
    <div className="screen">
      <PageTitle
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
        <CatalogPanel
          categories={categories}
          loading={loading}
          onChooseProduct={chooseProduct}
          onSelectCategory={setSelectedCategory}
          query={query}
          selectedCategory={selectedCategory}
          setQuery={setQuery}
          visibleProductGroups={visibleProductGroups}
        />

        <CartPanel
          charges={charges}
          customerId={customerId}
          customerOptions={customerOptions}
          items={items}
          loading={loading}
          onClearCart={() => setCart([])}
          onCompleteBill={completeBill}
          onRemoveItem={(id) => setCart((c) => c.filter((r) => r.productId !== id))}
          onSetCharges={setCharges}
          onSetCustomerId={setCustomerId}
          onSetPayment={setPayment}
          onShowChargeModal={setShowChargeModal}
          onUpdateQuantity={updateQuantity}
          payment={payment}
          saving={saving}
          shopSettings={shopSettings}
          showChargeModal={showChargeModal}
        />
      </div>

      {variantProduct && (
        <Modal className="variant-picker-modal" onClose={() => setVariantProduct(null)} title={variantProduct.name}>
          <p className="variant-dialog-description">Select a variant to add to the bill.</p>
          {actionError && <p className="error-banner" role="alert">{actionError}</p>}
          <div className="variant-options">
            {variantProduct.variants.map((product) => (
              <button className="variant-option" disabled={product.stock <= 0} key={product.id} onClick={() => chooseVariant(product)} type="button">
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
        <Modal className="bill-saved-modal" onClose={() => setCompleted(false)} title="Bill saved">
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
            <button className="button button-primary" onClick={printReceipt} type="button"><Printer size={17} /> Print bill</button>
            <button className="button button-whatsapp" onClick={shareOnWhatsApp} type="button"><MessageCircle size={17} /> Save PDF & open WhatsApp</button>
            <button className="button button-secondary" onClick={saveAsPDF} type="button"><FileText size={17} /> Save as PDF</button>
          </div>
        </Modal>
      )}

      <PrintableBill bill={receipt} />

      {showSavedBills && <Reprint onClose={() => setShowSavedBills(false)} />}
      {showCustomerForm && <AddCustomer onClose={() => setShowCustomerForm(false)} onSave={saveCustomer} />}
      <ToastContainer onClose={() => setToast(null)} toast={toast} />
    </div>
  )
}

export default NewBill
