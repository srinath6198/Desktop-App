import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Download, Search } from "lucide-react"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import { salesService } from "../../services/sales.service"

const PAGE_SIZE = 10

function getSaleDate(value) {
  return new Date(`${value.replace(" ", "T")}Z`)
}

function formatSaleDate(value) {
  const date = getSaleDate(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function getPeriodStart(period) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (period === "Today") return start
  if (period === "This week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    return start
  }
  if (period === "This month") {
    start.setDate(1)
    return start
  }
  return null
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function SalesHistory() {
  const [allSales, setAllSales] = useState([])
  const [query, setQuery] = useState("")
  const [period, setPeriod] = useState("All time")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    salesService.list()
      .then((rows) => {
        if (mounted) setAllSales(rows)
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || "Unable to load saved sales.")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const sales = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    const periodStart = getPeriodStart(period)
    return allSales.filter((sale) => {
      const matchesQuery = `${sale.invoice_number} ${sale.customer_name}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
      const matchesPeriod = !periodStart || getSaleDate(sale.created_at) >= periodStart
      return matchesQuery && matchesPeriod
    })
  }, [allSales, period, query])

  const pageCount = Math.max(1, Math.ceil(sales.length / PAGE_SIZE))
  const visibleSales = sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const paidSales = sales.filter((sale) => sale.payment_status === "paid")
  const totalOutstanding = sales.reduce((sum, sale) => sum + Math.max(sale.total - sale.amount_paid, 0), 0)

  function updateSearch(value) {
    setQuery(value)
    setPage(1)
  }

  function updatePeriod(value) {
    setPeriod(value)
    setPage(1)
  }

  function exportReport() {
    const headers = ["Invoice", "Customer", "Date", "Items", "Payment method", "Total", "Paid", "Outstanding", "Status"]
    const rows = sales.map((sale) => [
      sale.invoice_number,
      sale.customer_name,
      sale.created_at,
      sale.item_count,
      sale.payment_method,
      sale.total,
      sale.amount_paid,
      Math.max(sale.total - sale.amount_paid, 0),
      sale.payment_status,
    ])
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "flowerpos-sales-report.csv"
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="screen">
      <PageTitle
        description="Review invoices and payment activity saved in your local database."
        title="Sales history"
        action={<button className="button button-secondary" disabled={loading || sales.length === 0} onClick={exportReport} type="button"><Download size={16} /> Export report</button>}
      />
      {error && <p className="error-banner" role="alert">{error}</p>}

      <div className="stat-grid compact-stat-grid">
        <StatCard label="Total sales" value={formatCurrency(totalSales)} note={`Across ${sales.length} invoices in this view`} />
        <StatCard label="Paid invoices" value={paidSales.length} note={`${formatCurrency(paidSales.reduce((sum, sale) => sum + sale.amount_paid, 0))} collected`} tone="blue" />
        <StatCard label="Outstanding" value={formatCurrency(totalOutstanding)} note={`${sales.filter((sale) => sale.payment_status === "due").length} invoices due`} tone="orange" />
      </div>

      <Panel className="table-panel">
        <div className="toolbar">
          <label className="field-search"><Search size={17} /><input onChange={(event) => updateSearch(event.target.value)} placeholder="Search invoice or customer..." value={query} /></label>
          <select aria-label="Sales date range" className="select-control" onChange={(event) => updatePeriod(event.target.value)} value={period}>
            <option>All time</option><option>Today</option><option>This week</option><option>This month</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Date &amp; time</th><th>Items</th><th>Payment</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {visibleSales.map((sale) => (
                <tr key={sale.id}>
                  <td><strong>{sale.invoice_number}</strong></td>
                  <td>{sale.customer_name}</td>
                  <td>{formatSaleDate(sale.created_at)}</td>
                  <td>{sale.item_count}</td>
                  <td>{sale.payment_method}</td>
                  <td className="amount-cell">{formatCurrency(sale.total)}</td>
                  <td><Badge tone={sale.payment_status === "paid" ? "success" : "warning"}>{sale.payment_status === "paid" ? "Paid" : `Due ${formatCurrency(sale.total - sale.amount_paid)}`}</Badge></td>
                </tr>
              ))}
              {!loading && visibleSales.length === 0 && (
                <tr><td className="empty-table" colSpan="7">{error ? "Sales history could not be loaded." : "No saved invoices match this search or date range."}</td></tr>
              )}
              {loading && <tr><td className="empty-table" colSpan="7">Loading invoices from the local database…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="stock-entry-pagination">
          <span>Showing {visibleSales.length} of {sales.length} invoices</span>
          {sales.length > PAGE_SIZE && (
            <div>
              <button aria-label="Previous page" className="button button-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><ArrowLeft size={15} /> Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button aria-label="Next page" className="button button-secondary" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} type="button">Next <ArrowRight size={15} /></button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}

export default SalesHistory
