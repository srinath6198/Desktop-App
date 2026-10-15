import { useEffect, useMemo, useState } from "react"
import { CreditCard, Printer, Search, Wallet } from "lucide-react"
import { Badge, Modal, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import { customerCreditService } from "../../services/customer-credit.service"

function formatDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function CustomerCredit() {
  const [printedAt] = useState(() => new Date())
  const [customers, setCustomers] = useState([])
  const [entries, setEntries] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [query, setQuery] = useState("")
  const [entryType, setEntryType] = useState("payment")
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    let active = true
    customerCreditService.report()
      .then((report) => {
        if (!active) return
        setCustomers(report.customers)
        setEntries(report.entries)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || "Unable to load customer credit.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const selectedCustomer = customers.find((customer) => String(customer.id) === selectedCustomerId) ?? null
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return customers.filter((customer) =>
      `${customer.name} ${customer.phone ?? ""} ${customer.email ?? ""}`.toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [customers, query])
  const visibleEntries = useMemo(
    () => entries.filter((entry) => !selectedCustomerId || String(entry.customer_id) === selectedCustomerId),
    [entries, selectedCustomerId],
  )
  const totalOutstanding = customers.reduce((sum, customer) => sum + customer.balance, 0)
  const customersWithBalance = customers.filter((customer) => customer.balance > 0).length
  const totalPayments = entries.filter((entry) => entry.entry_type === "payment")
    .reduce((sum, entry) => sum + entry.amount, 0)

  async function saveEntry(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await customerCreditService.createEntry({
        customerId: form.get("customerId"),
        type: entryType,
        amount: form.get("amount"),
        reference: String(form.get("reference") ?? ""),
        notes: String(form.get("notes") ?? ""),
      })
      const report = await customerCreditService.report()
      setCustomers(report.customers)
      setEntries(report.entries)
      const name = report.customers.find((customer) => String(customer.id) === String(form.get("customerId")))?.name
      setMessage(`${entryType === "payment" ? "Payment recorded" : "Credit charge recorded"} for ${name}.`)
      setShowForm(false)
    } catch (saveError) {
      setError(saveError.message || "Unable to save the credit entry.")
    } finally {
      setSaving(false)
    }
  }

  function openForm(type) {
    setEntryType(type)
    setError("")
    setShowForm(true)
  }

  return (
    <div className="screen">
      <PageTitle
        description="Review customer credit balances, record payments, and print account statements."
        title="Customer Credit"
        action={(
          <div className="credit-page-actions">
            <button className="button button-secondary" disabled={loading || !visibleEntries.length} onClick={() => window.print()} type="button"><Printer size={16} /> Print statement</button>
            <button className="button button-secondary" disabled={!customers.length || saving} onClick={() => openForm("credit")} type="button"><CreditCard size={16} /> Add credit</button>
            <button className="button button-primary" disabled={!customersWithBalance || saving} onClick={() => openForm("payment")} type="button"><Wallet size={16} /> Receive payment</button>
          </div>
        )}
      />

      <div className="stat-grid compact-stat-grid">
        <StatCard icon={CreditCard} label="Outstanding credit" value={formatCurrency(totalOutstanding)} note="Across all customers" tone="orange" />
        <StatCard icon={Wallet} label="Customers with balance" value={customersWithBalance} note="Customers owing money" tone="blue" />
        <StatCard icon={Wallet} label="Payments received" value={formatCurrency(totalPayments)} note="All recorded payments" />
      </div>

      <Panel className="table-panel">
        <div className="credit-toolbar">
          <label className="credit-field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search customer name, phone or email..." value={query} /></label>
          <select aria-label="Filter credit report by customer" className="select-control" onChange={(event) => setSelectedCustomerId(event.target.value)} value={selectedCustomerId}>
            <option value="">All customers</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <span className="results-count">{filteredCustomers.length} customers</span>
        </div>
        {error && !showForm && <p className="error-banner product-error" role="alert">{error}</p>}
        {message && <p className="inline-success credit-success" role="status">{message}</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Phone</th><th>Credit given</th><th>Payments</th><th>Outstanding balance</th></tr></thead>
            <tbody>
              {filteredCustomers.map((customer) => {
                const customerEntries = entries.filter((entry) => entry.customer_id === customer.id)
                const credit = customerEntries.filter((entry) => entry.entry_type === "credit").reduce((sum, entry) => sum + entry.amount, 0)
                const payments = customerEntries.filter((entry) => entry.entry_type === "payment").reduce((sum, entry) => sum + entry.amount, 0)
                return (
                  <tr key={customer.id}>
                    <td><strong>{customer.name}</strong></td>
                    <td>{customer.phone || "—"}</td>
                    <td>{formatCurrency(credit)}</td>
                    <td>{formatCurrency(payments)}</td>
                    <td>{customer.balance > 0 ? <Badge tone="warning">{formatCurrency(customer.balance)} due</Badge> : <Badge tone="success">Clear</Badge>}</td>
                  </tr>
                )
              })}
              {!loading && filteredCustomers.length === 0 && <tr><td className="empty-table" colSpan="5">{customers.length ? "No customers match your search." : "No customers found. Add a customer before recording credit."}</td></tr>}
              {loading && <tr><td className="empty-table" colSpan="5">Loading customer credit from the local database…</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="table-panel credit-ledger-panel" title={selectedCustomer ? `Credit statement — ${selectedCustomer.name}` : "Credit transactions"} description="Credit entries increase the balance; payments reduce it.">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Reference</th><th>Notes</th><th>Amount</th></tr></thead>
            <tbody>
              {visibleEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.created_at)}</td>
                  <td>{entry.customer_name}</td>
                  <td><Badge tone={entry.entry_type === "payment" ? "success" : "warning"}>{entry.entry_type === "payment" ? "Payment" : "Credit"}</Badge></td>
                  <td>{entry.reference || "—"}</td>
                  <td>{entry.notes || "—"}</td>
                  <td className="amount-cell">{entry.entry_type === "payment" ? "−" : "+"}{formatCurrency(entry.amount)}</td>
                </tr>
              ))}
              {!loading && visibleEntries.length === 0 && <tr><td className="empty-table" colSpan="6">{selectedCustomer ? "No credit activity for this customer yet." : "No credit or payment entries recorded yet."}</td></tr>}
              {loading && <tr><td className="empty-table" colSpan="6">Loading credit transactions…</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <section aria-label="Printable customer credit statement" className="credit-print-report">
        <header>
          <h1>Offline POS Customer Credit Statement</h1>
          <p>{selectedCustomer ? selectedCustomer.name : "All customers"}</p>
          {selectedCustomer?.phone && <p>{selectedCustomer.phone}</p>}
          <p>Printed {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(printedAt)}</p>
        </header>
        <table>
          <thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Reference</th><th>Notes</th><th>Amount</th></tr></thead>
          <tbody>{visibleEntries.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDate(entry.created_at)}</td>
              <td>{entry.customer_name}</td>
              <td>{entry.entry_type === "payment" ? "Payment" : "Credit"}</td>
              <td>{entry.reference || "—"}</td>
              <td>{entry.notes || "—"}</td>
              <td>{entry.entry_type === "payment" ? "−" : "+"}{formatCurrency(entry.amount)}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="credit-print-balance">
          {selectedCustomer ? "Customer balance" : "Total outstanding credit"}:{" "}
          <strong>{formatCurrency(selectedCustomer?.balance ?? totalOutstanding)}</strong>
        </p>
      </section>

      {showForm && (
        <Modal onClose={() => !saving && setShowForm(false)} title={entryType === "payment" ? "Receive customer payment" : "Record customer credit"}>
          <form className="form-grid" onSubmit={saveEntry}>
            {error && <p className="error-banner span-2" role="alert">{error}</p>}
            <label className="form-field span-2">
              Customer
              <select defaultValue={selectedCustomerId} name="customerId" required>
                <option value="">Select customer</option>
                {customers
                  .filter((customer) => entryType !== "payment" || customer.balance > 0)
                  .map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — balance {formatCurrency(customer.balance)}</option>)}
              </select>
            </label>
            <label className="form-field span-2">Amount (₹)<input autoFocus min="0.01" name="amount" required step="0.01" type="number" /></label>
            {entryType === "payment" && <p className="muted-text span-2">Payments are applied to the customer’s oldest unpaid sales invoices first.</p>}
            <label className="form-field span-2">Reference / receipt number<input maxLength="250" name="reference" placeholder="Optional reference" /></label>
            <label className="form-field span-2">Notes<input maxLength="250" name="notes" placeholder={entryType === "payment" ? "Payment method or note" : "Invoice or reason for credit"} /></label>
            <div className="form-actions span-2">
              <button className="button button-secondary" disabled={saving} onClick={() => setShowForm(false)} type="button">Cancel</button>
              <button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : entryType === "payment" ? "Record payment" : "Record credit"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default CustomerCredit
