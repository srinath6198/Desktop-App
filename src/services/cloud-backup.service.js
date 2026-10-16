function getBackupApi() {
  const api = window.desktopAPI?.cloudBackup
  if (!api) {
    throw new Error("Cloud backup is available only in the Electron desktop app.")
  }
  return api
}

export const cloudBackupService = {
  getConfig() {
    return getBackupApi().getConfig()
  },

  saveConfig(config) {
    return getBackupApi().saveConfig(config)
  },

  clearConfig() {
    return getBackupApi().clearConfig()
  },

  testConnection() {
    return getBackupApi().testConnection()
  },

  create(passphrase) {
    return getBackupApi().create(passphrase)
  },

  restore(passphrase) {
    return getBackupApi().restore(passphrase)
  },
}
