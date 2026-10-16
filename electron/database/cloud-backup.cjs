const { app, safeStorage } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const { getDatabase, getDatabasePath, replaceDatabase } = require("./connection.cjs");

const scrypt = promisify(crypto.scrypt);
const FORMAT = Buffer.from("FLWRBK01");
const HEADER_SIZE = FORMAT.length + 16 + 12 + 16;
const MAX_BACKUP_BYTES = 256 * 1024 * 1024;
const CONFIG_PATH = path.join(app.getPath("userData"), "cloud-backup-config.json");

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { apiUrl: "", token: "" };
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is unavailable on this device.");
  }

  const encrypted = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  return JSON.parse(safeStorage.decryptString(Buffer.from(encrypted.data, "base64")));
}

function writeConfig(config) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is unavailable on this device.");
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(config));
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ data: encrypted.toString("base64") }),
    { mode: 0o600 },
  );
}

function normalizeApiUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Enter the backup API URL.");
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid backup API URL.");
  }
  const localHost = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost)) {
    throw new Error("The backup API must use HTTPS.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The backup API URL must not include credentials or query parameters.");
  }
  return url.toString().replace(/\/+$/, "");
}

function getConfigSummary() {
  const config = readConfig();
  return { apiUrl: config.apiUrl, isConfigured: Boolean(config.apiUrl && config.token) };
}

function saveConfig(input) {
  const existing = readConfig();
  if (!input || typeof input !== "object") throw new Error("Backup connection details are required.");
  const apiUrl = normalizeApiUrl(input.apiUrl);
  const token = typeof input.token === "string" && input.token.trim()
    ? input.token.trim()
    : existing.token;
  if (!token) throw new Error("Enter the backup access token.");
  if (token.length < 32 || token.length > 512) {
    throw new Error("The backup access token must be between 32 and 512 characters.");
  }
  writeConfig({ apiUrl, token });
  return getConfigSummary();
}

function clearConfig() {
  if (fs.existsSync(CONFIG_PATH)) fs.rmSync(CONFIG_PATH);
  return { apiUrl: "", isConfigured: false };
}

function validatePassphrase(passphrase) {
  if (typeof passphrase !== "string" || passphrase.length < 12 || passphrase.length > 1024) {
    throw new Error("Use a backup passphrase between 12 and 1024 characters.");
  }
}

async function deriveKey(passphrase, salt) {
  return scrypt(passphrase, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
}

async function encryptBackup(data, passphrase) {
  validatePassphrase(passphrase);
  if (data.length > MAX_BACKUP_BYTES) throw new Error("The local database is too large to back up.");

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = await deriveKey(passphrase, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(FORMAT);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([FORMAT, salt, iv, cipher.getAuthTag(), ciphertext]);
}

async function decryptBackup(data, passphrase) {
  validatePassphrase(passphrase);
  if (data.length < HEADER_SIZE || data.length > MAX_BACKUP_BYTES + HEADER_SIZE) {
    throw new Error("The cloud backup has an invalid size.");
  }
  if (!data.subarray(0, FORMAT.length).equals(FORMAT)) {
    throw new Error("The cloud backup format is not recognized.");
  }

  const saltStart = FORMAT.length;
  const ivStart = saltStart + 16;
  const tagStart = ivStart + 12;
  const ciphertextStart = tagStart + 16;
  const salt = data.subarray(saltStart, ivStart);
  const iv = data.subarray(ivStart, tagStart);
  const tag = data.subarray(tagStart, ciphertextStart);
  const ciphertext = data.subarray(ciphertextStart);

  try {
    const key = await deriveKey(passphrase, salt);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(FORMAT);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Could not decrypt the backup. Check the passphrase or use an intact backup.");
  }
}

async function requestBackupApi(pathname, options = {}, timeoutMs = 120_000) {
  const config = readConfig();
  if (!config.apiUrl || !config.token) throw new Error("Configure the cloud backup connection first.");

  const response = await fetch(`${config.apiUrl}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...options.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Backup service returned HTTP ${response.status}.`);
  }
  return response;
}

async function testConnection() {
  const response = await requestBackupApi("/v1/status", {}, 8_000);
  return response.json();
}

async function readBackupResponse(response) {
  const maxBytes = MAX_BACKUP_BYTES + HEADER_SIZE;
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("The cloud backup exceeds the supported size limit.");
  }
  if (!response.body) throw new Error("The backup service returned an empty response.");

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("The cloud backup exceeds the supported size limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalBytes);
}

async function createCloudBackup(passphrase) {
  validatePassphrase(passphrase);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "flower-billing-backup-"));
  const snapshotPath = path.join(directory, "flower-billing.db");

  try {
    await getDatabase().backup(snapshotPath);
    const snapshot = fs.readFileSync(snapshotPath);
    const encrypted = await encryptBackup(snapshot, passphrase);
    const response = await requestBackupApi("/v1/backup", {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: encrypted,
    });
    return response.json();
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function validateDatabaseFile(filePath) {
  const Database = require("better-sqlite3");
  const candidate = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const result = candidate.pragma("integrity_check", { simple: true });
    if (result !== "ok") throw new Error("The downloaded backup failed SQLite integrity validation.");
    const requiredTables = new Set(
      candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
    );
    for (const table of ["products", "sales", "app_settings"]) {
      if (!requiredTables.has(table)) throw new Error("The downloaded file is not a Flower Billing database.");
    }
  } finally {
    candidate.close();
  }
}

async function restoreCloudBackup(passphrase) {
  validatePassphrase(passphrase);
  const response = await requestBackupApi("/v1/backup");
  const encrypted = await readBackupResponse(response);
  const database = await decryptBackup(encrypted, passphrase);
  const directory = fs.mkdtempSync(path.join(path.dirname(getDatabasePath()), ".restore-"));
  const snapshotPath = path.join(directory, "flower-billing.db");

  try {
    fs.writeFileSync(snapshotPath, database, { flag: "wx" });
    validateDatabaseFile(snapshotPath);
    replaceDatabase(snapshotPath);
    return { restored: true };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

module.exports = {
  getConfigSummary,
  saveConfig,
  clearConfig,
  testConnection,
  createCloudBackup,
  restoreCloudBackup,
};
