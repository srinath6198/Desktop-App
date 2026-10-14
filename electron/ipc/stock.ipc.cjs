const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

function registerStockHandlers() {
  ipcMain.handle("stock:inventory-report", () => {
    const db = getDatabase();
    const products = db.prepare(`
      SELECT *
      FROM products
      ORDER BY active DESC, name COLLATE NOCASE, variant COLLATE NOCASE
    `).all();
    const movements = db.prepare(`
      SELECT
        stock_movements.id,
        stock_movements.product_id,
        products.name AS product_name,
        products.variant AS product_variant,
        products.unit,
        stock_movements.movement_type,
        stock_movements.quantity,
        stock_movements.notes,
        stock_movements.created_at
      FROM stock_movements
      JOIN products ON products.id = stock_movements.product_id
      ORDER BY stock_movements.id DESC
      LIMIT 10
    `).all();
    const movementCountThisMonth = db.prepare(`
      SELECT COUNT(*) AS count
      FROM stock_movements
      WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
    `).get().count;

    return { products, movements, movementCountThisMonth };
  });

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

  ipcMain.handle("stock:adjust", (_event, input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Stock adjustment details are required");
    }
    if (!Number.isInteger(input.productId) || input.productId <= 0) {
      throw new Error("Choose a valid product");
    }
    if (input.direction !== "add" && input.direction !== "remove") {
      throw new Error("Choose whether to add or remove stock");
    }
    const quantity = Number(input.quantity);
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Adjustment quantity must be greater than zero");
    }
    if (notes.length > 250) {
      throw new Error("Adjustment notes must be 250 characters or fewer");
    }

    const db = getDatabase();
    const adjustStock = db.transaction(() => {
      const product = db.prepare("SELECT id, name, stock FROM products WHERE id = ? AND active = 1")
        .get(input.productId);
      if (!product) throw new Error("Product not found or inactive");
      if (input.direction === "remove" && quantity > product.stock) {
        throw new Error(`Cannot remove more than the current stock of ${product.stock}`);
      }

      const movementQuantity = input.direction === "add" ? quantity : -quantity;
      db.prepare("UPDATE products SET stock = stock + ? WHERE id = ? AND active = 1")
        .run(movementQuantity, input.productId);
      db.prepare(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, notes)
        VALUES (?, 'adjustment', ?, ?)
      `).run(
        input.productId,
        movementQuantity,
        notes || `Manual stock ${input.direction === "add" ? "increase" : "decrease"}`,
      );

      return db.prepare("SELECT * FROM products WHERE id = ?").get(input.productId);
    });

    return adjustStock();
  });
}

module.exports = { registerStockHandlers };
