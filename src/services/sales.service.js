function getSalesApi() {
  const api = window.desktopAPI?.sales
  if (!api) {
    throw new Error("Sales and billing are available only in the Electron desktop app. Run `npm run electron:dev`.")
  }
  return api
}

export const salesService = {
  async list() {
    return getSalesApi().list()
  },

  get(saleId) {
    return getSalesApi().get(Number(saleId))
  },

  create({ customerId, paymentMethod, items }) {
    return getSalesApi().create({
      customerId: customerId == null ? null : Number(customerId),
      paymentMethod,
      items: items.map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      })),
    })
  },
}
