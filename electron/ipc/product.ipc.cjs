const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { getDatabase } = require("../database/connection.cjs");

const ALLOWED_UNITS = new Set(["kg", "gram", "piece", "bundle", "box", "length"]);
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getProductImageDirectory() {
  return path.join(app.getPath("userData"), "product-images");
}

function storeProductImage(dataUrl) {
  if (typeof dataUrl !== "string") {
    throw new Error("Choose a product image file");
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
  if (!match) {
    throw new Error("Product image must be a JPG, PNG, or WebP file");
  }

  const extension = IMAGE_TYPES.get(match[1]);
  const imageBuffer = Buffer.from(match[2], "base64");
  if (!imageBuffer.length || imageBuffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Product image must be smaller than 5 MB");
  }

  const fileName = `${crypto.randomUUID()}.${extension}`;
  const imageDirectory = getProductImageDirectory();
  fs.mkdirSync(imageDirectory, { recursive: true });
  fs.writeFileSync(path.join(imageDirectory, fileName), imageBuffer, { flag: "wx" });
  return fileName;
}

function removeStoredImage(fileName) {
  if (!fileName || path.basename(fileName) !== fileName) return;
  fs.rmSync(path.join(getProductImageDirectory(), fileName), { force: true });
}

function addImageDataUrl(product) {
  if (!product.image_path) {
    return { ...product, image_data_url: null };
  }

  const fileName = path.basename(product.image_path);
  if (fileName !== product.image_path) {
    throw new Error(`Invalid image path stored for product ${product.id}`);
  }

  const imagePath = path.join(getProductImageDirectory(), fileName);
  try {
    const extension = path.extname(fileName).slice(1);
    const mimeType = [...IMAGE_TYPES.entries()].find(([, ext]) => ext === extension)?.[0];
    if (!mimeType) throw new Error(`Unsupported product image type: ${extension}`);
    const image = fs.readFileSync(imagePath);
    return {
      ...product,
      image_data_url: `data:${mimeType};base64,${image.toString("base64")}`,
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      try { getDatabase().prepare("UPDATE products SET image_path = NULL WHERE id = ?").run(product.id); } catch (_) {}
    }
    return { ...product, image_path: null, image_data_url: null };
  }
}

function getProduct(db, id) {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  return product ? addImageDataUrl(product) : undefined;
}

function normalizeProduct(product, { requireId = false } = {}) {
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    throw new Error("Product details are required");
  }

  if (requireId && (!Number.isInteger(product.id) || product.id <= 0)) {
    throw new Error("Valid product ID is required");
  }

  if (typeof product.name !== "string" || !product.name.trim()) {
    throw new Error("Product name is required");
  }

  if (!ALLOWED_UNITS.has(product.unit)) {
    throw new Error("Choose a valid product unit");
  }

  const noOfUnits = Number(product.no_of_units ?? 1);
  const mrp = Number(product.mrp ?? 0);
  const purchasePrice = Number(product.purchase_price);
  const sellingPrice = Number(product.selling_price);
  const stock = Number(product.stock ?? 0);
  const minimumStock = Number(product.minimum_stock ?? 0);

  if (
    !Number.isFinite(noOfUnits) ||
    !Number.isFinite(mrp) ||
    !Number.isFinite(purchasePrice) ||
    !Number.isFinite(sellingPrice) ||
    !Number.isFinite(stock) ||
    !Number.isFinite(minimumStock) ||
    noOfUnits <= 0 ||
    mrp < 0 ||
    purchasePrice < 0 ||
    sellingPrice < 0 ||
    stock < 0 ||
    minimumStock < 0
  ) {
    throw new Error("Enter valid non-negative prices, stock, and minimum stock; units per product must be greater than zero");
  }

  if (
    product.product_code != null &&
    typeof product.product_code !== "string"
  ) {
    throw new Error("Product code must be text");
  }
  if (product.variant != null && typeof product.variant !== "string") {
    throw new Error("Product variant must be text");
  }
  if (product.category != null && typeof product.category !== "string") {
    throw new Error("Product category must be text");
  }
  if (product.image_data_url != null && typeof product.image_data_url !== "string") {
    throw new Error("Product image data must be text");
  }
  if (product.remove_image != null && typeof product.remove_image !== "boolean") {
    throw new Error("Product image removal flag must be true or false");
  }

  return {
    id: product.id,
    productCode: product.product_code?.trim() || null,
    name: product.name.trim(),
    variant: product.variant?.trim() || "",
    category: product.category?.trim() || null,
    unit: product.unit,
    noOfUnits,
    mrp,
    purchasePrice,
    sellingPrice,
    stock,
    minimumStock,
  };
}

function registerProductHandlers() {
  ipcMain.handle("products:select-image", async (event) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender),
      {
        title: "Choose product image",
        properties: ["openFile"],
        filters: [{ name: "Product images", extensions: ["jpg", "jpeg", "png", "webp"] }],
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
    if (!mimeType) throw new Error("Choose a JPG, PNG, or WebP image");

    const stats = fs.statSync(selectedPath);
    if (stats.size > MAX_IMAGE_BYTES) throw new Error("Product image must be smaller than 5 MB");
    return `data:${mimeType};base64,${fs.readFileSync(selectedPath).toString("base64")}`;
  });

  ipcMain.handle("products:list", () => {
    const products = getDatabase()
      .prepare("SELECT * FROM products ORDER BY name COLLATE NOCASE, variant COLLATE NOCASE")
      .all();
    return products.map(addImageDataUrl);
  });

  ipcMain.handle("products:create", (_event, input) => {
    const product = normalizeProduct(input);
    const db = getDatabase();
    const imageFileName = input.image_data_url
      ? storeProductImage(input.image_data_url)
      : null;
    try {
      const result = db
        .prepare(`
        INSERT INTO products
          (product_code, name, variant, category, unit, no_of_units,
           mrp, purchase_price, selling_price, stock, active, image_path, minimum_stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `)
        .run(
          product.productCode,
          product.name,
          product.variant,
          product.category,
          product.unit,
          product.noOfUnits,
          product.mrp,
          product.purchasePrice,
          product.sellingPrice,
          product.stock,
          imageFileName,
          product.minimumStock,
        );

      return getProduct(db, result.lastInsertRowid);
    } catch (error) {
      if (imageFileName) removeStoredImage(imageFileName);
      throw error;
    }
  });

  ipcMain.handle("products:create-many", (_event, input) => {
    if (!Array.isArray(input) || input.length < 2 || input.length > 4) {
      throw new Error("Add between 2 and 4 variants");
    }
    const products = input.map((product) => normalizeProduct(product));
    const name = products[0].name.toLocaleLowerCase();
    if (products.some((product) => product.name.toLocaleLowerCase() !== name)) {
      throw new Error("All variants must have the same product name");
    }
    const variants = products.map((product) => product.variant.toLocaleLowerCase());
    if (variants.some((variant) => !variant) || new Set(variants).size !== variants.length) {
      throw new Error("Enter a different variant name for each product");
    }

    const db = getDatabase();
    const imageFileNames = [];
    try {
      const imagePaths = input.map((product) => {
        const imageFileName = product.image_data_url
          ? storeProductImage(product.image_data_url)
          : null;
        if (imageFileName) imageFileNames.push(imageFileName);
        return imageFileName;
      });
      const createAll = db.transaction(() => products.map((product, index) => {
        const result = db.prepare(`
          INSERT INTO products
            (product_code, name, variant, category, unit, no_of_units,
             mrp, purchase_price, selling_price, stock, active, image_path, minimum_stock)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `).run(
          product.productCode,
          product.name,
          product.variant,
          product.category,
          product.unit,
          product.noOfUnits,
          product.mrp,
          product.purchasePrice,
          product.sellingPrice,
          product.stock,
          imagePaths[index],
          product.minimumStock,
        );
        return Number(result.lastInsertRowid);
      }));
      return createAll().map((id) => getProduct(db, id));
    } catch (error) {
      for (const imageFileName of imageFileNames) removeStoredImage(imageFileName);
      throw error;
    }
  });

  ipcMain.handle("products:update", (_event, input) => {
    const product = normalizeProduct(input, { requireId: true });
    const db = getDatabase();
    const currentProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(product.id);
    if (!currentProduct) throw new Error("Product not found");

    const imageFileName = input.image_data_url
      ? storeProductImage(input.image_data_url)
      : null;
    const imagePath = input.remove_image ? null : imageFileName ?? currentProduct.image_path;

    try {
      const result = db
        .prepare(`
        UPDATE products
        SET product_code = ?,
            name = ?,
            variant = ?,
            category = ?,
            unit = ?,
            no_of_units = ?,
            mrp = ?,
            purchase_price = ?,
            selling_price = ?,
            stock = ?,
            minimum_stock = ?,
            image_path = ?
        WHERE id = ?
      `)
        .run(
          product.productCode,
          product.name,
          product.variant,
          product.category,
          product.unit,
          product.noOfUnits,
          product.mrp,
          product.purchasePrice,
          product.sellingPrice,
          product.stock,
          product.minimumStock,
          imagePath,
          product.id,
        );

      if (result.changes === 0) {
        throw new Error("Product not found");
      }

      const savedProduct = getProduct(db, product.id);

      if ((input.remove_image || imageFileName) && currentProduct.image_path) {
        try {
          removeStoredImage(currentProduct.image_path);
        } catch (error) {
          console.error(`Unable to remove replaced image for product ${product.id}:`, error);
        }
      }

      return savedProduct;
    } catch (error) {
      if (imageFileName) removeStoredImage(imageFileName);
      throw error;
    }
  });

  ipcMain.handle("products:set-active", (_event, id, active) => {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Valid product ID is required");
    }
    if (active !== true && active !== false) {
      throw new Error("Product active status must be true or false");
    }

    const db = getDatabase();
    const result = db
      .prepare("UPDATE products SET active = ? WHERE id = ?")
      .run(active ? 1 : 0, id);

    if (result.changes === 0) {
      const product = db.prepare("SELECT id FROM products WHERE id = ?").get(id);
      if (!product) throw new Error("Product not found");
    }

    return getProduct(db, id);
  });
}

module.exports = { registerProductHandlers };
