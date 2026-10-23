import { formatCurrency } from "../../data/demoData"
import "./PrintableBill.css"

export async function printBill(bill) {
  if (!bill) throw new Error("Bill details are not available to print.")

  const print = window.desktopAPI?.print
  if (print) {
    const result = await print()
    if (!result.success && result.failureReason !== "cancelled") {
      throw new Error(result.failureReason || "Unable to print this bill.")
    }
    return
  }

  window.print()
}

function PrintableBill({ bill }) {
  if (!bill) return null

  const dueStatus = bill.paymentStatus === "paid"
    ? "Paid"
    : `Due ${formatCurrency(bill.total - bill.amountPaid)}`
  const shop = bill.shop ?? {}

  return (
    <article className="print-receipt">
      <header>
        {shop.logoDataUrl && <img alt="" className="receipt-shop-logo" src={shop.logoDataUrl} />}
        <h1>{shop.shopName || "Shop"}</h1>
        {shop.address && <p>{shop.address}</p>}
        {shop.mobileNumber && <p>Phone: {shop.mobileNumber}</p>}
        {shop.email && <p>{shop.email}</p>}
        {bill.showGst && shop.gstNumber && <p>GSTIN: {shop.gstNumber}</p>}
      </header>
      <div className="receipt-meta"><span>Invoice</span><strong>{bill.invoiceNumber}</strong></div>
      <div className="receipt-meta"><span>Date</span><span>{bill.date}</span></div>
      <div className="receipt-meta"><span>Customer</span><span>{bill.customer}</span></div>
      <hr />
      <div className="receipt-lines">
        {bill.items.map((item, index) => (
          <div className="receipt-line" key={`${item.name}-${item.variant}-${index}`}>
            <span>
              {item.name}{item.variant ? ` (${item.variant})` : ""}
              <small>
                {item.originalPrice && <s style={{ opacity: 0.5, marginRight: 4 }}>{formatCurrency(item.originalPrice)}</s>}
                {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
              </small>
            </span>
            <strong>{formatCurrency(item.unitPrice * item.quantity)}</strong>
          </div>
        ))}
      </div>
      <hr />
      <div className="receipt-meta"><span>Subtotal</span><span>{formatCurrency(bill.subtotal)}</span></div>
      {bill.discount > 0 && (
        <div className="receipt-meta"><span>Discount</span><span>− {formatCurrency(bill.discount)}</span></div>
      )}
      {bill.showTax && (
        <div className="receipt-meta"><span>Tax ({bill.taxRate}%)</span><span>{formatCurrency(bill.tax)}</span></div>
      )}
      {bill.parcelCharge > 0 && <div className="receipt-meta"><span>Parcel charge</span><span>{formatCurrency(bill.parcelCharge)}</span></div>}
      {bill.travelCharge > 0 && <div className="receipt-meta"><span>Travel charge</span><span>{formatCurrency(bill.travelCharge)}</span></div>}
      {bill.deliveryCharge > 0 && <div className="receipt-meta"><span>Delivery charge</span><span>{formatCurrency(bill.deliveryCharge)}</span></div>}
      {bill.otherCharge > 0 && <div className="receipt-meta"><span>{bill.otherChargeLabel || "Other"}</span><span>{formatCurrency(bill.otherCharge)}</span></div>}
      <div className="receipt-meta receipt-grand-total"><strong>Total</strong><strong>{formatCurrency(bill.total)}</strong></div>
      <div className="receipt-meta"><span>Payment</span><span>{bill.payment}</span></div>
      <div className="receipt-meta"><span>Status</span><span>{dueStatus}</span></div>
      <footer>
        <span>{shop.receiptFooter || "Thank you for your purchase!"}</span>
        <span className="receipt-signature">
          {shop.ownerName && <strong>{shop.ownerName}</strong>}
          <small>Authorized signature</small>
        </span>
      </footer>
      {shop.termsAndConditions && (
        <div className="receipt-terms">
          <strong>Terms &amp; Conditions</strong>
          <ol>
            {shop.termsAndConditions.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ol>
        </div>
      )}
    </article>
  )
}

export default PrintableBill
