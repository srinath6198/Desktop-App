import { useState } from "react"
import { ImagePlus, Users, X } from "lucide-react"
import { Modal } from "../../components/ui/PageUI"
import { customerService } from "../../services/customer.service"

const EMPTY_CUSTOMER = {
  name: "",
  phone: "",
  email: "",
  address: "",
  aadhaarNumber: "",
  gstNumber: "",
  profileImageDataUrl: null,
}

function AddCustomer({ customer = null, onClose, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [profileImageDataUrl, setProfileImageDataUrl] = useState(customer?.profileImageDataUrl ?? null)
  const [profileImageChanged, setProfileImageChanged] = useState(false)
  const [removeProfileImage, setRemoveProfileImage] = useState(false)
  const formCustomer = customer ?? EMPTY_CUSTOMER

  async function chooseProfileImage() {
    setError("")
    try {
      const image = await customerService.selectProfileImage()
      if (image) {
        setProfileImageDataUrl(image)
        setProfileImageChanged(true)
        setRemoveProfileImage(false)
      }
    } catch (imageError) {
      setError(imageError.message || "Unable to select the customer profile image.")
    }
  }

  async function submitCustomer(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const customerDetails = {
      id: customer?.id,
      name: String(form.get("name")).trim(),
      phone: String(form.get("phone")).trim(),
      email: String(form.get("email")).trim(),
      address: String(form.get("address")).trim(),
      aadhaarNumber: String(form.get("aadhaarNumber")).replace(/[\s-]/g, ""),
      gstNumber: String(form.get("gstNumber")).trim().toUpperCase(),
      profileImageDataUrl: profileImageChanged ? profileImageDataUrl : null,
      removeProfileImage: profileImageChanged && removeProfileImage,
    }

    try {
      await onSave(customerDetails)
      onClose()
    } catch (saveError) {
      setError(saveError.message || "Unable to save the customer.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={() => !saving && onClose()} title={customer ? "Edit customer" : "Add a customer"}>
      <form className="form-grid" onSubmit={submitCustomer}>
        {error && <p className="error-banner span-2" role="alert">{error}</p>}
        <div className="form-field span-2">
          <span>Customer profile photo</span>
          <div className="customer-profile-editor">
            {profileImageDataUrl
              ? <img alt="Customer profile preview" className="customer-profile-preview" src={profileImageDataUrl} />
              : <div className="customer-profile-placeholder"><Users size={22} /><span>No photo selected</span></div>}
            <div className="product-image-controls">
              <button className="button button-secondary" disabled={saving} onClick={chooseProfileImage} type="button"><ImagePlus size={16} /> Choose photo</button>
              {profileImageDataUrl && (
                <button
                  className="button button-secondary"
                  disabled={saving}
                  onClick={() => {
                    setProfileImageDataUrl(null)
                    setProfileImageChanged(true)
                    setRemoveProfileImage(true)
                  }}
                  type="button"
                >
                  <X size={15} /> Remove photo
                </button>
              )}
              <small>JPG, PNG or WebP · maximum 5 MB</small>
            </div>
          </div>
        </div>
        <label className="form-field span-2">Full name<input autoFocus defaultValue={formCustomer.name} maxLength="120" name="name" placeholder="Customer name" required /></label>
        <label className="form-field">Phone number<input defaultValue={formCustomer.phone} maxLength="30" name="phone" placeholder="+91 98765 43210" type="tel" /></label>
        <label className="form-field">Email address<input defaultValue={formCustomer.email} maxLength="254" name="email" placeholder="customer@example.com" type="email" /></label>
        <label className="form-field span-2">Address<textarea defaultValue={formCustomer.address} maxLength="1000" name="address" placeholder="Street, area, city, state and PIN code" rows="2" /></label>
        <label className="form-field">Aadhaar number<input autoComplete="off" defaultValue={formCustomer.aadhaarNumber} inputMode="numeric" maxLength="14" name="aadhaarNumber" placeholder="12 digits" /></label>
        <label className="form-field">GST number<input autoComplete="off" defaultValue={formCustomer.gstNumber} maxLength="15" name="gstNumber" placeholder="15-character GSTIN" /></label>
        <div className="form-actions span-2">
          <button className="button button-secondary" disabled={saving} onClick={onClose} type="button">Cancel</button>
          <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : customer ? "Save changes" : "Add customer"}</button>
        </div>
      </form>
    </Modal>
  )
}

export default AddCustomer
