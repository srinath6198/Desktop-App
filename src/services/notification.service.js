function getApi() {
  const api = window.desktopAPI?.notifications;
  if (!api) throw new Error("Notifications are only available in the desktop app.");
  return api;
}

export const notificationService = {
  list: () => getApi().list(),
  unreadCount: () => getApi().unreadCount(),
  create: (n) => getApi().create(n),
  markRead: (id) => getApi().markRead(id),
  markAllRead: () => getApi().markAllRead(),
  delete: (id) => getApi().delete(id),
  clearAll: () => getApi().clearAll(),
};
