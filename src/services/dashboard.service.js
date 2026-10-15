function getDashboardApi() {
  const api = window.desktopAPI?.dashboard
  if (!api) {
    throw new Error("The dashboard is available only in the Electron desktop app. Run `npm run electron:dev`.")
  }
  return api
}

export const dashboardService = {
  getSummary(period) {
    return getDashboardApi().summary(period)
  },
}
