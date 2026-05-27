// src/components/administrador/reporteria/pages/ReporteriaTrends.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Plus, Search, HelpCircle } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useReporteriaData } from '../context/ReporteriaDataContext';
import { ExecutiveModal } from '../components/modals/ExecutiveModal';
import { AdvancedTable } from '../components/AdvancedTable';
import { formatMoney, formatPct, truncateText } from '../utils/formatters';
import type { MonthlyAgg, WeeklyAgg, MonthKey, WeekKey } from '../utils/types';

type ViewMode = 'monthly' | 'weekly';

type TrendData = {
  executive: string;
  currentProfit: number;
  previousProfit: number;
  profitChange: number;
  profitPctChange: number;
  currentOps: number;
  previousOps: number;
  opsChange: number;
  currentRevenue: number;
  previousRevenue: number;
  trend: 'up' | 'down' | 'stable' | 'new';
};

// Componente Tooltip para los encabezados
const HeaderWithTooltip: React.FC<{ title: string; tooltip: string }> = ({ title, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="d-flex align-items-center position-relative">
      <span className="me-2">{title}</span>
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{ position: 'relative', cursor: 'help' }}
      >
        <HelpCircle size={14} color="#9ca3af" />
        {showTooltip && (
          <div
            className="position-absolute"
            style={{
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: '8px',
              padding: '8px 12px',
              backgroundColor: '#1f2937',
              color: 'white',
              borderRadius: '6px',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              zIndex: 1000,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}
          >
            {tooltip}
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid #1f2937',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Modal simple y reutilizable
const SearchModal: React.FC<{
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title = 'Buscador', onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1050 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="position-absolute top-50 start-50 translate-middle"
        style={{ width: 'min(980px, 92vw)' }}
      >
        <div
          className="card border-0"
          style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          }}
        >
          <div className="card-header d-flex align-items-center justify-content-between border-0" style={{ padding: '16px 20px' }}>
            <div className="d-flex align-items-center">
              <Search size={18} className="me-2" />
              <h5 className="mb-0" style={{ color: '#111827' }}>{title}</h5>
            </div>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
          <div className="card-body" style={{ padding: 20 }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default function ReporteriaTrends() {
  const { operations, monthly, weekly, availableMonths } = useReporteriaData();
  const [modalExecutive, setModalExecutive] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [trendCurrentPeriod, setTrendCurrentPeriod] = useState<string | null>(null);
  const [trendComparisonPeriod, setTrendComparisonPeriod] = useState<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentPeriod, setCurrentPeriod] = useState<string>('latest');
  const [previousPeriod, setPreviousPeriod] = useState<string>('previous');
  const [trendFilter, setTrendFilter] = useState<string>('all');
  const [selectedExecutives, setSelectedExecutives] = useState<string[]>([]);

  const resetFilters = () => {
    setViewMode('monthly');
    setCurrentPeriod('latest');
    setPreviousPeriod('previous');
    setTrendFilter('all');
    setSelectedExecutives([]);
  };

  // ✅ CAMBIO: Forzar tipo string[] explícitamente
  const availablePeriods = useMemo((): string[] => {
    if (viewMode === 'monthly') {
      return Array.from(new Set(monthly.map(m => m.month as string))).sort();
    } else {
      return Array.from(new Set(weekly.map(w => w.week as string))).sort();
    }
  }, [viewMode, monthly, weekly]);

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

  const trendData: TrendData[] = useMemo(() => {
    if (!actualCurrentPeriod || !actualPreviousPeriod) return [];

    const dataToUse = viewMode === 'monthly' ? monthly : weekly;
    const executives = Array.from(new Set(dataToUse.map(d => d.executive)));

    return executives.map(exec => {
      const current = dataToUse.find(d => {
        if (d.executive !== exec) return false;
        if (viewMode === 'monthly') {
          return (d as MonthlyAgg).month === (actualCurrentPeriod as MonthKey);
        } else {
          return (d as WeeklyAgg).week === (actualCurrentPeriod as WeekKey);
        }
      });

      const previous = dataToUse.find(d => {
        if (d.executive !== exec) return false;
        if (viewMode === 'monthly') {
          return (d as MonthlyAgg).month === (actualPreviousPeriod as MonthKey);
        } else {
          return (d as WeeklyAgg).week === (actualPreviousPeriod as WeekKey);
        }
      });

      const profitChange = current && previous ? previous.profit - current.profit : 0;
      const profitPctChange = previous && previous.profit !== 0 ?
        (previous.profit - (current?.profit || 0)) / Math.abs(previous.profit) * 100 : 0;
      const opsChange = current && previous ? current.ops - previous.ops : 0;

      let trend: 'up' | 'down' | 'stable' | 'new';
      if (!previous) trend = 'new';
      else if (Math.abs(profitPctChange) < 5) trend = 'stable';
      else if (profitPctChange > 0) trend = 'up';
      else trend = 'down';

      return {
        executive: exec,
        currentProfit: current?.profit || 0,
        previousProfit: previous?.profit || 0,
        profitChange,
        profitPctChange,
        currentOps: current?.ops || 0,
        previousOps: previous?.ops || 0,
        opsChange,
        currentRevenue: current?.income || 0,
        previousRevenue: previous?.income || 0,
        trend
      };
    }).filter(t => t.currentProfit > 0 || t.previousProfit > 0);
  }, [viewMode, monthly, weekly, actualCurrentPeriod, actualPreviousPeriod]);

  const filteredData = useMemo(() => {
    let filtered = trendData;
    if (trendFilter !== 'all') {
      filtered = filtered.filter(d => d.trend === trendFilter);
    }
    return filtered;
  }, [trendData, trendFilter]);

  const summaryStats = useMemo(() => {
    const improving = trendData.filter(d => d.trend === 'up').length;
    const declining = trendData.filter(d => d.trend === 'down').length;
    const stable = trendData.filter(d => d.trend === 'stable').length;
    const newExecs = trendData.filter(d => d.trend === 'new').length;

    const totalCurrentProfit = trendData.reduce((sum, d) => sum + d.currentProfit, 0);
    const totalPreviousProfit = trendData.reduce((sum, d) => sum + d.previousProfit, 0);
    const overallChange = totalPreviousProfit > 0 ? ((totalCurrentProfit - totalPreviousProfit) / totalPreviousProfit) * 100 : 0;

    return {
      improving,
      declining,
      stable,
      newExecs,
      totalCurrentProfit,
      totalPreviousProfit,
      overallChange
    };
  }, [trendData]);

  const columns = useMemo<ColumnDef<TrendData>[]>(
    () => [
      {
        accessorKey: 'executive',
        header: () => <HeaderWithTooltip title="Ejecutivo" tooltip="Nombre del ejecutivo de cuenta" />,
        cell: ({ row }) => (
          <div className="d-flex align-items-center">
            <div
              className="d-flex align-items-center justify-content-center me-3"
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 500,
                color: '#6b7280'
              }}
            >
              {row.original.executive.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: '#1f2937', fontSize: '0.9rem' }}>
              {truncateText(row.original.executive, 25)}
            </span>
          </div>
        ),
        enableSorting: true,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'currentProfit',
        header: () => <HeaderWithTooltip title={`Profit ${actualCurrentPeriod}`} tooltip="Ganancia neta del período seleccionado" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 500 }}>
            {formatMoney(getValue<number>())}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'previousProfit',
        header: () => <HeaderWithTooltip title={`Profit ${actualPreviousPeriod}`} tooltip="Ganancia neta del período a comparar" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            {formatMoney(getValue<number>())}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'profitChange',
        header: () => <HeaderWithTooltip title="Cambio ($)" tooltip="Diferencia en CLP de los periodos seleccionados" />,
        cell: ({ getValue }) => {
          const value = getValue<number>();
          return (
            <span
              style={{
                color: value >= 0 ? '#10b981' : '#ef4444',
                fontSize: '0.9rem',
                fontWeight: 600
              }}
            >
              {value >= 0 ? '+' : ''}{formatMoney(value)}
            </span>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'profitPctChange',
        header: () => <HeaderWithTooltip title="Cambio (%)" tooltip="Variación porcentual del profit entre períodos" />,
        cell: ({ getValue }) => {
          const value = getValue<number>();
          return (
            <div className="d-flex align-items-center">
              {value > 0 ? (
                <TrendingUp size={16} color="#10b981" className="me-1" />
              ) : value < 0 ? (
                <TrendingDown size={16} color="#ef4444" className="me-1" />
              ) : (
                <Minus size={16} color="#6b7280" className="me-1" />
              )}
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: Math.abs(value) < 5 ? '#f3f4f6' : value > 0 ? '#d1fae5' : '#fee2e2',
                  color: Math.abs(value) < 5 ? '#6b7280' : value > 0 ? '#065f46' : '#991b1b',
                  fontSize: '0.8rem',
                  fontWeight: 500
                }}
              >
                {value >= 0 ? '+' : ''}{value.toFixed(1)}%
              </span>
            </div>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'currentOps',
        header: () => <HeaderWithTooltip title={`Ops ${actualCurrentPeriod}`} tooltip="Número de operaciones del período seleccionado" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#1f2937', fontSize: '0.9rem' }}>
            {getValue<number>()}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'previousOps',
        header: () => <HeaderWithTooltip title={`Ops ${actualPreviousPeriod}`} tooltip="Número de operaciones del período a comparar" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            {getValue<number>()}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'trend',
        header: () => <HeaderWithTooltip title="Tendencia" tooltip="Clasificación de desempeño: Mejorando (+5%), Bajando (-5%), Estable o Nuevo" />,
        cell: ({ getValue }) => {
          const trend = getValue<string>();
          const config = {
            up: { label: 'Mejorando', color: '#10b981', bg: '#d1fae5' },
            down: { label: 'Bajando', color: '#ef4444', bg: '#fee2e2' },
            stable: { label: 'Estable', color: '#6b7280', bg: '#f3f4f6' },
            new: { label: 'Nuevo', color: '#3b82f6', bg: '#dbeafe' }
          };
          const { label, color, bg } = config[trend as keyof typeof config];

          return (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: bg,
                color: color,
                fontSize: '0.8rem',
                fontWeight: 500
              }}
            >
              {label}
            </span>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },
    ],
    [actualCurrentPeriod, actualPreviousPeriod]
  );

  const handleExecutiveClick = (row: TrendData) => {
    setModalExecutive(row.executive);
    setTrendCurrentPeriod(actualCurrentPeriod);
    setTrendComparisonPeriod(actualPreviousPeriod);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalExecutive(null);
    setTrendCurrentPeriod(null);
    setTrendComparisonPeriod(null);
  };

  if (!operations) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#fafafa' }}>
        <div className="text-center">
          <TrendingUp size={48} color="#d1d5db" className="mb-3" />
          <h4 className="fw-normal mb-2" style={{ color: '#6b7280' }}>No hay datos cargados</h4>
          <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
            Sube un archivo CSV desde el Dashboard
          </p>
        </div>
      </div>
    );
  }

  if (availableMonths.length < 2) {
    return (
      <div style={{ backgroundColor: '#fafafa', minHeight: '100vh' }}>
        <div className="mb-4">
          <h2 className="fw-normal mb-1" style={{ color: '#1f2937', fontSize: '1.75rem' }}>
            Análisis de Tendencias
          </h2>
          <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
            Comparaciones de rendimiento entre períodos
          </p>
        </div>
        <div
          className="card border-0"
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}
        >
          <div className="card-body text-center py-5">
            <TrendingUp size={48} color="#d1d5db" className="mb-3" />
            <h5 className="fw-normal mb-2" style={{ color: '#6b7280' }}>
              Datos insuficientes
            </h5>
            <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
              Se necesitan al menos 2 períodos para realizar análisis de tendencias
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', padding: '0' }}>
      <div className="mb-4">
        <h2 className="fw-normal mb-1" style={{ color: '#1f2937', fontSize: '1.75rem' }}>
          Análisis de Tendencias
        </h2>
        <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
          Comparación de rendimiento entre períodos
        </p>
      </div>

      <div className="mb-4"></div>

      <div className="row g-3 mb-4">
        <div className="col-lg-3 col-md-6">
          <div
            className="card border-0 h-100"
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          >
            <div className="card-body p-4 text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <TrendingUp size={20} color="#10b981" className="me-2" />
                <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Mejorando</p>
              </div>
              <h3 className="fw-semibold mb-0" style={{ color: '#10b981' }}>
                {summaryStats.improving}
              </h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6">
          <div
            className="card border-0 h-100"
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          >
            <div className="card-body p-4 text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <TrendingDown size={20} color="#ef4444" className="me-2" />
                <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Bajando</p>
              </div>
              <h3 className="fw-semibold mb-0" style={{ color: '#ef4444' }}>
                {summaryStats.declining}
              </h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6">
          <div
            className="card border-0 h-100"
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          >
            <div className="card-body p-4 text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <Minus size={20} color="#6b7280" className="me-2" />
                <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Estable</p>
              </div>
              <h3 className="fw-semibold mb-0" style={{ color: '#6b7280' }}>
                {summaryStats.stable}
              </h3>
            </div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6">
          <div
            className="card border-0 h-100"
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}
          >
            <div className="card-body p-4 text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>Cambio Global</p>
              </div>
              <h3
                className="fw-semibold mb-0 d-flex align-items-center justify-content-center"
                style={{ color: summaryStats.overallChange >= 0 ? '#10b981' : '#ef4444' }}
              >
                {summaryStats.overallChange >= 0 ? <Plus size={20} className="me-1" /> : ''}
                {summaryStats.overallChange.toFixed(1)}%
              </h3>
            </div>
          </div>
        </div>
        <div className="border-0">
          <div className="card-body p-4 position-relative" style={{ minHeight: '60px' }}>
            <button
              type="button"
              className="btn btn-dark d-inline-flex align-items-center position-absolute top-0 end-0 mt-3 me-3"
              onClick={() => setIsSearchOpen(true)}
              style={{ fontSize: '0.9rem', gap: '8px' }}
              aria-label="Abrir buscador"
            >
              <Search size={16} />
              Buscador
            </button>
          </div>
        </div>
      </div>

      <AdvancedTable
        data={filteredData}
        columns={columns}
        onRowClick={handleExecutiveClick}
        exportFileName={`tendencias_${actualCurrentPeriod}_vs_${actualPreviousPeriod}`}
      />

      {modalExecutive && (
        <ExecutiveModal
          isOpen={showModal}
          onClose={handleCloseModal}
          executiveName={modalExecutive}
          operations={operations || []}
          selectedMonth="all"
          currentPeriod={trendCurrentPeriod || undefined}
          comparisonPeriod={trendComparisonPeriod || undefined}
          showPeriodSelector={true}
        />
      )}

      <SearchModal open={isSearchOpen} onClose={() => setIsSearchOpen(false)} title="Buscador de períodos y filtros">
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Tipo de Análisis
            </label>
            <div className="btn-group w-100" role="group">
              <button
                type="button"
                className={`btn ${viewMode === 'monthly' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setViewMode('monthly');
                  setCurrentPeriod('latest');
                  setPreviousPeriod('previous');
                }}
                style={{
                  fontSize: '0.85rem',
                  border: '1px solid #e5e7eb',
                  backgroundColor: viewMode === 'monthly' ? '#1f2937' : 'white',
                  color: viewMode === 'monthly' ? 'white' : '#6b7280'
                }}
              >
                Mensual
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'weekly' ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setViewMode('weekly');
                  setCurrentPeriod('latest');
                  setPreviousPeriod('previous');
                }}
                style={{
                  fontSize: '0.85rem',
                  border: '1px solid #e5e7eb',
                  backgroundColor: viewMode === 'weekly' ? '#1f2937' : 'white',
                  color: viewMode === 'weekly' ? 'white' : '#6b7280'
                }}
              >
                Semanal
              </button>
            </div>
          </div>

          <div className="col-md-3">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Período Actual
            </label>
            <select
              value={currentPeriod}
              onChange={(e) => setCurrentPeriod(e.target.value)}
              className="form-select"
              style={{
                fontSize: '0.85rem',
                border: "1px solid #e5e7eb"
              }}
            >
              <option value="latest">Último período</option>
              {availablePeriods.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Período Comparación
            </label>
            <select
              value={previousPeriod}
              onChange={(e) => setPreviousPeriod(e.target.value)}
              className="form-select"
              style={{
                fontSize: '0.85rem',
                border: '1px solid #e5e7eb'
              }}
            >
              <option value="previous">Período anterior</option>
              {availablePeriods.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Filtrar por Tendencia
            </label>
            <select
              value={trendFilter}
              onChange={(e) => setTrendFilter(e.target.value)}
              className="form-select"
              style={{
                fontSize: '0.85rem',
                border: '1px solid #e5e7eb'
              }}
            >
              <option value="all">Todas</option>
              <option value="up">Mejorando</option>
              <option value="down">Bajando</option>
              <option value="stable">Estable</option>
              <option value="new">Nuevos</option>
            </select>
          </div>

          <div className="col-12 d-flex justify-content-end mt-2">
             <button
                type="button"
                className="btn btn-link me-auto text-decoration-none"
                onClick={() => {
                  resetFilters();
                }}
                style={{ color: '#6b7280' }}
              >
                Limpiar
              </button>
            <button
              type="button"
              className="btn btn-outline-secondary me-2"
              onClick={() => setIsSearchOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => setIsSearchOpen(false)}
            >
              Aplicar
            </button>
          </div>
        </div>
      </SearchModal>
    </div>
  );
}