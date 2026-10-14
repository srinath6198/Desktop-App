import { useEffect, useMemo, useState } from "react"
import { ImagePlus, Pencil, Plus, Search, Users, X } from "lucide-react"
import { Modal, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
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

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(`${value.replace(" ", "T")}Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date)
}

function Customers() {
  const [currentMonth] = useState(() => {
    const now = new Date()
    return { month: now.getMonth(), year: now.getFullYear() }
  })
  const [customers, setCustomers] = useState([])
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [profileImageDataUrl, setProfileImageDataUrl] = useState(null)
  const [profileImageChanged, setProfileImageChanged] = useState(false)
  const [removeProfileImage, setRemoveProfileImage] = useState(false)

  useEffect(() => {
    let active = true
    customerService.list()
      .then((rows) => {
        if (active) setCustomers(rows)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load customers.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return customers.filter((customer) => [
      customer.name,
      customer.phone,
      customer.email,
      customer.address,
      customer.gstNumber,
    ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)))
  }, [customers, query])

  const newThisMonth = customers.filter((customer) => {
    const created = new Date(`${customer.createdAt?.replace(" ", "T")}Z`)
    return created.getFullYear() === currentMonth.year && created.getMonth() === currentMonth.month
  }).length
  const customersWithGst = customers.filter((customer) => customer.gstNumber).length
  const formCustomer = editingCustomer ?? EMPTY_CUSTOMER

  function openCreateForm() {
    setEditingCustomer(null)
    setProfileImageDataUrl(null)
    setProfileImageChanged(false)
    setRemoveProfileImage(false)
    setError("")
    setShowForm(true)
  }

  function openEditForm(customer) {
    setEditingCustomer(customer)
    setProfileImageDataUrl(customer.profileImageDataUrl)
    setProfileImageChanged(false)
    setRemoveProfileImage(false)
    setError("")
    setShowForm(true)
  }

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

  async function saveCustomer(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")
    const form = new FormData(event.currentTarget)
    const customer = {
      id: editingCustomer?.id,
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
      const saved = editingCustomer
        ? await customerService.update(customer)
        : await customerService.create(customer)
      setCustomers((current) => {
        const exists = current.some((item) => item.id === saved.id)
        return exists
          ? current.map((item) => item.id === saved.id ? saved : item)
          : [...current, saved].sort((left, right) => left.name.localeCompare(right.name))
      })
      setMessage(`${saved.name} ${editingCustomer ? "updated" : "added"} successfully.`)
      setShowForm(false)
      setEditingCustomer(null)
    } catch (saveError) {
      setError(saveError.message || "Unable to save the customer.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <PageTitle
        description="Keep customer contact, address, tax, and profile details organized."
        title="Customers"
        action={<button className="button button-primary" onClick={openCreateForm} type="button"><Plus size={17} /> Add customer</button>}
      />
      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Users} label="Total customers" value={customers.length} note="Saved in local database" />
        <StatCard icon={Users} label="New this month" value={newThisMonth} note="Customer sign-ups" tone="blue" />
        <StatCard icon={Users} label="GST registered" value={customersWithGst} note="Customers with GST number" tone="purple" />
      </div>
      <Panel className="table-panel directory-list">
        <div className="toolbar">
          <label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, email or GST..." value={query} /></label>
          <span className="results-count">{filtered.length} shown</span>
        </div>
        {error && !showForm && <p className="error-banner product-error" role="alert">{error}</p>}
        {message && <p className="inline-success customer-success" role="status">{message}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Phone</th><th>Email</th><th>Address</th><th>GST number</th><th>Customer since</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="table-product">
                      {customer.profileImageDataUrl
                        ? <img alt="" className="customer-profile-image" src={customer.profileImageDataUrl} />
                        : <div className="person-avatar">{customer.name.slice(0, 1)}</div>}
                      <strong>{customer.name}</strong>
                    </div>
                  </td>
                  <td>{customer.phone || "—"}</td>
                  <td>{customer.email || "—"}</td>
                  <td>{customer.address || "—"}</td>
                  <td>{customer.gstNumber || "—"}</td>
                  <td>{formatDate(customer.createdAt)}</td>
                  <td><button aria-label={`Edit ${customer.name}`} className="icon-button" onClick={() => openEditForm(customer)} type="button"><Pencil size={15} /></button></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td className="empty-table" colSpan="7">{customers.length ? "No customers match your search." : "No customers yet. Add a customer to get started."}</td></tr>
              )}
              {loading && <tr><td className="empty-table" colSpan="7">Loading customers from the local database…</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="demo-notice">Customer details are stored in the local SQLite database. Aadhaar numbers are not displayed in the customer list.</p>
      </Panel>

      {showForm && (
        <Modal onClose={() => !saving && setShowForm(false)} title={editingCustomer ? "Edit customer" : "Add a customer"}>
          <form className="form-grid" onSubmit={saveCustomer}>
            {error && <p className="error-banner span-2" role="alert">{error}</p>}
            <div className="form-field span-2">
              <span>Customer profile photo</span>
              <div className="customer-profile-editor">
                {profileImageDataUrl
                  ? <img alt="Customer profile preview" className="customer-profile-preview" src={profileImageDataUrl} />
                  : <div className="customer-profile-placeholder"><Users size={22} /><span>No photo selected</span></div>}
                <div className="product-image-controls">
                  <button className="button button-secondary" onClick={chooseProfileImage} type="button"><ImagePlus size={16} /> Choose photo</button>
                  {profileImageDataUrl && (
                    <button className="button button-secondary" onClick={() => { setProfileImageDataUrl(null); setProfileImageChanged(true); setRemoveProfileImage(true) }} type="button"><X size={15} /> Remove photo</button>
                  )}
                  <small>JPG, PNG or WebP · maximum 5 MB</small>
                </div>
              </div>
            </div>
            <label className="form-field span-2">Full name<input autoFocus defaultValue={formCustomer.name} name="name" placeholder="Customer name" required /></label>
            <label className="form-field">Phone number<input defaultValue={formCustomer.phone} name="phone" placeholder="+91 98765 43210" type="tel" /></label>
            <label className="form-field">Email address<input defaultValue={formCustomer.email} name="email" placeholder="customer@example.com" type="email" /></label>
            <label className="form-field span-2">Address<textarea defaultValue={formCustomer.address} name="address" placeholder="Street, area, city, state and PIN code" rows="2" /></label>
            <label className="form-field">Aadhaar number<input autoComplete="off" defaultValue={formCustomer.aadhaarNumber} inputMode="numeric" maxLength="14" name="aadhaarNumber" placeholder="12 digits" /></label>
            <label className="form-field">GST number<input autoComplete="off" defaultValue={formCustomer.gstNumber} maxLength="15" name="gstNumber" placeholder="15-character GSTIN" /></label>
            <div className="form-actions span-2">
              <button className="button button-secondary" disabled={saving} onClick={() => setShowForm(false)} type="button">Cancel</button>
              <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : editingCustomer ? "Save changes" : "Add customer"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default Customers
