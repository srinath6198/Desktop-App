export function formatBillDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function toBillReceipt(sale, shopSettings = sale.settings) {
  const settings = shopSettings ?? {}
  const terms = settings.termsAndConditions
  const termsAndConditions = Array.isArray(terms)
    ? terms.map((term) => String(term).trim()).filter(Boolean).join("\n")
    : typeof terms === "string"
      ? terms.split(/\r?\n/).map((term) => term.trim()).filter(Boolean).join("\n")
      : ""
  return {
    invoiceNumber: sale.invoice_number,
    customer: sale.customer_name,
    customerPhone: sale.customer_phone ?? "",
    payment: sale.payment_method,
    paymentStatus: sale.payment_status,
    amountPaid: sale.amount_paid,
    date: formatBillDate(sale.created_at),
    items: sale.items.map((item) => ({
      name: item.product_name,
      variant: item.variant,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.price,
      originalPrice: (item.original_price != null && item.original_price !== item.price) ? item.original_price : null,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount ?? sale.discountAmount ?? sale.discount_amount ?? 0,
    tax: sale.tax,
    total: sale.total,
    taxRate: sale.tax_rate ?? sale.taxRate ?? settings.taxRate ?? 0,
    showTax: sale.show_tax == null ? (sale.showTax ?? settings.showTax !== false) : sale.show_tax === 1,
    showGst: settings.showGst !== false,
    parcelCharge: sale.parcel_charge ?? sale.parcelCharge ?? 0,
    travelCharge: sale.travel_charge ?? sale.travelCharge ?? 0,
    deliveryCharge: sale.delivery_charge ?? sale.deliveryCharge ?? 0,
    otherCharge: sale.other_charge ?? sale.otherCharge ?? 0,
    otherChargeLabel: sale.other_charge_label || sale.otherChargeLabel || "Other",
    shop: {
      shopName: settings.shopName ?? "Shop",
      address: settings.address ?? "",
      mobileNumber: settings.mobileNumber ?? "",
      email: settings.email ?? "",
      gstNumber: settings.gstNumber ?? "",
      ownerName: settings.ownerName ?? "",
      logoDataUrl: settings.logoDataUrl ?? "",
      receiptFooter: settings.receiptFooter ?? "",
      termsAndConditions,
    },
  }
}
