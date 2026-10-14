
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
  })();
}

module.exports = { runMigrations };
