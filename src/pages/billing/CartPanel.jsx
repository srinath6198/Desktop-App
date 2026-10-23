import { useState } from "react"
import { Check, Minus, Pencil, Plus, ShoppingCart, Tag, Trash2, X } from "lucide-react"
import { Panel } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import ExtraChargeModal, { ExtraChargeSummary } from "../../components/billing/ExtraCharge"
import CustomerSearchSelect from "../../components/billing/CustomerSearchSelect"

const WALK_IN = "__walk_in_customer__"

// ── Overall discount modal ────────────────────────────────────
function OverallDiscountModal({ subtotal, discount, onApply, onClose }) {
  const [type, setType] = useState(discount.type)
  const [value, setValue] = useState(discount.value > 0 ? String(discount.value) : "")

  const numVal = parseFloat(value) || 0
  const preview = type === "percent"
    ? Math.min(subtotal * numVal / 100, subtotal)
    : Math.min(numVal, subtotal)

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: 360 }}>
        <div className="modal-heading">
          <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Tag size={17} /> Overall Discount</h3>
          <button className="icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        <div className="discount-type-toggle">
          <button className={`discount-type-btn${type === "percent" ? " active" : ""}`} onClick={() => setType("percent")} type="button">% Percentage</button>
          <button className={`discount-type-btn${type === "flat" ? " active" : ""}`} onClick={() => setType("flat")} type="button">₹ Flat amount</button>
        </div>

        <label className="form-field" style={{ marginTop: 14 }}>
          {type === "percent" ? "Discount %" : "Discount amount (₹)"}
          <input
            autoFocus
            max={type === "percent" ? 100 : subtotal}
            min={0}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "percent" ? "e.g. 10" : "e.g. 50"}
            step="0.01"
            type="number"
            value={value}
          />
        </label>

        {numVal > 0 && (
          <p className="discount-preview">
            Discount: <strong>− {formatCurrency(preview)}</strong>
            {type === "percent" && <span> ({numVal}% of {formatCurrency(subtotal)})</span>}
          </p>
        )}

        <div className="form-actions" style={{ marginTop: 16 }}>
          {discount.value > 0 && (
            <button className="button button-secondary" onClick={() => { onApply({ type: "percent", value: 0 }); onClose() }} type="button">Remove</button>
          )}
          <button className="button button-secondary" onClick={onClose} type="button">Cancel</button>
          <button className="button button-primary" disabled={numVal <= 0} onClick={() => { onApply({ type, value: numVal }); onClose() }} type="button">
            <Check size={15} /> Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inline rate editor ────────────────────────────────────────
function RateEditor({ item, customRate, onSave, onClose }) {
  const original = item.product.sellingPrice
  const [val, setVal] = useState(customRate != null ? String(customRate) : String(original))
  const num = parseFloat(val) || 0
  const diff = num - original

  return (
    <div className="rate-editor-popover">
      <span className="rate-editor-label">Rate (₹)</span>
      <input
        autoFocus
        className="rate-editor-input"
        min={0}
        onChange={(e) => setVal(e.target.value)}
        step="0.01"
        type="number"
        value={val}
      />
      {num !== original && num > 0 && (
        <span className={`rate-editor-diff${diff < 0 ? " neg" : " pos"}`}>
          {diff > 0 ? "+" : ""}{formatCurrency(diff)}
        </span>
      )}
      <div className="item-disc-actions">
        {customRate != null && (
          <button className="item-disc-remove" onClick={() => { onSave(null); onClose() }} title="Reset to original" type="button"><X size={12} /></button>
        )}
        <button className="item-disc-apply" disabled={num <= 0} onClick={() => { onSave(num); onClose() }} type="button"><Check size={12} /></button>
      </div>
    </div>
  )
}

// ── CartPanel ─────────────────────────────────────────────────
function CartPanel({
  charges, customerOptions, items, loading, payment, saving,
  customerId, shopSettings,
  onClearCart, onUpdateQuantity, onRemoveItem,
  onSetCharges, onSetCustomerId, onSetPayment,
  onCompleteBill, onShowChargeModal, showChargeModal,
}) {
  const [overallDiscount, setOverallDiscount] = useState({ type: "percent", value: 0 })
  const [showOverallDisc, setShowOverallDisc] = useState(false)
  const [customRates, setCustomRates] = useState({})   // { [productId]: number }
  const [openRateId, setOpenRateId] = useState(null)

  const taxRate = shopSettings?.taxRate ?? 5
  const extraTotal = charges.parcelCharge + charges.travelCharge + charges.deliveryCharge + charges.otherCharge

  // subtotal using custom rates where set
  const subtotal = items.reduce((sum, item) => {
    const rate = customRates[item.productId] ?? item.product.sellingPrice
    return sum + rate * item.quantity
  }, 0)

  // overall discount
  const overallDiscAmt = overallDiscount.value > 0
    ? overallDiscount.type === "percent"
      ? Math.min(subtotal * overallDiscount.value / 100, subtotal)
      : Math.min(overallDiscount.value, subtotal)
    : 0

  const discountedSubtotal = subtotal - overallDiscAmt
  const tax = Math.round(discountedSubtotal * taxRate / 100 * 100) / 100
  const total = discountedSubtotal + tax + extraTotal

  return (
    <>
      <Panel className="bill-panel">
        <div className="panel-heading">
          <div>
            <h3><ShoppingCart size={18} /> Current bill</h3>
            <p>{items.length} different products</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Overall discount button */}
            <button
              className={`bill-discount-btn${overallDiscount.value > 0 ? " active" : ""}`}
              disabled={!items.length}
              onClick={() => setShowOverallDisc(true)}
              title="Apply overall discount"
              type="button"
            >
              <Tag size={14} />
              {overallDiscount.value > 0
                ? overallDiscount.type === "percent" ? `${overallDiscount.value}% off` : `−₹${overallDiscount.value}`
                : "Discount"}
            </button>
            <button className="text-button" disabled={!items.length || saving} onClick={() => { onClearCart(); setCustomRates({}); setOverallDiscount({ type: "percent", value: 0 }) }} type="button">Clear</button>
          </div>
        </div>

        <div className="bill-items">
          {items.map((item) => {
            const originalRate = item.product.sellingPrice
            const customRate = customRates[item.productId]
            const rate = customRate ?? originalRate
            const lineTotal = rate * item.quantity
            const isRateEdited = customRate != null && customRate !== originalRate
            const isRateOpen = openRateId === item.productId

            return (
              <div className="bill-item" key={item.productId}>
                {item.product.imageDataUrl
                  ? <img alt="" className="bill-product-image" src={item.product.imageDataUrl} />
                  : <div className="flower-avatar">{item.product.name.slice(0, 1)}</div>}

                <div className="bill-item-copy">
                  <strong>{item.product.name}</strong>
                  {item.product.variant && <span className="bill-variant-name">{item.product.variant}</span>}
                  <span>
                    {isRateEdited
                      ? <><s className="item-original-price">{formatCurrency(originalRate)}</s> {formatCurrency(rate)}</>
                      : formatCurrency(rate)
                    } / {item.product.unit}
                  </span>
                </div>

                <div className="quantity-control">
                  <button disabled={saving} onClick={() => onUpdateQuantity(item.productId, -1)} type="button"><Minus size={13} /></button>
                  <span>{item.quantity}</span>
                  <button disabled={saving || item.quantity >= item.product.stock} onClick={() => onUpdateQuantity(item.productId, 1)} type="button"><Plus size={13} /></button>
                </div>

                {/* Edit rate button + popover */}
                <div className="item-disc-wrap">
                  <button
                    className={`item-disc-btn${isRateEdited ? " has-disc" : ""}`}
                    onClick={() => setOpenRateId((p) => p === item.productId ? null : item.productId)}
                    title="Edit rate"
                    type="button"
                  >
                    <Pencil size={13} />
                    {isRateEdited && <span>{formatCurrency(rate)}</span>}
                  </button>
                  {isRateOpen && (
                    <RateEditor
                      customRate={customRate}
                      item={item}
                      onClose={() => setOpenRateId(null)}
                      onSave={(v) => setCustomRates((p) => ({ ...p, [item.productId]: v }))}
                    />
                  )}
                </div>

                <div className="line-total-wrap">
                  {isRateEdited && <s className="line-original">{formatCurrency(originalRate * item.quantity)}</s>}
                  <strong className="line-total">{formatCurrency(lineTotal)}</strong>
                </div>

                <button
                  aria-label={`Remove ${item.product.name}`}
                  className="icon-button danger-icon"
                  disabled={saving}
                  onClick={() => { onRemoveItem(item.productId); setCustomRates((p) => { const n = { ...p }; delete n[item.productId]; return n }) }}
                  type="button"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
          {!items.length && (
            <div className="empty-cart">
              <ShoppingCart size={26} />
              <strong>Your bill is empty</strong>
              <span>Choose products from the catalogue to get started.</span>
            </div>
          )}
        </div>

        <div className="bill-checkout">
          {payment === "Credit / due" && <p className="muted-text">This invoice will be added to the selected customer's outstanding credit.</p>}
          <div className="bill-summary">
            <div><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            {overallDiscAmt > 0 && (
              <div className="bill-discount-row">
                <span>
                  Discount {overallDiscount.type === "percent" ? `(${overallDiscount.value}%)` : "(flat)"}
                  <button className="discount-remove-inline" onClick={() => setOverallDiscount({ type: "percent", value: 0 })} title="Remove" type="button"><X size={11} /></button>
                </span>
                <span className="discount-amount">− {formatCurrency(overallDiscAmt)}</span>
              </div>
            )}
            <div><span>Tax ({taxRate}%)</span><span>{formatCurrency(tax)}</span></div>
            {charges.parcelCharge > 0 && <div><span>Parcel charge</span><span>{formatCurrency(charges.parcelCharge)}</span></div>}
            {charges.travelCharge > 0 && <div><span>Travel charge</span><span>{formatCurrency(charges.travelCharge)}</span></div>}
            {charges.deliveryCharge > 0 && <div><span>Delivery charge</span><span>{formatCurrency(charges.deliveryCharge)}</span></div>}
            {charges.otherCharge > 0 && <div><span>{charges.otherChargeLabel || "Other"}</span><span>{formatCurrency(charges.otherCharge)}</span></div>}
            <div className="bill-total"><strong>Total due</strong><strong>{formatCurrency(total)}</strong></div>
          </div>

          <ExtraChargeSummary
            charges={charges}
            onEdit={onShowChargeModal}
            onRemove={(key) => onSetCharges((c) => ({ ...c, [key]: 0 }))}
          />

          <div className="bill-checkout-fields">
            <label className="form-field">
              Customer
              <CustomerSearchSelect
                disabled={loading || saving}
                onChange={(value) => onSetCustomerId(value === WALK_IN ? "" : value)}
                options={customerOptions}
                value={customerId || WALK_IN}
              />
            </label>
            <label className="form-field payment-field">
              Payment method
              <select disabled={saving} onChange={(e) => onSetPayment(e.target.value)} value={payment}>
                <option>UPI</option><option>Cash</option><option>Card</option><option>Credit / due</option>
              </select>
            </label>
          </div>

          <button
            className="button button-primary checkout-button"
            disabled={!items.length || loading || saving}
            onClick={() => onCompleteBill(overallDiscAmt, customRates)}
            type="button"
          >
            <Check size={17} /> {saving ? "Saving bill..." : "Complete bill"}
          </button>
        </div>
      </Panel>

      {showOverallDisc && (
        <OverallDiscountModal
          discount={overallDiscount}
          onApply={setOverallDiscount}
          onClose={() => setShowOverallDisc(false)}
          subtotal={subtotal}
        />
      )}

      {showChargeModal && (
        <ExtraChargeModal
          charges={charges}
          onApply={onSetCharges}
          onClose={() => onShowChargeModal(false)}
        />
      )}
    </>
  )
}

export default CartPanel
