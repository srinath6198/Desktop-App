function getCustomersApi() {
  const api = window.desktopAPI?.customers
  if (!api) {
    throw new Error("Customer storage is available only in the desktop app. Run `npm run electron:dev` from the project folder.")
  }
  return api
}

function fromDatabase(customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone ?? "",
    address: customer.address ?? "",
    email: customer.email ?? "",
    aadhaarNumber: customer.aadhaar_number ?? "",
    gstNumber: customer.gst_number ?? "",
    profileImageDataUrl: customer.profile_image_data_url ?? null,
    createdAt: customer.created_at,
    visits: 0,
    balance: 0,
  }
}

function toDatabase(customer) {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    email: customer.email,
    aadhaarNumber: customer.aadhaarNumber,
    gstNumber: customer.gstNumber,
    profileImageDataUrl: customer.profileImageDataUrl ?? null,
    removeProfileImage: customer.removeProfileImage ?? false,
  }
}

export const customerService = {
  async list() {
    return (await getCustomersApi().list()).map(fromDatabase)
  },

  selectProfileImage() {
    return getCustomersApi().selectProfileImage()
  },

  async create(customer) {
    return fromDatabase(await getCustomersApi().create(toDatabase(customer)))
  },

  async update(customer) {
    return fromDatabase(await getCustomersApi().update(toDatabase(customer)))
  },
}
