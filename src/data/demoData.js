export const demoProducts = [
  {
    id: 1,
    name: "Red Rose",
    category: "Roses",
    unit: "bunch",
    stock: 42,
    purchasePrice: 180,
    sellingPrice: 250,
    variants: [
      { id: "10-stem", name: "10-stem bunch", unit: "bunch", stock: 24, sellingPrice: 250 },
      { id: "20-stem", name: "20-stem bunch", unit: "bunch", stock: 18, sellingPrice: 450 },
    ],
  },
  { id: 2, name: "White Lily", category: "Lilies", unit: "stem", stock: 28, purchasePrice: 65, sellingPrice: 95 },
  { id: 3, name: "Marigold", category: "Seasonal", unit: "kg", stock: 8, purchasePrice: 90, sellingPrice: 140 },
  { id: 4, name: "Jasmine", category: "Garlands", unit: "kg", stock: 16, purchasePrice: 320, sellingPrice: 450 },
  { id: 5, name: "Pink Carnation", category: "Carnations", unit: "bunch", stock: 21, purchasePrice: 150, sellingPrice: 220 },
  {
    id: 6,
    name: "Orchid",
    category: "Exotic",
    unit: "stem",
    stock: 5,
    purchasePrice: 110,
    sellingPrice: 180,
    variants: [
      { id: "standard", name: "Standard", unit: "stem", stock: 3, sellingPrice: 180 },
      { id: "premium", name: "Premium", unit: "stem", stock: 2, sellingPrice: 240 },
    ],
  },
]

export const demoSales = [
  { id: "INV-1048", customer: "Ananya Sharma", date: "Today, 10:42 AM", items: 4, payment: "UPI", total: 1850, status: "Paid" },
  { id: "INV-1047", customer: "Walk-in customer", date: "Today, 10:18 AM", items: 2, payment: "Cash", total: 640, status: "Paid" },
  { id: "INV-1046", customer: "Meera Flowers", date: "Today, 9:56 AM", items: 6, payment: "Card", total: 3240, status: "Paid" },
  { id: "INV-1045", customer: "Priya Nair", date: "Yesterday, 5:31 PM", items: 3, payment: "UPI", total: 1220, status: "Paid" },
  { id: "INV-1044", customer: "Walk-in customer", date: "Yesterday, 4:12 PM", items: 1, payment: "Cash", total: 450, status: "Due" },
]

export const demoCustomers = [
  { id: "CUS-001", name: "Ananya Sharma", phone: "+91 98765 43210", visits: 18, balance: 0, since: "12 Jan 2025" },
  { id: "CUS-002", name: "Meera Flowers", phone: "+91 98220 55124", visits: 12, balance: 1250, since: "28 Feb 2025" },
  { id: "CUS-003", name: "Priya Nair", phone: "+91 99876 12345", visits: 9, balance: 0, since: "03 Mar 2025" },
  { id: "CUS-004", name: "Walk-in customer", phone: "—", visits: 1, balance: 0, since: "—" },
]

export const demoSuppliers = [
  { id: "SUP-001", name: "Green Valley Farms", contact: "Ravi Kumar", phone: "+91 98765 11002", products: "Roses, Lilies", balance: 4200 },
  { id: "SUP-002", name: "Mysore Flower Market", contact: "Suresh M.", phone: "+91 98450 22334", products: "Jasmine, Marigold", balance: 0 },
  { id: "SUP-003", name: "Bloom Wholesale", contact: "Nisha Patel", phone: "+91 99000 45678", products: "Exotic flowers", balance: 1850 },
]

export const demoMovements = [
  { id: "MOV-2401", product: "Red Rose", type: "Sale", quantity: "-3 bunch", reference: "INV-1048", date: "Today, 10:42 AM" },
  { id: "MOV-2400", product: "Marigold", type: "Purchase", quantity: "+10 kg", reference: "PUR-0215", date: "Today, 9:15 AM" },
  { id: "MOV-2399", product: "White Lily", type: "Adjustment", quantity: "-2 stem", reference: "Stock count", date: "Yesterday, 6:30 PM" },
  { id: "MOV-2398", product: "Jasmine", type: "Sale", quantity: "-1 kg", reference: "INV-1045", date: "Yesterday, 5:31 PM" },
]

export const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value)
