const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

const VALID_TYPES = ["info", "success", "warning", "error"];

function registerNotificationHandlers() {
  ipcMain.handle("notifications:list", () => {
    const db = getDatabase();
    return db.prepare(
      "SELECT id, type, title, message, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT 100"
    ).all();
  });

  ipcMain.handle("notifications:unread-count", () => {
    const db = getDatabase();
    return db.prepare("SELECT COUNT(*) as count FROM notifications WHERE is_read = 0").get().count;
  });

  ipcMain.handle("notifications:create", (_event, input) => {
    if (!input || typeof input.title !== "string" || !input.title.trim()) {
      throw new Error("Notification title is required");
    }
    const type = VALID_TYPES.includes(input.type) ? input.type : "info";
    const db = getDatabase();
    const result = db.prepare(
      "INSERT INTO notifications (type, title, message) VALUES (?, ?, ?)"
    ).run(type, input.title.trim().slice(0, 200), String(input.message ?? "").trim().slice(0, 500));
    return db.prepare("SELECT * FROM notifications WHERE id = ?").get(result.lastInsertRowid);
  });

  ipcMain.handle("notifications:mark-read", (_event, id) => {
    const db = getDatabase();
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(id);
    return { success: true };
  });

  ipcMain.handle("notifications:mark-all-read", () => {
    const db = getDatabase();
    db.prepare("UPDATE notifications SET is_read = 1 WHERE is_read = 0").run();
    return { success: true };
  });

  ipcMain.handle("notifications:delete", (_event, id) => {
    const db = getDatabase();
    db.prepare("DELETE FROM notifications WHERE id = ?").run(id);
    return { success: true };
  });

  ipcMain.handle("notifications:clear-all", () => {
    const db = getDatabase();
    db.prepare("DELETE FROM notifications").run();
    return { success: true };
  });
}

module.exports = { registerNotificationHandlers };
