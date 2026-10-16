import { useEffect, useState } from "react"
import { Cloud, Download, LoaderCircle, LockKeyhole, Upload } from "lucide-react"
import { Panel } from "../../components/ui/PageUI"
import { cloudBackupService } from "../../services/cloud-backup.service"

function OnlineDataBase() {
  const [apiUrl, setApiUrl] = useState("")
  const [token, setToken] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [confirmPassphrase, setConfirmPassphrase] = useState("")
  const [configured, setConfigured] = useState(false)
  const [busyAction, setBusyAction] = useState("")
  const busy = Boolean(busyAction)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [backupInfo, setBackupInfo] = useState(null)

  useEffect(() => {
    cloudBackupService.getConfig()
      .then(async (config) => {
        setApiUrl(config.apiUrl)
        setConfigured(config.isConfigured)
        if (config.isConfigured) {
          setBackupInfo(await cloudBackupService.testConnection())
        }
      })
      .catch((loadError) => setError(loadError.message || "Unable to load backup settings."))
  }, [])

  async function saveConnection() {
    setBusyAction("saving")
    setError("")
    setMessage("")
    try {
      const config = await cloudBackupService.saveConfig({ apiUrl, token })
      setApiUrl(config.apiUrl)
      setConfigured(config.isConfigured)
      setToken("")
      setMessage("Secure backup connection saved on this device.")
    } catch (saveError) {
      setError(saveError.message || "Unable to save the backup connection.")
    } finally {
      setBusyAction("")
    }
  }

  async function testConnection() {
    setBusyAction("testing")
    setError("")
    setMessage("")
    try {
      const status = await cloudBackupService.testConnection()
      setBackupInfo(status)
      setMessage(status.hasBackup
        ? `Connected. Latest backup: ${new Date(status.createdAt).toLocaleString()}.`
        : "Connected. No cloud backup exists yet.")
    } catch (connectionError) {
      setError(connectionError.message || "Unable to connect to the backup service.")
    } finally {
      setBusyAction("")
    }
  }

  async function createBackup() {
    if (passphrase.length < 12) {
      setError("Use a backup passphrase with at least 12 characters.")
      return
    }
    if (passphrase !== confirmPassphrase) {
      setError("The backup passphrases do not match.")
      return
    }
    setBusyAction("backup")
    setError("")
    setMessage("")
    try {
      const result = await cloudBackupService.create(passphrase)
      setPassphrase("")
      setConfirmPassphrase("")
      setBackupInfo({ hasBackup: true, createdAt: result.createdAt, size: result.size })
      setMessage(`Encrypted database backup saved at ${new Date(result.createdAt).toLocaleString()}.`)
    } catch (backupError) {
      setError(backupError.message || "Unable to create the cloud backup.")
    } finally {
      setBusyAction("")
    }
  }

  async function restoreBackup() {
    if (passphrase.length < 12) {
      setError("Enter the backup passphrase with at least 12 characters.")
      return
    }
    if (!window.confirm("Restore the latest cloud backup? This replaces the local database. Make a cloud backup first if you need to preserve current records.")) {
      return
    }
    setBusyAction("restore")
    setError("")
    setMessage("")
    try {
      await cloudBackupService.restore(passphrase)
      setPassphrase("")
      setMessage("Database restored. Reloading the app…")
      window.setTimeout(() => window.location.reload(), 500)
    } catch (restoreError) {
      setError(restoreError.message || "Unable to restore the cloud backup.")
      setBusyAction("")
    }
  }

  async function removeConnection() {
    if (!window.confirm("Remove the saved backup API URL and access token from this device?")) return
    setBusyAction("removing")
    setError("")
    setMessage("")
    try {
      await cloudBackupService.clearConfig()
      setApiUrl("")
      setToken("")
      setConfigured(false)
      setBackupInfo(null)
      setMessage("Saved backup connection removed from this device.")
    } catch (clearError) {
      setError(clearError.message || "Unable to remove the saved backup connection.")
    } finally {
      setBusyAction("")
    }
  }

  return (
    <Panel className="settings-panel" title={<><Cloud size={18} /> Encrypted cloud backup</>} description="Keep a protected copy of this device's SQLite database in your MongoDB Atlas account.">
      {message && <p className="success-banner" role="status">{message}</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="form-grid">
        <label className="form-field span-2">
          Backup API URL
          <input autoComplete="url" disabled={busy} onChange={(event) => setApiUrl(event.target.value)} placeholder="https://your-service.onrender.com" required type="url" value={apiUrl} />
          <small>Use the HTTPS URL of your deployed Render backup service, not the MongoDB Atlas connection string.</small>
        </label>
        <label className="form-field span-2">
          Backend access token
          <input autoComplete="new-password" disabled={busy} onChange={(event) => setToken(event.target.value)} placeholder={configured ? "Saved securely; enter only to replace it" : "Paste BACKUP_API_TOKEN from Render"} type="password" value={token} />
          <small>The token is encrypted in local secure storage and is never shown again.</small>
        </label>
        <div className="span-2 toolbar">
          <button className="button button-primary" disabled={busy || !apiUrl.trim()} onClick={saveConnection} type="button">Save connection</button>
          <button className="button button-secondary" disabled={busy || !configured} onClick={testConnection} type="button">Test connection</button>
          {configured && <button className="button button-secondary" disabled={busy} onClick={removeConnection} type="button">Remove connection</button>}
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 20 }}>
        <label className="form-field span-2">
          Backup passphrase
          <input autoComplete="new-password" disabled={busy || !configured} onChange={(event) => setPassphrase(event.target.value)} placeholder="At least 12 characters; keep it safe" type="password" value={passphrase} />
          <small><LockKeyhole size={13} /> Encrypts the backup before upload. The passphrase is not stored or sent to the server.</small>
        </label>
        <label className="form-field span-2">
          Confirm passphrase for backup
          <input autoComplete="new-password" disabled={busy || !configured} onChange={(event) => setConfirmPassphrase(event.target.value)} placeholder="Re-enter the same passphrase" type="password" value={confirmPassphrase} />
        </label>
        <div className="span-2 toolbar">
          <button className="button button-primary" disabled={busy || !configured || passphrase.length < 12 || passphrase !== confirmPassphrase} onClick={createBackup} type="button">
            {busyAction === "backup" ? <LoaderCircle aria-hidden="true" className="backup-spinner" size={16} /> : <Upload size={16} />}
            {busyAction === "backup" ? "Backing up..." : "Back up now"}
          </button>
          <button className="button button-secondary" disabled={busy || !configured || !backupInfo?.hasBackup || passphrase.length < 12} onClick={restoreBackup} type="button">
            {busyAction === "restore" ? <LoaderCircle aria-hidden="true" className="backup-spinner" size={16} /> : <Download size={16} />}
            {busyAction === "restore" ? "Restoring..." : "Restore latest backup"}
          </button>
        </div>
        {(busyAction === "backup" || busyAction === "restore") && (
          <p aria-live="polite" className="span-2 backup-operation-status" role="status">
            <LoaderCircle aria-hidden="true" className="backup-spinner" size={17} />
            {busyAction === "backup"
              ? "Creating encrypted backup and uploading it to the cloud. Please keep this window open."
              : "Downloading, decrypting, and validating the backup. Please keep this window open."}
          </p>
        )}
        <p className="span-2 muted-text">Only the encrypted SQLite database is uploaded; product and customer image files remain on this device. Keep your passphrase safe; it cannot be recovered. This is a manual backup for this device, not live sync. Customer Aadhaar encryption is tied to this computer, so restoring that data on a different computer may not allow it to be decrypted.</p>
      </div>
    </Panel>
  )
}

export default OnlineDataBase