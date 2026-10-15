import { useEffect, useMemo, useState } from "react"
import { FileText, MessageCircle, Printer, Search } from "lucide-react"
import { Badge, Modal } from "../../components/ui/PageUI"
import BillTerms from "../../components/billing/BillTerms"
import PrintableBill, { printBill } from "../../components/billing/PrintableBill"
import { formatCurrency } from "../../data/demoData"
import { customerService } from "../../services/customer.service"
import { salesService } from "../../services/sales.service"
import { formatBillDate, toBillReceipt } from "../../utils/billReceipt"
import { shareBillPdf as saveAndOpenBillPdf } from "../../utils/shareBillPdf"

function getLocalDate(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function Reprint({ onClose }) {
  const [savedBills, setSavedBills] = useState([])
  const [selectedBill, setSelectedBill] = useState(null)
  const [query, setQuery] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [customers, setCustomers] = useState([])
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedBillLoading, setSelectedBillLoading] = useState(false)
  const [sharingPdf, setSharingPdf] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [shareMessage, setShareMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true
    Promise.all([salesService.list(), customerService.list()])
      .then(([saleRows, customerRows]) => {
        if (!mounted) return
        setSavedBills(saleRows)
        setCustomers(customerRows)
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || "Unable to load saved bills.")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const filteredBills = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return savedBills.filter((sale) => {
      const matchesCustomer = !customerId || String(sale.customer_id ?? "") === String(customerId)
      const matchesSearch = `${sale.invoice_number} ${sale.customer_name}`
        .toLocaleLowerCase()
        .includes(normalizedQuery)
      const date = getLocalDate(sale.created_at)
      const matchesFrom = !fromDate || date >= fromDate
      const matchesTo = !toDate || date <= toDate
      return matchesCustomer && matchesSearch && matchesFrom && matchesTo
    })
  }, [customerId, fromDate, query, savedBills, toDate])

  async function selectBill(saleId) {
    setSelectedBillLoading(true)
    setError("")
    try {
      setSelectedBill(await salesService.get(saleId))
    } catch (loadError) {
      setError(loadError.message || "Unable to load this saved bill.")
    } finally {
      setSelectedBillLoading(false)
    }
  }

  async function printSelectedBill() {
    if (!selectedBill) return
    try {
      await printBill(toBillReceipt(selectedBill))
    } catch (printError) {
      setError(printError.message || "Unable to print this bill.")
    }
  }

  async function saveSelectedBillPdf() {
    if (!selectedBill) return
    setSavingPdf(true)
    setError("")
    setShareMessage("")
    const savePdf = window.desktopAPI?.saveBillPdf
    if (!savePdf) {
      setError("PDF saving is only available in the desktop app.")
      setSavingPdf(false)
      return
    }
    try {
      const result = await savePdf(toBillReceipt(selectedBill))
      if (!result.canceled) setShareMessage(`PDF saved to ${result.filePath}.`)
    } catch (saveError) {
      setError(saveError.message || "Unable to save the invoice PDF.")
    } finally {
      setSavingPdf(false)
    }
  }

  async function shareSelectedBill() {
    if (!selectedBill) return
    setSharingPdf(true)
    setError("")
    setShareMessage("")
    try {
      const filePath = await saveAndOpenBillPdf(toBillReceipt(selectedBill))
      if (filePath) setShareMessage(`PDF saved to ${filePath}. Attach it in the WhatsApp chat that was opened.`)
    } catch (shareError) {
      setError(shareError.message || "Unable to save and share the invoice PDF.")
    } finally {
      setSharingPdf(false)
    }
  }

  return (
    <>
      <Modal
        className="saved-bills-modal"
        onClose={onClose}
        title="Reprint a saved bill"
      >
        <div className="reprint-filters">
          <label className="field-search saved-bills-search">
            <Search size={17} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search invoice or customer..."
              value={query}
            />
          </label>
          <label className="purchase-date-filter">
            Customer
            <select onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
          </label>
          <label className="purchase-date-filter">
            From date
            <input max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} />
          </label>
          <label className="purchase-date-filter">
            To date
            <input min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} />
          </label>
        </div>
        {error && <p className="error-banner saved-bills-error" role="alert">{error}</p>}
        <div className="saved-bills-content">
          <div aria-label="Saved bills" className="saved-bills-list">
            {loading && <p className="empty-note">Loading saved bills…</p>}
            {!loading && filteredBills.map((sale) => (
              <button
                aria-pressed={selectedBill?.id === sale.id}
                className={`saved-bill-row${selectedBill?.id === sale.id ? " active" : ""}`}
                disabled={selectedBillLoading}
                key={sale.id}
                onClick={() => selectBill(sale.id)}
                type="button"
              >
                <span className="saved-bill-row-heading">
                  <strong>{sale.invoice_number}</strong>
                  <Badge tone={sale.payment_status === "paid" ? "success" : "warning"}>
                    {sale.payment_status === "paid" ? "Paid" : "Due"}
                  </Badge>
                </span>
                <span>{sale.customer_name}</span>
                <small>{formatBillDate(sale.created_at)} · {sale.item_count} items · {formatCurrency(sale.total)}</small>
              </button>
            ))}
            {!loading && filteredBills.length === 0 && (
              <p className="empty-note">{savedBills.length ? "No bills match these filters." : "No saved bills yet."}</p>
            )}
          </div>

          <section aria-label="Bill preview" className="saved-bill-preview">
            {selectedBillLoading && <p className="empty-note">Loading bill preview…</p>}
            {!selectedBillLoading && !selectedBill && (
              <div className="empty-cart">
                <Printer size={26} />
                <strong>Select a saved bill</strong>
                <span>Choose an invoice to preview and reprint.</span>
              </div>
            )}
            {!selectedBillLoading && selectedBill && (
              <>
                <div className="saved-bill-preview-heading">
                  <div>
                    <strong>{selectedBill.invoice_number}</strong>
                    <span>{selectedBill.customer_name} · {formatBillDate(selectedBill.created_at)}</span>
                  </div>
                  <div className="saved-bill-preview-actions">
                    <button className="button button-secondary" disabled={savingPdf} onClick={saveSelectedBillPdf} type="button">
                      <FileText size={16} /> {savingPdf ? "Saving PDF..." : "Save bill"}
                    </button>
                    <button className="button button-secondary" disabled={sharingPdf} onClick={shareSelectedBill} type="button">
                      <MessageCircle size={16} /> {sharingPdf ? "Preparing PDF..." : "Share PDF"}
                    </button>
                    <button className="button button-primary" onClick={printSelectedBill} type="button">
                      <Printer size={16} /> Reprint bill
                    </button>
                  </div>
                </div>
                {shareMessage && <p className="success-banner" role="status">{shareMessage}</p>}
                <div className="saved-bill-preview-items">
                  {selectedBill.items.map((item, index) => (
                    <div className="saved-bill-preview-item" key={`${item.product_id}-${index}`}>
                      <span>
                        <strong>{item.product_name}{item.variant ? ` (${item.variant})` : ""}</strong>
                        <small>{item.quantity} {item.unit} × {formatCurrency(item.price)}</small>
                      </span>
                      <strong>{formatCurrency(item.subtotal)}</strong>
                    </div>
                  ))}
                </div>
                <div className="saved-bill-preview-totals">
                  <div><span>Subtotal</span><span>{formatCurrency(selectedBill.subtotal)}</span></div>
                  <div><span>Tax</span><span>{formatCurrency(selectedBill.tax)}</span></div>
                  <div className="bill-total"><strong>Total</strong><strong>{formatCurrency(selectedBill.total)}</strong></div>
                  <div><span>Payment</span><span>{selectedBill.payment_method}</span></div>
                  <div>
                    <span>Status</span>
                    <span>{selectedBill.payment_status === "paid"
                      ? "Paid"
                      : `Due ${formatCurrency(selectedBill.total - selectedBill.amount_paid)}`}
                    </span>
                  </div>
                </div>
                <BillTerms terms={selectedBill.settings?.termsAndConditions} />
              </>
            )}
          </section>
        </div>
      </Modal>
      <PrintableBill bill={selectedBill ? toBillReceipt(selectedBill) : null} />
    </>
  )
}

export default Reprint
