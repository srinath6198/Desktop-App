# Flower Billing App

## Development

Install dependencies and start the Vite development server inside an Electron
window:

```powershell
npm install
npm run electron:dev
```

The Electron window uses context isolation, disables Node.js integration in the
renderer, and runs with the sandbox enabled.

## Native SQLite dependency

`better-sqlite3` is a native Node.js module. If no compatible prebuilt binary is
available for the installed Electron version, rebuilding it on Windows requires
the Visual Studio C++ Build Tools and a Windows SDK:

```powershell
npx electron-rebuild -f -w better-sqlite3
```
# Desktop-App
