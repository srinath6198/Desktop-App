const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getDatabase } = require("../database/connection.cjs");

const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ENCRYPTED_AADHAAR_PREFIX = "enc:";

function getProfileDirectory() {
  return path.join(app.getPath("userData"), "customer-profiles");
}

function storeProfileImage(dataUrl) {
  if (typeof dataUrl !== "string") throw new Error("Choose a customer profile image");
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) throw new Error("Profile image must be a JPG, PNG, or WebP file");

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Profile image must be smaller than 5 MB");
  }

  const fileName = `${crypto.randomUUID()}.${IMAGE_TYPES.get(match[1])}`;
  const directory = getProfileDirectory();
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, fileName), buffer, { flag: "wx" });
  return fileName;
}

function removeProfileImage(fileName) {
  if (!fileName || path.basename(fileName) !== fileName) return;
  fs.rmSync(path.join(getProfileDirectory(), fileName), { force: true });
}

function addProfileDataUrl(customer) {
  if (!customer.profile_image_path) return { ...customer, profile_image_data_url: null };
  const fileName = path.basename(customer.profile_image_path);
  if (fileName !== customer.profile_image_path) {
    throw new Error(`Invalid profile image path stored for customer ${customer.id}`);
  }
  const imagePath = path.join(getProfileDirectory(), fileName);
  try {
    const extension = path.extname(fileName).slice(1);
    const mimeType = [...IMAGE_TYPES.entries()].find(([, ext]) => ext === extension)?.[0];
    if (!mimeType) throw new Error(`Unsupported profile image type: ${extension}`);
    const image = fs.readFileSync(imagePath);
    return {
      ...customer,
      profile_image_data_url: `data:${mimeType};base64,${image.toString("base64")}`,
    };
  } catch (error) {
    console.error(`Unable to read profile image for customer ${customer.id}:`, error);
    return { ...customer, profile_image_data_url: null };
  }
}

function normalizeCustomer(input, { requireId = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Customer details are required");
  }
  if (requireId && (!Number.isInteger(input.id) || input.id <= 0)) {
    throw new Error("Valid customer ID is required");
  }
  if (typeof input.name !== "string" || !input.name.trim()) {
    throw new Error("Customer name is required");
  }
  for (const field of ["phone", "address", "email", "aadhaarNumber", "gstNumber"]) {
    if (input[field] != null && typeof input[field] !== "string") {
      throw new Error(`Customer ${field} must be text`);
    }
  }

  const email = input.email?.normalize("NFC").trim() || null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email))) {
    throw new Error("Enter a valid customer email address");
  }

  const aadhaarNumber = input.aadhaarNumber?.replace(/[\s-]/g, "") || null;
  if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
    throw new Error("Aadhaar number must contain exactly 12 digits");
  }

  const gstNumber = input.gstNumber?.trim().toUpperCase() || null;
  if (gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstNumber)) {
    throw new Error("Enter a valid 15-character GST number");
  }

  if (input.profileImageDataUrl != null && typeof input.profileImageDataUrl !== "string") {
    throw new Error("Customer profile image must be image data");
  }
  if (input.removeProfileImage != null && typeof input.removeProfileImage !== "boolean") {
    throw new Error("Profile image removal flag must be true or false");
  }

  return {
    id: input.id,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    email,
    aadhaarNumber,
    gstNumber,
  };
}

function getCustomer(db, id) {
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  if (!customer) return undefined;
  let aadhaarNumber = customer.aadhaar_number;
  if (aadhaarNumber?.startsWith(ENCRYPTED_AADHAAR_PREFIX)) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Aadhaar decryption is unavailable on this device");
    }
    aadhaarNumber = safeStorage.decryptString(
      Buffer.from(aadhaarNumber.slice(ENCRYPTED_AADHAAR_PREFIX.length), "base64"),
    );
  }
  return addProfileDataUrl({ ...customer, aadhaar_number: aadhaarNumber });
}

function encryptAadhaar(aadhaarNumber) {
  if (!aadhaarNumber) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure Aadhaar storage is unavailable on this device");
  }
  const encrypted = safeStorage.encryptString(aadhaarNumber).toString("base64");
  return `${ENCRYPTED_AADHAAR_PREFIX}${encrypted}`;
}

function registerCustomerHandlers() {
  ipcMain.handle("customers:select-profile-image", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Choose customer profile image",
        properties: ["openFile"],
        filters: [{ name: "Profile images", extensions: ["jpg", "jpeg", "png", "webp"] }],
      },
    );
    if (result.canceled || !result.filePaths[0]) return null;

    const selectedPath = result.filePaths[0];
    const extension = path.extname(selectedPath).toLowerCase();
    const mimeType = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    }[extension];
    if (!mimeType) throw new Error("Choose a JPG, PNG, or WebP profile image");
    if (fs.statSync(selectedPath).size > MAX_IMAGE_BYTES) {
      throw new Error("Profile image must be smaller than 5 MB");
    }
    return `data:${mimeType};base64,${fs.readFileSync(selectedPath).toString("base64")}`;
  });

  ipcMain.handle("customers:list", () => {
    const db = getDatabase();
    return db.prepare("SELECT * FROM customers ORDER BY name COLLATE NOCASE")
      .all()
      .map(addProfileDataUrl);
  });

  ipcMain.handle("customers:create", (_event, input) => {
    const customer = normalizeCustomer(input);
    const db = getDatabase();
    const encryptedAadhaar = encryptAadhaar(customer.aadhaarNumber);
    const imageFileName = input.profileImageDataUrl
      ? storeProfileImage(input.profileImageDataUrl)
      : null;
    try {
      const result = db.prepare(`
        INSERT INTO customers
          (name, phone, address, email, aadhaar_number, gst_number, profile_image_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        customer.name,
        customer.phone,
        customer.address,
        customer.email,
        encryptedAadhaar,
        customer.gstNumber,
        imageFileName,
      );
      return getCustomer(db, Number(result.lastInsertRowid));
    } catch (error) {
      if (imageFileName) removeProfileImage(imageFileName);
      throw error;
    }
  });

  ipcMain.handle("customers:update", (_event, input) => {
    const customer = normalizeCustomer(input, { requireId: true });
    const db = getDatabase();
    const current = db.prepare("SELECT * FROM customers WHERE id = ?").get(customer.id);
    if (!current) throw new Error("Customer not found");

    const encryptedAadhaar = encryptAadhaar(customer.aadhaarNumber);
    const imageFileName = input.profileImageDataUrl
      ? storeProfileImage(input.profileImageDataUrl)
      : null;
    const imagePath = input.removeProfileImage ? null : imageFileName ?? current.profile_image_path;
    try {
      const result = db.prepare(`
        UPDATE customers
        SET name = ?, phone = ?, address = ?, email = ?, aadhaar_number = ?,
            gst_number = ?, profile_image_path = ?
        WHERE id = ?
      `).run(
        customer.name,
        customer.phone,
        customer.address,
        customer.email,
        encryptedAadhaar,
        customer.gstNumber,
        imagePath,
        customer.id,
      );
      if (result.changes !== 1) throw new Error("Customer not found");

      const saved = getCustomer(db, customer.id);
      if ((input.removeProfileImage || imageFileName) && current.profile_image_path) {
        try {
          removeProfileImage(current.profile_image_path);
        } catch (error) {
          console.error(`Unable to remove replaced profile image for customer ${customer.id}:`, error);
        }
      }
      return saved;
    } catch (error) {
      if (imageFileName) removeProfileImage(imageFileName);
      throw error;
    }
  });
}

module.exports = { registerCustomerHandlers };
