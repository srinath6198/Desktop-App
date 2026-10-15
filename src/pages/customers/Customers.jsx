import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Users } from "lucide-react"
import { PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import AddCustomer from "./AddCustomer"
import { customerService } from "../../services/customer.service"

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
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)

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

  function openCreateForm() {
    setEditingCustomer(null)
    setError("")
    setShowForm(true)
  }

  function openEditForm(customer) {
    setEditingCustomer(customer)
    setError("")
    setShowForm(true)
  }

  async function saveCustomer(customer) {
    setMessage("")
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
    setEditingCustomer(null)
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
        <AddCustomer
          customer={editingCustomer}
          onClose={() => setShowForm(false)}
          onSave={saveCustomer}
        />
      )}
    </div>
  )
}

export default Customers
