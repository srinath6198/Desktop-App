
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Cloud,
  CloudUpload,
  LoaderCircle,
  Menu,
  LayoutDashboard,
  ReceiptText,
  History,
  Flower2,
  ShoppingCart,
  TrendingUpDown,
  Users,
  Wallet,
  Truck,
  Boxes,
  ChartNoAxesCombined,
  Settings,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  WifiOff,
  Sun,
  Moon,
} from "lucide-react";

import { settingsService } from "../../services/settings.service";
import { cloudBackupService } from "../../services/cloud-backup.service";
import Notification from "../../pages/Notification/Notification";
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
      { label: "Price Changes", path: "/price-changes", icon: TrendingUpDown },
      { label: "Purchases", path: "/purchases", icon: ShoppingCart },
      { label: "Stock Entry", path: "/stock-entry", icon: Boxes },
      { label: "Customers", path: "/customers", icon: Users },
      { label: "Customer Credit", path: "/customers/credit", icon: Wallet },
      { label: "Suppliers", path: "/suppliers", icon: Truck },
      { label: "Inventory", path: "/inventory", icon: Boxes },
      // { label: "Extra Charges", path: "/extra-charges", icon: Boxes },
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
      {
        label: "Settings",
        path: "/settings",
        icon: Settings,
        children: [
          { label: "Profile Settings", path: "/settings/profile" },
          { label: "Backup Settings", path: "/settings/backup" },
        ],
      },
    ],
  },
];

function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(() =>
    window.location.hash.startsWith("#/settings")
  );
  const [shopSettings, setShopSettings] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("app-theme") || "light");
  const [cloudStatus, setCloudStatus] = useState("checking");
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupPassphraseConfirmation, setBackupPassphraseConfirmation] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    settingsService.get().then(setShopSettings).catch(() => { })
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("app-theme", theme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    let checking = false;

    async function checkCloudStatus() {
      if (!navigator.onLine) {
        setCloudStatus("offline");
        return;
      }
      if (checking) return;
      checking = true;
      try {
        const config = await cloudBackupService.getConfig();
        if (!config.isConfigured) {
          if (mounted) setCloudStatus("offline");
          return;
        }
        await cloudBackupService.testConnection();
        if (mounted) setCloudStatus("online");
      } catch {
        if (mounted) setCloudStatus("offline");
      } finally {
        checking = false;
      }
    }

    function updateNetworkStatus() {
      if (!navigator.onLine) setCloudStatus("offline");
      else checkCloudStatus();
    }

    checkCloudStatus();
    const intervalId = window.setInterval(checkCloudStatus, 30_000);
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  async function createHeaderBackup(event) {
    event.preventDefault();
    if (backupPassphrase.length < 12) {
      setBackupError("Use a backup passphrase with at least 12 characters.");
      return;
    }
    if (backupPassphrase !== backupPassphraseConfirmation) {
      setBackupError("The backup passphrases do not match.");
      return;
    }

    setBackupBusy(true);
    setBackupError("");
    setBackupMessage("");
    try {
      const result = await cloudBackupService.create(backupPassphrase);
      setBackupMessage(`Backup completed at ${new Date(result.createdAt).toLocaleString()}.`);
      setBackupPassphrase("");
      setBackupPassphraseConfirmation("");
      setBackupDialogOpen(false);
    } catch (error) {
      setBackupError(error.message || "Unable to create the cloud backup.");
    } finally {
      setBackupBusy(false);
    }
  }

  return (
    <div className="app-layout">
      {backupDialogOpen && (
        <div
          className="backup-dialog-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !backupBusy) setBackupDialogOpen(false);
          }}
        >
          <form aria-labelledby="quick-backup-title" className="quick-backup-dialog" onSubmit={createHeaderBackup} role="dialog" aria-modal="true">
            <h2 id="quick-backup-title"><CloudUpload size={20} /> Back up database</h2>
            <p>Encrypts this device's SQLite database before uploading it to your configured cloud backup.</p>
            {backupError && <p className="error-banner" role="alert">{backupError}</p>}
            <label className="form-field">
              Backup passphrase
              <input autoComplete="new-password" disabled={backupBusy} minLength={12} onChange={(event) => setBackupPassphrase(event.target.value)} required type="password" value={backupPassphrase} />
            </label>
            <label className="form-field">
              Confirm passphrase
              <input autoComplete="new-password" disabled={backupBusy} minLength={12} onChange={(event) => setBackupPassphraseConfirmation(event.target.value)} required type="password" value={backupPassphraseConfirmation} />
            </label>
            <small>Use the same passphrase when restoring. It is not saved or sent to the server.</small>
            {backupBusy && (
              <p aria-live="polite" className="backup-operation-status" role="status">
                <LoaderCircle aria-hidden="true" className="backup-spinner" size={17} />
                Encrypting and uploading the backup. Please keep this window open.
              </p>
            )}
            <div className="quick-backup-actions">
              <button className="button button-secondary" disabled={backupBusy} onClick={() => setBackupDialogOpen(false)} type="button">Cancel</button>
              <button className="button button-primary" disabled={backupBusy || backupPassphrase.length < 12 || backupPassphrase !== backupPassphraseConfirmation} type="submit">
                {backupBusy ? <LoaderCircle aria-hidden="true" className="backup-spinner" size={16} /> : <CloudUpload size={16} />}
                {backupBusy ? "Backing up..." : "Back up now"}
              </button>
            </div>
          </form>
        </div>
      )}
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
                const itemIsActive = item.children
                  ? item.children.some((child) => location.pathname === child.path)
                  : false;

                return (
                  <div className="navigation-item-group" key={item.path}>
                    {item.children ? (
                      <button
                        aria-expanded={settingsExpanded}
                        className={`navigation-link navigation-parent ${itemIsActive ? "active" : ""}`}
                        onClick={() => {
                          if (sidebarCollapsed) {
                            setSidebarCollapsed(false);
                            setSettingsExpanded(true);
                          } else {
                            setSettingsExpanded((expanded) => !expanded);
                          }
                        }}
                        title={sidebarCollapsed ? item.label : undefined}
                        type="button"
                      >
                        <Icon size={19} strokeWidth={1.8} />
                        <span className="navigation-label">{item.label}</span>
                        {!sidebarCollapsed && (
                          <ChevronDown
                            aria-hidden="true"
                            className={`navigation-chevron ${settingsExpanded ? "expanded" : ""}`}
                            size={15}
                          />
                        )}
                      </button>
                    ) : (
                      <NavLink
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
                    )}
                    {item.children && !sidebarCollapsed && settingsExpanded && (
                      <div aria-label={`${item.label} submenu`} className="navigation-submenu">
                        {item.children.map((child) => (
                          <NavLink
                            className={({ isActive }) =>
                              `navigation-sublink ${isActive ? "active" : ""}`
                            }
                            key={child.path}
                            onClick={() => {
                              setSettingsExpanded(true);
                              closeMobileSidebar();
                            }}
                            to={child.path}
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
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
            {/* <label className="header-search">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search..."
                aria-label="Search"
              />
              <kbd>⌘ K</kbd>
            </label> */}


            <button
              aria-label="Toggle theme"
              className="theme-toggle-btn"
              onClick={() => setTheme((t) => t === "light" ? "dark" : "light")}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              type="button"
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <div
              aria-label={cloudStatus === "online" ? "Cloud backup connected" : "Cloud backup disconnected"}
              className={`cloud-connection-status ${cloudStatus}`}
              role="status"
              title={cloudStatus === "online" ? "Cloud backup service is reachable" : "Cloud backup service is not reachable"}
            >
              {cloudStatus === "online" ? <Cloud size={16} /> : <WifiOff size={16} />}
              <span>{cloudStatus === "online" ? "Cloud online" : "Cloud offline"}</span>
            </div>
            <button
              className="button button-primary header-backup-button"
              disabled={cloudStatus === "checking"}
              onClick={() => {
                setBackupError("");
                setBackupMessage("");
                if (cloudStatus === "online") setBackupDialogOpen(true);
                else navigate("/settings/backup");
              }}
              title={cloudStatus === "online" ? "Back up your database" : "Configure and connect cloud backup in Settings"}
              type="button"
            >
              <CloudUpload size={16} /> {cloudStatus === "online" ? "Backup" : "Connect backup"}
            </button>
            {backupMessage && <span className="header-backup-message" role="status">{backupMessage}</span>}
            <Notification />

            <div className="header-divider" />

            <button
              type="button"
              className="profile-button"
              onClick={() =>
                window.alert("Store profile settings can be added here.")
              }
            >
              <div className="profile-avatar">
                {shopSettings?.logoDataUrl
                  ? <img alt="Shop" src={shopSettings.logoDataUrl} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  : (shopSettings?.shopName?.slice(0, 2).toUpperCase() || "FS")}
              </div>

              <div className="profile-details">
                <strong>{shopSettings?.ownerName || shopSettings?.shopName || "Shop Admin"}</strong>
                <span>{shopSettings?.mobileNumber || "Administrator"}</span>
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
