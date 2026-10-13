import { useMemo, useState } from "react"
import { Boxes, Search, SlidersHorizontal } from "lucide-react"
import { Badge, PageTitle, Panel, StatCard } from "../../components/ui/PageUI"
import { demoMovements, demoProducts } from "../../data/demoData"

function Inventory() {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("All stock")
  const [adjustments, setAdjustments] = useState([])
  const lowStockCount = demoProducts.filter((product) => product.stock < 10).length
  const products = useMemo(() => {
    const matches = demoProducts.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()))
    return filter === "Low stock" ? matches.filter((product) => product.stock < 10) : matches
  }, [filter, query])
  const movements = [...adjustments, ...demoMovements]

  function recordAdjustment() {
    const product = demoProducts.find((item) => item.stock < 10)
    if (!product) return
    setAdjustments((current) => [{ id: `MOV-${Date.now()}`, product: product.name, type: "Adjustment", quantity: "+1 unit", reference: "Demo adjustment", date: "Just now" }, ...current])
  }

  return (
    <div className="screen">
      <PageTitle description="Monitor flower levels, recent stock changes and items to replenish." title="Inventory" action={<button className="button button-secondary" onClick={recordAdjustment} type="button"><SlidersHorizontal size={16} /> Record adjustment</button>} />
      <div className="stat-grid compact-stat-grid">
        <StatCard icon={Boxes} label="Total units on hand" value="120" note="Across 6 product varieties" />
        <StatCard icon={Boxes} label="Low stock items" value={lowStockCount} note="Needs replenishment" tone="orange" />
        <StatCard icon={Boxes} label="Stock movements" value="148" note="This month" tone="blue" />
      </div>
      <Panel className="table-panel">
        <div className="panel-heading"><div><h3>Stock levels</h3><p>Current quantity by product</p></div><Badge tone="neutral">Updated just now</Badge></div>
        <div className="toolbar"><label className="field-search"><Search size={17} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search flowers..." value={query} /></label><select aria-label="Inventory filter" className="select-control" onChange={(event) => setFilter(event.target.value)} value={filter}><option>All stock</option><option>Low stock</option></select></div>
        <div className="table-wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Available</th><th>Stock level</th><th>Reorder at</th><th>Status</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="table-product"><div className="flower-avatar">{product.name.slice(0, 1)}</div><strong>{product.name}</strong></div></td><td>{product.category}</td><td><strong>{product.stock} {product.unit}</strong></td><td><div className="stock-meter"><span style={{ width: `${Math.min(product.stock * 2, 100)}%` }} /></div></td><td>10 {product.unit}</td><td><Badge tone={product.stock < 10 ? "warning" : "success"}>{product.stock < 10 ? "Restock soon" : "In stock"}</Badge></td></tr>)}</tbody></table></div>
      </Panel>
      <Panel className="table-panel movement-panel" title="Recent stock movements" description="Purchases, sales and inventory adjustments">
        <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Product</th><th>Type</th><th>Quantity</th><th>Date</th></tr></thead><tbody>{movements.slice(0, 5).map((movement) => <tr key={movement.id}><td><strong>{movement.reference}</strong></td><td>{movement.product}</td><td><Badge tone={movement.type === "Purchase" ? "success" : movement.type === "Adjustment" ? "warning" : "neutral"}>{movement.type}</Badge></td><td className={movement.quantity.startsWith("+") ? "positive-quantity" : ""}>{movement.quantity}</td><td>{movement.date}</td></tr>)}</tbody></table></div>
        <p className="demo-notice">Sample inventory data · “Record adjustment” adds a demo movement only.</p>
      </Panel>
    </div>
  )
}

export default Inventory
