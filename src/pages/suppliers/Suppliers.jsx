import { useState } from "react"
import { Plus, Search, Truck } from "lucide-react"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { demoSuppliers, formatCurrency } from "../../data/demoData"

function Suppliers() {
  const [query, setQuery] = useState("")
  const [suppliers] = useState(demoSuppliers)
  const filtered = suppliers.filter((supplier) => `${supplier.name} ${supplier.contact} ${supplier.products}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="screen">
      <PageTitle description="Manage flower farms, wholesalers and supplier balances." title="Suppliers" action={<button className="button button-secondary" onClick={() => window.alert("Supplier creation will be available when database storage is connected.")} type="button"><Plus size={17} /> Add supplier</button>} />
      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Truck} label="Active suppliers" value={suppliers.length + 9} note="Across your supply network" />
        <StatCard icon={Truck} label="Payables due" value={formatCurrency(suppliers.reduce((sum, supplier) => sum + supplier.balance, 0))} note="Outstanding supplier balance" tone="orange" />
        <StatCard icon={Truck} label="Purchases this month" value={formatCurrency(146800)} note="From all suppliers" tone="blue" />
      </div>
      <Panel className="table-panel">
        <div className="toolbar"><label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers..." value={query} /></label><span className="results-count">{filtered.length} suppliers</span></div>
        <div className="supplier-cards">{filtered.map((supplier) => <article className="supplier-card" key={supplier.id}><div className="supplier-card-top"><div className="supplier-avatar"><Truck size={19} /></div><Badge tone={supplier.balance ? "warning" : "success"}>{supplier.balance ? "Balance due" : "Up to date"}</Badge></div><h3>{supplier.name}</h3><p>{supplier.contact} · {supplier.phone}</p><div className="supplier-products"><span>Supplies</span><strong>{supplier.products}</strong></div><div className="supplier-balance"><span>Outstanding</span><strong>{formatCurrency(supplier.balance)}</strong></div></article>)}</div>
        <p className="demo-notice">Sample supplier profiles · Connect the database to store supplier records.</p>
      </Panel>
    </div>
  )
}

export default Suppliers
