import { useState } from "react"
import { Plus, Search, Truck } from "lucide-react"
import { Badge, Modal, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { demoSuppliers, formatCurrency } from "../../data/demoData"

const initialPurchases = [
  { id: "PUR-0215", supplier: "Mysore Flower Market", date: "Today, 9:15 AM", items: 5, total: 8400, status: "Received" },
  { id: "PUR-0214", supplier: "Green Valley Farms", date: "Yesterday, 11:20 AM", items: 3, total: 12600, status: "Received" },
  { id: "PUR-0213", supplier: "Bloom Wholesale", date: "11 Oct 2026", items: 4, total: 5750, status: "Pending" },
]

function Purchases() {
  const [purchases, setPurchases] = useState(initialPurchases)
  const [query, setQuery] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState("")

  function addPurchase(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const purchase = { id: `PUR-${String(Date.now()).slice(-4)}`, supplier: String(form.get("supplier")), date: "Just now", items: Number(form.get("items")), total: Number(form.get("total")), status: "Received" }
    setPurchases((current) => [purchase, ...current])
    setMessage(`${purchase.id} added to this demo list.`)
    setShowForm(false)
  }

  const filtered = purchases.filter((purchase) => `${purchase.id} ${purchase.supplier}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="screen">
      <PageTitle description="Record supplier deliveries and keep purchase costs organized." title="Purchases" action={<button className="button button-primary" onClick={() => setShowForm(true)} type="button"><Plus size={17} /> Record purchase</button>} />
      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Truck} label="Purchases this month" value={formatCurrency(146800)} note="Across 24 orders" />
        <StatCard icon={Truck} label="Received orders" value="21" note="This month" tone="blue" />
        <StatCard icon={Truck} label="Pending orders" value="3" note="Awaiting delivery" tone="orange" />
      </div>
      <Panel className="table-panel">
        <div className="toolbar"><label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search purchase or supplier..." value={query} /></label><span className="results-count">{filtered.length} orders</span></div>
        {message && <p className="inline-success" role="status">{message}</p>}
        <div className="table-wrap"><table><thead><tr><th>Purchase ID</th><th>Supplier</th><th>Date</th><th>Line items</th><th>Total</th><th>Status</th></tr></thead><tbody>{filtered.map((purchase) => <tr key={purchase.id}><td><strong>{purchase.id}</strong></td><td>{purchase.supplier}</td><td>{purchase.date}</td><td>{purchase.items} products</td><td className="amount-cell">{formatCurrency(purchase.total)}</td><td><Badge tone={purchase.status === "Received" ? "success" : "warning"}>{purchase.status}</Badge></td></tr>)}{filtered.length === 0 && <tr><td className="empty-table" colSpan="6">No purchases match your search.</td></tr>}</tbody></table></div>
        <p className="demo-notice">Sample purchase records · Connect SQLite to manage real supplier orders.</p>
      </Panel>
      {showForm && <Modal onClose={() => setShowForm(false)} title="Record a purchase"><form className="form-grid" onSubmit={addPurchase}>
        <label className="form-field span-2">Supplier<select defaultValue="" name="supplier" required><option disabled value="">Choose supplier</option>{demoSuppliers.map((supplier) => <option key={supplier.id}>{supplier.name}</option>)}</select></label>
        <label className="form-field">Number of products<input min="1" name="items" required type="number" /></label>
        <label className="form-field">Total amount (₹)<input min="1" name="total" required type="number" /></label>
        <div className="form-actions span-2"><button className="button button-secondary" onClick={() => setShowForm(false)} type="button">Cancel</button><button className="button button-primary" type="submit">Save purchase</button></div>
      </form></Modal>}
    </div>
  )
}

export default Purchases
