import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const TURNS = ['mañana', 'tarde'];

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
}

function monthTitle(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('es-SV', { month: 'long', year: 'numeric' });
}

export default function Reportes() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'super_admin';

  const [month, setMonth] = useState(currentMonth());
  const [turn, setTurn] = useState(isSuperAdmin ? 'todos' : user.turn);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ month });
      if (turn !== 'todos') params.set('turn', turn);
      const response = await api.get(`/attendance/reports/monthly?${params.toString()}`);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No fue posible generar el reporte mensual');
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    load();
  }, [month, load]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn]);

  // Si el instructor cambia de turno desde su perfil, actualizar el reporte al instante
  useEffect(() => {
    if (!isSuperAdmin && user.turn && user.turn !== turn) {
      setTurn(user.turn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.turn]);

  const summary = useMemo(() => data?.summary || [], [data]);

  const selectedSummary = turn === 'todos' ? summary : summary.filter((s) => s.turn === turn);

  const chartData = useMemo(() => {
    if (!data?.daily?.length) return [];
    const totalDays = daysInMonth(month);
    const byDay = new Array(totalDays).fill(0);
    (data.daily || []).forEach((d) => {
      if (turn !== 'todos' && d.turn !== turn) return;
      const day = Number(String(d.day).slice(-2));
      if (day >= 1 && day <= totalDays) byDay[day - 1] += Number(d.entradas) || 0;
    });
    const max = Math.max(1, ...byDay);
    return byDay.map((count, index) => ({ day: index + 1, count, height: Math.max(count > 0 ? 4 : 2, (count / max) * 160) }));
  }, [data, month, turn]);

  const totalLabel = useMemo(() => {
    if (turn === 'todos') return 'ambos turnos';
    return `turno de la ${turn}`;
  }, [turn]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2 className="section-title">Reportes mensuales</h2>
          <p className="section-subtitle">
            {isSuperAdmin
              ? 'Acceso global a los reportes mes a mes de ambos turnos.'
              : `Reporte mensual del turno de la ${user.turn}.`}
          </p>
        </div>
      </div>

      <div className="filters">
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="rep-month">Mes consultado</label>
          <input id="rep-month" className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        {isSuperAdmin && (
          <div className="field">
            <label>Turno</label>
            <div className="segmented">
              <button type="button" className={turn === 'todos' ? 'active' : ''} onClick={() => setTurn('todos')}>
                Ambos
              </button>
              {TURNS.map((option) => (
                <button key={option} type="button" className={turn === option ? 'active' : ''} onClick={() => setTurn(option)}>
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      {loading ? (
        <div className="card"><div className="empty-state">Generando reporte del mes…</div></div>
      ) : (
        data && (
          <>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-label">Asistencias totales</div>
                <div className="stat-value">{data.total.asistencias}</div>
                <div className="stat-foot">{monthTitle(month)} · {totalLabel}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Entradas</div>
                <div className="stat-value">{data.total.entradas}</div>
                <div className="stat-foot">Registradas en el mes</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Salidas</div>
                <div className="stat-value">{data.total.salidas}</div>
                <div className="stat-foot">Registradas en el mes</div>
              </div>
              <div className="stat-card tono-guinda">
                <div className="stat-label">Alumnos activos</div>
                <div className="stat-value">{data.total.alumnos_activos}</div>
                <div className="stat-foot">Con al menos una asistencia</div>
              </div>
            </div>

            {turn === 'todos' && summary.length > 0 && (
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                {summary.map((s) => (
                  <div key={s.turn} className="stat-card tono-gold">
                    <div className="stat-label">Turno de la {s.turn}</div>
                    <div className="stat-value">{s.asistencias}</div>
                    <div className="stat-foot">
                      {s.entradas} entradas · {s.salidas} salidas · {s.alumnos_activos} alumnos activos
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Asistencias por día (entradas)</div>
                  <div className="card-muted">{monthTitle(month)} · {totalLabel}</div>
                </div>
                <div className="legend">
                  <span><span className="dot" style={{ background: 'var(--guinda)' }} /> Entradas</span>
                </div>
              </div>
              {chartData.every((d) => d.count === 0) ? (
                <div className="empty-state">No hay asistencias registradas en este mes.</div>
              ) : (
                <div className="chart" role="img" aria-label="Gráfica de asistencias por día">
                  {chartData.map((d) => (
                    <div
                      key={d.day}
                      className={`chart-bar ${d.count === 0 ? 'empty' : ''}`}
                      style={{ height: d.height }}
                      title={`Día ${d.day}: ${d.count} entradas`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Detalle por alumno</div>
                  <div className="card-muted">Ordenado por número de asistencias en el mes</div>
                </div>
              </div>
              {selectedSummary.length === 0 && data.students.length === 0 ? (
                <div className="empty-state">No hay datos para mostrar en este mes.</div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Expediente</th>
                        <th>Alumno</th>
                        <th>Turno</th>
                        <th className="cell-numeric">Entradas</th>
                        <th className="cell-numeric">Salidas</th>
                        <th className="cell-numeric">Asistencias</th>
                        <th>Certificado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.students]
                        .sort((a, b) => (b.asistencias || 0) - (a.asistencias || 0))
                        .map((s) => (
                          <tr key={s.id}>
                            <td><strong>{s.student_number}</strong></td>
                            <td>{s.name} {s.lastname}</td>
                            <td>
                              <span className={s.turn === 'mañana' ? 'badge badge-guinda' : 'badge badge-gold'}>
                                {s.turn}
                              </span>
                            </td>
                            <td className="cell-numeric">{s.entradas || 0}</td>
                            <td className="cell-numeric">{s.salidas || 0}</td>
                            <td className="cell-numeric"><strong>{s.asistencias || 0}</strong></td>
                            <td>
                              {s.medical_certificate ? (
                                <span className="badge badge-success">Vigente</span>
                              ) : (
                                <span className="badge badge-danger">No vigente</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}