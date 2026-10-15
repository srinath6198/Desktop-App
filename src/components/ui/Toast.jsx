import { CheckCircle2, CircleAlert, X } from "lucide-react"
import { useEffect } from "react"

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = window.setTimeout(() => {
      onClose?.()
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [message, onClose])

  if (!message) return null

  const isError = type === "error"

  return (
    <div className={`toast toast-${isError ? "error" : "success"}`} role={isError ? "alert" : "status"}>
      <div className="toast-icon">
        {isError ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
      </div>
      <span>{message}</span>
      <button aria-label="Dismiss notification" className="icon-button toast-close" onClick={onClose} type="button">
        <X size={14} />
      </button>
    </div>
  )
}

export default Toast
