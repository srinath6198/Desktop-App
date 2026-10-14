function getProductsApi() {
  const api = window.desktopAPI?.products
  if (!api) {
    throw new Error(
      "The product database is available only in the desktop app. Close the browser preview and run `npm run electron:dev` from the project folder.",
    )
  }
  return api
}

function fromDatabase(product) {
  return {
    id: product.id,
    productCode: product.product_code ?? "",
    name: product.name,
    variant: product.variant ?? "",
    category: product.category ?? "",
    unit: product.unit,
    noOfUnits: product.no_of_units,
    mrp: product.mrp,
    purchasePrice: product.purchase_price,
    sellingPrice: product.selling_price,
    stock: product.stock,
    minimumStock: product.minimum_stock ?? 0,
    active: product.active === 1,
    imageDataUrl: product.image_data_url ?? null,
    createdAt: product.created_at,
  }
}

function toDatabase(product) {
  return {
    id: product.id,
    product_code: product.productCode,
    name: product.name,
    variant: product.variant,
    category: product.category,
    unit: product.unit,
    no_of_units: product.noOfUnits,
    mrp: product.mrp,
    purchase_price: product.purchasePrice,
    selling_price: product.sellingPrice,
    stock: product.stock,
    minimum_stock: product.minimumStock ?? 0,
    image_data_url: product.imageDataUrl ?? null,
    remove_image: product.removeImage ?? false,
  }
}

export const productService = {
  async list() {
    const rows = await getProductsApi().list()
    return rows.map(fromDatabase)
  },

  selectImage() {
    return getProductsApi().selectImage()
  },

  async create(product) {
    return fromDatabase(await getProductsApi().create(toDatabase(product)))
  },

  async update(product) {
    return fromDatabase(await getProductsApi().update(toDatabase(product)))
  },

  async setActive(id, active) {
    return fromDatabase(await getProductsApi().setActive(id, active))
  },
}
