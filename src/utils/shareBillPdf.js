import { formatCurrency } from "../data/demoData"

export async function shareBillPdf(bill) {
  const phoneDigits = bill.customerPhone.replace(/\D/g, "")
  const whatsappPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits
  if (!/^\d{8,15}$/.test(whatsappPhone)) {
    throw new Error("A valid customer phone number is required to share the invoice PDF.")
  }

  const savePdf = window.desktopAPI?.saveBillPdf
  const openExternal = window.desktopAPI?.openExternal
  if (!savePdf || !openExternal) {
    throw new Error("PDF sharing is available only in the Electron desktop app.")
  }

  const result = await savePdf(bill)
  if (result.canceled) return null

  const message = `Invoice ${bill.invoiceNumber} for ${formatCurrency(bill.total)} is ready. Please attach the saved PDF.`
  const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
  await openExternal(whatsappUrl)
  return result.filePath
}
