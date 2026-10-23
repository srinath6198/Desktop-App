const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

const VALID_TYPES = ["info", "success", "warning", "error"];

function registerNotificationHandlers() {
  // Remove any existing handlers to prevent duplicate registration on hot reload
  [
    "notifications:list", "notifications:unread-count", "notifications:create",
    "notifications:mark-read", "notifications:mark-all-read", "notifications:delete",
    "notifications:clear-all", "notifications:low-stock", "notifications:pending-credit",
  ].forEach((ch) => ipcMain.removeHandler(ch));

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

  ipcMain.handle("notifications:low-stock", () => {
    const db = getDatabase();
    return db.prepare(
      `SELECT id, name, variant, stock, minimum_stock, unit
       FROM products
       WHERE active = 1 AND minimum_stock > 0 AND stock <= minimum_stock
       ORDER BY (minimum_stock - stock) DESC`
    ).all();
  });

  ipcMain.handle("notifications:pending-credit", () => {
    const db = getDatabase();
    return db.prepare(
      `SELECT c.id, c.name, c.phone,
              ROUND(SUM(CASE WHEN e.entry_type = 'credit' THEN e.amount ELSE -e.amount END), 2) AS pending_amount,
              MIN(e.created_at) AS oldest_credit_at
       FROM customers c
       JOIN customer_credit_entries e ON e.customer_id = c.id
       WHERE e.entry_type = 'credit'
       GROUP BY c.id
       HAVING pending_amount > 0
         AND CAST((julianday('now') - julianday(MIN(e.created_at))) AS INTEGER) > 10
       ORDER BY pending_amount DESC`
    ).all();
  });
}

module.exports = { registerNotificationHandlers };
