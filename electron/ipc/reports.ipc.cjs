const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeReportFilters(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Report filters are required");
  }

  const { startDate = "", endDate = "", customerId = "" } = input;
  if (startDate && !isValidDate(startDate)) throw new Error("Choose a valid start date");
  if (endDate && !isValidDate(endDate)) throw new Error("Choose a valid end date");
  if (startDate && endDate && startDate > endDate) {
    throw new Error("Start date must be on or before the end date");
  }

  let normalizedCustomerId = "";
  if (customerId === "walk-in") {
    normalizedCustomerId = "walk-in";
  } else if (customerId !== "" && customerId != null) {
    normalizedCustomerId = Number(customerId);
    if (!Number.isInteger(normalizedCustomerId) || normalizedCustomerId <= 0) {
      throw new Error("Choose a valid customer");
    }
  }

  return { startDate, endDate, customerId: normalizedCustomerId };
}

function registerReportHandlers() {
  ipcMain.handle("reports:sales", (_event, input) => {
    const filters = normalizeReportFilters(input);
    const db = getDatabase();
    const conditions = [];
    const parameters = [];

    if (filters.startDate) {
      conditions.push("substr(s.created_at, 1, 10) >= ?");
      parameters.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push("substr(s.created_at, 1, 10) <= ?");
      parameters.push(filters.endDate);
    }
    if (filters.customerId === "walk-in") {
      conditions.push("s.customer_id IS NULL");
    } else if (filters.customerId) {
      conditions.push("s.customer_id = ?");
      parameters.push(filters.customerId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const sales = db.prepare(`
      SELECT s.id, s.invoice_number, s.customer_id,
             COALESCE(c.name, 'Walk-in customer') AS customer_name,
             s.total, s.amount_paid, s.payment_status, s.payment_method, s.created_at,
             (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS item_count
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ${where}
      ORDER BY s.created_at, s.id
    `).all(...parameters);

    const dailyRevenue = db.prepare(`
      SELECT substr(s.created_at, 1, 10) AS date,
             ROUND(SUM(s.total), 2) AS revenue,
             COUNT(*) AS invoice_count
      FROM sales s
      ${where}
      GROUP BY substr(s.created_at, 1, 10)
      ORDER BY date
    `).all(...parameters);

    const paymentMethods = db.prepare(`
      SELECT s.payment_method AS method,
             ROUND(SUM(s.total), 2) AS revenue,
             COUNT(*) AS invoice_count
      FROM sales s
      ${where}
      GROUP BY s.payment_method
      ORDER BY revenue DESC
    `).all(...parameters);

    const topProducts = db.prepare(`
      SELECT si.product_name AS name, si.variant,
             SUM(si.quantity) AS quantity,
             ROUND(SUM(si.subtotal), 2) AS revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      ${where}
      GROUP BY si.product_id, si.product_name, si.variant
      ORDER BY quantity DESC, revenue DESC
      LIMIT 10
    `).all(...parameters);

    const customers = db.prepare(`
      SELECT id, name
      FROM customers
      ORDER BY name COLLATE NOCASE, id
    `).all();
    const hasWalkInSales = Boolean(db.prepare(`
      SELECT 1 FROM sales WHERE customer_id IS NULL LIMIT 1
    `).get());

    const totalRevenue = sales.reduce((total, sale) => total + sale.total, 0);
    const totalCollected = sales.reduce((total, sale) => total + sale.amount_paid, 0);

    return {
      sales,
      customers,
      hasWalkInSales,
      dailyRevenue,
      paymentMethods,
      topProducts,
      summary: {
        invoiceCount: sales.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        outstanding: Math.round(Math.max(totalRevenue - totalCollected, 0) * 100) / 100,
        averageBill: sales.length
          ? Math.round((totalRevenue / sales.length) * 100) / 100
          : 0,
      },
    };
  });
}

module.exports = { registerReportHandlers, normalizeReportFilters };
