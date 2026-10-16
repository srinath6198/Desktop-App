function getReportsApi() {
  const api = window.desktopAPI?.reports
  if (!api) {
    throw new Error("Reports are available only in the Electron desktop app.")
  }
  return api
}

export const reportsService = {
  sales(filters) {
    return getReportsApi().sales(filters)
  },
}
