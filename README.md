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

## Native SQLite dependency

`better-sqlite3` is a native Node.js module. If no compatible prebuilt binary is
available for the installed Electron version, rebuilding it on Windows requires
the Visual Studio C++ Build Tools and a Windows SDK:

```powershell
npx electron-rebuild -f -w better-sqlite3
```
# Desktop-App
