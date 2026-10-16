# Flower Billing App

## Development

Install dependencies and start the Vite development server inside an Electron
window:

```powershell
npm install
npm run electron:dev
```

Use the Electron window for product database access. Running `npm run dev` and
opening the site in a regular browser only displays the frontend; browsers do
not have access to the Electron SQLite bridge. The Electron development script
requires port 5173 to be free and fails instead of silently using a different
Vite port.

The Electron window uses context isolation, disables Node.js integration in the
renderer, and runs with the sandbox enabled.

Products are stored in the local SQLite database. Deactivating a product marks
it inactive without deleting its row, so historical records remain intact.
Use the product status filter to view inactive products and reactivate them.
When adding a product, add up to four variants under the same product name.
Each variant has its own unit of measure, product code, prices, and stock.

Supplier records are stored in the same database. Add, edit, deactivate, and
reactivate suppliers from the Suppliers screen; deactivation retains supplier
records and purchase history.

Customer records support contact details, address, email, Aadhaar number, GST
number, and a profile photo. Aadhaar numbers are encrypted at rest with the
operating system's Electron secure-storage integration; profile photos are kept
under the application's local data directory.

Shop settings, including the shop name, invoice short name, logo, contact details,
GST number, owner name, tax rate, invoice display preferences, receipt footer,
and terms and conditions are persisted in SQLite. Terms can be added, edited,
removed, and included as a numbered list on printed invoices and invoice PDFs.
New invoice numbers use the configured short name and a sequential number (for
example, `BLOOM-0001`). Printed invoices and invoice PDFs include configured
shop details and an authorized-signature line. PDF sharing saves an invoice PDF
and opens the customer's WhatsApp chat; attach the saved PDF in WhatsApp to send
it.

The Customer Credit screen stores credit charges and received payments in a
SQLite ledger, calculates outstanding balances, prevents payments above the
current balance, and prints customer-specific or all-customer statements.

New Bill loads active products (including saved product images) and customers
from SQLite. Completing checkout atomically saves the invoice and item
snapshots, deducts stock, records sale movements, and adds credit bills to the
customer credit ledger. Sales History reads persisted invoices and provides
search, date filters, payment summaries, and CSV export. Customer payments are
applied to the oldest unpaid sales invoices first. Tax currently follows the
existing bill calculation of 5%.

The dashboard reads sales totals, bill counts, product stock, customers, recent
invoices, and this month's best-selling flowers from SQLite through Electron IPC.

The Reports screen reads saved sales from SQLite and supports start/end date
filters, customer filtering (including walk-in sales), revenue and payment
summaries, top-selling products, invoice details, and CSV export of the filtered
invoices.

The Stock Entry screen lists all products, including inactive records, and
supports name/code search, category and stock-status filters, minimum-stock
levels, and paginated results. Adding stock records a stock movement and updates
the product quantity and minimum-stock level in one SQLite transaction.

The Inventory screen reads product quantities and stock movements from SQLite.
It shows active and low-stock product counts, monthly movement totals, filtered
and paginated stock levels, and recent purchases, purchase returns, and manual
adjustments. Manual adjustments can add or remove stock and cannot reduce a
product below zero. Sales are not yet connected to inventory movements.

Purchases, purchase line items, and supplier returns are stored in SQLite.
Recording a purchase adds received quantities to product stock and creates stock
movement entries. Purchase history can be filtered by a date range; returns can
be partial, are limited to purchased quantities and available stock, and reduce
inventory while retaining the original purchase and return history.

## Encrypted cloud backup

The Settings screen can upload and restore an encrypted snapshot of the local
SQLite database. Product and customer image files remain local. It is a manual backup for one device, not live synchronization.
The passphrase encrypts the snapshot on the device before upload; it is never
sent to the backend. Keep the passphrase safe because it cannot be recovered.
Restoring replaces the local database. Customer Aadhaar encryption uses
Electron's device secure storage, so an Aadhaar value restored on another
computer may not be decryptable there.

The backup API is a separate Node.js service in `backend/`. Deploy the included
`render.yaml` Blueprint from the project root, then set these secrets in the
Render service environment:

- `MONGODB_URI`: the **newly rotated** Atlas connection string. The password
  previously shared must be changed in Atlas before using this API.
- `BACKUP_API_TOKEN`: a random secret of at least 32 characters. Configure it
  only in Render and enter it in the app's Settings screen.

Give the Atlas database user access only to the `flower_billing` database and
restrict Atlas Network Access to the backend's outbound IP addresses. Do not
allow access from all IP addresses. Once Render deploys, copy its HTTPS service
URL into Settings and save the same `BACKUP_API_TOKEN`. The API token is stored
encrypted using Electron secure storage on this computer. Never put the Atlas
URI, Atlas password, or backend token in frontend code or a committed env file.

## Native SQLite dependency

`better-sqlite3` includes a Windows N-API prebuilt binary, which is compatible
with the Electron runtime used by this project. Electron Builder uses that
prebuild rather than compiling native dependencies during packaging. Sass is a
build-time dependency and is not included in the packaged app.

```powershell
npm run dist
```

This creates the Windows Setup installer under `release`. Do not run
`electron-builder install-app-deps` for this project; it attempts to rebuild
unneeded native dependencies such as Sass's file watcher.
# Desktop-App
