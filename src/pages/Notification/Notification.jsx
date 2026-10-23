import { useEffect, useRef, useState } from "react"
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle, Trash2, X, Package, CreditCard } from "lucide-react"
import { notificationService } from "../../services/notification.service"

const TYPE_META = {
  info:    { icon: Info,          color: "#1e80ff", bg: "#eef4ff" },
  success: { icon: CheckCircle,   color: "#198754", bg: "#e9f7ef" },
  warning: { icon: AlertTriangle, color: "#e67e22", bg: "#fef6ec" },
  error:   { icon: AlertCircle,   color: "#e74c3c", bg: "#fdecea" },
  stock:   { icon: Package,       color: "#9b59b6", bg: "#f5eefb" },
  credit:  { icon: CreditCard,    color: "#c0392b", bg: "#fdf0ef" },
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

function buildLiveAlerts(lowStock, pendingCredits) {
  const alerts = []

  lowStock.forEach((p) => {
    const label = p.variant ? `${p.name} (${p.variant})` : p.name
    alerts.push({
      id: `stock-${p.id}`,
      type: "stock",
      title: "Low Stock",
      message: `${label} — ${p.stock} ${p.unit} left (min: ${p.minimum_stock})`,
      is_read: 0,
      created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      _live: true,
    })
  })

  pendingCredits.forEach((c) => {
    const days = Math.floor(
      (Date.now() - new Date(`${c.oldest_credit_at.replace(" ", "T")}Z`).getTime()) / 86400000
    )
    alerts.push({
      id: `credit-${c.id}`,
      type: "credit",
      title: "Pending Credit",
      message: `${c.name}${c.phone ? ` (${c.phone})` : ""} — ₹${c.pending_amount} pending for ${days} days`,
      is_read: 0,
      created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      _live: true,
    })
  })

  return alerts
}

function Notification({ onCountChange }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [liveAlerts, setLiveAlerts] = useState([])
  const [dismissedLive, setDismissedLive] = useState(() => {
    try { return new Set(JSON.parse(sessionStorage.getItem("dismissed_live_notifs") || "[]")) }
    catch { return new Set() }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const panelRef = useRef(null)

  const visibleLive = liveAlerts.filter((a) => !dismissedLive.has(a.id))
  const allItems = [...visibleLive, ...items]
  const unread = allItems.filter((n) => !n.is_read).length

  useEffect(() => { loadAll() }, [])

  useEffect(() => { onCountChange?.(unread) }, [unread, onCountChange])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  async function loadAll() {
    setLoading(true)
    setError("")
    try {
      const [dbItems, lowStock, pendingCredits] = await Promise.all([
        notificationService.list(),
        notificationService.lowStock(),
        notificationService.pendingCredit(),
      ])
      setItems(dbItems)
      setLiveAlerts(buildLiveAlerts(lowStock, pendingCredits))
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

  function dismissLive(id) {
    setDismissedLive((prev) => {
      const next = new Set(prev)
      next.add(id)
      sessionStorage.setItem("dismissed_live_notifs", JSON.stringify([...next]))
      return next
    })
  }

  async function markAllRead() {
    await notificationService.markAllRead()
    setItems((prev) => prev.map((n) => ({ ...n, is_read: 1 })))
    // dismiss all live alerts too
    setDismissedLive((prev) => {
      const next = new Set(prev)
      liveAlerts.forEach((a) => next.add(a.id))
      sessionStorage.setItem("dismissed_live_notifs", JSON.stringify([...next]))
      return next
    })
  }

  async function deleteOne(id) {
    await notificationService.delete(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
  }

  async function clearAll() {
    await notificationService.clearAll()
    setItems([])
    setDismissedLive((prev) => {
      const next = new Set(prev)
      liveAlerts.forEach((a) => next.add(a.id))
      sessionStorage.setItem("dismissed_live_notifs", JSON.stringify([...next]))
      return next
    })
  }

  return (
    <div className="notif-root" ref={panelRef}>
      <button
        aria-label="Notifications"
        className="notification-btn"
        onClick={() => { setOpen((v) => !v); if (!open) loadAll() }}
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
              {allItems.length > 0 && (
                <button className="notif-text-btn danger" onClick={clearAll} type="button">
                  <Trash2 size={14} /> Clear all
                </button>
              )}
              <button className="notif-close-btn" onClick={() => setOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
          </div>

          {(visibleLive.length > 0) && (
            <div className="notif-section-label">Live Alerts</div>
          )}

          <div className="notif-list">
            {loading && <p className="notif-empty">Loading…</p>}
            {error && <p className="notif-empty notif-error">{error}</p>}
            {!loading && !error && allItems.length === 0 && (
              <div className="notif-empty-state">
                <Bell size={28} />
                <span>No notifications yet</span>
              </div>
            )}
            {!loading && allItems.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.info
              const Icon = meta.icon
              const isLive = !!n._live
              return (
                <div
                  className={`notif-item${n.is_read ? "" : " unread"}${isLive ? " notif-live" : ""}`}
                  key={n.id}
                  onClick={() => !n.is_read && !isLive && markRead(n.id)}
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
                    onClick={(e) => { e.stopPropagation(); isLive ? dismissLive(n.id) : deleteOne(n.id) }}
                    title="Dismiss"
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
