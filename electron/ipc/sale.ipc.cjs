const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");
const { getAppSettings } = require("../database/settings.cjs");

const PAYMENT_METHODS = new Set(["Cash", "UPI", "Card", "Credit / due"]);

function normalizeSale(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Bill details are required");
  }
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100) {
    throw new Error("Add between 1 and 100 products to the bill");
  }
  if (!PAYMENT_METHODS.has(input.paymentMethod)) {
    throw new Error("Choose a valid payment method");
  }
  if (input.customerId != null && (!Number.isInteger(input.customerId) || input.customerId <= 0)) {
    throw new Error("Choose a valid customer");
  }
  if (input.paymentMethod === "Credit / due" && input.customerId == null) {
    throw new Error("Select a customer before creating a credit bill");
  }

  const items = input.items.map((item) => {
    if (!item || !Number.isInteger(item.productId) || item.productId <= 0) {
      throw new Error("A bill contains an invalid product");
    }
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
      throw new Error("Product quantities must be greater than zero");
    }
    return { productId: item.productId, quantity };
  });
  if (new Set(items.map((item) => item.productId)).size !== items.length) {
    throw new Error("Each product can appear only once in a bill");
  }

  function toCharge(val) {
    const n = Number(val ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
  }

  return {
    customerId: input.customerId ?? null,
    paymentMethod: input.paymentMethod,
    items,
    parcelCharge: toCharge(input.parcelCharge),
    travelCharge: toCharge(input.travelCharge),
    deliveryCharge: toCharge(input.deliveryCharge),
    otherCharge: toCharge(input.otherCharge),
    otherChargeLabel: typeof input.otherChargeLabel === "string" && input.otherChargeLabel.trim() ? input.otherChargeLabel.trim().slice(0, 60) : "Other",
  };
}

function getSale(db, saleId) {
  const sale = db.prepare(`
    SELECT s.id, s.invoice_number, s.customer_id,
           COALESCE(c.name, 'Walk-in customer') AS customer_name, c.phone AS customer_phone,
           s.subtotal, s.tax, s.tax_rate, s.show_tax, s.total, s.payment_method,
           s.amount_paid, s.payment_status, s.created_at,
           s.parcel_charge, s.travel_charge, s.delivery_charge, s.other_charge, s.other_charge_label
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = ?
  `).get(saleId);
  if (!sale) throw new Error("Saved invoice could not be loaded");
  const items = db.prepare(`
    SELECT product_id, product_name, variant, unit, quantity, price, subtotal
    FROM sale_items
    WHERE sale_id = ?
    ORDER BY id
  `).all(saleId);
  return { ...sale, items, settings: getAppSettings(db) };
}

function registerSaleHandlers() {
  ipcMain.handle("sales:list", () => {
    const db = getDatabase();
    return db.prepare(`
      SELECT s.id, s.invoice_number, s.customer_id,
             COALESCE(c.name, 'Walk-in customer') AS customer_name,
             s.subtotal, s.tax, s.total, s.payment_method, s.amount_paid,
             s.payment_status, s.created_at,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.id DESC
    `).all();
  });

  ipcMain.handle("sales:get", (_event, saleId) => {
    if (!Number.isInteger(saleId) || saleId <= 0) {
      throw new Error("Choose a valid invoice");
    }
    return getSale(getDatabase(), saleId);
  });

  ipcMain.handle("sales:create", (_event, input) => {
    const sale = normalizeSale(input);
    const db = getDatabase();
    const create = db.transaction(() => {
      if (sale.customerId != null) {
        const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(sale.customerId);
        if (!customer) throw new Error("Customer not found");
      }

      const saleItems = sale.items.map((item) => {
        const product = db.prepare(`
          SELECT id, name, variant, unit, selling_price, stock
          FROM products
          WHERE id = ? AND active = 1
        `).get(item.productId);
        if (!product) throw new Error("A selected product is unavailable");
        if (item.quantity > product.stock) {
          throw new Error(`${product.name} has only ${product.stock} ${product.unit} available`);
        }
        const subtotal = Math.round(item.quantity * product.selling_price * 100) / 100;
        return { ...item, product, subtotal };
      });
      const settings = getAppSettings(db);
      const subtotal = Math.round(saleItems.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
      const tax = Math.round(subtotal * settings.taxRate / 100 * 100) / 100;
      const extraCharges = sale.parcelCharge + sale.travelCharge + sale.deliveryCharge + sale.otherCharge;
      const total = Math.round((subtotal + tax + extraCharges) * 100) / 100;
      const amountPaid = sale.paymentMethod === "Credit / due" ? 0 : total;
      const paymentStatus = amountPaid >= total ? "paid" : "due";
      let sequence = (db.prepare("SELECT COALESCE(MAX(seq), 0) AS value FROM sqlite_sequence WHERE name = 'sales'").get().value || 0) + 1;
      let invoiceNumber;
      do {
        invoiceNumber = `${settings.shortName}-${String(sequence).padStart(4, "0")}`;
        sequence += 1;
      } while (db.prepare("SELECT 1 FROM sales WHERE invoice_number = ?").get(invoiceNumber));
      const saleResult = db.prepare(`
        INSERT INTO sales
          (invoice_number, customer_id, subtotal, tax, tax_rate, show_tax, total, payment_method, amount_paid, payment_status,
           parcel_charge, travel_charge, delivery_charge, other_charge, other_charge_label)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceNumber,
        sale.customerId,
        subtotal,
        tax,
        settings.taxRate,
        settings.showTax ? 1 : 0,
        total,
        sale.paymentMethod,
        amountPaid,
        paymentStatus,
        sale.parcelCharge,
        sale.travelCharge,
        sale.deliveryCharge,
        sale.otherCharge,
        sale.otherChargeLabel,
      );
      const saleId = Number(saleResult.lastInsertRowid);
      const insertItem = db.prepare(`
        INSERT INTO sale_items
          (sale_id, product_id, product_name, variant, unit, quantity, price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const reduceStock = db.prepare(`
        UPDATE products SET stock = stock - ?
        WHERE id = ? AND active = 1 AND stock >= ?
      `);
      const insertMovement = db.prepare(`
        INSERT INTO stock_movements (product_id, movement_type, quantity, notes)
        VALUES (?, 'sale', ?, ?)
      `);

      for (const item of saleItems) {
        insertItem.run(
          saleId,
          item.product.id,
          item.product.name,
          item.product.variant,
          item.product.unit,
          item.quantity,
          item.product.selling_price,
          item.subtotal,
        );
        const update = reduceStock.run(item.quantity, item.product.id, item.quantity);
        if (update.changes !== 1) {
          throw new Error(`${item.product.name} stock changed before the bill could be completed`);
        }
        insertMovement.run(item.product.id, -item.quantity, invoiceNumber);
      }

      if (paymentStatus === "due") {
        db.prepare(`
          INSERT INTO customer_credit_entries (customer_id, entry_type, amount, reference, notes)
          VALUES (?, 'credit', ?, ?, ?)
        `).run(sale.customerId, total, invoiceNumber, "Credit bill");
      }

      return saleId;
    });

    return getSale(db, create());
  });
}

module.exports = { registerSaleHandlers };
