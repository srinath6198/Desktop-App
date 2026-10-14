function getPurchasesApi() {
  const api = window.desktopAPI?.purchases
  if (!api) {
    throw new Error("Purchase storage is available only in the desktop app. Run `npm run electron:dev` from the project folder.")
  }
  return api
}

function fromDatabase(purchase) {
  return {
    id: purchase.id,
    purchaseNumber: `PUR-${String(purchase.id).padStart(5, "0")}`,
    supplierId: purchase.supplier_id,
    supplier: purchase.supplier_name ?? "Unknown supplier",
    supplierEmail: purchase.supplier_email ?? "",
    total: purchase.total,
    createdAt: purchase.created_at,
    itemCount: purchase.items.length,
    uom: [...new Set(purchase.items.map((item) => item.unit).filter(Boolean))].join(", ") || "—",
    returnedTotal: purchase.items.reduce((sum, item) => {
      const returnedSubtotal = item.returned_quantity * item.purchase_rate
      return sum + returnedSubtotal + returnedSubtotal * item.tax_rate / 100
    }, 0),
    items: purchase.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      variant: item.variant,
      uom: item.unit,
      unit: item.unit,
      quantity: item.quantity,
      returnedQuantity: item.returned_quantity,
      availableToReturn: Math.max(0, item.quantity - item.returned_quantity),
      purchaseRate: item.purchase_rate,
      taxRate: item.tax_rate,
      sellingPrice: item.selling_price,
      subtotal: item.subtotal,
      taxAmount: item.tax_amount,
      total: item.total,
    })),
  }
}

function toDatabase(purchase) {
  return {
    supplierId: Number(purchase.supplierId),
    items: purchase.items.map((item) => ({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      purchaseRate: Number(item.purchaseRate),
      taxRate: Number(item.taxRate),
      sellingPrice: Number(item.sellingPrice),
    })),
  }
}

export const purchaseService = {
  async list(filters = {}) {
    return (await getPurchasesApi().list(filters)).map(fromDatabase)
  },

  async create(purchase) {
    return fromDatabase(await getPurchasesApi().create(toDatabase(purchase)))
  },

  async createReturn(purchaseId, items) {
    const result = await getPurchasesApi().createReturn({
      purchaseId: Number(purchaseId),
      items: items.map((item) => ({
        purchaseItemId: Number(item.purchaseItemId),
        quantity: Number(item.quantity),
      })),
    })
    return {
      id: result.id,
      returnNumber: result.returnNumber,
      total: result.total,
      purchase: fromDatabase(result.purchase),
    }
  },
}
