import { useState } from "react"
import { Download, IndianRupee, ShoppingBag, Users } from "lucide-react"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"

function Reports() {
  const [range, setRange] = useState("This week")
  const bars = [38, 54, 47, 75, 61, 92, 70]

  return (
    <div className="screen">
      <PageTitle description="Understand sales, products and customer performance." title="Reports" action={<button className="button button-secondary" onClick={() => window.print()} type="button"><Download size={16} /> Export report</button>} />
      <div className="report-toolbar"><span className="muted-text">Reporting period</span><select aria-label="Report period" className="select-control" onChange={(event) => setRange(event.target.value)} value={range}><option>This week</option><option>This month</option><option>This year</option></select></div>
      <div className="stat-grid compact-stat-grid">
        <StatCard icon={IndianRupee} label="Gross revenue" value={formatCurrency(86240)} note={<><Badge tone="success">↑ 8.4%</Badge> vs previous period</>} />
        <StatCard icon={ShoppingBag} label="Orders completed" value="148" note={<><Badge tone="success">↑ 5.2%</Badge> vs previous period</>} tone="blue" />
        <StatCard icon={Users} label="Average bill value" value={formatCurrency(583)} note="Across all completed sales" tone="purple" />
      </div>
      <div className="dashboard-grid report-grid">
        <Panel className="sales-panel" title={`Revenue · ${range.toLowerCase()}`} description="Daily sales total">
          <div className="chart-summary"><strong>{formatCurrency(86240)}</strong><Badge tone="success">↑ 8.4%</Badge></div>
          <div aria-label="Revenue chart" className="bar-chart report-chart" role="img">{bars.map((height, index) => <div className="chart-column" key={index}><div className="chart-track"><span style={{ height: `${height}%` }} /></div><small>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</small></div>)}</div>
        </Panel>
        <Panel title="Sales by payment" description="How customers paid">
          <div className="payment-legend"><div className="payment-ring"><span>₹86k<small>Total</small></span></div><div className="legend-list"><p><i className="legend-dot green-dot" />UPI <strong>48%</strong></p><p><i className="legend-dot blue-dot" />Cash <strong>32%</strong></p><p><i className="legend-dot orange-dot" />Card <strong>20%</strong></p></div></div>
        </Panel>
      </div>
      <Panel title="Top selling flowers" description="Products ranked by units sold">
        <div className="top-selling-list">{[["Red Rose", 142, 86], ["Jasmine", 96, 63], ["Marigold", 78, 48], ["White Lily", 54, 35]].map(([name, quantity, width], index) => <div className="top-selling-row" key={name}><span className="popular-rank">{index + 1}</span><strong>{name}</strong><div className="selling-track"><span style={{ width: `${width}%` }} /></div><span>{quantity} sold</span></div>)}</div>
      </Panel>
      <p className="demo-notice">Illustrative sample report · Export and date range are UI previews, not database reports.</p>
    </div>
  )
}

export default Reports
