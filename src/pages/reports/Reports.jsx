import { useEffect, useState } from "react"
import { Download, IndianRupee, ShoppingBag, Users } from "lucide-react"
import { PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import { reportsService } from "../../services/reports.service"

const PAYMENT_COLORS = ["#198754", "#568fcf", "#e8ad56", "#9b6ac7", "#de6c6c"]

function getLocalDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getInitialFilters() {
  const today = new Date()
  return {
    startDate: getLocalDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: getLocalDateInputValue(today),
    customerId: "",
  }
}

function formatReportDate(value) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date)
}

function formatSaleDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`
}

function makeRevenueChartData(dailyRevenue) {
  if (dailyRevenue.length <= 31) {
    return dailyRevenue.map((item) => ({
      ...item,
      label: new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(new Date(`${item.date}T00:00:00Z`)),
    }))
  }

  const monthly = new Map()
  for (const item of dailyRevenue) {
    const month = item.date.slice(0, 7)
    const current = monthly.get(month) ?? { date: `${month}-01`, revenue: 0, invoice_count: 0 }
    current.revenue += item.revenue
    current.invoice_count += item.invoice_count
    monthly.set(month, current)
  }
  return [...monthly.values()].map((item) => ({
    ...item,
    label: new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(new Date(`${item.date}T00:00:00Z`)),
  }))
}

function Reports() {
  const [filters, setFilters] = useState(getInitialFilters)
  const [appliedFilters, setAppliedFilters] = useState(getInitialFilters)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    reportsService.sales(appliedFilters)
      .then((result) => {
        if (mounted) setReport(result)
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || "Unable to load report data.")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [appliedFilters])

  const chartData = makeRevenueChartData(report?.dailyRevenue ?? [])
  const maxRevenue = Math.max(1, ...chartData.map((item) => item.revenue))
  const paymentTotal = report?.paymentMethods.reduce((sum, payment) => sum + payment.revenue, 0) ?? 0
  let paymentGradient = "#e8ecef 0 100%"
  if (report?.paymentMethods.length && paymentTotal > 0) {
    let cursor = 0
    paymentGradient = report.paymentMethods.map((payment, index) => {
      const start = cursor
      cursor += (payment.revenue / paymentTotal) * 100
      return `${PAYMENT_COLORS[index % PAYMENT_COLORS.length]} ${start}% ${cursor}%`
    }).join(", ")
  }
  const maxProductQuantity = Math.max(1, ...(report?.topProducts ?? []).map((product) => product.quantity))

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setLoading(true)
    setError("")
    setReport(null)
    setAppliedFilters({ ...filters })
  }

  function exportReport() {
    if (!report?.sales.length) return
    const headers = ["Invoice", "Customer", "Date", "Items", "Payment method", "Total", "Paid", "Outstanding", "Status"]
    const rows = report.sales.map((sale) => [
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

  const summary = report?.summary

  return (
    <div className="screen">
      <PageTitle
        description="Review sales performance using date and customer filters."
        title="Reports"
        action={<button className="button button-secondary" disabled={loading || !report?.sales.length} onClick={exportReport} type="button"><Download size={16} /> Export CSV</button>}
      />
      {error && <p className="error-banner" role="alert">{error}</p>}

      <Panel className="report-filter-panel" title="Report filters" description="Select a date range and optionally limit the report to one customer.">
        <form className="report-filter-form" onSubmit={applyFilters}>
          <label className="form-field">
            From date
            <input aria-label="Report start date" onChange={(event) => updateFilter("startDate", event.target.value)} required type="date" value={filters.startDate} />
          </label>
          <label className="form-field">
            To date
            <input aria-label="Report end date" onChange={(event) => updateFilter("endDate", event.target.value)} required type="date" value={filters.endDate} />
          </label>
          <label className="form-field">
            Customer
            <select aria-label="Filter report by customer" onChange={(event) => updateFilter("customerId", event.target.value)} value={filters.customerId}>
              <option value="">All customers</option>
              {report?.hasWalkInSales && <option value="walk-in">Walk-in customers</option>}
              {report?.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <button className="button button-primary report-filter-submit" disabled={loading} type="submit">
            {loading ? "Loading..." : "Apply filters"}
          </button>
        </form>
      </Panel>

      {summary && (
        <>
          <div className="stat-grid compact-stat-grid">
            <StatCard icon={IndianRupee} label="Gross revenue" value={formatCurrency(summary.totalRevenue)} note={`${summary.invoiceCount} invoices in this report`} />
            <StatCard icon={ShoppingBag} label="Orders completed" value={summary.invoiceCount} note={`${formatCurrency(summary.totalCollected)} collected`} tone="blue" />
            <StatCard icon={Users} label="Average bill value" value={formatCurrency(summary.averageBill)} note={`${formatCurrency(summary.outstanding)} outstanding`} tone="purple" />
          </div>

          <div className="dashboard-grid report-grid">
            <Panel className="sales-panel" title="Revenue over time" description={chartData.length > 31 ? "Monthly sales totals for the selected period" : "Daily sales totals for the selected period"}>
              <div className="chart-summary"><strong>{formatCurrency(summary.totalRevenue)}</strong><span>{loading ? "Updating report..." : "Filtered revenue"}</span></div>
              {chartData.length ? (
                <div aria-label="Revenue chart" className="bar-chart report-chart" role="img">
                  {chartData.map((item) => (
                    <div className="chart-column" key={item.date} title={`${formatReportDate(item.date)}: ${formatCurrency(item.revenue)} (${item.invoice_count} invoices)`}>
                      <div className="chart-track"><span style={{ height: `${Math.max(3, item.revenue / maxRevenue * 100)}%` }} /></div>
                      <small>{item.label}</small>
                    </div>
                  ))}
                </div>
              ) : <p className="muted-text">No sales in the selected date range.</p>}
            </Panel>

            <Panel title="Sales by payment" description="Invoice value grouped by payment method">
              <div className="payment-legend">
                <div className="payment-ring" style={{ background: `conic-gradient(${paymentGradient})` }}>
                  <span>{formatCurrency(paymentTotal)}<small>Total</small></span>
                </div>
                <div className="legend-list">
                  {report.paymentMethods.length ? report.paymentMethods.map((payment, index) => (
                    <p key={payment.method}>
                      <i className="legend-dot" style={{ backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} />
                      {payment.method}
                      <strong>{paymentTotal ? `${Math.round(payment.revenue / paymentTotal * 100)}%` : "0%"}</strong>
                    </p>
                  )) : <p className="muted-text">No payment data.</p>}
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Top selling products" description="Products ranked by quantity sold for the selected filters">
            {report.topProducts.length ? (
              <div className="top-selling-list">
                {report.topProducts.map((product, index) => (
                  <div className="top-selling-row" key={`${product.name}-${product.variant}`}>
                    <span className="popular-rank">{index + 1}</span>
                    <strong>{product.name}{product.variant ? ` · ${product.variant}` : ""}</strong>
                    <div aria-label={`${product.quantity} sold`} className="selling-track"><span style={{ width: `${product.quantity / maxProductQuantity * 100}%` }} /></div>
                    <span>{product.quantity} sold</span>
                  </div>
                ))}
              </div>
            ) : <p className="muted-text">No product sales in the selected date range.</p>}
          </Panel>

          <Panel title="Invoices in report" description="Invoice details matching the current date and customer filters">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Invoice</th><th>Customer</th><th>Date &amp; time</th><th>Items</th><th>Payment</th><th>Total</th><th>Paid</th><th>Outstanding</th></tr></thead>
                <tbody>
                  {report.sales.map((sale) => (
                    <tr key={sale.id}>
                      <td><strong>{sale.invoice_number}</strong></td>
                      <td>{sale.customer_name}</td>
                      <td>{formatSaleDate(sale.created_at)}</td>
                      <td>{sale.item_count}</td>
                      <td>{sale.payment_method}</td>
                      <td className="amount-cell">{formatCurrency(sale.total)}</td>
                      <td className="amount-cell">{formatCurrency(sale.amount_paid)}</td>
                      <td className="amount-cell">{formatCurrency(Math.max(sale.total - sale.amount_paid, 0))}</td>
                    </tr>
                  ))}
                  {!report.sales.length && (
                    <tr><td className="empty-table" colSpan="8">No invoices match the selected date range and customer.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="report-results-count">Showing {report.sales.length} invoices{loading ? " · Updating..." : ""}</p>
          </Panel>
        </>
      )}

      {loading && !report && <Panel title="Loading report"><p className="muted-text">Loading sales data from the local database…</p></Panel>}
    </div>
  )
}

export default Reports
