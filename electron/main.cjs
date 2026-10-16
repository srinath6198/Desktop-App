
const { app, BrowserWindow } = require("electron");
const path = require("path");

const {
  initializeDatabase,
  closeDatabase,
} = require("./database/connection.cjs");

const { registerProductHandlers } = require("./ipc/product.ipc.cjs");
const { registerSupplierHandlers } = require("./ipc/supplier.ipc.cjs");
const { registerPurchaseHandlers } = require("./ipc/purchase.ipc.cjs");
const { registerStockHandlers } = require("./ipc/stock.ipc.cjs");
const { registerCustomerHandlers } = require("./ipc/customer.ipc.cjs");
const {
  registerCustomerCreditHandlers,
} = require("./ipc/customer-credit.ipc.cjs");
const { registerSaleHandlers } = require("./ipc/sale.ipc.cjs");
const { registerDashboardHandlers } = require("./ipc/dashboard.ipc.cjs");
const { registerSettingsHandlers } = require("./ipc/settings.ipc.cjs");
const { registerAppHandlers } = require("./ipc/app.ipc.cjs");
const { registerBackupHandlers } = require("./ipc/backup.ipc.cjs");
const { registerReportHandlers } = require("./ipc/reports.ipc.cjs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    win.loadURL("http://127.0.0.1:5173");
  }
}

app.whenReady().then(() => {
  initializeDatabase();

  registerProductHandlers();
  registerSupplierHandlers();
  registerPurchaseHandlers();
  registerStockHandlers();
  registerCustomerHandlers();
  registerCustomerCreditHandlers();
  registerSaleHandlers();
  registerDashboardHandlers();
  registerSettingsHandlers();
  registerBackupHandlers();
  registerReportHandlers();
  registerAppHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  closeDatabase();
});
