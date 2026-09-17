import { PDF_PATHS } from '../data/horario';

const REGLAMENTO_URL = PDF_PATHS.reglamento;

export default function Reglamento() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Reglamento del Gimnasio UES</h2>
          <p className="section-subtitle">
            Instructivo oficial para la correcta utilización de las instalaciones.
          </p>
        </div>
        <a className="btn btn-primary" href={REGLAMENTO_URL} target="_blank" rel="noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M7 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-2m-5 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Descargar PDF
        </a>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Visor del PDF Reglamento</div>
            <div className="card-muted">
              Si el documento no se visualiza, descárgalo con el botón superior.
            </div>
          </div>
        </div>

        <iframe
          src={REGLAMENTO_URL}
          title="Visor del reglamento del gimnasio"
          style={{ width: '100%', height: '72vh', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: '#fff' }}
        />
      </div>
    </div>
  );
}