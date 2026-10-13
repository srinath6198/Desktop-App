
import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, IndianRupee, ShoppingBag, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { demoProducts, demoSales, formatCurrency } from "../../data/demoData"

function Dashboard() {
  const lowStockProducts = demoProducts.filter((product) => product.stock < 10)

  return (
    <div className="screen">
      <PageTitle
        description="Here’s what’s happening at your flower shop today."
        eyebrow="TUESDAY, 13 OCTOBER 2026"
        title="Good afternoon, Shop Admin"
        action={<Link className="button button-primary" to="/billing/new"><IndianRupee size={17} /> Create a bill</Link>}
      />

      <div className="stat-grid">
        <StatCard icon={IndianRupee} label="Today's sales" value={formatCurrency(18450)} note={<><ArrowUpRight size={14} /> 12.8% from yesterday</>} />
        <StatCard icon={ShoppingBag} label="Bills created" value="28" note="6 bills since noon" tone="blue" />
        <StatCard icon={Boxes} label="Products in stock" value="120" note={`${lowStockProducts.length} items need attention`} tone="orange" />
        <StatCard icon={Users} label="Active customers" value="86" note={<><ArrowUpRight size={14} /> 8 new this month</>} tone="purple" />
      </div>

      <div className="dashboard-grid">
        <Panel
          className="sales-panel"
          description="Your sales performance this week"
          title="Sales overview"
          action={<select aria-label="Sales chart period" className="select-control"><option>This week</option><option>This month</option></select>}
        >
          <div className="chart-summary"><strong>{formatCurrency(86240)}</strong><Badge tone="success"><ArrowUpRight size={13} /> 8.4%</Badge><span>vs. last week</span></div>
          <div aria-label="Weekly sales bar chart" className="bar-chart" role="img">
            {[42, 64, 48, 78, 58, 90, 68].map((height, index) => (
              <div className="chart-column" key={index}>
                <div className="chart-track"><span style={{ height: `${height}%` }} /></div>
                <small>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</small>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          className="low-stock-panel"
          description="Restock these items soon"
          title="Low stock alerts"
          action={<Link className="text-link" to="/inventory">View inventory <ArrowRight size={14} /></Link>}
        >
          {lowStockProducts.map((product) => (
            <div className="stock-alert-row" key={product.id}>
              <div className="flower-avatar">{product.name.slice(0, 1)}</div>
              <div className="stock-alert-name"><strong>{product.name}</strong><span>{product.category}</span></div>
              <Badge tone="warning">{product.stock} {product.unit}</Badge>
            </div>
          ))}
          {lowStockProducts.length === 0 && <p className="empty-note">All products are well stocked.</p>}
        </Panel>
      </div>

      <div className="dashboard-grid lower-grid">
        <Panel title="Recent sales" description="Latest invoices from your store" action={<Link className="text-link" to="/billing/history">See all <ArrowRight size={14} /></Link>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {demoSales.slice(0, 4).map((sale) => (
                  <tr key={sale.id}><td><strong>{sale.id}</strong></td><td>{sale.customer}</td><td>{sale.date}</td><td className="amount-cell">{formatCurrency(sale.total)}</td><td><Badge tone={sale.status === "Paid" ? "success" : "warning"}>{sale.status}</Badge></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel className="top-products-panel" title="Popular flowers" description="Best sellers this month">
          {demoProducts.slice(0, 4).map((product, index) => (
            <div className="popular-row" key={product.id}>
              <span className="popular-rank">{String(index + 1).padStart(2, "0")}</span>
              <div className="flower-avatar">{product.name.slice(0, 1)}</div>
              <div className="popular-name"><strong>{product.name}</strong><span>{product.category}</span></div>
              <span className="popular-trend">{index === 3 ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />} {24 - index * 3}%</span>
            </div>
          ))}
        </Panel>
      </div>
      <p className="demo-notice">Sample dashboard data · Connect your database to show live shop activity.</p>
    </div>
  )
}

export default Dashboard
