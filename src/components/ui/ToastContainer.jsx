import Toast from "./Toast"

function ToastContainer({ toast, onClose }) {
  if (!toast) return null

  return (
    <div className="toast-container">
      <Toast message={toast.message} onClose={onClose} type={toast.type} />
    </div>
  )
}

export default ToastContainer
