
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  getPlatform: () => process.platform,
  openExternal: (url) => ipcRenderer.invoke("app:open-whatsapp", url),
  openEmail: (to, subject, body) => ipcRenderer.invoke("app:open-email", { to, subject, body }),

  products: {
    list: () => ipcRenderer.invoke("products:list"),
    selectImage: () => ipcRenderer.invoke("products:select-image"),
    create: (product) =>
      ipcRenderer.invoke("products:create", product),
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
    create: (sale) => ipcRenderer.invoke("sales:create", sale),
  },
});
