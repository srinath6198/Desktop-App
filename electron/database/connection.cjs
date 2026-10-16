
const { app } = require("electron");
const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("path");
const { runMigrations } = require("./migrations.cjs");

let db;

function initializeDatabase() {
  if (db) return db;

  const databasePath = getDatabasePath();
  const recoveryPath = `${databasePath}.before-restore`;
  if (!fs.existsSync(databasePath) && fs.existsSync(recoveryPath)) {
    fs.renameSync(recoveryPath, databasePath);
  }

  db = new Database(databasePath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  console.log("SQLite database connected:", databasePath);

  return db;
}

function getDatabasePath() {
  return path.join(app.getPath("userData"), "flower-billing.db");
}

function getDatabase() {
  if (!db) {
    throw new Error("Database has not been initialized");
  }

  return db;
}

function replaceDatabase(snapshotPath) {
  const databasePath = getDatabasePath();
  const previousPath = `${databasePath}.before-restore`;
  let originalMoved = false;

  if (db) {
    db.pragma("wal_checkpoint(TRUNCATE)");
    closeDatabase();
  }

  try {
    for (const suffix of ["-wal", "-shm"]) {
      const sidecarPath = `${databasePath}${suffix}`;
      if (fs.existsSync(sidecarPath)) fs.rmSync(sidecarPath);
    }
    if (fs.existsSync(previousPath)) fs.rmSync(previousPath);

    fs.renameSync(databasePath, previousPath);
    originalMoved = true;
    fs.renameSync(snapshotPath, databasePath);
    initializeDatabase();
    fs.rmSync(previousPath);
  } catch (error) {
    if (db) closeDatabase();
    if (originalMoved) {
      if (fs.existsSync(databasePath)) fs.rmSync(databasePath);
      if (fs.existsSync(previousPath)) fs.renameSync(previousPath, databasePath);
      initializeDatabase();
    } else {
      initializeDatabase();
    }
    throw error;
  }
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
  getDatabasePath,
  replaceDatabase,
  closeDatabase,
};
