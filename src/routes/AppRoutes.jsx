
import { Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";

import Dashboard from "../pages/dashboard/Dashboard";
import NewBill from "../pages/billing/NewBill";
import SalesHistory from "../pages/billing/SalesHistory";
import Products from "../pages/products/Products";
import Purchases from "../pages/purchases/Purchases";
import Customers from "../pages/customers/Customers";
import CustomerCredit from "../pages/customers/CustomerCredit";
import Suppliers from "../pages/suppliers/Suppliers";
import Inventory from "../pages/inventory/Inventory";
import Reports from "../pages/reports/Reports";
import ProfileSettings from "../pages/settings/ProfileSettings";
import BackupSettings from "../pages/settings/BackupSettings";
import StockEntry from "../pages/stock/StockEntery";
import PriceChanges from "../pages/priceChanges/PriceChanges";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Dashboard />} />

        <Route path="billing/new" element={<NewBill />} />
        <Route path="billing/history" element={<SalesHistory />} />

        <Route path="products" element={<Products />} />
        <Route path="price-changes" element={<PriceChanges />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/credit" element={<CustomerCredit />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="stock-entry" element={<StockEntry />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings">
          <Route index element={<Navigate replace to="profile" />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="backup" element={<BackupSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
