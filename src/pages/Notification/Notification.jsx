import { useEffect, useRef, useState } from "react"
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle, Trash2, X } from "lucide-react"
import { notificationService } from "../../services/notification.service"

const TYPE_META = {
  info:    { icon: Info,          color: "#1e80ff", bg: "#eef4ff" },
  success: { icon: CheckCircle,   color: "#198754", bg: "#e9f7ef" },
  warning: { icon: AlertTriangle, color: "#e67e22", bg: "#fef6ec" },
  error:   { icon: AlertCircle,   color: "#e74c3c", bg: "#fdecea" },
}

function timeAgo(value) {
  const date = new Date(`${value.replace(" ", "T")}Z`)
  if (Number.isNaN(date.getTime())) return value
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return "Just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Notification({ onCountChange }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const panelRef = useRef(null)

  const unread = items.filter((n) => !n.is_read).length

  useEffect(() => { loadNotifications() }, [])

  useEffect(() => { onCountChange?.(unread) }, [unread, onCountChange])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  async function loadNotifications() {
    setLoading(true)
    setError("")
    try {
      setItems(await notificationService.list())
    } catch (err) {
      setError(err.message || "Unable to load notifications.")
    } finally {
      setLoading(false)
    }
  }

  async function markRead(id) {
    await notificationService.markRead(id)
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: 1 } : n))
  }

  async function markAllRead() {
    await notificationService.markAllRead()
    setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 })))
  }

  async function deleteOne(id) {
    await notificationService.delete(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
  }

  async function clearAll() {
    await notificationService.clearAll()
    setItems([])
  }

  return (
    <div className="notif-root" ref={panelRef}>
      <button
        aria-label="Notifications"
        className="notification-btn"
        onClick={() => { setOpen((v) => !v); if (!open) loadNotifications() }}
        type="button"
      >
        <Bell size={20} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-header">
            <strong>Notifications {unread > 0 && <span className="notif-count">{unread} new</span>}</strong>
            <div className="notif-header-actions">
              {unread > 0 && (
                <button className="notif-text-btn" onClick={markAllRead} type="button">
                  <CheckCheck size={15} /> Mark all read
                </button>
              )}
              {items.length > 0 && (
                <button className="notif-text-btn danger" onClick={clearAll} type="button">
                  <Trash2 size={14} /> Clear all
                </button>
              )}
              <button className="notif-close-btn" onClick={() => setOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="notif-list">
            {loading && <p className="notif-empty">Loading…</p>}
            {error && <p className="notif-empty notif-error">{error}</p>}
            {!loading && !error && items.length === 0 && (
              <div className="notif-empty-state">
                <Bell size={28} />
                <span>No notifications yet</span>
              </div>
            )}
            {!loading && items.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.info
              const Icon = meta.icon
              return (
                <div
                  className={`notif-item${n.is_read ? "" : " unread"}`}
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  style={{ "--notif-color": meta.color, "--notif-bg": meta.bg }}
                >
                  <span className="notif-item-icon"><Icon color={meta.color} size={18} /></span>
                  <div className="notif-item-body">
                    <strong>{n.title}</strong>
                    {n.message && <span>{n.message}</span>}
                    <small>{timeAgo(n.created_at)}</small>
                  </div>
                  {!n.is_read && <span className="notif-unread-dot" />}
                  <button
                    className="notif-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
                    title="Remove"
                    type="button"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default Notification
