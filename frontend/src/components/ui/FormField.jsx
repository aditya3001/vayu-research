export default function FormField({ label, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="form-label">{label}</label>}
      {children}
    </div>
  )
}

export function ModalField({ label, children }) {
  return (
    <div>
      <label className="modal-label">{label}</label>
      {children}
    </div>
  )
}
