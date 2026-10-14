import { productService } from "./product.service"

function getStockApi() {
  const api = window.desktopAPI?.stock
  if (!api) {
    throw new Error("Stock management is available only in the Electron desktop app. Run `npm run electron:dev`.")
  }
  return api
}

export const stockService = {
  listProducts() {
    return productService.list()
  },

  async getInventoryReport() {
    const report = await getStockApi().inventoryReport()
    return {
      products: report.products.map((product) => ({
        id: product.id,
        productCode: product.product_code ?? "",
        name: product.name,
        variant: product.variant ?? "",
        category: product.category ?? "",
        unit: product.unit,
        stock: product.stock,
        minimumStock: product.minimum_stock ?? 0,
        active: product.active === 1,
      })),
      movements: report.movements,
      movementCountThisMonth: report.movementCountThisMonth,
    }
  },

  async addStock({ productId, quantity, minimumStock, notes }) {
    const product = await getStockApi().add({
      productId: Number(productId),
      quantity: Number(quantity),
      minimumStock: Number(minimumStock),
      notes,
    })
    return {
      ...product,
      productCode: product.product_code ?? "",
      category: product.category ?? "",
      unit: product.unit,
      minimumStock: product.minimum_stock ?? 0,
      active: product.active === 1,
    }
  },

  async adjustStock({ productId, direction, quantity, notes }) {
    const product = await getStockApi().adjust({
      productId: Number(productId),
      direction,
      quantity: Number(quantity),
      notes,
    })
    return {
      ...product,
      productCode: product.product_code ?? "",
      category: product.category ?? "",
      unit: product.unit,
      minimumStock: product.minimum_stock ?? 0,
      active: product.active === 1,
    }
  },
}
