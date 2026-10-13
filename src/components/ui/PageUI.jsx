import { X } from "lucide-react"

export function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="screen-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="screen-title-action">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, note, icon: Icon, tone = "green" }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>{Icon && <Icon size={20} />}</div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </article>
  )
}

export function Panel({ title, description, action, children, className = "" }) {
  return (
    <section className={`panel ${className}`.trim()}>
      {(title || description || action) && (
        <div className="panel-heading">
          <div>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-label={title}
        aria-modal="true"
        className="modal-card"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="modal-heading">
          <h3>{title}</h3>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
