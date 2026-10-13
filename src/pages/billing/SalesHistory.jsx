import { useMemo, useState } from "react"
import { Download, Printer, Search } from "lucide-react"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { demoSales, formatCurrency } from "../../data/demoData"

function SalesHistory() {
  const [query, setQuery] = useState("")
  const [period, setPeriod] = useState("All time")
  const sales = useMemo(
    () => demoSales.filter((sale) => {
      const matchesQuery = `${sale.id} ${sale.customer}`.toLowerCase().includes(query.toLowerCase())
      const matchesPeriod = period !== "Today" || sale.date.startsWith("Today")
      return matchesQuery && matchesPeriod
    }),
    [period, query],
  )

  return (
    <div className="screen">
      <PageTitle description="Review invoices and payment activity from your shop." title="Sales history" action={<button className="button button-secondary" onClick={() => window.print()} type="button"><Download size={16} /> Export report</button>} />
      <div className="stat-grid compact-stat-grid">
        <StatCard label="Total sales" value={formatCurrency(18450)} note="Across 28 invoices today" />
        <StatCard label="Paid invoices" value="26" note="92.8% collected" tone="blue" />
        <StatCard label="Outstanding" value={formatCurrency(1480)} note="2 invoices need follow-up" tone="orange" />
      </div>
      <Panel className="table-panel">
        <div className="toolbar">
          <label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice or customer..." value={query} /></label>
          <select aria-label="Sales date range" className="select-control" onChange={(event) => setPeriod(event.target.value)} value={period}><option>All time</option><option>Today</option><option>This week</option><option>This month</option></select>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Invoice</th><th>Customer</th><th>Date & time</th><th>Items</th><th>Payment</th><th>Amount</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>{sales.map((sale) => <tr key={sale.id}><td><strong>{sale.id}</strong></td><td>{sale.customer}</td><td>{sale.date}</td><td>{sale.items}</td><td>{sale.payment}</td><td className="amount-cell">{formatCurrency(sale.total)}</td><td><Badge tone={sale.status === "Paid" ? "success" : "warning"}>{sale.status}</Badge></td><td><button aria-label={`Print ${sale.id}`} className="icon-button" onClick={() => window.print()} type="button"><Printer size={16} /></button></td></tr>)}
            {sales.length === 0 && <tr><td className="empty-table" colSpan="8">No invoices found for “{query}”.</td></tr>}</tbody>
        </table></div>
        <div className="table-footer"><span>Showing {sales.length} sample invoices</span><span>Page 1 of 1</span></div>
      </Panel>
      <p className="demo-notice">Sample invoice records · Date range filters are for layout preview only.</p>
    </div>
  )
}

export default SalesHistory
