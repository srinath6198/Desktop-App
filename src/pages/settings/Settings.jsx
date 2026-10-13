import { useState } from "react"
import { Check, Database, ReceiptText, Store } from "lucide-react"
import { PageTitle, Panel } from "../../components/ui/PageUI"

function Settings() {
  const [saved, setSaved] = useState(false)

  function saveSettings(event) {
    event.preventDefault()
    setSaved(true)
  }

  return (
    <div className="screen">
      <PageTitle description="Customize your shop details, invoices and app preferences." title="Settings" />
      {saved && <p className="success-banner" role="status"><Check size={18} /> Settings saved for this demo session.</p>}
      <form className="settings-form" onSubmit={saveSettings}>
        <Panel className="settings-panel" title={<><Store size={18} /> Shop details</>} description="Shown on receipts and customer invoices.">
          <div className="form-grid"><label className="form-field span-2">Shop name<input defaultValue="FlowerPOS Flower Shop" name="shopName" required /></label><label className="form-field span-2">Address<textarea defaultValue="12 Market Road, Bengaluru, Karnataka" name="address" rows="3" /></label><label className="form-field">Phone<input defaultValue="+91 98765 00000" name="phone" type="tel" /></label><label className="form-field">Email<input defaultValue="hello@flowershop.in" name="email" type="email" /></label></div>
        </Panel>
        <Panel className="settings-panel" title={<><ReceiptText size={18} /> Billing preferences</>} description="Set default invoice behavior for your shop.">
          <div className="form-grid"><label className="form-field">Invoice prefix<input defaultValue="INV" name="invoicePrefix" /></label><label className="form-field">Default tax rate<select defaultValue="5" name="tax"><option value="0">No tax</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option></select></label><label className="form-field span-2">Receipt footer<textarea defaultValue="Thank you for choosing us. Have a blooming day!" name="footer" rows="2" /></label><label className="toggle-setting span-2"><input defaultChecked name="showTax" type="checkbox" /><span><strong>Show tax details on receipt</strong><small>Display tax as a separate line on customer invoices.</small></span></label></div>
        </Panel>
        <Panel className="settings-panel" title={<><Database size={18} /> Data & backup</>} description="Your records should stay on this device and be easy to restore.">
          <div className="backup-callout"><div><strong>Local database</strong><span>Database backup and restore will be available after SQLite integration.</span></div><button className="button button-secondary" disabled type="button">Backup unavailable</button></div>
        </Panel>
        <div className="settings-actions"><span className="muted-text">Some settings require database integration to persist.</span><button className="button button-primary" type="submit">Save settings</button></div>
      </form>
    </div>
  )
}

export default Settings
