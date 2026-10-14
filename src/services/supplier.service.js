function getSuppliersApi() {
  const api = window.desktopAPI?.suppliers
  if (!api) {
    throw new Error(
      "Supplier storage is available only in the desktop app. Run `npm run electron:dev` from the project folder.",
    )
  }
  return api
}

function fromDatabase(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    address: supplier.address ?? "",
    state: supplier.state ?? "",
    pincode: supplier.pincode ?? "",
    active: supplier.active === 1,
    createdAt: supplier.created_at,
  }
}

function toDatabase(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    state: supplier.state,
    pincode: supplier.pincode,
  }
}

export const supplierService = {
  async list() {
    return (await getSuppliersApi().list()).map(fromDatabase)
  },

  async create(supplier) {
    return fromDatabase(await getSuppliersApi().create(toDatabase(supplier)))
  },

  async update(supplier) {
    return fromDatabase(await getSuppliersApi().update(toDatabase(supplier)))
  },

  async setActive(id, active) {
    return fromDatabase(await getSuppliersApi().setActive(id, active))
  },
}
