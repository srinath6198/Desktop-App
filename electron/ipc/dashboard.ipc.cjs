const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

function registerDashboardHandlers() {
  ipcMain.handle("dashboard:summary", (_event, period = "week") => {
    if (period !== "week" && period !== "month") {
      throw new Error("Choose a valid dashboard period");
    }

    const db = getDatabase();
    const salesTotals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE
          WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN total
          ELSE 0
        END), 0) AS today_sales,
        COALESCE(SUM(CASE
          WHEN date(created_at, 'localtime') = date('now', 'localtime', '-1 day') THEN total
          ELSE 0
        END), 0) AS yesterday_sales,
        COUNT(CASE
          WHEN date(created_at, 'localtime') = date('now', 'localtime') THEN 1
        END) AS today_bills
      FROM sales
    `).get();

    const productTotals = db.prepare(`
      SELECT
        COUNT(*) AS active_products,
        COUNT(CASE WHEN stock <= minimum_stock THEN 1 END) AS low_stock_count
      FROM products
      WHERE active = 1
    `).get();

    const customerTotals = db.prepare(`
      SELECT
        COUNT(*) AS customer_count,
        COUNT(CASE
          WHEN strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime') THEN 1
        END) AS new_customers_this_month
      FROM customers
    `).get();

    const lowStockProducts = db.prepare(`
      SELECT id, name, category, unit, stock, minimum_stock
      FROM products
      WHERE active = 1 AND stock <= minimum_stock
      ORDER BY stock ASC, name COLLATE NOCASE
      LIMIT 5
    `).all();

    const recentSales = db.prepare(`
      SELECT s.id, s.invoice_number, s.total, s.payment_status, s.created_at,
             COALESCE(c.name, 'Walk-in customer') AS customer_name
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 4
    `).all();

    const popularProducts = db.prepare(`
      SELECT si.product_id AS id, si.product_name AS name,
             COALESCE(p.category, '') AS category, COALESCE(p.unit, '') AS unit,
             SUM(si.quantity) AS quantity_sold
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE strftime('%Y-%m', s.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
      GROUP BY si.product_id, si.product_name, p.category, p.unit
      ORDER BY quantity_sold DESC, SUM(si.subtotal) DESC, si.product_name COLLATE NOCASE
      LIMIT 4
    `).all();

    let chartPoints;
    let chartTotals;
    if (period === "week") {
      const weekStart = db.prepare(`
        SELECT date(
          'now', 'localtime',
          '-' || ((CAST(strftime('%w', 'now', 'localtime') AS INTEGER) + 6) % 7) || ' days'
        ) AS week_start
      `).get().week_start;
      const currentRows = db.prepare(`
        SELECT date(created_at, 'localtime') AS sales_date, SUM(total) AS total
        FROM sales
        WHERE date(created_at, 'localtime') BETWEEN date(?) AND date(?, '+6 days')
        GROUP BY sales_date
      `).all(weekStart, weekStart);
      const previousTotal = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total
        FROM sales
        WHERE date(created_at, 'localtime') BETWEEN date(?, '-7 days') AND date(?, '-1 day')
      `).get(weekStart, weekStart).total;
      const currentByDate = new Map(currentRows.map((row) => [row.sales_date, row.total]));
      const startDate = new Date(`${weekStart}T00:00:00`);
      chartPoints = Array.from({ length: 7 }, (_value, index) => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + index);
        const dateKey = [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0"),
        ].join("-");
        return {
          label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date),
          value: currentByDate.get(dateKey) ?? 0,
        };
      });
      chartTotals = {
        current: chartPoints.reduce((sum, point) => sum + point.value, 0),
        previous: previousTotal,
      };
    } else {
      const monthStart = db.prepare(`
        SELECT date('now', 'localtime', 'start of month') AS month_start
      `).get().month_start;
      const currentRows = db.prepare(`
        SELECT CAST((CAST(strftime('%d', date(created_at, 'localtime')) AS INTEGER) - 1) / 7 AS INTEGER) AS week_index,
               SUM(total) AS total
        FROM sales
        WHERE date(created_at, 'localtime') >= date(?)
          AND date(created_at, 'localtime') < date(?, '+1 month')
        GROUP BY week_index
      `).all(monthStart, monthStart);
      const previousTotal = db.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total
        FROM sales
        WHERE date(created_at, 'localtime') >= date(?, '-1 month')
          AND date(created_at, 'localtime') < date(?)
      `).get(monthStart, monthStart).total;
      const currentByWeek = new Map(currentRows.map((row) => [row.week_index, row.total]));
      chartPoints = Array.from({ length: 5 }, (_value, index) => ({
        label: `${index * 7 + 1}-${index === 4 ? 31 : index * 7 + 7}`,
        value: currentByWeek.get(index) ?? 0,
      }));
      chartTotals = {
        current: chartPoints.reduce((sum, point) => sum + point.value, 0),
        previous: previousTotal,
      };
    }

    return {
      todaySales: salesTotals.today_sales,
      yesterdaySales: salesTotals.yesterday_sales,
      todayBills: salesTotals.today_bills,
      activeProducts: productTotals.active_products,
      lowStockCount: productTotals.low_stock_count,
      customerCount: customerTotals.customer_count,
      newCustomersThisMonth: customerTotals.new_customers_this_month,
      chart: { points: chartPoints, ...chartTotals },
      lowStockProducts,
      recentSales,
      popularProducts,
    };
  });
}

module.exports = { registerDashboardHandlers };
