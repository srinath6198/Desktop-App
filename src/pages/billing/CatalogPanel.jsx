import { Plus, Search, ShoppingCart } from "lucide-react"
import { Badge, Panel } from "../../components/ui/PageUI"
import { formatCurrency } from "../../data/demoData"

function CatalogPanel({ categories, loading, onChooseProduct, onSelectCategory, query, selectedCategory, setQuery, visibleProductGroups }) {
  return (
    <Panel className="catalog-panel">
      <label className="field-search billing-search">
        <Search size={17} />
        <input onChange={(e) => setQuery(e.target.value)} placeholder="Search product, code or category..." value={query} />
      </label>

      <div className="panel-heading">
        <div><h3>Choose products</h3></div>
        <Badge tone="neutral">{visibleProductGroups.length} products</Badge>
      </div>

      <div aria-label="Filter products by category" className="product-category-list" role="group">
        <button
          aria-pressed={!selectedCategory}
          className={`category-filter-button${!selectedCategory ? " active" : ""}`}
          onClick={() => onSelectCategory("")}
          type="button"
        >
          All
        </button>
        {categories.map((category) => (
          <button
            aria-pressed={selectedCategory === category}
            className={`category-filter-button${selectedCategory === category ? " active" : ""}`}
            key={category}
            onClick={() => onSelectCategory(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>

      <div className="product-picker">
        {visibleProductGroups.map((group) => {
          const firstProduct = group.variants[0]
          const lowestPrice = Math.min(...group.variants.map((p) => p.sellingPrice))
          const availableStock = group.variants.some((p) => p.stock > 0)
          return (
            <button
              className="picker-product"
              disabled={!availableStock}
              key={group.key}
              onClick={() => onChooseProduct(group)}
              type="button"
            >
              {firstProduct.imageDataUrl
                ? <img alt={group.name} className="picker-product-image" src={firstProduct.imageDataUrl} />
                : <div className="picker-flower">{group.name.slice(0, 1)}</div>}
              <strong>{group.name}</strong>
              <span style={{ color: "#0d1620", fontSize: "11px", fontWeight: 500 }}>
                {group.variants.length > 1
                  ? `${group.variants.length} variants · From ${formatCurrency(lowestPrice)}`
                  : `${formatCurrency(firstProduct.sellingPrice)} / ${firstProduct.unit}`}
              </span>
              <small style={{ color: "#1e80ff", fontSize: "11px", fontWeight: 500 }}>
                {group.variants.length > 1 ? "Choose a variant" : `${firstProduct.stock} ${firstProduct.unit} in stock`}
              </small>
              <span className="picker-add"><Plus size={16} /></span>
            </button>
          )
        })}
        {!loading && visibleProductGroups.length === 0 && (
          <div className="empty-cart">
            <ShoppingCart size={26} />
            <strong>No matching products</strong>
            <span>Try a different search or category.</span>
          </div>
        )}
        {loading && <div className="empty-cart">Loading products…</div>}
      </div>
    </Panel>
  )
}

export default CatalogPanel
