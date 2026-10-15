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

Supplier records are stored in the same database. Add, edit, deactivate, and
reactivate suppliers from the Suppliers screen; deactivation retains supplier
records and purchase history.

Customer records support contact details, address, email, Aadhaar number, GST
number, and a profile photo. Aadhaar numbers are encrypted at rest with the
operating system's Electron secure-storage integration; profile photos are kept
under the application's local data directory.

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

## Native SQLite dependency

`better-sqlite3` is a native Node.js module. If no compatible prebuilt binary is
available for the installed Electron version, rebuilding it on Windows requires
the Visual Studio C++ Build Tools and a Windows SDK:

```powershell
npx electron-rebuild -f -w better-sqlite3
```
# Desktop-App
