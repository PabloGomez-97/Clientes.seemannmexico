// src/components/common/Modals/ExecutiveModal.tsx
import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Calendar,
  DollarSign,
  TrendingUp,
  HelpCircle,
} from 'lucide-react';
import type { Operation } from '../../utils/types';
import { formatMoney, formatPct, truncateText } from '../../utils/formatters';
import { filterOperationsByMonth } from '../../utils/dataProcessing';

interface ExecutiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  executiveName: string;
  operations: Operation[];
  selectedMonth: string;
  comparisonPeriod?: string;
  currentPeriod?: string;
  showPeriodSelector?: boolean;
}

type SortDirection = 'asc' | 'desc' | null;
type SortField = 'date' | 'invoiceRef' | 'client' | 'income' | 'expense' | 'profit' | 'margin';

// Componente Tooltip para Stats Cards
const StatCardWithTooltip: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  tooltip: string;
  valueColor?: string;
}> = ({ icon, label, value, tooltip, valueColor = '#111827' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="card border" style={{ borderRadius: '8px', borderColor: '#e5e7eb' }}>
      <div className="card-body p-3">
        <div className="d-flex align-items-center mb-2 position-relative">
          {icon}
          <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </span>
          <div
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            style={{ position: 'relative', cursor: 'help', marginLeft: '6px' }}
          >
            <HelpCircle size={12} color="#9ca3af" />
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
        <p className="mb-0" style={{ fontSize: '1.5rem', fontWeight: 600, color: valueColor }}>
          {value}
        </p>
      </div>
    </div>
  );
};

export const ExecutiveModal: React.FC<ExecutiveModalProps> = ({
  isOpen,
  onClose,
  executiveName,
  operations,
  selectedMonth,
  comparisonPeriod,
  currentPeriod,
  showPeriodSelector = false,
}) => {
  // Estados
  const [selectedPeriodView, setSelectedPeriodView] = useState<'current' | 'comparison'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showClientFilter, setShowClientFilter] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [tempDateRange, setTempDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // Filtrar operaciones según el período
  const baseFilteredOperations = useMemo(() => {
    if (!showPeriodSelector) {
      return operations.filter(op => op.executive === executiveName);
    }

    const periodToShow = selectedPeriodView === 'current' ? currentPeriod : comparisonPeriod;
    if (!periodToShow || periodToShow === 'all') {
      return operations.filter(op => op.executive === executiveName);
    }

    const executiveOps = operations.filter(op => op.executive === executiveName);
    return filterOperationsByMonth(executiveOps, periodToShow);
  }, [operations, executiveName, showPeriodSelector, selectedPeriodView, currentPeriod, comparisonPeriod]);

  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    baseFilteredOperations.forEach(op => {
      if (op.client) clients.add(op.client);
    });
    return Array.from(clients).sort();
  }, [baseFilteredOperations]);

  // Aplicar búsqueda
  const filteredAndSearchedOps = useMemo(() => {
    let result = baseFilteredOperations;

    // Filtro por rango de fechas
    if (dateRange.start || dateRange.end) {
      result = result.filter(op => {
        if (!op.date) return false;
        const opDate = op.date.toISOString().split('T')[0];
        if (dateRange.start && opDate < dateRange.start) return false;
        if (dateRange.end && opDate > dateRange.end) return false;
        return true;
      });
    }

    // Filtro por clientes seleccionados
    if (selectedClients.length > 0) {
      result = result.filter(op => selectedClients.includes(op.client || ''));
    }

    // Búsqueda de texto
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (op) =>
          op.client?.toLowerCase().includes(query) ||
          op.invoiceRef?.toLowerCase().includes(query) ||
          op.date?.toLocaleDateString('es-CL').includes(query)
      );
    }

    return result;
  }, [baseFilteredOperations, searchQuery, dateRange, selectedClients]);

  // Ordenamiento
  const sortedOperations = useMemo(() => {
    if (!sortField || !sortDirection) return filteredAndSearchedOps;

    return [...filteredAndSearchedOps].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'date':
          aVal = a.date?.getTime() || 0;
          bVal = b.date?.getTime() || 0;
          break;
        case 'margin':
          aVal = a.income && a.profit ? (a.profit / a.income) * 100 : 0;
          bVal = b.income && b.profit ? (b.profit / b.income) * 100 : 0;
          break;
        default:
          aVal = a[sortField] || '';
          bVal = b[sortField] || '';
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
  }, [filteredAndSearchedOps, sortField, sortDirection]);

  // Paginación
  const paginatedOperations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedOperations.slice(startIndex, startIndex + pageSize);
  }, [sortedOperations, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedOperations.length / pageSize);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.position-relative')) {
        setShowDateFilter(false);
        setShowClientFilter(false);
      }
    };
    
    if (showDateFilter || showClientFilter) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDateFilter, showClientFilter]);

  React.useEffect(() => {
    if (showDateFilter) {
      setTempDateRange(dateRange);
    }
  }, [showDateFilter, dateRange]);

  // Estadísticas
  const stats = useMemo(() => {
    const totalProfit = filteredAndSearchedOps.reduce((sum, op) => sum + (op.profit || 0), 0);
    const totalIncome = filteredAndSearchedOps.reduce((sum, op) => sum + (op.income || 0), 0);
    const totalExpense = filteredAndSearchedOps.reduce((sum, op) => sum + (op.expense || 0), 0);
    const averageMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;

    return { totalProfit, totalIncome, totalExpense, averageMargin };
  }, [filteredAndSearchedOps]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc');
      if (sortDirection === 'desc') setSortField('date');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleClientToggle = (client: string) => {
    setSelectedClients(prev => 
      prev.includes(client) 
        ? prev.filter(c => c !== client)
        : [...prev, client]
    );
    setCurrentPage(1);
  };

  const clearDateRange = () => {
    setDateRange({ start: '', end: '' });
    setTempDateRange({ start: '', end: '' });
    setCurrentPage(1);
  };

  const applyDateFilter = () => {
    setDateRange(tempDateRange);
    setCurrentPage(1);
    setShowDateFilter(false);
  };

  const clearClientFilter = () => {
    setSelectedClients([]);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Referencia', 'Cliente', 'Facturación', 'Gasto', 'Profit', 'Margen'];
    const rows = sortedOperations.map((op) => {
      const margin = op.income && op.profit ? ((op.profit / op.income) * 100).toFixed(2) : '0';
      return [
        op.date?.toLocaleDateString('es-CL') || '',
        op.invoiceRef || '',
        op.client || '',
        op.income?.toString() || '0',
        op.expense?.toString() || '0',
        op.profit?.toString() || '0',
        margin,
      ];
    });

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${executiveName}_operaciones.csv`;
    link.click();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} style={{ color: '#9ca3af' }} />;
    if (sortDirection === 'asc') return <ArrowUp size={14} style={{ color: '#374151' }} />;
    if (sortDirection === 'desc') return <ArrowDown size={14} style={{ color: '#374151' }} />;
    return <ArrowUpDown size={14} style={{ color: '#9ca3af' }} />;
  };

  if (!isOpen) return null;

  const periodLabel = showPeriodSelector
    ? selectedPeriodView === 'current'
      ? currentPeriod
      : comparisonPeriod
    : selectedMonth !== 'all'
    ? selectedMonth
    : 'Todos los períodos';

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="modal-dialog modal-fullscreen-lg-down modal-xl">
        <div className="modal-content" style={{ borderRadius: '8px', border: 'none' }}>
          {/* Header */}
          <div className="modal-header" style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 24px' }}>
            <div>
              <h5 className="modal-title mb-1" style={{ color: '#111827', fontSize: '1.25rem', fontWeight: 600 }}>
                {truncateText(executiveName, 40)}
              </h5>
              <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>Período: {periodLabel}</small>
            </div>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>

          {/* Stats Cards CON TOOLTIPS */}
          <div style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <StatCardWithTooltip
                  icon={<Calendar size={16} style={{ color: '#9ca3af' }} className="me-2" />}
                  label="Operaciones"
                  value={filteredAndSearchedOps.length.toString()}
                  tooltip="Número total de operaciones realizadas en el período"
                />
              </div>

              <div className="col-6 col-md-3">
                <StatCardWithTooltip
                  icon={<DollarSign size={16} style={{ color: '#9ca3af' }} className="me-2" />}
                  label="Revenue"
                  value={formatMoney(stats.totalIncome)}
                  tooltip="Ingresos totales generados por las operaciones"
                />
              </div>

              <div className="col-6 col-md-3">
                <StatCardWithTooltip
                  icon={<TrendingUp size={16} style={{ color: '#10b981' }} className="me-2" />}
                  label="Profit"
                  value={formatMoney(stats.totalProfit)}
                  tooltip="Ganancia neta obtenida (Revenue - Gastos)"
                  valueColor="#10b981"
                />
              </div>

              <div className="col-6 col-md-3">
                <StatCardWithTooltip
                  icon={<Filter size={16} style={{ color: '#9ca3af' }} className="me-2" />}
                  label="Margen"
                  value={formatPct(stats.averageMargin)}
                  tooltip="Porcentaje de profit sobre revenue (Profit/Revenue × 100)"
                />
              </div>
            </div>
          </div>

          {/* Period Selector */}
          {showPeriodSelector && currentPeriod && comparisonPeriod && (
            <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 24px' }}>
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Comparar período:</span>
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    onClick={() => setSelectedPeriodView('current')}
                    className={`btn ${selectedPeriodView === 'current' ? 'btn-dark' : 'btn-outline-secondary'}`}
                    style={{ fontSize: '0.875rem' }}
                  >
                    {currentPeriod}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPeriodView('comparison')}
                    className={`btn ${selectedPeriodView === 'comparison' ? 'btn-dark' : 'btn-outline-secondary'}`}
                    style={{ fontSize: '0.875rem' }}
                  >
                    {comparisonPeriod}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '12px 24px' }}>
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-6">
                <div className="input-group">
                  <span className="input-group-text bg-white" style={{ border: '1px solid #d1d5db' }}>
                    <Search size={18} style={{ color: '#9ca3af' }} />
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar por cliente, referencia o fecha..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{ border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="d-flex gap-2 justify-content-md-end">
                  <select
                    className="form-select form-select-sm"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{ width: 'auto', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  >
                    <option value={10}>10 filas</option>
                    <option value={25}>25 filas</option>
                    <option value={50}>50 filas</option>
                    <option value={100}>100 filas</option>
                  </select>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
                    onClick={handleExportCSV}
                    style={{ fontSize: '0.875rem' }}
                  >
                    <Download size={16} />
                    <span className="d-none d-sm-inline">Exportar CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="modal-body p-0" style={{ maxHeight: '50vh', overflow: 'auto' }}>
            {paginatedOperations.length > 0 ? (
              <table className="table table-hover mb-0" style={{ fontSize: '0.875rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 10 }}>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span 
                          onClick={() => handleSort('date')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Fecha
                        </span>
                        <SortIcon field="date" />
                        <div className="position-relative">
                          <button
                            type="button"
                            className="btn btn-sm p-0"
                            onClick={() => setShowDateFilter(!showDateFilter)}
                            style={{ 
                              border: 'none', 
                              background: 'none',
                              color: (dateRange.start || dateRange.end) ? '#3b82f6' : '#9ca3af'
                            }}
                          >
                            <Search size={14} />
                          </button>
                          
                          {showDateFilter && (
                            <div
                              className="position-absolute"
                              style={{
                                top: '100%',
                                left: 0,
                                marginTop: '8px',
                                backgroundColor: 'white',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                padding: '12px',
                                zIndex: 1000,
                                minWidth: '280px',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                Filtrar por fecha
                              </div>
                              <div className="mb-2">
                                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                                  Desde
                                </label>
                                <input
                                  type="date"
                                  className="form-control form-control-sm"
                                  value={tempDateRange.start}
                                  onChange={(e) => {
                                    setTempDateRange(prev => ({ ...prev, start: e.target.value }));
                                  }}
                                  style={{ fontSize: '0.875rem' }}
                                />
                              </div>
                              <div className="mb-3">
                                <label style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                                  Hasta
                                </label>
                                <input
                                  type="date"
                                  className="form-control form-control-sm"
                                  value={tempDateRange.end}
                                  onChange={(e) => {
                                    setTempDateRange(prev => ({ ...prev, end: e.target.value }));
                                  }}
                                  style={{ fontSize: '0.875rem' }}
                                />
                              </div>
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary flex-grow-1"
                                  onClick={applyDateFilter}
                                  disabled={!tempDateRange.start && !tempDateRange.end}
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Aplicar
                                </button>
                                {(dateRange.start || dateRange.end) && (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => {
                                      clearDateRange();
                                      setShowDateFilter(false);
                                    }}
                                    style={{ fontSize: '0.75rem' }}
                                  >
                                    Limpiar
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('invoiceRef')}
                      style={{ cursor: 'pointer', padding: '12px 16px', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none' }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        Referencia
                        <SortIcon field="invoiceRef" />
                      </div>
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span 
                          onClick={() => handleSort('client')}
                          style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                          Cliente
                        </span>
                        <SortIcon field="client" />
                        <div className="position-relative">
                          <button
                            type="button"
                            className="btn btn-sm p-0"
                            onClick={() => setShowClientFilter(!showClientFilter)}
                            style={{ 
                              border: 'none', 
                              background: 'none',
                              color: selectedClients.length > 0 ? '#3b82f6' : '#9ca3af'
                            }}
                          >
                            <Search size={14} />
                          </button>
                          
                          {showClientFilter && (
                            <div
                              className="position-absolute"
                              style={{
                                top: '100%',
                                left: 0,
                                marginTop: '8px',
                                backgroundColor: 'white',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                padding: '12px',
                                zIndex: 1000,
                                minWidth: '250px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                Filtrar por cliente
                              </div>
                              <div className="mb-2">
                                {uniqueClients.map(client => (
                                  <label
                                    key={client}
                                    className="d-flex align-items-center gap-2 p-1"
                                    style={{ cursor: 'pointer', fontSize: '0.875rem', margin: 0 }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedClients.includes(client)}
                                      onChange={() => handleClientToggle(client)}
                                      className="form-check-input"
                                      style={{ cursor: 'pointer', margin: 0 }}
                                    />
                                    <span style={{ color: '#111827' }}>{truncateText(client, 30)}</span>
                                  </label>
                                ))}
                              </div>
                              {selectedClients.length > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary w-100"
                                  onClick={() => {
                                    clearClientFilter();
                                    setShowClientFilter(false);
                                  }}
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  Limpiar filtro ({selectedClients.length})
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('income')}
                      className="text-end"
                      style={{ cursor: 'pointer', padding: '12px 16px', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none' }}
                    >
                      <div className="d-flex align-items-center justify-content-end gap-2">
                        Revenue
                        <SortIcon field="income" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('expense')}
                      className="text-end"
                      style={{ cursor: 'pointer', padding: '12px 16px', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none' }}
                    >
                      <div className="d-flex align-items-center justify-content-end gap-2">
                        Gasto
                        <SortIcon field="expense" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('profit')}
                      className="text-end"
                      style={{ cursor: 'pointer', padding: '12px 16px', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none' }}
                    >
                      <div className="d-flex align-items-center justify-content-end gap-2">
                        Profit
                        <SortIcon field="profit" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('margin')}
                      className="text-center"
                      style={{ cursor: 'pointer', padding: '12px 16px', fontWeight: 500, fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none' }}
                    >
                      <div className="d-flex align-items-center justify-content-center gap-2">
                        Margen
                        <SortIcon field="margin" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOperations.map((op, idx) => {
                    const margin = op.income && op.profit ? (op.profit / op.income) * 100 : null;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 16px', color: '#111827', whiteSpace: 'nowrap' }}>
                          {op.date ? op.date.toLocaleDateString('es-CL') : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {op.invoiceRef || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#111827' }}>
                          {truncateText(op.client, 30)}
                        </td>
                        <td className="text-end" style={{ padding: '12px 16px', color: '#111827', whiteSpace: 'nowrap' }}>
                          {formatMoney(op.income)}
                        </td>
                        <td className="text-end" style={{ padding: '12px 16px', color: '#111827', whiteSpace: 'nowrap' }}>
                          {formatMoney(op.expense)}
                        </td>
                        <td className="text-end" style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 600, color: (op.profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                            {formatMoney(op.profit)}
                          </span>
                        </td>
                        <td className="text-center" style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          {margin !== null ? (
                            <span
                              className="badge"
                              style={{
                                backgroundColor: margin >= 20 ? '#d1fae5' : margin >= 10 ? '#fef3c7' : '#fee2e2',
                                color: margin >= 20 ? '#065f46' : margin >= 10 ? '#92400e' : '#991b1b',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                padding: '4px 8px'
                              }}
                            >
                              {formatPct(margin)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-5">
                <div className="mb-3" style={{ width: '64px', height: '64px', backgroundColor: '#f3f4f6', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Search size={32} style={{ color: '#9ca3af' }} />
                </div>
                <h5 style={{ color: '#111827', fontWeight: 500, marginBottom: '8px' }}>No se encontraron resultados</h5>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 0 }}>
                  Intenta ajustar los filtros o la búsqueda
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="modal-footer" style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '16px 24px', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                Mostrando <strong>{(currentPage - 1) * pageSize + 1}</strong> a{' '}
                <strong>{Math.min(currentPage * pageSize, sortedOperations.length)}</strong> de{' '}
                <strong>{sortedOperations.length}</strong> resultados
              </div>

              <div className="d-flex align-items-center gap-1">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  aria-label="Primera página"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="d-flex gap-1 mx-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        className={`btn btn-sm ${currentPage === pageNum ? 'btn-dark' : 'btn-outline-secondary'}`}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{ minWidth: '36px' }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  aria-label="Última página"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};