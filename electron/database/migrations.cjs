
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
  })();
}

module.exports = { runMigrations };
