
import { Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";

import Dashboard from "../pages/dashboard/Dashboard";
import NewBill from "../pages/billing/NewBill";
import SalesHistory from "../pages/billing/SalesHistory";
import Products from "../pages/products/Products";
import Purchases from "../pages/purchases/Purchases";
import Customers from "../pages/customers/Customers";
import Suppliers from "../pages/suppliers/Suppliers";
import Inventory from "../pages/inventory/Inventory";
import Reports from "../pages/reports/Reports";
import Settings from "../pages/settings/Settings";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />

        <Route path="billing/new" element={<NewBill />} />
        <Route path="billing/history" element={<SalesHistory />} />

        <Route path="products" element={<Products />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="customers" element={<Customers />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
