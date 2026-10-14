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
}
