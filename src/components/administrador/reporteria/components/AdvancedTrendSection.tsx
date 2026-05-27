// src/components/administrador/reporteria/components/AdvancedTrendSection.tsx
import React, { useState, useMemo } from 'react';
import { TrendIndicator } from './TrendIndicator';
import { formatMoney, truncateText } from '../utils/formatters';
import type { MonthlyAgg, WeeklyAgg, Operation, MonthKey, WeekKey } from '../utils/types';

interface AdvancedTrendSectionProps {
  monthlyData: MonthlyAgg[];
  weeklyData: WeeklyAgg[];
  operations: Operation[];
  onExecutiveClick: (executiveName: string, currentPeriod?: string, comparisonPeriod?: string) => void;
}

type ViewMode = 'monthly' | 'weekly';
type TrendComparison = {
  executive: string;
  current: MonthlyAgg | WeeklyAgg | null;
  previous: MonthlyAgg | WeeklyAgg | null;
  profitChange: number | null;
  profitPctChange: number | null;
  opsChange: number | null;
  trend: 'up' | 'down' | 'stable' | 'new';
};

export const AdvancedTrendSection: React.FC<AdvancedTrendSectionProps> = ({
  monthlyData,
  weeklyData,
  operations,
  onExecutiveClick
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentPeriod, setCurrentPeriod] = useState<string>('latest');
  const [previousPeriod, setPreviousPeriod] = useState<string>('previous');

  // ✅ CAMBIO: Forzar tipo string[] explícitamente
  const availablePeriods = useMemo((): string[] => {
    if (viewMode === 'monthly') {
      const months = Array.from(new Set(monthlyData.map(m => m.month as string))).sort();
      return months;
    } else {
      const weeks = Array.from(new Set(weeklyData.map(w => w.week as string))).sort();
      return weeks;
    }
  }, [viewMode, monthlyData, weeklyData]);

  // Determinar períodos actual y anterior basado en selección
  const { actualCurrentPeriod, actualPreviousPeriod } = useMemo(() => {
    if (availablePeriods.length === 0) {
      return { actualCurrentPeriod: '', actualPreviousPeriod: '' };
    }

    let curr: string;
    let prev: string;

    if (currentPeriod === 'latest') {
      curr = availablePeriods[availablePeriods.length - 1];
    } else {
      curr = currentPeriod;
    }

    if (previousPeriod === 'previous') {
      const currentIndex = availablePeriods.indexOf(curr);
      prev = currentIndex > 0 ? availablePeriods[currentIndex - 1] : '';
    } else {
      prev = previousPeriod;
    }

    return { actualCurrentPeriod: curr, actualPreviousPeriod: prev };
  }, [currentPeriod, previousPeriod, availablePeriods]);

  // Calcular comparaciones de tendencias
  const trendComparisons = useMemo((): TrendComparison[] => {
    if (!actualCurrentPeriod || !actualPreviousPeriod) return [];

    const dataToUse = viewMode === 'monthly' ? monthlyData : weeklyData;
    const executives = Array.from(new Set(dataToUse.map(d => d.executive)));

    return executives.map(exec => {
      const current = dataToUse.find(d => {
        if (d.executive !== exec) return false;
        if (viewMode === 'monthly') {
          return (d as MonthlyAgg).month === (actualCurrentPeriod as MonthKey);
        } else {
          return (d as WeeklyAgg).week === (actualCurrentPeriod as WeekKey);
        }
      }) || null;

      const previous = dataToUse.find(d => {
        if (d.executive !== exec) return false;
        if (viewMode === 'monthly') {
          return (d as MonthlyAgg).month === (actualPreviousPeriod as MonthKey);
        } else {
          return (d as WeeklyAgg).week === (actualPreviousPeriod as WeekKey);
        }
      }) || null;

      const profitChange = current && previous ? current.profit - previous.profit : null;
      const profitPctChange = previous && previous.profit !== 0 ? 
        ((current?.profit || 0) - previous.profit) / Math.abs(previous.profit) * 100 : null;
      const opsChange = current && previous ? current.ops - previous.ops : null;

      let trend: 'up' | 'down' | 'stable' | 'new';
      if (!previous) trend = 'new';
      else if (profitPctChange === null) trend = 'new';
      else if (Math.abs(profitPctChange) < 5) trend = 'stable';
      else if (profitPctChange > 0) trend = 'up';
      else trend = 'down';

      return {
        executive: exec,
        current,
        previous,
        profitChange,
        profitPctChange,
        opsChange,
        trend
      };
    }).filter(t => t.current || t.previous);
  }, [viewMode, monthlyData, weeklyData, actualCurrentPeriod, actualPreviousPeriod]);

  // Handler para click en ejecutivo con período específico
  const handleExecutiveClick = (executiveName: string) => {
    onExecutiveClick(executiveName, actualCurrentPeriod, actualPreviousPeriod);
  };

  if (availablePeriods.length < 2) {
    return (
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-light p-3">
          <h6 className="card-title mb-0">Análisis de Tendencias</h6>
          <small className="text-muted">Se necesitan al menos 2 períodos para mostrar comparaciones</small>
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-light p-3">
        {/* Header Principal */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 className="card-title mb-1">Análisis de Tendencias Avanzado</h6>
            <small className="text-muted">
              Comparando {actualCurrentPeriod} vs {actualPreviousPeriod}
            </small>
          </div>
          
          {/* Toggle Mensual/Semanal más compacto */}
          <div className="btn-group btn-group-sm" role="group">
            <input
              type="radio"
              className="btn-check"
              name="trendViewMode"
              id="trendMonthly"
              checked={viewMode === 'monthly'}
              onChange={() => {
                setViewMode('monthly');
                setCurrentPeriod('latest');
                setPreviousPeriod('previous');
              }}
            />
            <label className="btn btn-outline-primary" htmlFor="trendMonthly">
              Mensual
            </label>
            
            <input
              type="radio"
              className="btn-check"
              name="trendViewMode"
              id="trendWeekly"
              checked={viewMode === 'weekly'}
              onChange={() => {
                setViewMode('weekly');
                setCurrentPeriod('latest');
                setPreviousPeriod('previous');
              }}
            />
            <label className="btn btn-outline-primary" htmlFor="trendWeekly">
              Semanal
            </label>
          </div>
        </div>

        {/* Selectores de Períodos en una sola fila */}
        <div className="row g-2">
          <div className="col-md-6">
            <label className="form-label small fw-semibold mb-1">Período Actual</label>
            <select
              value={currentPeriod}
              onChange={(e) => setCurrentPeriod(e.target.value)}
              className="form-select form-select-sm"
            >
              <option value="latest">Último período</option>
              {availablePeriods.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold mb-1">Período Comparación</label>
            <select
              value={previousPeriod}
              onChange={(e) => setPreviousPeriod(e.target.value)}
              className="form-select form-select-sm"
            >
              <option value="previous">Período anterior</option>
              {availablePeriods.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card-body p-3">
        {trendComparisons.length === 0 ? (
          <div className="text-center text-muted py-4">
            <p className="mb-0">No hay datos para los períodos seleccionados</p>
          </div>
        ) : (
          <>
            {/* Nota informativa */}
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-muted small">
                <strong>{trendComparisons.length}</strong> ejecutivos con datos en los períodos seleccionados
              </span>
              <small className="text-muted">Haz clic en un ejecutivo para ver operaciones del período actual</small>
            </div>

            {/* Vista de Cards para pocos ejecutivos */}
            {trendComparisons.length <= 6 ? (
              <div className="row g-3">
                {trendComparisons.map((comparison) => (
                  <div key={comparison.executive} className="col-lg-2 col-md-4 col-sm-6">
                    <div 
                      className="card border-0 bg-light h-100 shadow-sm" 
                      style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                      onClick={() => handleExecutiveClick(comparison.executive)}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h6 className="card-title mb-0 small text-primary fw-semibold" title={comparison.executive} style={{ textDecoration: 'underline' }}>
                            {truncateText(comparison.executive, 15)}
                          </h6>
                          <TrendIndicator trend={comparison.trend} profitPctChange={comparison.profitPctChange} />
                        </div>
                        
                        <div className="small">
                          <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Actual:</span>
                            <span className="fw-bold text-success">{formatMoney(comparison.current?.profit || 0)}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-1">
                            <span className="text-muted">Anterior:</span>
                            <span className="text-secondary">{formatMoney(comparison.previous?.profit || 0)}</span>
                          </div>
                          {comparison.current && (
                            <div className="d-flex justify-content-between">
                              <span className="text-muted">Ops:</span>
                              <span className="badge bg-info">{comparison.current.ops}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Vista de Tabla para muchos ejecutivos */
              <div className="table-responsive">
                <table className="table table-hover table-sm mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="small fw-semibold">Ejecutivo</th>
                      <th className="small fw-semibold">Período Actual</th>
                      <th className="small fw-semibold">Período Anterior</th>
                      <th className="small fw-semibold">Cambio ($)</th>
                      <th className="small fw-semibold">Cambio (%)</th>
                      <th className="small fw-semibold">Ops Actual</th>
                      <th className="small fw-semibold">Ops Anterior</th>
                      <th className="small fw-semibold">Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendComparisons.map((comparison) => (
                      <tr 
                        key={comparison.executive} 
                        className="align-middle" 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => handleExecutiveClick(comparison.executive)}
                      >
                        <td>
                          <div className="fw-semibold small text-primary" title={comparison.executive} style={{ textDecoration: 'underline' }}>
                            {truncateText(comparison.executive, 25)}
                          </div>
                        </td>
                        <td className="small">
                          <div className="fw-bold text-success">{formatMoney(comparison.current?.profit || 0)}</div>
                          <small className="text-muted">{actualCurrentPeriod}</small>
                        </td>
                        <td className="small">
                          <div className="text-secondary">{formatMoney(comparison.previous?.profit || 0)}</div>
                          <small className="text-muted">{actualPreviousPeriod}</small>
                        </td>
                        <td className="small">
                          <span className={`fw-bold ${(comparison.profitChange || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                            {comparison.profitChange !== null ? formatMoney(comparison.profitChange) : "—"}
                          </span>
                        </td>
                        <td className="small">
                          <span className={`fw-bold ${(comparison.profitPctChange || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                            {comparison.profitPctChange !== null ? `${comparison.profitPctChange.toFixed(1)}%` : "—"}
                          </span>
                        </td>
                        <td className="small">
                          <span className="badge bg-info">{comparison.current?.ops || 0}</span>
                        </td>
                        <td className="small">
                          <span className="badge bg-secondary">{comparison.previous?.ops || 0}</span>
                        </td>
                        <td>
                          <TrendIndicator trend={comparison.trend} profitPctChange={comparison.profitPctChange} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};