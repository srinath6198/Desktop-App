const { ipcMain } = require("electron");
const {
  getConfigSummary,
  saveConfig,
  clearConfig,
  testConnection,
  createCloudBackup,
  restoreCloudBackup,
} = require("../database/cloud-backup.cjs");

function registerBackupHandlers() {
  ipcMain.handle("backup:config:get", () => getConfigSummary());
  ipcMain.handle("backup:config:save", (_event, input) => saveConfig(input));
  ipcMain.handle("backup:config:clear", () => clearConfig());
  ipcMain.handle("backup:connection:test", () => testConnection());
  ipcMain.handle("backup:create", (_event, passphrase) => createCloudBackup(passphrase));
  ipcMain.handle("backup:restore", (_event, passphrase) => restoreCloudBackup(passphrase));
}

module.exports = { registerBackupHandlers };
