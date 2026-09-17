import Icon from './Icon';

export default function Modal({ title, onClose, children, footer, size, showClose = true, rect = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${size === 'lg' ? 'modal-lg' : ''}${rect ? ' modal-rect' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>{title}</h3>
          {showClose && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
              <Icon name="x" size={18} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}