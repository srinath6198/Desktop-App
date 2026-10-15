const { BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { getDatabase } = require("../database/connection.cjs");
const { getAppSettings, saveAppSettings } = require("../database/settings.cjs");

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function normalizeSettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Shop settings are required");
  }

  const textFields = [
    ["shopName", 120, true],
    ["shortName", 12, true],
    ["address", 500, false],
    ["mobileNumber", 30, false],
    ["email", 254, false],
    ["gstNumber", 15, false],
    ["ownerName", 120, false],
    ["logoDataUrl", MAX_LOGO_BYTES * 2, false],
    ["receiptFooter", 250, false],
    ["termsAndConditions", 10_249, false],
  ];
  const settings = {};
  for (const [field, maxLength, required] of textFields) {
    const value = input[field] ?? "";
    if (typeof value !== "string") throw new Error(`${field} must be text`);
    const normalized = value.normalize("NFC").trim();
    if (required && !normalized) throw new Error(`${field} is required`);
    if (normalized.length > maxLength) throw new Error(`${field} is too long`);
    settings[field] = normalized;
  }
  const terms = settings.termsAndConditions
    ? settings.termsAndConditions.split(/\r?\n/).map((term) => term.trim()).filter(Boolean)
    : [];
  if (terms.length > 50 || terms.some((term) => term.length > 200)) {
    throw new Error("Terms & Conditions can contain up to 50 terms, each no longer than 200 characters");
  }
  settings.termsAndConditions = terms.join("\n");

  settings.shortName = settings.shortName.toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(settings.shortName)) {
    throw new Error("Short name must contain 2 to 12 letters or numbers");
  }
  if (settings.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
    throw new Error("Enter a valid shop email address");
  }
  settings.gstNumber = settings.gstNumber.toUpperCase();
  if (settings.gstNumber && !GST_PATTERN.test(settings.gstNumber)) {
    throw new Error("Enter a valid 15-character GST number");
  }

  const taxRate = Number(input.taxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    throw new Error("Tax rate must be between 0 and 100");
  }
  if (typeof input.showTax !== "boolean" || typeof input.showGst !== "boolean") {
    throw new Error("Choose whether tax and GST details should appear on invoices");
  }
  settings.taxRate = taxRate;
  settings.showTax = input.showTax;
  settings.showGst = input.showGst;

  if (settings.logoDataUrl) {
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/.exec(settings.logoDataUrl);
    if (!match || Buffer.from(match[2], "base64").length > MAX_LOGO_BYTES) {
      throw new Error("Shop logo must be a PNG, JPG, or WebP image smaller than 2 MB");
    }
  }

  return settings;
}

function registerSettingsHandlers() {
  ipcMain.handle("settings:get", () => getAppSettings(getDatabase()));

  ipcMain.handle("settings:save", (_event, input) => {
    const settings = normalizeSettings(input);
    return saveAppSettings(getDatabase(), settings);
  });

  ipcMain.handle("settings:select-logo", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Choose shop logo",
        properties: ["openFile"],
        filters: [{ name: "Shop logo", extensions: ["png", "jpg", "jpeg", "webp"] }],
      },
    );
    if (result.canceled || !result.filePaths.length) return null;

    const image = fs.readFileSync(result.filePaths[0]);
    if (!image.length || image.length > MAX_LOGO_BYTES) {
      throw new Error("Shop logo must be smaller than 2 MB");
    }
    const extension = path.extname(result.filePaths[0]).toLowerCase();
    const mimeType = extension === ".png"
      ? "image/png"
      : extension === ".webp" ? "image/webp" : "image/jpeg";
    return `data:${mimeType};base64,${image.toString("base64")}`;
  });
}

module.exports = { registerSettingsHandlers };
