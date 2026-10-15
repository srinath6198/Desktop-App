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

async function createProductsOneByOne(api, databaseProducts) {
  const rows = []
  for (const product of databaseProducts) {
    try {
      rows.push(await api.create(product))
    } catch (error) {
      if (rows.length) {
        throw new Error(
          `Created ${rows.length} of ${databaseProducts.length} variants before an error: ${error.message || "Unable to save a product variant."}`,
        )
      }
      throw error
    }
  }
  return rows.map(fromDatabase)
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

  async createMany(products) {
    const api = getProductsApi()
    const databaseProducts = products.map(toDatabase)
    if (typeof api.createMany !== "function") {
      return createProductsOneByOne(api, databaseProducts)
    }

    try {
      const rows = await api.createMany(databaseProducts)
      return rows.map(fromDatabase)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/No handler registered for ['"]products:create-many['"]/.test(message)) {
        return createProductsOneByOne(api, databaseProducts)
      }
      throw error
    }
  },

  async update(product) {
    return fromDatabase(await getProductsApi().update(toDatabase(product)))
  },

  async setActive(id, active) {
    return fromDatabase(await getProductsApi().setActive(id, active))
  },
}
