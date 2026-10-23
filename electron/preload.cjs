
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  getPlatform: () => process.platform,
  print: () => ipcRenderer.invoke("app:print"),
  saveBillPdf: (bill) => ipcRenderer.invoke("app:save-bill-pdf", bill),
  openExternal: (url) => ipcRenderer.invoke("app:open-whatsapp", url),
  openEmail: (to, subject, body) => ipcRenderer.invoke("app:open-email", { to, subject, body }),

  products: {
    list: () => ipcRenderer.invoke("products:list"),
    selectImage: () => ipcRenderer.invoke("products:select-image"),
    create: (product) =>
      ipcRenderer.invoke("products:create", product),
    createMany: (products) =>
      ipcRenderer.invoke("products:create-many", products),
    update: (product) =>
      ipcRenderer.invoke("products:update", product),
    setActive: (id, active) =>
      ipcRenderer.invoke("products:set-active", id, active),
  },

  suppliers: {
    list: () => ipcRenderer.invoke("suppliers:list"),
    create: (supplier) => ipcRenderer.invoke("suppliers:create", supplier),
    update: (supplier) => ipcRenderer.invoke("suppliers:update", supplier),
    setActive: (id, active) => ipcRenderer.invoke("suppliers:set-active", id, active),
  },

  purchases: {
    list: (filters) => ipcRenderer.invoke("purchases:list", filters),
    create: (purchase) => ipcRenderer.invoke("purchases:create", purchase),
    createReturn: (purchaseReturn) => ipcRenderer.invoke("purchases:return", purchaseReturn),
  },

  stock: {
    inventoryReport: () => ipcRenderer.invoke("stock:inventory-report"),
    add: (entry) => ipcRenderer.invoke("stock:add", entry),
    adjust: (adjustment) => ipcRenderer.invoke("stock:adjust", adjustment),
  },

  customers: {
    list: () => ipcRenderer.invoke("customers:list"),
    selectProfileImage: () => ipcRenderer.invoke("customers:select-profile-image"),
    create: (customer) => ipcRenderer.invoke("customers:create", customer),
    update: (customer) => ipcRenderer.invoke("customers:update", customer),
  },

  customerCredit: {
    report: (customerId) => ipcRenderer.invoke("customer-credit:report", customerId),
    createEntry: (entry) => ipcRenderer.invoke("customer-credit:create-entry", entry),
  },

  sales: {
    list: () => ipcRenderer.invoke("sales:list"),
    get: (saleId) => ipcRenderer.invoke("sales:get", saleId),
    create: (sale) => ipcRenderer.invoke("sales:create", sale),
  },

  dashboard: {
    summary: (period) => ipcRenderer.invoke("dashboard:summary", period),
  },

  reports: {
    sales: (filters) => ipcRenderer.invoke("reports:sales", filters),
  },

  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    save: (settings) => ipcRenderer.invoke("settings:save", settings),
    selectLogo: () => ipcRenderer.invoke("settings:select-logo"),
  },

  notifications: {
    list: () => ipcRenderer.invoke("notifications:list"),
    unreadCount: () => ipcRenderer.invoke("notifications:unread-count"),
    create: (n) => ipcRenderer.invoke("notifications:create", n),
    markRead: (id) => ipcRenderer.invoke("notifications:mark-read", id),
    markAllRead: () => ipcRenderer.invoke("notifications:mark-all-read"),
    delete: (id) => ipcRenderer.invoke("notifications:delete", id),
    clearAll: () => ipcRenderer.invoke("notifications:clear-all"),
    lowStock: () => ipcRenderer.invoke("notifications:low-stock"),
    pendingCredit: () => ipcRenderer.invoke("notifications:pending-credit"),
  },

  cloudBackup: {
    getConfig: () => ipcRenderer.invoke("backup:config:get"),
    saveConfig: (config) => ipcRenderer.invoke("backup:config:save", config),
    clearConfig: () => ipcRenderer.invoke("backup:config:clear"),
    testConnection: () => ipcRenderer.invoke("backup:connection:test"),
    create: (passphrase) => ipcRenderer.invoke("backup:create", passphrase),
    restore: (passphrase) => ipcRenderer.invoke("backup:restore", passphrase),
  },
});
