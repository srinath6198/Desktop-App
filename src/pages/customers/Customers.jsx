import { useMemo, useState } from "react"
import { Plus, Search, Users } from "lucide-react"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { demoCustomers, formatCurrency } from "../../data/demoData"

function Customers() {
  const [query, setQuery] = useState("")
  const [customers, setCustomers] = useState(demoCustomers)
  const [message, setMessage] = useState("")
  const filtered = useMemo(() => customers.filter((customer) => `${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase())), [customers, query])

  function addCustomer(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const customer = { id: `CUS-${String(Date.now()).slice(-3)}`, name: String(form.get("name")), phone: String(form.get("phone")), visits: 0, balance: 0, since: "Today" }
    setCustomers((current) => [customer, ...current])
    setMessage(`${customer.name} added to this demo list.`)
    event.currentTarget.reset()
  }

  return (
    <div className="screen">
      <PageTitle description="Build lasting relationships and keep customer balances in view." title="Customers" />
      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Users} label="Total customers" value={customers.length + 248} note="Registered shoppers" />
        <StatCard icon={Users} label="New this month" value="32" note="Customer sign-ups" tone="blue" />
        <StatCard icon={Users} label="Outstanding balance" value={formatCurrency(customers.reduce((sum, customer) => sum + customer.balance, 0))} note="Across customer accounts" tone="orange" />
      </div>
      <div className="directory-grid">
        <Panel className="table-panel directory-list">
          <div className="toolbar"><label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search name or phone..." value={query} /></label><span className="results-count">{filtered.length} shown</span></div>
          <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Visits</th><th>Balance</th><th>Customer since</th></tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id}><td><div className="table-product"><div className="person-avatar">{customer.name.slice(0, 1)}</div><strong>{customer.name}</strong></div></td><td>{customer.phone}</td><td>{customer.visits}</td><td>{customer.balance ? <Badge tone="warning">{formatCurrency(customer.balance)} due</Badge> : <span className="muted-text">Clear</span>}</td><td>{customer.since}</td></tr>)}</tbody></table></div>
          <p className="demo-notice">Sample customer data · New entries are held in this page session.</p>
        </Panel>
        <Panel className="quick-form-panel" title="Add a customer" description="Add a shopper to your customer list.">
          {message && <p className="inline-success" role="status">{message}</p>}
          <form className="stacked-form" onSubmit={addCustomer}><label className="form-field">Full name<input name="name" placeholder="Customer name" required /></label><label className="form-field">Phone number<input name="phone" placeholder="+91 98765 43210" type="tel" /></label><button className="button button-primary" type="submit"><Plus size={16} /> Add customer</button></form>
        </Panel>
      </div>
    </div>
  )
}

export default Customers
