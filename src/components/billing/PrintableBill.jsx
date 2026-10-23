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
  const discount = Number(bill.discount ?? bill.discountAmount ?? bill.discount_amount ?? 0)
  const parcelCharge = Number(bill.parcelCharge ?? bill.parcel_charge ?? 0)
  const travelCharge = Number(bill.travelCharge ?? bill.travel_charge ?? 0)
  const deliveryCharge = Number(bill.deliveryCharge ?? bill.delivery_charge ?? 0)
  const otherCharge = Number(bill.otherCharge ?? bill.other_charge ?? 0)
  const otherChargeLabel = bill.otherChargeLabel || bill.other_charge_label || "Other"
  const tax = Number(bill.tax ?? 0)
  const taxRate = bill.taxRate ?? bill.tax_rate ?? 0
  const showTax = (bill.showTax !== false && bill.show_tax !== 0)

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
      {(discount > 0 || Number(bill.discount) > 0 || Number(bill.discountAmount) > 0) && (
        <div className="receipt-meta"><span>Discount amount</span><span>− {formatCurrency(discount || bill.discount || bill.discountAmount)}</span></div>
      )}
      {showTax && tax > 0 && (
        <div className="receipt-meta"><span>Tax ({taxRate}%)</span><span>{formatCurrency(tax)}</span></div>
      )}
      {parcelCharge > 0 && <div className="receipt-meta"><span>Parcel charge</span><span>{formatCurrency(parcelCharge)}</span></div>}
      {travelCharge > 0 && <div className="receipt-meta"><span>Travel charge</span><span>{formatCurrency(travelCharge)}</span></div>}
      {deliveryCharge > 0 && <div className="receipt-meta"><span>Delivery charge</span><span>{formatCurrency(deliveryCharge)}</span></div>}
      {otherCharge > 0 && <div className="receipt-meta"><span>{otherChargeLabel}</span><span>{formatCurrency(otherCharge)}</span></div>}
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
