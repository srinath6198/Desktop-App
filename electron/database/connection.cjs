
const { app } = require("electron");
const Database = require("better-sqlite3");
const path = require("path");
const { runMigrations } = require("./migrations.cjs");

let db;

function initializeDatabase() {
  if (db) return db;

  const databasePath = path.join(
    app.getPath("userData"),
    "flower-billing.db"
  );

  db = new Database(databasePath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  console.log("SQLite database connected:", databasePath);

  return db;
}

function getDatabase() {
  if (!db) {
    throw new Error("Database has not been initialized");
  }

  return db;
}

function closeDatabase() {
  if (db) {
    db.close();
    db = undefined;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};
