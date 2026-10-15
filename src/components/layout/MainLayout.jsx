
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Menu,
  LayoutDashboard,
  ReceiptText,
  History,
  Flower2,
  ShoppingCart,
  Users,
  Wallet,
  Truck,
  Boxes,
  ChartNoAxesCombined,
  Settings,
  Bell,
  Search,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { settingsService } from "../../services/settings.service";
import "./MainLayout.scss";

const navigation = [
  {
    title: "MAIN MENU",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "New Bill", path: "/billing/new", icon: ReceiptText },
      { label: "Sales History", path: "/billing/history", icon: History },
    ],
  },
  {
    title: "MANAGEMENT",
    items: [
      { label: "Products", path: "/products", icon: Flower2 },
      { label: "Purchases", path: "/purchases", icon: ShoppingCart },
      { label: "Stock Entry", path: "/stock-entry", icon: Boxes },
      { label: "Customers", path: "/customers", icon: Users },
      { label: "Customer Credit", path: "/customers/credit", icon: Wallet },
      { label: "Suppliers", path: "/suppliers", icon: Truck },
      { label: "Inventory", path: "/inventory", icon: Boxes },
      { label: "Extra Charges", path: "/extra-charges", icon: Boxes },
    ],
  },
  {
    title: "ANALYTICS",
    items: [
      {
        label: "Reports",
        path: "/reports",
        icon: ChartNoAxesCombined,
      },
      { label: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

const pageTitles = {
  "/": "Dashboard",
  "/billing/new": "New Bill",
  "/billing/history": "Sales History",
  "/products": "Products",
  "/purchases": "Purchases",
  "/customers": "Customers",
  "/customers/credit": "Customer Credit",
  "/suppliers": "Suppliers",
  "/inventory": "Inventory",
  "/reports": "Reports",
  "/settings": "Settings",
};

function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [shopSettings, setShopSettings] = useState(null);

  useEffect(() => {
    settingsService.get().then(setShopSettings).catch(() => { })
  }, []);

  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || "Flower Billing";

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <div className="app-layout">
      {mobileSidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={[
          "app-sidebar",
          sidebarCollapsed ? "collapsed" : "",
          mobileSidebarOpen ? "mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="sidebar-brand">
          {/* <div className="brand-logo">
            {shopSettings?.logoDataUrl
              ? <img alt="Shop logo" src={shopSettings.logoDataUrl} />
              : <Flower2 size={25} strokeWidth={2.2} />}
          </div> */}

          <div className="brand-details">
            <h2>Offline POS</h2>
            <span>Billing & Inventory</span>
          </div>

          <button
            type="button"
            className="sidebar-collapse-btn"
            aria-label="Collapse sidebar"
            onClick={() => setSidebarCollapsed((previous) => !previous)}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>

        <nav className="sidebar-navigation">
          {navigation.map((section) => (
            <div className="navigation-section" key={section.title}>
              <p className="navigation-heading">{section.title}</p>

              {section.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      `navigation-link ${isActive ? "active" : ""}`
                    }
                    onClick={closeMobileSidebar}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon size={19} strokeWidth={1.8} />
                    <span className="navigation-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="store-avatar">
            <Flower2 size={19} />
          </div>

          <div className="store-details">
            <strong>My Flower Shop</strong>
            <span>Local Store</span>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Open navigation"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>

            <div className="page-heading">
              <div className="brand-logo">
                {shopSettings?.logoDataUrl
                  ? <img alt="Shop logo" src={shopSettings.logoDataUrl} />
                  : <Flower2 size={25} strokeWidth={2.2} />}
              </div>
              <h2>{shopSettings?.shopName || "Offline POS"}</h2>
            </div>
          </div>

          <div className="header-actions">
            <label className="header-search">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search..."
                aria-label="Search"
              />
              <kbd>⌘ K</kbd>
            </label>

            <button
              type="button"
              className="notification-btn"
              aria-label="Notifications"
              onClick={() =>
                window.alert("No new notifications.")
              }
            >
              <Bell size={20} />
              <span className="notification-dot" />
            </button>

            <div className="header-divider" />

            <button
              type="button"
              className="profile-button"
              onClick={() =>
                window.alert("Store profile settings can be added here.")
              }
            >
              <div className="profile-avatar">FS</div>

              <div className="profile-details">
                <strong>Shop Admin</strong>
                <span>Administrator</span>
              </div>

              <ChevronDown size={16} />
            </button>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>

        <footer className="app-footer">
          <span>Offline POS</span>
          <span>Offline Billing System</span>
        </footer>
      </div>
    </div>
  );
}

export default MainLayout;
