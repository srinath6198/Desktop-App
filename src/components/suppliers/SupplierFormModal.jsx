import { Modal } from "../ui/PageUI"
import { INDIAN_STATES_AND_UTS } from "../../utils/Others.js"

function SupplierFormModal({
  error = "",
  onClose,
  onSubmit,
  saving = false,
  supplier = {},
  title = "Add supplier",
  submitLabel,
}) {
  return (
    <Modal onClose={() => !saving && onClose()} title={title}>
      <form className="form-grid" onSubmit={onSubmit}>
        {error && <p className="error-banner span-2" role="alert">{error}</p>}
        <label className="form-field span-2">Supplier / business name<input autoFocus defaultValue={supplier.name} name="name" placeholder="e.g. Green Valley Farms" required /></label>
        <label className="form-field">Phone number<input defaultValue={supplier.phone} name="phone" placeholder="+91 98765 43210" type="tel" /></label>
        <label className="form-field">Email address<input defaultValue={supplier.email} name="email" placeholder="supplier@example.com" type="email" /></label>
        <label className="form-field span-2">Address<textarea defaultValue={supplier.address} name="address" placeholder="Street, area, city" rows="2" /></label>
        <label className="form-field">
          State
          <select className="select-control" defaultValue={supplier.state} name="state" required>
            <option value="">Select State / Union Territory</option>
            {INDIAN_STATES_AND_UTS.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </label>
        <label className="form-field">PIN code<input defaultValue={supplier.pincode} name="pincode" inputMode="numeric" placeholder="PIN code" /></label>
        <div className="form-actions span-2">
          <button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>
          <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : submitLabel}</button>
        </div>
      </form>
    </Modal>
  )
}

export default SupplierFormModal
