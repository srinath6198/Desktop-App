
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  getPlatform: () => process.platform,
  openExternal: (url) => ipcRenderer.invoke("app:open-whatsapp", url),

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
});
