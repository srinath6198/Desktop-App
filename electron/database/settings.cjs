const DEFAULT_SETTINGS = Object.freeze({
  shopName: "FlowerPOS Flower Shop",
  shortName: "FLOWER",
  address: "",
  mobileNumber: "",
  email: "",
  gstNumber: "",
  ownerName: "",
  logoDataUrl: "",
  taxRate: 5,
  showTax: true,
  showGst: true,
  receiptFooter: "Thank you for choosing us. Have a blooming day!",
  termsAndConditions: [
    "Goods once sold will not be taken back or exchanged.",
    "All disputes are subject to local jurisdiction only.",
    "Payment is due within 30 days of invoice date.",
    "Prices are inclusive of applicable taxes unless stated otherwise.",
    "This is a computer-generated invoice and requires no signature unless specified.",
  ].join("\n"),
});

const SETTING_KEYS = Object.freeze({
  shopName: "shop_name",
  shortName: "short_name",
  address: "address",
  mobileNumber: "mobile_number",
  email: "email",
  gstNumber: "gst_number",
  ownerName: "owner_name",
  logoDataUrl: "logo_data_url",
  taxRate: "tax_rate",
  showTax: "show_tax",
  showGst: "show_gst",
  receiptFooter: "receipt_footer",
  termsAndConditions: "terms_and_conditions",
});

function getAppSettings(db) {
  const rows = db.prepare("SELECT setting_key, setting_value FROM app_settings").all();
  const values = new Map(rows.map((row) => [row.setting_key, row.setting_value]));

  // Seed defaults into DB on first run so all values are always DB-driven
  if (rows.length === 0) {
    const seed = db.prepare(`
      INSERT OR IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)
    `);
    const seedAll = db.transaction(() => {
      for (const [key, settingKey] of Object.entries(SETTING_KEYS)) {
        const val = DEFAULT_SETTINGS[key];
        seed.run(
          settingKey,
          key === "taxRate" ? String(val)
            : key === "showTax" || key === "showGst" ? (val ? "1" : "0")
            : val,
        );
      }
    });
    seedAll();
    // Re-read from DB after seeding
    const seeded = db.prepare("SELECT setting_key, setting_value FROM app_settings").all();
    seeded.forEach((row) => values.set(row.setting_key, row.setting_value));
  }

  return {
    shopName: values.get(SETTING_KEYS.shopName) ?? DEFAULT_SETTINGS.shopName,
    shortName: values.get(SETTING_KEYS.shortName) ?? DEFAULT_SETTINGS.shortName,
    address: values.get(SETTING_KEYS.address) ?? DEFAULT_SETTINGS.address,
    mobileNumber: values.get(SETTING_KEYS.mobileNumber) ?? DEFAULT_SETTINGS.mobileNumber,
    email: values.get(SETTING_KEYS.email) ?? DEFAULT_SETTINGS.email,
    gstNumber: values.get(SETTING_KEYS.gstNumber) ?? DEFAULT_SETTINGS.gstNumber,
    ownerName: values.get(SETTING_KEYS.ownerName) ?? DEFAULT_SETTINGS.ownerName,
    logoDataUrl: values.get(SETTING_KEYS.logoDataUrl) ?? DEFAULT_SETTINGS.logoDataUrl,
    taxRate: Number(values.get(SETTING_KEYS.taxRate) ?? DEFAULT_SETTINGS.taxRate),
    showTax: values.has(SETTING_KEYS.showTax)
      ? values.get(SETTING_KEYS.showTax) === "1"
      : DEFAULT_SETTINGS.showTax,
    showGst: values.has(SETTING_KEYS.showGst)
      ? values.get(SETTING_KEYS.showGst) === "1"
      : DEFAULT_SETTINGS.showGst,
    receiptFooter: values.get(SETTING_KEYS.receiptFooter) ?? DEFAULT_SETTINGS.receiptFooter,
    termsAndConditions: values.get(SETTING_KEYS.termsAndConditions) ?? DEFAULT_SETTINGS.termsAndConditions,
  };
}

function saveAppSettings(db, settings) {
  const save = db.prepare(`
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES (?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value
  `);
  const values = Object.entries(SETTING_KEYS).map(([key, settingKey]) => [
    settingKey,
    key === "taxRate" ? String(settings[key]) : key === "showTax" || key === "showGst"
      ? (settings[key] ? "1" : "0")
      : settings[key],
  ]);
  const saveAll = db.transaction(() => {
    for (const [key, value] of values) save.run(key, value);
  });
  saveAll();
  return getAppSettings(db);
}

module.exports = { DEFAULT_SETTINGS, getAppSettings, saveAppSettings };
