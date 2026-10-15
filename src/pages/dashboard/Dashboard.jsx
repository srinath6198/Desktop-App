import { useEffect, useState } from "react"
import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, IndianRupee, ShoppingBag, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"
import { dashboardService } from "../../services/dashboard.service"

function formatQuantity(value) {
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 3 })
}

function formatSaleDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function getChange(current, previous) {
  if (previous === 0) {
    return current === 0 ? "0%" : "New"
  }
  const percentage = ((current - previous) / previous) * 100
  return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function Dashboard() {
  const [period, setPeriod] = useState("week")
  const [requestState, setRequestState] = useState({ period: null, summary: null, error: "" })
  const [now] = useState(() => new Date())
  const loading = requestState.period !== period
  const summary = loading ? null : requestState.summary
  const error = loading ? "" : requestState.error

  useEffect(() => {
    let mounted = true
    dashboardService.getSummary(period)
      .then((data) => {
        if (mounted) setRequestState({ period, summary: data, error: "" })
      })
      .catch((loadError) => {
        if (mounted) {
          setRequestState({
            period,
            summary: null,
            error: loadError.message || "Unable to load dashboard data.",
          })
        }
      })
    return () => {
      mounted = false
    }
  }, [period])

  const todaySales = summary?.todaySales ?? 0
  const salesChange = summary ? getChange(todaySales, summary.yesterdaySales) : "—"
  const chartChange = summary ? getChange(summary.chart.current, summary.chart.previous) : "—"
  const chartIsDown = summary && summary.chart.current < summary.chart.previous
  const todayIsDown = summary && todaySales < summary.yesterdaySales
  const chartPoints = summary?.chart.points ?? []
  const chartMax = Math.max(...chartPoints.map(({ value }) => value), 1)
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now).toLocaleUpperCase("en-IN")

  return (
    <div className="screen">
      <PageTitle
        description="Here’s what’s happening at your flower shop today."
        eyebrow={dateLabel}
        title={`${getGreeting()}, Shop Admin`}
        action={<Link className="button button-primary" to="/billing/new"><IndianRupee size={17} /> Create a bill</Link>}
      />

      {error && <p className="error-banner" role="alert">{error}</p>}

      <div className="stat-grid">
        <StatCard
          icon={IndianRupee}
          label="Today's sales"
          value={summary ? formatCurrency(todaySales) : "—"}
          note={summary && <>{todayIsDown ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />} {salesChange} vs. yesterday</>}
        />
        <StatCard
          icon={ShoppingBag}
          label="Bills created"
          value={summary?.todayBills ?? "—"}
          note="Today"
          tone="blue"
        />
        <StatCard
          icon={Boxes}
          label="Products in stock"
          value={summary?.activeProducts ?? "—"}
          note={summary ? `${summary.lowStockCount} items need attention` : "Inventory summary unavailable"}
          tone="orange"
        />
        <StatCard
          icon={Users}
          label="Customers"
          value={summary?.customerCount ?? "—"}
          note={`${summary?.newCustomersThisMonth ?? 0} new this month`}
          tone="purple"
        />
      </div>

      <div className="dashboard-grid">
        <Panel
          className="sales-panel"
          description={`Your sales performance ${period === "week" ? "this week" : "this month"}`}
          title="Sales overview"
          action={(
            <select
              aria-label="Sales chart period"
              className="select-control"
              onChange={(event) => setPeriod(event.target.value)}
              value={period}
            >
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          )}
        >
          <div className="chart-summary">
            <strong>{summary ? formatCurrency(summary.chart.current) : "—"}</strong>
            <Badge tone={chartIsDown ? "warning" : "success"}>
              {chartIsDown ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} {chartChange}
            </Badge>
            <span>vs. previous {period === "week" ? "week" : "month"}</span>
          </div>
          <div aria-label={`${period === "week" ? "Weekly" : "Monthly"} sales bar chart`} className="bar-chart" role="img">
            {chartPoints.map((point) => {
              const height = Math.max((point.value / chartMax) * 100, 6)
              return (
                <div className="chart-column" key={point.label}>
                  <div className="chart-track"><span style={{ height: `${height}%` }} /></div>
                  <small>{point.label}</small>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel
          className="low-stock-panel"
          description="Restock these items soon"
          title="Low stock alerts"
          action={<Link className="text-link" to="/inventory">View inventory <ArrowRight size={14} /></Link>}
        >
          {(summary?.lowStockProducts ?? []).map((product) => (
            <div className="stock-alert-row" key={product.id}>
              <div className="flower-avatar">{product.name.slice(0, 1)}</div>
              <div className="stock-alert-name"><strong>{product.name}</strong><span>{product.category || "Uncategorized"}</span></div>
              <Badge tone="warning">{formatQuantity(product.stock)} {product.unit}</Badge>
            </div>
          ))}
          {loading && <p className="empty-note">Loading inventory…</p>}
          {!loading && summary?.lowStockProducts.length === 0 && <p className="empty-note">All products are well stocked.</p>}
        </Panel>
      </div>

      <div className="dashboard-grid lower-grid">
        <Panel title="Recent sales" description="Latest invoices from your store" action={<Link className="text-link" to="/billing/history">See all <ArrowRight size={14} /></Link>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {(summary?.recentSales ?? []).map((sale) => (
                  <tr key={sale.id}>
                    <td><strong>{sale.invoice_number}</strong></td>
                    <td>{sale.customer_name}</td>
                    <td>{formatSaleDate(sale.created_at)}</td>
                    <td className="amount-cell">{formatCurrency(sale.total)}</td>
                    <td><Badge tone={sale.payment_status === "paid" ? "success" : "warning"}>{sale.payment_status === "paid" ? "Paid" : "Due"}</Badge></td>
                  </tr>
                ))}
                {!loading && summary?.recentSales.length === 0 && (
                  <tr><td colSpan="5"><p className="empty-note">No sales recorded yet.</p></td></tr>
                )}
                {loading && <tr><td colSpan="5"><p className="empty-note">Loading sales…</p></td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="top-products-panel" title="Popular flowers" description="Best sellers this month">
          {(summary?.popularProducts ?? []).map((product, index) => (
            <div className="popular-row" key={product.id}>
              <span className="popular-rank">{String(index + 1).padStart(2, "0")}</span>
              <div className="flower-avatar">{product.name.slice(0, 1)}</div>
              <div className="popular-name"><strong>{product.name}</strong><span>{product.category || "Uncategorized"}</span></div>
              <span className="popular-trend">{formatQuantity(product.quantity_sold)} {product.unit} sold</span>
            </div>
          ))}
          {!loading && summary?.popularProducts.length === 0 && <p className="empty-note">No sales this month yet.</p>}
          {loading && <p className="empty-note">Loading popular products…</p>}
        </Panel>
      </div>
    </div>
  )
}

export default Dashboard
