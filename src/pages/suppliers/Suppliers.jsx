import { useEffect, useMemo, useState } from "react"
import { Archive, Mail, MapPin, Pencil, Plus, RotateCcw, Search, Truck } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import SupplierFormModal from "../../components/suppliers/SupplierFormModal"
import { supplierService } from "../../services/supplier.service"

const EMPTY_SUPPLIER = {
  name: "",
  phone: "",
  email: "",
  address: "",
  state: "",
  pincode: "",
}

function Suppliers() {
  const location = useLocation()
  const navigate = useNavigate()
  const [suppliers, setSuppliers] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [showForm, setShowForm] = useState(() => Boolean(location.state?.openSupplierForm))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)
  const [error, setError] = useState("")
  const [savedMessage, setSavedMessage] = useState("")

  useEffect(() => {
    let active = true

    supplierService.list()
      .then((rows) => {
        if (active) setSuppliers(rows)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load suppliers.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (location.state?.openSupplierForm) {
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return suppliers.filter((supplier) =>
      (statusFilter === "all" || supplier.active === (statusFilter === "active")) &&
      [supplier.name, supplier.phone, supplier.email, supplier.address, supplier.state, supplier.pincode]
        .some((value) => value?.toLowerCase().includes(normalizedQuery)),
    )
  }, [query, statusFilter, suppliers])

  function openCreateForm() {
    setEditingSupplier(null)
    setError("")
    setShowForm(true)
  }

  function openEditForm(supplier) {
    setEditingSupplier(supplier)
    setError("")
    setShowForm(true)
  }

  async function saveSupplier(event) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setSavedMessage("")
    const form = new FormData(event.currentTarget)
    const supplier = {
      id: editingSupplier?.id,
      name: String(form.get("name")).trim(),
      phone: String(form.get("phone")).trim(),
      email: String(form.get("email")).trim(),
      address: String(form.get("address")).trim(),
      state: String(form.get("state")).trim(),
      pincode: String(form.get("pincode")).trim(),
    }

    try {
      const savedSupplier = editingSupplier
        ? await supplierService.update(supplier)
        : await supplierService.create(supplier)
      setSuppliers((current) => {
        const exists = current.some((item) => item.id === savedSupplier.id)
        return exists
          ? current.map((item) => item.id === savedSupplier.id ? savedSupplier : item)
          : [...current, savedSupplier].sort((left, right) => left.name.localeCompare(right.name))
      })
      setSavedMessage(`${savedSupplier.name} ${editingSupplier ? "updated" : "added"} successfully.`)
      setShowForm(false)
      setEditingSupplier(null)
    } catch (saveError) {
      setError(saveError.message || "Unable to save this supplier.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleSupplierStatus(supplier) {
    const nextActive = !supplier.active
    const action = nextActive ? "reactivate" : "deactivate"
    const confirmation = nextActive
      ? `Reactivate ${supplier.name}?`
      : `Deactivate ${supplier.name}? The supplier record and purchase history will be kept.`
    if (!window.confirm(confirmation)) return

    setError("")
    setSavedMessage("")
    setUpdatingStatusId(supplier.id)
    try {
      const updatedSupplier = await supplierService.setActive(supplier.id, nextActive)
      setSuppliers((current) => current.map((item) => item.id === updatedSupplier.id ? updatedSupplier : item))
      setSavedMessage(`${supplier.name} ${action}d. Its record has been kept.`)
    } catch (statusError) {
      setError(statusError.message || `Unable to ${action} this supplier.`)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const activeCount = suppliers.filter((supplier) => supplier.active).length
  const formSupplier = editingSupplier ?? EMPTY_SUPPLIER

  return (
    <div className="screen">
      <PageTitle
        description="Maintain supplier contact and address details for your flower shop."
        title="Suppliers"
        action={<button className="button button-primary" onClick={openCreateForm} type="button"><Plus size={17} /> Add supplier</button>}
      />

      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Truck} label="Active suppliers" value={activeCount} note="Available for new purchases" />
        <StatCard icon={Archive} label="Inactive suppliers" value={suppliers.length - activeCount} note="Records retained" tone="orange" />
        <StatCard icon={Truck} label="Total suppliers" value={suppliers.length} note="Stored in local database" tone="blue" />
      </div>

      <Panel className="table-panel">
        <div className="toolbar">
          <label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers..." value={query} /></label>
          <select aria-label="Supplier status filter" className="select-control" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="all">All suppliers</option>
            <option value="active">Active suppliers</option>
            <option value="inactive">Inactive suppliers</option>
          </select>
          <span className="results-count">{filteredSuppliers.length} suppliers</span>
        </div>
        {error && !showForm && <p className="error-banner product-error" role="alert">{error}</p>}
        {savedMessage && <p className="inline-success" role="status">{savedMessage}</p>}

        <div className="supplier-cards">
          {filteredSuppliers.map((supplier) => (
            <article className={`supplier-card ${supplier.active ? "" : "inactive-supplier-card"}`} key={supplier.id}>
              <div className="supplier-card-top">
                <div className="supplier-avatar"><Truck size={19} /></div>
                <Badge tone={supplier.active ? "success" : "neutral"}>{supplier.active ? "Active" : "Inactive"}</Badge>
              </div>
              <h3>{supplier.name}</h3>
              {supplier.phone && <p>{supplier.phone}</p>}
              {supplier.email && <p className="supplier-contact-line"><Mail size={13} /> {supplier.email}</p>}
              {(supplier.address || supplier.state || supplier.pincode) && (
                <p className="supplier-contact-line"><MapPin size={13} /> {[supplier.address, supplier.state, supplier.pincode].filter(Boolean).join(", ")}</p>
              )}
              <div className="supplier-card-actions">
                <button className="button button-secondary" onClick={() => openEditForm(supplier)} type="button"><Pencil size={14} /> Edit</button>
                <button
                  className={`button ${supplier.active ? "button-secondary" : "button-primary"}`}
                  disabled={updatingStatusId === supplier.id}
                  onClick={() => toggleSupplierStatus(supplier)}
                  type="button"
                >
                  {supplier.active ? <Archive size={14} /> : <RotateCcw size={14} />}
                  {supplier.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </article>
          ))}
          {!loading && filteredSuppliers.length === 0 && (
            <p className="empty-suppliers">{query ? "No suppliers match your search." : statusFilter === "inactive" ? "No inactive suppliers." : "No suppliers yet. Add a supplier to get started."}</p>
          )}
          {loading && <p className="empty-suppliers">Loading suppliers from the local database…</p>}
        </div>
        <p className="demo-notice">Supplier records are stored in the local SQLite database. Deactivating keeps supplier and purchase history.</p>
      </Panel>

      {showForm && (
        <SupplierFormModal
          error={error}
          onClose={() => setShowForm(false)}
          onSubmit={saveSupplier}
          saving={saving}
          supplier={formSupplier}
          submitLabel={editingSupplier ? "Save changes" : "Save supplier"}
          title={editingSupplier ? "Edit supplier" : "Add supplier"}
        />
      )}
    </div>
  )
}

export default Suppliers
