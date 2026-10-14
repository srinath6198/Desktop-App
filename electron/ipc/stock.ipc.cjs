const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

function registerStockHandlers() {
  ipcMain.handle("stock:add", (_event, input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Stock entry details are required");
    }
    if (!Number.isInteger(input.productId) || input.productId <= 0) {
      throw new Error("Choose a valid product");
    }
    const quantity = Number(input.quantity);
    const minimumStock = Number(input.minimumStock);
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Stock quantity must be greater than zero");
    }
    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      throw new Error("Minimum stock must be zero or greater");
    }
    if (notes.length > 250) {
      throw new Error("Stock entry notes must be 250 characters or fewer");
    }

    const db = getDatabase();
    const addStock = db.transaction(() => {
      const product = db.prepare("SELECT id, name FROM products WHERE id = ? AND active = 1")
        .get(input.productId);
      if (!product) throw new Error("Product not found or inactive");

      db.prepare(`
        UPDATE products
        SET stock = stock + ?, minimum_stock = ?
        WHERE id = ? AND active = 1
      `).run(quantity, minimumStock, input.productId);

      db.prepare(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, notes)
        VALUES (?, 'adjustment', ?, ?)
      `).run(
        input.productId,
        quantity,
        notes || `Manual stock entry for ${product.name}`,
      );

      return db.prepare("SELECT * FROM products WHERE id = ?").get(input.productId);
    });

    return addStock();
  });
}

module.exports = { registerStockHandlers };
