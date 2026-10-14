const { ipcMain } = require("electron");
const { randomUUID } = require("node:crypto");
const { getDatabase } = require("../database/connection.cjs");

function normalizeDate(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be a valid date`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid date`);
  }
  return value;
}

function getPurchase(db, purchaseId) {
  const purchase = db.prepare(`
    SELECT p.id, p.supplier_id, s.name AS supplier_name, s.email AS supplier_email,
           p.total, p.created_at
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ?
  `).get(purchaseId);
  if (!purchase) return undefined;

  const items = db.prepare(`
    SELECT pi.id, pi.product_id, pi.product_name, pi.variant, pi.unit,
           pi.quantity, pi.purchase_rate, pi.tax_rate, pi.selling_price,
           pi.subtotal, pi.tax_amount, pi.total,
           COALESCE(SUM(pri.quantity), 0) AS returned_quantity
    FROM purchase_items pi
    LEFT JOIN purchase_return_items pri ON pri.purchase_item_id = pi.id
    WHERE pi.purchase_id = ?
    GROUP BY pi.id
    ORDER BY pi.id
  `).all(purchaseId);

  return { ...purchase, items };
}

function validatePurchase(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Purchase details are required");
  }
  if (!Number.isInteger(input.supplierId) || input.supplierId <= 0) {
    throw new Error("Choose a valid supplier");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("Add at least one purchase item");
  }

  return input.items.map((item) => {
    if (!item || typeof item !== "object" || !Number.isInteger(item.productId) || item.productId <= 0) {
      throw new Error("Choose a valid product for each purchase item");
    }
    const quantity = Number(item.quantity);
    const purchaseRate = Number(item.purchaseRate);
    const taxRate = Number(item.taxRate);
    const sellingPrice = Number(item.sellingPrice);
    if (
      !Number.isFinite(quantity) || quantity <= 0 ||
      !Number.isFinite(purchaseRate) || purchaseRate < 0 ||
      !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 ||
      !Number.isFinite(sellingPrice) || sellingPrice < 0
    ) {
      throw new Error("Enter valid purchase quantities, rates, and tax");
    }
    return { productId: item.productId, quantity, purchaseRate, taxRate, sellingPrice };
  });
}

function registerPurchaseHandlers() {
  ipcMain.handle("purchases:list", (_event, filters = {}) => {
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
      throw new Error("Purchase date filters are invalid");
    }
    const from = normalizeDate(filters.from, "Start date");
    const to = normalizeDate(filters.to, "End date");
    if (from && to && from > to) {
      throw new Error("Start date must be before or equal to end date");
    }

    const db = getDatabase();
    let rows;
    if (from && to) {
      rows = db.prepare(`
        SELECT id FROM purchases
        WHERE date(created_at, 'localtime') BETWEEN ? AND ?
        ORDER BY created_at DESC, id DESC
      `).all(from, to);
    } else if (from) {
      rows = db.prepare(`
        SELECT id FROM purchases WHERE date(created_at, 'localtime') >= ?
        ORDER BY created_at DESC, id DESC
      `).all(from);
    } else if (to) {
      rows = db.prepare(`
        SELECT id FROM purchases WHERE date(created_at, 'localtime') <= ?
        ORDER BY created_at DESC, id DESC
      `).all(to);
    } else {
      rows = db.prepare("SELECT id FROM purchases ORDER BY created_at DESC, id DESC").all();
    }
    return rows.map(({ id }) => getPurchase(db, id));
  });

  ipcMain.handle("purchases:create", (_event, input) => {
    const items = validatePurchase(input);
    const db = getDatabase();
    const supplier = db.prepare("SELECT id FROM suppliers WHERE id = ? AND active = 1").get(input.supplierId);
    if (!supplier) throw new Error("Supplier not found or inactive");

    const insertPurchase = db.prepare("INSERT INTO purchases (supplier_id, total) VALUES (?, ?)");
    const insertItem = db.prepare(`
      INSERT INTO purchase_items
        (purchase_id, product_id, product_name, variant, unit, quantity,
         purchase_rate, tax_rate, selling_price, subtotal, tax_amount, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const receiveStock = db.prepare(`
      UPDATE products
      SET stock = stock + ?, purchase_price = ?, selling_price = ?
      WHERE id = ? AND active = 1
    `);
    const movement = db.prepare(`
      INSERT INTO stock_movements (product_id, movement_type, quantity, notes)
      VALUES (?, 'purchase', ?, ?)
    `);

    const create = db.transaction(() => {
      const normalizedItems = items.map((item) => {
        const product = db.prepare("SELECT * FROM products WHERE id = ? AND active = 1").get(item.productId);
        if (!product) throw new Error(`Product ${item.productId} was not found or is inactive`);
        const subtotal = item.quantity * item.purchaseRate;
        const taxAmount = subtotal * item.taxRate / 100;
        return { ...item, product, subtotal, taxAmount, total: subtotal + taxAmount };
      });
      const total = normalizedItems.reduce((sum, item) => sum + item.total, 0);
      const result = insertPurchase.run(input.supplierId, total);
      const purchaseId = Number(result.lastInsertRowid);

      for (const item of normalizedItems) {
        insertItem.run(
          purchaseId,
          item.product.id,
          item.product.name,
          item.product.variant || "",
          item.product.unit,
          item.quantity,
          item.purchaseRate,
          item.taxRate,
          item.sellingPrice,
          item.subtotal,
          item.taxAmount,
          item.total,
        );
        const update = receiveStock.run(item.quantity, item.purchaseRate, item.sellingPrice, item.product.id);
        if (update.changes !== 1) throw new Error(`Unable to update stock for ${item.product.name}`);
        movement.run(item.product.id, item.quantity, `Purchase #${purchaseId}`);
      }
      return purchaseId;
    });

    return getPurchase(db, create());
  });

  ipcMain.handle("purchases:return", (_event, input) => {
    if (!input || typeof input !== "object" || !Number.isInteger(input.purchaseId) || input.purchaseId <= 0) {
      throw new Error("Choose a valid purchase to return");
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("Choose at least one item to return");
    }

    const requestedItems = input.items.map((item) => {
      const purchaseItemId = Number(item?.purchaseItemId);
      const quantity = Number(item?.quantity);
      if (!Number.isInteger(purchaseItemId) || purchaseItemId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Enter a return quantity greater than zero for a selected item");
      }
      return { purchaseItemId, quantity };
    });
    if (new Set(requestedItems.map((item) => item.purchaseItemId)).size !== requestedItems.length) {
      throw new Error("A purchase item can only appear once in a return");
    }

    const db = getDatabase();
    const createReturn = db.transaction(() => {
      const purchase = db.prepare("SELECT id, supplier_id FROM purchases WHERE id = ?").get(input.purchaseId);
      if (!purchase) throw new Error("Purchase not found");

      const resolvedItems = requestedItems.map((requested) => {
        const item = db.prepare(`
          SELECT pi.*, p.stock,
                 COALESCE((SELECT SUM(pri.quantity) FROM purchase_return_items pri
                           WHERE pri.purchase_item_id = pi.id), 0) AS returned_quantity
          FROM purchase_items pi
          JOIN products p ON p.id = pi.product_id
          WHERE pi.id = ? AND pi.purchase_id = ?
        `).get(requested.purchaseItemId, input.purchaseId);
        if (!item) throw new Error("A selected item does not belong to this purchase");
        const available = item.quantity - item.returned_quantity;
        if (requested.quantity > available) {
          throw new Error(`${item.product_name} has only ${available} ${item.unit} available to return`);
        }
        if (requested.quantity > item.stock) {
          throw new Error(`${item.product_name} has only ${item.stock} ${item.unit} in stock; it cannot be returned`);
        }
        return { ...item, returnQuantity: requested.quantity };
      });

      const returnTotal = resolvedItems.reduce((sum, item) => {
        const subtotal = item.returnQuantity * item.purchase_rate;
        return sum + subtotal + subtotal * item.tax_rate / 100;
      }, 0);
      const returnNumber = `PR-${randomUUID()}`;
      const returnResult = db.prepare(`
        INSERT INTO purchase_returns (return_number, purchase_id, supplier_id, total)
        VALUES (?, ?, ?, ?)
      `).run(returnNumber, input.purchaseId, purchase.supplier_id, returnTotal);
      const returnId = Number(returnResult.lastInsertRowid);

      const insertReturnItem = db.prepare(`
        INSERT INTO purchase_return_items
          (purchase_return_id, purchase_item_id, product_id, quantity, unit_price, tax_rate, total)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const reduceStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?");
      const movement = db.prepare(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, notes)
        VALUES (?, 'purchase_return', ?, ?)
      `);

      for (const item of resolvedItems) {
        const subtotal = item.returnQuantity * item.purchase_rate;
        const total = subtotal + subtotal * item.tax_rate / 100;
        insertReturnItem.run(
          returnId,
          item.id,
          item.product_id,
          item.returnQuantity,
          item.purchase_rate,
          item.tax_rate,
          total,
        );
        const update = reduceStock.run(item.returnQuantity, item.product_id, item.returnQuantity);
        if (update.changes !== 1) throw new Error(`${item.product_name} stock changed before the return completed`);
        movement.run(item.product_id, -item.returnQuantity, `Purchase return ${returnNumber}`);
      }

      return { id: returnId, returnNumber, total: returnTotal };
    });

    const result = createReturn();
    return { ...result, purchase: getPurchase(db, input.purchaseId) };
  });
}

module.exports = { registerPurchaseHandlers };
