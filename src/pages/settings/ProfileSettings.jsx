import { useEffect, useRef, useState } from "react"
import { Check, ImagePlus, Pencil, Plus, ReceiptText, Store, Trash2, X } from "lucide-react"
import { PageTitle, Panel } from "../../components/ui/PageUI"
import { settingsService } from "../../services/settings.service"

const DEFAULT_SETTINGS = {
  shopName: "",
  shortName: "",
  address: "",
  mobileNumber: "",
  email: "",
  gstNumber: "",
  ownerName: "",
  logoDataUrl: "",
  taxRate: 5,
  showTax: true,
  showGst: true,
  receiptFooter: "",
  termsAndConditions: "Goods once sold will not be taken back or exchanged.\nAll disputes are subject to local jurisdiction only.\nPayment is due within 30 days of invoice date.\nPrices are inclusive of applicable taxes unless stated otherwise.\nThis is a computer-generated invoice and requires no signature unless specified.",
}
const MAX_TERMS = 50

function getTerms(value) {
  return typeof value === "string"
    ? value.split(/\r?\n/).map((term) => term.trim()).filter(Boolean)
    : []
}

function ProfileSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectingLogo, setSelectingLogo] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [termInput, setTermInput] = useState("")
  const [editingIndex, setEditingIndex] = useState(-1)
  const [editValue, setEditValue] = useState("")
  const termInputRef = useRef(null)
  const terms = getTerms(settings.termsAndConditions)

  function addTerm() {
    const trimmed = termInput.trim()
    if (!trimmed) return
    setSettings((current) => {
      const currentTerms = getTerms(current.termsAndConditions)
      if (currentTerms.length >= MAX_TERMS) return current
      return { ...current, termsAndConditions: [...currentTerms, trimmed].join("\n") }
    })
    setTermInput("")
    setSaved(false)
  }

  function saveEditedTerm(index) {
    const trimmed = editValue.trim()
    if (!trimmed) return
    setSettings((current) => {
      const lines = current.termsAndConditions ? current.termsAndConditions.split("\n").filter(Boolean) : []
      lines[index] = trimmed
      return { ...current, termsAndConditions: lines.join("\n") }
    })
    setEditingIndex(-1)
    setSaved(false)
  }

  function deleteTerm(index) {
    setSettings((current) => {
      const lines = current.termsAndConditions ? current.termsAndConditions.split("\n").filter(Boolean) : []
      lines.splice(index, 1)
      return { ...current, termsAndConditions: lines.join("\n") }
    })
    setEditingIndex((current) => current === index ? -1 : current > index ? current - 1 : current)
    setSaved(false)
  }

  useEffect(() => {
    let mounted = true
    settingsService.get()
      .then((savedSettings) => {
        if (mounted) {
          setSettings((current) => ({
            ...current,
            ...savedSettings,
            termsAndConditions: typeof savedSettings.termsAndConditions === "string"
              ? savedSettings.termsAndConditions
              : current.termsAndConditions,
          }))
        }
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message || "Unable to load shop settings.")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  function updateSetting(event) {
    const { checked, name, type, value } = event.target
    setSettings((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }))
    setSaved(false)
  }

  async function selectLogo() {
    setSelectingLogo(true)
    setError("")
    try {
      const logoDataUrl = await settingsService.selectLogo()
      if (logoDataUrl) {
        setSettings((current) => ({ ...current, logoDataUrl }))
        setSaved(false)
      }
    } catch (logoError) {
      setError(logoError.message || "Unable to select the shop logo.")
    } finally {
      setSelectingLogo(false)
    }
  }

  async function saveSettings(event) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError("")
    try {
      const savedSettings = await settingsService.save(settings)
      setSettings((current) => ({
        ...current,
        ...savedSettings,
        termsAndConditions: typeof savedSettings.termsAndConditions === "string"
          ? savedSettings.termsAndConditions
          : current.termsAndConditions,
      }))
      setSaved(true)
    } catch (saveError) {
      setError(saveError.message || "Unable to save shop settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen">
      <PageTitle description="Manage your shop profile, invoice details and print preferences." title="Profile Settings" />
      {saved && <p className="success-banner" role="status"><Check size={18} /> Shop settings saved.</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <form className="settings-form" onSubmit={saveSettings}>
        <Panel className="settings-panel" title={<><Store size={18} /> Shop details</>} description="These details appear on customer invoices and PDF bills.">
          <div className="shop-logo-editor">
            <div className="shop-logo-preview">
              {settings.logoDataUrl
                ? <img alt="Shop logo preview" src={settings.logoDataUrl} />
                : <Store size={25} />}
            </div>
            <div className="shop-logo-actions">
              <strong>Shop logo</strong>
              <span>PNG, JPG, or WebP · up to 2 MB</span>
              <div>
                <button className="button button-secondary" disabled={loading || selectingLogo} onClick={selectLogo} type="button">
                  <ImagePlus size={16} /> {selectingLogo ? "Choosing..." : "Choose logo"}
                </button>
                {settings.logoDataUrl && (
                  <button
                    aria-label="Remove shop logo"
                    className="icon-button danger-icon"
                    disabled={loading}
                    onClick={() => {
                      setSettings((current) => ({ ...current, logoDataUrl: "" }))
                      setSaved(false)
                    }}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="form-grid settings-shop-fields">
            <label className="form-field span-2">Shop name<input autoComplete="organization" disabled={loading} maxLength="120" name="shopName" onChange={updateSetting} required value={settings.shopName} /></label>
            <label className="form-field">Short name for invoice numbers<input disabled={loading} maxLength="12" name="shortName" onChange={updateSetting} pattern="[A-Za-z0-9]{2,12}" required value={settings.shortName} /><small>Example: BLOOM-0001</small></label>
            <label className="form-field">Shop owner name<input autoComplete="name" disabled={loading} maxLength="120" name="ownerName" onChange={updateSetting} value={settings.ownerName} /></label>
            <label className="form-field span-2">Address<textarea autoComplete="street-address" disabled={loading} maxLength="500" name="address" onChange={updateSetting} rows="3" value={settings.address} /></label>
            <label className="form-field">Mobile number<input autoComplete="tel" disabled={loading} maxLength="30" name="mobileNumber" onChange={updateSetting} type="tel" value={settings.mobileNumber} /></label>
            <label className="form-field">Email<input autoComplete="email" disabled={loading} maxLength="254" name="email" onChange={updateSetting} type="email" value={settings.email} /></label>
            <label className="form-field span-2">GST number<input disabled={loading} maxLength="15" name="gstNumber" onChange={(event) => {
              setSettings((current) => ({ ...current, gstNumber: event.target.value.toUpperCase() }))
              setSaved(false)
            }} value={settings.gstNumber} /></label>
          </div>
        </Panel>

        <Panel className="settings-panel" title={<><ReceiptText size={18} /> Billing & print preferences</>} description="Set the tax calculation and details shown on printed invoices.">
          <div className="form-grid">
            <label className="form-field">Default tax rate
              <select disabled={loading} name="taxRate" onChange={updateSetting} value={settings.taxRate}>
                <option value="0">No tax</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option>
              </select>
            </label>
            <label className="form-field span-2">Receipt footer<textarea disabled={loading} maxLength="250" name="receiptFooter" onChange={updateSetting} rows="2" value={settings.receiptFooter} /></label>
            <div className="form-field span-2">
              <span>Terms &amp; Conditions</span>
              <div className="terms-input-row">
                <input
                  disabled={loading || terms.length >= MAX_TERMS}
                  maxLength="200"
                  onChange={(e) => setTermInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addTerm()
                    }
                  }}
                  placeholder={terms.length >= MAX_TERMS ? "Maximum 50 terms reached" : "Type a term and press Enter or +"}
                  ref={termInputRef}
                  value={termInput}
                />
                <button
                  className="button button-secondary"
                  disabled={loading || !termInput.trim() || terms.length >= MAX_TERMS}
                  onClick={() => {
                    addTerm()
                    termInputRef.current?.focus()
                  }}
                  type="button"
                >
                  <Plus size={16} />
                </button>
              </div>
              <ol className="terms-list">
                {terms.map((term, i) => (
                  <li key={i} className="terms-list-item">
                    {editingIndex === i ? (
                      <>
                        <input
                          autoFocus
                          className="terms-edit-input"
                          maxLength="200"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              saveEditedTerm(i)
                            } else if (e.key === "Escape") {
                              setEditingIndex(-1)
                            }
                          }}
                          onChange={(e) => setEditValue(e.target.value)}
                          value={editValue}
                        />
                        <div className="terms-item-actions">
                          <button
                            className="button button-primary terms-save-btn"
                            disabled={!editValue.trim()}
                            onClick={() => saveEditedTerm(i)}
                            type="button"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            className="icon-button"
                            onClick={() => setEditingIndex(-1)}
                            type="button"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span>{term}</span>
                        <div className="terms-item-actions">
                          <button
                            aria-label="Edit term"
                            className="icon-button"
                            disabled={loading}
                            onClick={() => { setEditingIndex(i); setEditValue(term) }}
                            type="button"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            aria-label="Delete term"
                            className="icon-button danger-icon"
                            disabled={loading}
                            onClick={() => deleteTerm(i)}
                            type="button"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {terms.length === 0 && (
                <p className="terms-empty-state">No terms added yet. Enter a term above and press Enter or +.</p>
              )}
              <small className="terms-count">{terms.length} of {MAX_TERMS} terms. Save settings to use them on printed invoices.</small>
            </div>
            <label className="toggle-setting span-2">
              <input checked={settings.showTax} disabled={loading} name="showTax" onChange={updateSetting} type="checkbox" />
              <span><strong>Show tax details on printed bills</strong><small>Tax is calculated using the rate above; this option controls whether its amount appears on the invoice.</small></span>
            </label>
            <label className="toggle-setting span-2">
              <input checked={settings.showGst} disabled={loading} name="showGst" onChange={updateSetting} type="checkbox" />
              <span><strong>Show shop GST number on printed bills</strong><small>Display the shop GST number in the invoice header.</small></span>
            </label>
          </div>
        </Panel>

        <div className="settings-actions"><span className="muted-text">Invoice numbers use your short name followed by an increasing number.</span><button className="button button-primary" disabled={loading || saving} type="submit">{saving ? "Saving..." : "Save settings"}</button></div>
      </form>
    </div>
  )
}

export default ProfileSettings
