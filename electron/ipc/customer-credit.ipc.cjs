const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

function normalizeCreditEntry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Credit entry details are required");
  }
  if (!Number.isInteger(input.customerId) || input.customerId <= 0) {
    throw new Error("Choose a valid customer");
  }
  if (input.type !== "credit" && input.type !== "payment") {
    throw new Error("Choose credit or payment");
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    throw new Error("Enter an amount greater than zero");
  }
  for (const field of ["reference", "notes"]) {
    if (input[field] != null && typeof input[field] !== "string") {
      throw new Error(`${field} must be text`);
    }
    if (input[field]?.length > 250) {
      throw new Error(`${field} must be 250 characters or fewer`);
    }
  }
  return {
    customerId: input.customerId,
    type: input.type,
    amount: Math.round(amount * 100) / 100,
    reference: input.reference?.trim() || null,
    notes: input.notes?.trim() || null,
  };
}

function registerCustomerCreditHandlers() {
  ipcMain.handle("customer-credit:report", (_event, customerId) => {
    if (customerId != null && (!Number.isInteger(customerId) || customerId <= 0)) {
      throw new Error("Customer filter is invalid");
    }
    const db = getDatabase();
    const customers = db.prepare(`
      SELECT c.id, c.name, c.phone, c.email,
             COALESCE(SUM(CASE WHEN e.entry_type = 'credit' THEN e.amount ELSE -e.amount END), 0) AS balance
      FROM customers c
      LEFT JOIN customer_credit_entries e ON e.customer_id = c.id
      WHERE (? IS NULL OR c.id = ?)
      GROUP BY c.id
      ORDER BY c.name COLLATE NOCASE
    `).all(customerId ?? null, customerId ?? null);

    const entries = db.prepare(`
      SELECT e.id, e.customer_id, c.name AS customer_name, e.entry_type,
             e.amount, e.reference, e.notes, e.created_at
      FROM customer_credit_entries e
      JOIN customers c ON c.id = e.customer_id
      WHERE (? IS NULL OR c.id = ?)
      ORDER BY e.created_at DESC, e.id DESC
    `).all(customerId ?? null, customerId ?? null);
    return { customers, entries };
  });

  ipcMain.handle("customer-credit:create-entry", (_event, input) => {
    const entry = normalizeCreditEntry(input);
    const db = getDatabase();
    const create = db.transaction(() => {
      const customer = db.prepare("SELECT id, name FROM customers WHERE id = ?").get(entry.customerId);
      if (!customer) throw new Error("Customer not found");

      if (entry.type === "payment") {
        const balance = db.prepare(`
          SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) AS balance
          FROM customer_credit_entries
          WHERE customer_id = ?
        `).get(entry.customerId).balance;
        if (balance <= 0) throw new Error("This customer has no outstanding credit balance");
        if (entry.amount > balance) {
          throw new Error(`Payment cannot exceed the outstanding balance of ₹${balance.toFixed(2)}`);
        }
      }

      const result = db.prepare(`
        INSERT INTO customer_credit_entries
          (customer_id, entry_type, amount, reference, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(entry.customerId, entry.type, entry.amount, entry.reference, entry.notes);
      const entryId = Number(result.lastInsertRowid);

      if (entry.type === "payment") {
        const dueSales = db.prepare(`
          SELECT id, total, amount_paid
          FROM sales
          WHERE customer_id = ? AND payment_status = 'due'
          ORDER BY created_at, id
        `).all(entry.customerId);
        const insertSalePayment = db.prepare(`
          INSERT INTO sale_payments (sale_id, credit_entry_id, amount)
          VALUES (?, ?, ?)
        `);
        const applyPayment = db.prepare(`
          UPDATE sales
          SET amount_paid = amount_paid + ?,
              payment_status = CASE WHEN amount_paid + ? >= total THEN 'paid' ELSE 'due' END
          WHERE id = ?
        `);
        let remaining = Math.round(entry.amount * 100);
        for (const sale of dueSales) {
          if (remaining <= 0) break;
          const balance = Math.max(0, Math.round((sale.total - sale.amount_paid) * 100));
          const allocation = Math.min(remaining, balance);
          if (allocation <= 0) continue;
          const allocatedAmount = allocation / 100;
          insertSalePayment.run(sale.id, entryId, allocatedAmount);
          applyPayment.run(allocatedAmount, allocatedAmount, sale.id);
          remaining -= allocation;
        }
      }

      return entryId;
    });

    const id = create();
    const savedEntry = db.prepare(`
      SELECT e.id, e.customer_id, c.name AS customer_name, e.entry_type,
             e.amount, e.reference, e.notes, e.created_at
      FROM customer_credit_entries e
      JOIN customers c ON c.id = e.customer_id
      WHERE e.id = ?
    `).get(id);
    const balance = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) AS balance
      FROM customer_credit_entries WHERE customer_id = ?
    `).get(entry.customerId).balance;
    return { entry: savedEntry, balance };
  });
}

module.exports = { registerCustomerCreditHandlers };
