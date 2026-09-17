import { useState } from 'react';
import { DIAS, HORARIOS, PDF_PATHS } from '../data/horario';

export default function Horarios() {
  const [activeTurn, setActiveTurn] = useState('mañana');

  const turn = HORARIOS[activeTurn] || [];

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Horarios</h2>
          <p className="section-subtitle">
            Distribución de los entrenadores por turno, de lunes a viernes.
          </p>
        </div>
        <a className="btn btn-primary" href={PDF_PATHS.horario} target="_blank" rel="noreferrer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Ver PDF del horario
        </a>
      </div>

      <div className="filters">
        <div className="segmented">
          {Object.keys(HORARIOS).map((option) => (
            <button
              key={option}
              type="button"
              className={activeTurn === option ? 'active' : ''}
              onClick={() => setActiveTurn(option)}
            >
              Turno de la {option}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              Turno de la {activeTurn} · Semana laboral
            </div>
            <div className="card-muted">Lunes a viernes</div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Instructor</th>
                <th>Área / Actividad</th>
                {DIAS.map((dia) => (
                  <th key={dia}>{dia}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turn.map((fila, index) => (
                <tr key={index}>
                  <td><strong>{fila.instructor}</strong></td>
                  <td>{fila.area}</td>
                  {DIAS.map((dia) => (
                    <td key={dia}>{fila[dia.toLowerCase()]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="alert alert-info" style={{ marginTop: 18 }}>
          El PDF oficial del horario está disponible para descarga e impresión desde el botón "Ver PDF del horario".
        </div>
      </div>
    </div>
  );
}