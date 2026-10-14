function getCreditApi() {
  const api = window.desktopAPI?.customerCredit
  if (!api) {
    throw new Error("Customer credit is available only in the Electron desktop app. Run `npm run electron:dev`.")
  }
  return api
}

export const customerCreditService = {
  report(customerId = null) {
    return getCreditApi().report(customerId == null ? null : Number(customerId))
  },

  createEntry(entry) {
    return getCreditApi().createEntry({
      customerId: Number(entry.customerId),
      type: entry.type,
      amount: Number(entry.amount),
      reference: entry.reference?.trim() ?? "",
      notes: entry.notes?.trim() ?? "",
    })
  },
}
