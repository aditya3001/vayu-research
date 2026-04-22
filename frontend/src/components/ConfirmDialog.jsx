export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-dialog" onClick={e => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="modal-footer">
          <button className="btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn-sm btn-danger-confirm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}
