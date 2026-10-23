
const fs = require("fs");
const path = require("path");

function runMigrations(db) {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");

  db.transaction(() => {
    db.exec(schema);

    const productColumns = db.prepare("PRAGMA table_info(products)").all();
    if (!productColumns.some((column) => column.name === "active")) {
      db.exec(`
        ALTER TABLE products
        ADD COLUMN active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1))
      `);
    }

    const migratedProductColumns = db.prepare("PRAGMA table_info(products)").all();
    if (!migratedProductColumns.some((column) => column.name === "image_path")) {
      db.exec("ALTER TABLE products ADD COLUMN image_path TEXT");
    }

    const latestProductColumns = db.prepare("PRAGMA table_info(products)").all();
    if (!latestProductColumns.some((column) => column.name === "minimum_stock")) {
      db.exec(`
        ALTER TABLE products
        ADD COLUMN minimum_stock REAL NOT NULL DEFAULT 0
        CHECK (minimum_stock >= 0)
      `);
    }

    const supplierColumns = new Set(
      db.prepare("PRAGMA table_info(suppliers)").all().map((column) => column.name),
    );
    const supplierMigrations = [
      ["email", "TEXT"],
      ["state", "TEXT"],
      ["pincode", "TEXT"],
      ["active", "INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))"],
    ];
    for (const [column, definition] of supplierMigrations) {
      if (!supplierColumns.has(column)) {
        db.exec(`ALTER TABLE suppliers ADD COLUMN ${column} ${definition}`);
      }
    }

    const customerColumns = new Set(
      db.prepare("PRAGMA table_info(customers)").all().map((column) => column.name),
    );
    const customerMigrations = [
      ["email", "TEXT"],
      ["aadhaar_number", "TEXT"],
      ["gst_number", "TEXT"],
      ["profile_image_path", "TEXT"],
    ];
    for (const [column, definition] of customerMigrations) {
      if (!customerColumns.has(column)) {
        db.exec(`ALTER TABLE customers ADD COLUMN ${column} ${definition}`);
      }
    }

    const saleColumns = new Set(
      db.prepare("PRAGMA table_info(sales)").all().map((column) => column.name),
    );
    const saleMigrations = [
      ["subtotal", "REAL NOT NULL DEFAULT 0"],
      ["tax", "REAL NOT NULL DEFAULT 0"],
      ["tax_rate", "REAL NOT NULL DEFAULT 5"],
      ["show_tax", "INTEGER NOT NULL DEFAULT 1 CHECK (show_tax IN (0, 1))"],
      ["amount_paid", "REAL NOT NULL DEFAULT 0"],
      ["payment_status", "TEXT NOT NULL DEFAULT 'paid'"],
      ["parcel_charge", "REAL NOT NULL DEFAULT 0"],
      ["travel_charge", "REAL NOT NULL DEFAULT 0"],
      ["delivery_charge", "REAL NOT NULL DEFAULT 0"],
      ["other_charge", "REAL NOT NULL DEFAULT 0"],
      ["other_charge_label", "TEXT NOT NULL DEFAULT 'Other'"],
      ["discount", "REAL NOT NULL DEFAULT 0"],
    ];
    for (const [column, definition] of saleMigrations) {
      if (!saleColumns.has(column)) {
        db.exec(`ALTER TABLE sales ADD COLUMN ${column} ${definition}`);
      }
    }
    if (!saleColumns.has("amount_paid")) {
      db.exec("UPDATE sales SET amount_paid = total, subtotal = total, tax = 0");
    }

    const saleItemColumns = new Set(
      db.prepare("PRAGMA table_info(sale_items)").all().map((column) => column.name),
    );
    const saleItemMigrations = [
      ["product_name", "TEXT NOT NULL DEFAULT ''"],
      ["variant", "TEXT NOT NULL DEFAULT ''"],
      ["unit", "TEXT NOT NULL DEFAULT ''"],
      ["original_price", "REAL"],
    ];
    for (const [column, definition] of saleItemMigrations) {
      if (!saleItemColumns.has(column)) {
        db.exec(`ALTER TABLE sale_items ADD COLUMN ${column} ${definition}`);
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS price_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        variant TEXT NOT NULL DEFAULT '',
        old_price REAL NOT NULL,
        new_price REAL NOT NULL,
        reason TEXT,
        changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);
  })();
}

module.exports = { runMigrations };
