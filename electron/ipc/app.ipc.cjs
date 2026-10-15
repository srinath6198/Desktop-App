const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeBill(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Bill details are required to create a PDF");
  }
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100) {
    throw new Error("Bill must contain between 1 and 100 items");
  }

  const textFields = ["invoiceNumber", "date", "customer", "payment", "paymentStatus"];
  for (const field of textFields) {
    if (typeof input[field] !== "string" || input[field].length > 300) {
      throw new Error(`Bill ${field} is invalid`);
    }
  }
  for (const field of ["subtotal", "tax", "total", "amountPaid"]) {
    if (!Number.isFinite(input[field]) || input[field] < 0) {
      throw new Error(`Bill ${field} is invalid`);
    }
  }
  function toCharge(val) { const n = Number(val ?? 0); return Number.isFinite(n) && n >= 0 ? n : 0; }
  const items = input.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Bill contains an invalid item");
    }
    if (typeof item.name !== "string" || item.name.length > 250 ||
        typeof item.variant !== "string" || item.variant.length > 100 ||
        typeof item.unit !== "string" || item.unit.length > 50 ||
        !Number.isFinite(item.quantity) || item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      throw new Error("Bill contains invalid item details");
    }
    return {
      name: item.name,
      variant: item.variant,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    };
  });

  const shop = input.shop && typeof input.shop === "object" ? input.shop : {};
  if (shop.termsAndConditions != null && typeof shop.termsAndConditions !== "string") {
    throw new Error("Bill terms and conditions must be text");
  }
  const termsAndConditions = typeof shop.termsAndConditions === "string"
    ? shop.termsAndConditions.split(/\r?\n/).map((term) => term.trim()).filter(Boolean)
    : [];
  if (termsAndConditions.length > 50 || termsAndConditions.some((term) => term.length > 200)) {
    throw new Error("Bill contains invalid terms and conditions");
  }
  const logoDataUrl = typeof shop.logoDataUrl === "string" &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(shop.logoDataUrl) &&
    shop.logoDataUrl.length <= 3_000_000
    ? shop.logoDataUrl
    : "";

  return {
    invoiceNumber: input.invoiceNumber,
    date: input.date,
    customer: input.customer,
    payment: input.payment,
    paymentStatus: input.paymentStatus,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    amountPaid: input.amountPaid,
    taxRate: Number.isFinite(input.taxRate) ? input.taxRate : 0,
    showTax: input.showTax === true,
    showGst: input.showGst === true,
    parcelCharge: toCharge(input.parcelCharge),
    travelCharge: toCharge(input.travelCharge),
    deliveryCharge: toCharge(input.deliveryCharge),
    otherCharge: toCharge(input.otherCharge),
    otherChargeLabel: typeof input.otherChargeLabel === "string" && input.otherChargeLabel.trim() ? input.otherChargeLabel.trim() : "Other",
    items,
    shop: {
      shopName: typeof shop.shopName === "string" ? shop.shopName.slice(0, 120) : "",
      address: typeof shop.address === "string" ? shop.address.slice(0, 500) : "",
      mobileNumber: typeof shop.mobileNumber === "string" ? shop.mobileNumber.slice(0, 30) : "",
      email: typeof shop.email === "string" ? shop.email.slice(0, 254) : "",
      gstNumber: typeof shop.gstNumber === "string" ? shop.gstNumber.slice(0, 15) : "",
      ownerName: typeof shop.ownerName === "string" ? shop.ownerName.slice(0, 120) : "",
      logoDataUrl,
      receiptFooter: typeof shop.receiptFooter === "string"
        ? shop.receiptFooter.slice(0, 250)
        : "",
      termsAndConditions,
    },
  };
}

function buildBillHtml(bill) {
  const itemRows = bill.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}${item.variant ? `<small>${escapeHtml(item.variant)}</small>` : ""}</td>
      <td>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td>
      <td>${escapeHtml(formatCurrency(item.unitPrice))}</td>
      <td>${escapeHtml(formatCurrency(item.quantity * item.unitPrice))}</td>
    </tr>
  `).join("");
  const shop = bill.shop;
  const shopLines = [
    shop.address,
    shop.mobileNumber && `Phone: ${shop.mobileNumber}`,
    shop.email && `Email: ${shop.email}`,
    bill.showGst && shop.gstNumber && `GSTIN: ${shop.gstNumber}`,
  ].filter(Boolean).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const taxLine = bill.showTax
    ? `<div class="totals-row"><span>Tax (${escapeHtml(bill.taxRate)}%)</span><span>${escapeHtml(formatCurrency(bill.tax))}</span></div>`
    : "";
  const dueStatus = bill.paymentStatus === "paid"
    ? "Paid"
    : `Due ${formatCurrency(bill.total - bill.amountPaid)}`;
  const termsSection = shop.termsAndConditions.length
    ? `<section class="terms"><strong>Terms &amp; Conditions</strong><ol>${shop.termsAndConditions
      .map((term) => `<li>${escapeHtml(term)}</li>`)
      .join("")}</ol></section>`
    : "";

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(bill.invoiceNumber)}</title>
        <style>
          @page { margin: 14mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #202a35; font: 12px Arial, sans-serif; }
          header { padding-bottom: 16px; border-bottom: 2px solid #198754; text-align: center; }
          header img { max-width: 110px; max-height: 70px; object-fit: contain; margin-bottom: 7px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          header p { margin: 3px 0; color: #515c67; }
          .meta { display: flex; justify-content: space-between; gap: 20px; margin: 18px 0; }
          .meta div { display: flex; flex-direction: column; gap: 6px; }
          .muted { color: #68737e; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 9px 7px; border-bottom: 1px solid #dfe5e1; text-align: left; }
          th { background: #f1f7f3; }
          td:last-child, th:last-child { text-align: right; }
          td small { display: block; margin-top: 3px; color: #68737e; }
          .totals { width: min(320px, 100%); margin: 18px 0 0 auto; }
          .totals-row { display: flex; justify-content: space-between; gap: 15px; padding: 6px 0; }
          .grand-total { margin-top: 5px; padding-top: 10px; border-top: 1px solid #aab5ae; font-size: 15px; font-weight: bold; }
          footer { margin-top: 54px; display: flex; justify-content: space-between; align-items: end; gap: 30px; }
          .footer-message { color: #68737e; }
          .signature { width: 200px; padding-top: 34px; border-top: 1px solid #333; text-align: center; }
          .signature span { display: block; margin-top: 5px; font-weight: bold; }
          .signature small { display: block; margin-top: 3px; color: #68737e; }
          .terms { margin-top: 24px; padding-top: 10px; border-top: 1px dashed #aab5ae; font-size: 10px; break-inside: avoid; }
          .terms strong { display: block; margin-bottom: 6px; font-size: 11px; }
          .terms ol { margin: 0; padding-left: 18px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <header>
          ${shop.logoDataUrl ? `<img src="${shop.logoDataUrl}" alt="Shop logo">` : ""}
          <h1>${escapeHtml(shop.shopName || "Shop")}</h1>
          ${shopLines}
        </header>
        <section class="meta">
          <div><strong>Invoice</strong><span>${escapeHtml(bill.invoiceNumber)}</span><span class="muted">${escapeHtml(bill.date)}</span></div>
          <div><strong>Bill to</strong><span>${escapeHtml(bill.customer)}</span></div>
        </section>
        <table>
          <thead><tr><th>Item</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <section class="totals">
          <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(bill.subtotal))}</span></div>
          ${taxLine}
          ${bill.parcelCharge > 0 ? `<div class="totals-row"><span>Parcel charge</span><span>${escapeHtml(formatCurrency(bill.parcelCharge))}</span></div>` : ""}
          ${bill.travelCharge > 0 ? `<div class="totals-row"><span>Travel charge</span><span>${escapeHtml(formatCurrency(bill.travelCharge))}</span></div>` : ""}
          ${bill.deliveryCharge > 0 ? `<div class="totals-row"><span>Delivery charge</span><span>${escapeHtml(formatCurrency(bill.deliveryCharge))}</span></div>` : ""}
          ${bill.otherCharge > 0 ? `<div class="totals-row"><span>${escapeHtml(bill.otherChargeLabel)}</span><span>${escapeHtml(formatCurrency(bill.otherCharge))}</span></div>` : ""}
          <div class="totals-row grand-total"><span>Total</span><span>${escapeHtml(formatCurrency(bill.total))}</span></div>
          <div class="totals-row"><span>Payment</span><span>${escapeHtml(bill.payment)}</span></div>
          <div class="totals-row"><span>Status</span><span>${escapeHtml(dueStatus)}</span></div>
        </section>
        ${termsSection}
        <footer>
          <span class="footer-message">${escapeHtml(shop.receiptFooter || "Thank you for your purchase!")}</span>
          <div class="signature">
            ${shop.ownerName ? `<span>${escapeHtml(shop.ownerName)}</span>` : ""}
            <small>Authorized signature</small>
          </div>
        </footer>
      </body>
    </html>`;
}

function registerAppHandlers() {
  ipcMain.handle("app:print", (event) => new Promise((resolve) => {
    event.sender.print(
      { silent: false, printBackground: true },
      (success, failureReason) => resolve({ success, failureReason }),
    );
  }));

  ipcMain.handle("app:save-bill-pdf", async (event, input) => {
    const bill = normalizeBill(input);
    const safeName = bill.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    const result = await dialog.showSaveDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Save invoice PDF",
        defaultPath: path.join(app.getPath("documents"), `${safeName}.pdf`),
        filters: [{ name: "PDF document", extensions: ["pdf"] }],
      },
    );
    if (result.canceled || !result.filePath) return { canceled: true };

    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    try {
      await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildBillHtml(bill))}`);
      const pdf = await pdfWindow.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        margins: { top: 0.35, bottom: 0.35, left: 0.45, right: 0.45 },
        preferCSSPageSize: true,
      });
      await fs.writeFile(result.filePath, pdf, { flag: "w" });
      return { canceled: false, filePath: result.filePath };
    } finally {
      if (!pdfWindow.isDestroyed()) pdfWindow.destroy();
    }
  });

  ipcMain.handle("app:open-whatsapp", async (_event, target) => {
    let url;

    try {
      url = new URL(target);
    } catch {
      throw new Error("Invalid WhatsApp link");
    }

    if (
      url.protocol !== "https:" ||
      url.hostname !== "wa.me" ||
      !/^\/(?:\d{8,15})?\/?$/.test(url.pathname) ||
      !url.searchParams.has("text")
    ) {
      throw new Error("A customer phone number and message are required to open WhatsApp");
    }

    await shell.openExternal(url.toString());
  });

  ipcMain.handle("app:open-email", async (_event, message) => {
    if (
      !message ||
      typeof message.to !== "string" ||
      message.to.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to) ||
      typeof message.subject !== "string" ||
      typeof message.body !== "string"
    ) {
      throw new Error("Valid email details are required");
    }

    const emailUrl =
      `mailto:${encodeURIComponent(message.to)}` +
      `?subject=${encodeURIComponent(message.subject)}` +
      `&body=${encodeURIComponent(message.body)}`;

    await shell.openExternal(emailUrl);
  });
}

module.exports = { registerAppHandlers };
