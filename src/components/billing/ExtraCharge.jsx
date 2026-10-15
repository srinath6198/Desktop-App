import { useState } from "react"
import { Check, Trash2, X } from "lucide-react"
import { Modal } from "../ui/PageUI"
import { formatCurrency } from "../../data/demoData"

const CHARGE_MENU = [
  { key: "parcelCharge", label: "Parcel charge", icon: "📦" },
  { key: "travelCharge", label: "Travel charge", icon: "🚗" },
  { key: "deliveryCharge", label: "Delivery charge", icon: "🛵" },
  { key: "otherCharge", label: "Other charge", icon: "💰" },
]

function ExtraChargeModal({ charges, onClose, onApply }) {
  const [draft, setDraft] = useState({ ...charges })

  function setAmt(key, val) {
    const n = val === "" ? 0 : parseFloat(val)
    setDraft((c) => ({ ...c, [key]: Number.isFinite(n) && n >= 0 ? n : c[key] }))
  }

  function remove(key) {
    setDraft((c) => ({ ...c, [key]: 0, ...(key === "otherCharge" ? { otherChargeLabel: "Other" } : {}) }))
  }

  const total = CHARGE_MENU.reduce((s, f) => s + (draft[f.key] || 0), 0)

  return (
    <Modal onClose={onClose} title="Extra charges">
      <div className="ec-menu">
        {CHARGE_MENU.map(({ key, label, icon }) => {
          const active = (draft[key] || 0) > 0
          return (
            <div className={`ec-row${active ? " ec-row-active" : ""}`} key={key}>
              <div className="ec-row-left">
                <span className="ec-icon">{icon}</span>
                {key === "otherCharge"
                  ? (
                    <input
                      className="ec-label-input"
                      maxLength={40}
                      onChange={(e) => setDraft((c) => ({ ...c, otherChargeLabel: e.target.value }))}
                      placeholder="Label"
                      value={draft.otherChargeLabel}
                    />
                  )
                  : <span className="ec-label">{label}</span>}
              </div>
              <div className="ec-row-right">
                <span className="ec-rupee">₹</span>
                <input
                  className="ec-amt-input"
                  min="0"
                  onChange={(e) => setAmt(key, e.target.value)}
                  placeholder="0"
                  step="0.01"
                  type="number"
                  value={draft[key] || ""}
                />
                {active && (
                  <button
                    aria-label="Remove"
                    className="icon-button danger-icon ec-remove"
                    onClick={() => remove(key)}
                    type="button"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {total > 0 && (
        <div className="ec-total-row">
          <span>Total extra charges</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button className="button button-secondary" onClick={onClose} type="button">
          <X size={15} /> Cancel
        </button>
        <button
          className="button button-primary"
          onClick={() => { onApply(draft); onClose() }}
          type="button"
        >
          <Check size={15} /> Apply charges
        </button>
      </div>
    </Modal>
  )
}

export function ExtraChargeSummary({ charges, onEdit, onRemove }) {
  const active = CHARGE_MENU.filter(({ key }) => (charges[key] || 0) > 0)
  if (!active.length) return null
  return (
    <div className="ec-summary">
      {active.map(({ key, label }) => (
        <div className="ec-summary-row" key={key}>
          <span>{key === "otherCharge" ? (charges.otherChargeLabel || "Other") : label}</span>
          <div className="ec-summary-right">
            <strong>{formatCurrency(charges[key])}</strong>
            <button
              aria-label="Edit charges"
              className="icon-button ec-edit-btn"
              onClick={onEdit}
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button
              aria-label="Remove charge"
              className="icon-button danger-icon ec-edit-btn"
              onClick={() => onRemove(key)}
              type="button"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ExtraChargeModal
