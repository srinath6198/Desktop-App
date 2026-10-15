
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");

const {
  initializeDatabase,
  closeDatabase,
} = require("./database/connection.cjs");

const {
  registerProductHandlers,
} = require("./ipc/product.ipc.cjs");
const {
  registerSupplierHandlers,
} = require("./ipc/supplier.ipc.cjs");
const {
  registerPurchaseHandlers,
} = require("./ipc/purchase.ipc.cjs");
const {
  registerStockHandlers,
} = require("./ipc/stock.ipc.cjs");
const {
  registerCustomerHandlers,
} = require("./ipc/customer.ipc.cjs");
const {
  registerCustomerCreditHandlers,
} = require("./ipc/customer-credit.ipc.cjs");
const {
  registerSaleHandlers,
} = require("./ipc/sale.ipc.cjs");

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

function registerExternalLinkHandler() {
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
      url.pathname !== "/" ||
      !url.searchParams.has("text")
    ) {
      throw new Error("Only WhatsApp bill-sharing links can be opened");
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

    const emailUrl = `mailto:${encodeURIComponent(message.to)}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
    await shell.openExternal(emailUrl);
  });
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
  registerExternalLinkHandler();
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
