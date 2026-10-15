function getSettingsApi() {
  const api = window.desktopAPI?.settings
  if (!api) {
    throw new Error("Shop settings are available only in the Electron desktop app. Run `npm run electron:dev`.")
  }
  return api
}

export const settingsService = {
  get() {
    return getSettingsApi().get()
  },

  save(settings) {
    return getSettingsApi().save(settings)
  },

  selectLogo() {
    return getSettingsApi().selectLogo()
  },
}
