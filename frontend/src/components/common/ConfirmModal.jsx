import Modal from './Modal';
import Icon from './Icon';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirmar', tone = 'danger', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose} showClose={false} rect>
      <div className={`confirm-banner ${tone === 'danger' ? 'confirm-banner-danger' : 'confirm-banner-primary'}`}>
        <span className="confirm-banner-icon">
          <Icon name={tone === 'danger' ? 'warning' : 'check'} size={22} />
        </span>
        <p className="section-subtitle" style={{ fontSize: 14, marginTop: 0 }}>
          {message}
        </p>
      </div>
      <div className="form-actions" style={{ marginTop: 24 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          <Icon name="x" />
          Cancelar
        </button>
        <button
          type="button"
          className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
        >
          <Icon name={tone === 'danger' ? 'trash' : 'check'} />
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}