import Modal from './ui/Modal'

export default function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <Modal onClose={onCancel} width={360}>
      <p className="confirm-message">{message}</p>
      <div className="modal-footer">
        <button className="btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn-sm btn-danger-confirm" onClick={onConfirm}>Delete</button>
      </div>
    </Modal>
  )
}
