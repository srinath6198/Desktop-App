const { ipcMain } = require("electron");
const { getDatabase } = require("../database/connection.cjs");

function normalizeSupplier(supplier, { requireId = false } = {}) {
  if (!supplier || typeof supplier !== "object" || Array.isArray(supplier)) {
    throw new Error("Supplier details are required");
  }

  if (requireId && (!Number.isInteger(supplier.id) || supplier.id <= 0)) {
    throw new Error("Valid supplier ID is required");
  }
  if (typeof supplier.name !== "string" || !supplier.name.trim()) {
    throw new Error("Supplier name is required");
  }

  for (const field of ["phone", "email", "address", "state", "pincode"]) {
    if (supplier[field] != null && typeof supplier[field] !== "string") {
      throw new Error(`Supplier ${field} must be text`);
    }
  }

  const email = supplier.email?.trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid supplier email address");
  }

  return {
    id: supplier.id,
    name: supplier.name.trim(),
    phone: supplier.phone?.trim() || null,
    email,
    address: supplier.address?.trim() || null,
    state: supplier.state?.trim() || null,
    pincode: supplier.pincode?.trim() || null,
  };
}

function registerSupplierHandlers() {
  ipcMain.handle("suppliers:list", () => {
    return getDatabase()
      .prepare("SELECT * FROM suppliers ORDER BY name COLLATE NOCASE")
      .all();
  });

  ipcMain.handle("suppliers:create", (_event, input) => {
    const supplier = normalizeSupplier(input);
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO suppliers (name, phone, email, address, state, pincode, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(
      supplier.name,
      supplier.phone,
      supplier.email,
      supplier.address,
      supplier.state,
      supplier.pincode,
    );
    return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(result.lastInsertRowid);
  });

  ipcMain.handle("suppliers:update", (_event, input) => {
    const supplier = normalizeSupplier(input, { requireId: true });
    const db = getDatabase();
    const result = db.prepare(`
      UPDATE suppliers
      SET name = ?, phone = ?, email = ?, address = ?, state = ?, pincode = ?
      WHERE id = ?
    `).run(
      supplier.name,
      supplier.phone,
      supplier.email,
      supplier.address,
      supplier.state,
      supplier.pincode,
      supplier.id,
    );

    if (result.changes === 0) throw new Error("Supplier not found");
    return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(supplier.id);
  });

  ipcMain.handle("suppliers:set-active", (_event, id, active) => {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Valid supplier ID is required");
    }
    if (active !== true && active !== false) {
      throw new Error("Supplier active status must be true or false");
    }

    const db = getDatabase();
    const result = db.prepare("UPDATE suppliers SET active = ? WHERE id = ?")
      .run(active ? 1 : 0, id);
    if (result.changes === 0 && !db.prepare("SELECT id FROM suppliers WHERE id = ?").get(id)) {
      throw new Error("Supplier not found");
    }
    return db.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
  });
}

module.exports = { registerSupplierHandlers };
