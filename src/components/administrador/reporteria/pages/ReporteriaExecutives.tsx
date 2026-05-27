// src/components/pages/ExecutivesPage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { Users, TrendingUp, Target, Search, HelpCircle, DollarSign, Activity } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useReporteriaData } from '../context/ReporteriaDataContext';
import { Filters } from '../components/Filters';
import { ExecutiveModal } from '../components/modals/ExecutiveModal';
import { AdvancedTable } from '../components/AdvancedTable';
import { formatMoney, formatPct, truncateText } from '../utils/formatters';

type ExecutiveData = {
  executive: string;
  ops: number;
  income: number;
  profit: number;
  profitMargin: number;
  clients: number;
  avgTicket: number;
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

// Modal reutilizable (igual patrón que en TrendsPage)
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
      <div className="position-absolute top-50 start-50 translate-middle" style={{ width: 'min(960px, 92vw)' }}>
        <div
          className="card border-0"
          style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}
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

export default function ReporteriaExecutives() {
  const { operations, summaryData, selectedMonth } = useReporteriaData();
  const [modalExecutive, setModalExecutive] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Estado del modal Buscador
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Filtros locales del Buscador (afectan la tabla)
  const [sortBy, setSortBy] = useState<'profit' | 'income' | 'profitMargin' | 'ops' | 'avgTicket'>('profit');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [minOps, setMinOps] = useState<number>(0);
  const [minClients, setMinClients] = useState<number>(0);
  const [nameQuery, setNameQuery] = useState<string>('');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const [selectedExecutiveForDetail, setSelectedExecutiveForDetail] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const resetFilters = () => {
    setSortBy('profit');
    setSortDir('desc');
    setMinOps(0);
    setMinClients(0);
    setNameQuery('');
  };

  const handleCardClick = (cardType: string) => {
    setSelectedCard(cardType);
    setCardModalOpen(true);
  };

  const closeCardModal = () => {
    setCardModalOpen(false);
    setSelectedCard(null);
    setCardSearchQuery('');
  };

  const openExecutiveDetailModal = (executiveName: string) => {
    setSelectedExecutiveForDetail(executiveName);
    setDetailModalOpen(true);
  };

  const closeExecutiveDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedExecutiveForDetail(null);
  };

  const handleExecutiveClick = (executiveName: string) => {
    setModalExecutive(executiveName);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalExecutive(null);
  };

  // Datos base transformados
  const baseData: ExecutiveData[] = useMemo(() => {
    if (!summaryData) return [];
    return Object.entries(summaryData).map(([exec, data]) => ({
      executive: exec,
      ops: data.ops,
      income: data.income,
      profit: data.profit,
      profitMargin: data.income > 0 ? (data.profit / data.income) * 100 : 0,
      clients: data.clients.size,
      avgTicket: data.ops > 0 ? data.income / data.ops : 0,
    }));
  }, [summaryData]);

  // Aplicar filtros del Buscador + orden
  const tableData: ExecutiveData[] = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    let filtered = baseData
      .filter(d => d.ops >= minOps)
      .filter(d => d.clients >= minClients)
      .filter(d => (q ? d.executive.toLowerCase().includes(q) : true));

    const pick = (d: ExecutiveData) =>
      sortBy === 'profit' ? d.profit :
      sortBy === 'income' ? d.income :
      sortBy === 'profitMargin' ? d.profitMargin :
      sortBy === 'ops' ? d.ops :
      d.avgTicket;

    filtered.sort((a, b) => {
      const va = pick(a);
      const vb = pick(b);
      return sortDir === 'desc' ? vb - va : va - vb;
    });

    // desempate por profit desc
    filtered.sort((a, b) => {
      const va = pick(a), vb = pick(b);
      if (va === vb) return b.profit - a.profit;
      return 0;
    });

    return filtered;
  }, [baseData, sortBy, sortDir, minOps, minClients, nameQuery]);

  // Columnas CON TOOLTIPS
  const columns = useMemo<ColumnDef<ExecutiveData>[]>(
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
              {truncateText(row.original.executive, 30)}
            </span>
          </div>
        ),
        enableSorting: true,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'ops',
        header: () => <HeaderWithTooltip title="Operaciones" tooltip="Número total de operaciones realizadas" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            {getValue<number>()}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'income',
        header: () => <HeaderWithTooltip title="Ingresos" tooltip="Ingresos totales generados" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#1f2937', fontSize: '0.9rem' }}>
            {formatMoney(getValue<number>())}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'profit',
        header: () => <HeaderWithTooltip title="Ganancia" tooltip="Ganancia neta obtenida" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 500 }}>
            {formatMoney(getValue<number>())}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'profitMargin',
        header: () => <HeaderWithTooltip title="Margen" tooltip="Porcentaje de ganancia sobre ingresos" />,
        cell: ({ getValue }) => {
          const value = getValue<number>();
          return (
            <span
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: value >= 20 ? '#d1fae5' : value >= 10 ? '#fef3c7' : '#fee2e2',
                color: value >= 20 ? '#065f46' : value >= 10 ? '#92400e' : '#991b1b',
                fontSize: '0.8rem',
                fontWeight: 500
              }}
            >
              {formatPct(value)}
            </span>
          );
        },
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'clients',
        header: () => <HeaderWithTooltip title="Clientes" tooltip="Número de clientes únicos atendidos" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            {getValue<number>()}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
      {
        accessorKey: 'avgTicket',
        header: () => <HeaderWithTooltip title="Ticket Prom." tooltip="Valor promedio por operación (Revenue/Operaciones)" />,
        cell: ({ getValue }) => (
          <span style={{ color: '#1f2937', fontSize: '0.9rem' }}>
            {formatMoney(getValue<number>())}
          </span>
        ),
        enableSorting: true,
        enableColumnFilter: false,
      },
    ],
    []
  );

  // CardType type moved outside for reuse
  type CardType = 'revenue' | 'profit' | 'margin' | 'operations' | 'clients' | 'ticket' | 'efficiency';

  // Modal para detalles de cards
  const CardDetailModal: React.FC = () => {
    if (!cardModalOpen || !selectedCard) return null;

    const getCardData = () => {
      const searchLower = cardSearchQuery.trim().toLowerCase();

      switch (selectedCard as CardType) {
        case 'revenue':
          return executivesArray
            .filter(([exec]) => !searchLower || exec.toLowerCase().includes(searchLower))
            .sort(([, a], [, b]) => b.income - a.income)
            .map(([exec, data]) => ({
              name: exec,
              value: formatMoney(data.income),
              subtitle: `${data.ops} operaciones`,
              rawValue: data.income
            }));
        
        case 'profit':
          return executivesArray
            .filter(([exec]) => !searchLower || exec.toLowerCase().includes(searchLower))
            .sort(([, a], [, b]) => b.profit - a.profit)
            .map(([exec, data]) => ({
              name: exec,
              value: formatMoney(data.profit),
              subtitle: `Margen: ${formatPct(data.income > 0 ? (data.profit / data.income) * 100 : 0)}`,
              rawValue: data.profit
            }));
        
        case 'margin':
          return executivesArray
            .filter(([exec]) => !searchLower || exec.toLowerCase().includes(searchLower))
            .sort(([, a], [, b]) => {
              const marginA = a.income > 0 ? (a.profit / a.income) * 100 : 0;
              const marginB = b.income > 0 ? (b.profit / b.income) * 100 : 0;
              return marginB - marginA;
            })
            .map(([exec, data]) => ({
              name: exec,
              value: formatPct(data.income > 0 ? (data.profit / data.income) * 100 : 0),
              subtitle: `Revenue: ${formatMoney(data.income)}`,
              rawValue: data.income > 0 ? (data.profit / data.income) * 100 : 0
            }));
        
        case 'operations':
          return executivesArray
            .filter(([exec]) => !searchLower || exec.toLowerCase().includes(searchLower))
            .sort(([, a], [, b]) => b.ops - a.ops)
            .map(([exec, data]) => ({
              name: exec,
              value: data.ops.toString(),
              subtitle: `${data.clients.size} clientes únicos`,
              rawValue: data.ops
            }));
        
        case 'clients':
          return executivesArray
            .filter(([exec]) => !searchLower || exec.toLowerCase().includes(searchLower))
            .sort(([, a], [, b]) => b.clients.size - a.clients.size)
            .map(([exec, data]) => ({
              name: exec,
              value: data.clients.size.toString(),
              subtitle: `${data.ops} operaciones`,
              rawValue: data.clients.size
            }));
        
        case 'ticket':
          return executivesArray
            .filter(([exec]) => !searchLower || exec.toLowerCase().includes(searchLower))
            .sort(([, a], [, b]) => {
              const ticketA = a.ops > 0 ? a.income / a.ops : 0;
              const ticketB = b.ops > 0 ? b.income / b.ops : 0;
              return ticketB - ticketA;
            })
            .map(([exec, data]) => ({
              name: exec,
              value: formatMoney(data.ops > 0 ? data.income / data.ops : 0),
              subtitle: `${data.ops} operaciones`,
              rawValue: data.ops > 0 ? data.income / data.ops : 0
            }));
        
        case 'efficiency':
          return executivesArray
            .filter(([exec]) => !searchLower || exec.toLowerCase().includes(searchLower))
            .sort(([, a], [, b]) => {
              const effA = a.ops > 0 ? a.profit / a.ops : 0;
              const effB = b.ops > 0 ? b.profit / b.ops : 0;
              return effB - effA;
            })
            .map(([exec, data]) => ({
              name: exec,
              value: formatMoney(data.ops > 0 ? data.profit / data.ops : 0),
              subtitle: `${data.ops} operaciones`,
              rawValue: data.ops > 0 ? data.profit / data.ops : 0
            }));
        
        default:
          return [];
      }
    };
    const cardTitles = {
      revenue: 'Total Revenue por Ejecutivo',
      profit: 'Total Profit por Ejecutivo',
      margin: 'Margen Promedio por Ejecutivo',
      operations: 'Operaciones por Ejecutivo',
      clients: 'Clientes Activos por Ejecutivo',
      ticket: 'Ticket Promedio por Ejecutivo',
      efficiency: 'Eficiencia por Ejecutivo'
    };

    const data = getCardData();

    return (
      <div
        className="position-fixed top-0 start-0 w-100 h-100"
        style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1050 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeCardModal();
        }}
      >
        <div className="position-absolute top-50 start-50 translate-middle" style={{ width: 'min(720px, 92vw)', maxHeight: '85vh' }}>
          <div
            className="card border-0"
            style={{ backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}
          >
            <div className="card-header d-flex align-items-center justify-content-between border-0" style={{ padding: '20px' }}>
              <h5 className="mb-0" style={{ color: '#111827' }}>
                {cardTitles[selectedCard as keyof typeof cardTitles]}
              </h5>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeCardModal}>
                Cerrar
              </button>
            </div>
            
            <div className="px-4 pb-3">
              <input
                type="text"
                value={cardSearchQuery}
                onChange={(e) => setCardSearchQuery(e.target.value)}
                className="form-control"
                placeholder="Buscar ejecutivo..."
                style={{ fontSize: '0.9rem', border: '1px solid #e5e7eb' }}
              />
            </div>

            <div className="card-body" style={{ padding: '0 20px 20px', maxHeight: '50vh', overflowY: 'auto' }}>
              {data.length > 0 ? (
                <div>
                  {data.map((item, index) => (
                    <div
                    key={item.name}
                    className="d-flex justify-content-between align-items-center py-3"
                    style={{ 
                      borderBottom: index < data.length - 1 ? '1px solid #f3f4f6' : 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onClick={() => openExecutiveDetailModal(item.name)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                      <div>
                        <div style={{ color: '#1f2937', fontSize: '0.95rem', fontWeight: 500 }}>
                          {truncateText(item.name, 35)}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {item.subtitle}
                        </small>
                      </div>
                      <div className="text-end">
                        <div style={{ color: '#1f2937', fontSize: '0.95rem', fontWeight: 600 }}>
                          {item.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5">
                  <p className="text-muted mb-0">No se encontraron ejecutivos</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ExecutiveDetailFromCard: React.FC = () => {
    if (!detailModalOpen || !selectedExecutiveForDetail) return null;

    return (
      <ExecutiveModal
        isOpen={detailModalOpen}
        onClose={closeExecutiveDetailModal}
        executiveName={selectedExecutiveForDetail}
        operations={operations || []}
        selectedMonth={selectedMonth}
      />
    );
  };

  if (!operations) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ backgroundColor: '#fafafa' }}>
        <div className="text-center">
          <Users size={48} color="#d1d5db" className="mb-3" />
          <h4 className="fw-normal mb-2" style={{ color: '#6b7280' }}>No hay datos cargados</h4>
          <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
            Sube un archivo CSV desde el Dashboard
          </p>
        </div>
      </div>
    );
  }

  const executivesArray = Object.entries(summaryData || {});

  // Topes existentes (no dependen del buscador)
  const sortedExecutives = useMemo(() => {
    return executivesArray
      .slice()
      .sort(([, a], [, b]) => {
        const aProductivity = a.ops > 0 ? a.profit / a.ops : 0;
        const bProductivity = b.ops > 0 ? b.profit / b.ops : 0;
        return bProductivity - aProductivity;
      });
  }, [executivesArray]);

  // Estado inicial para deshabilitar "Limpiar"
  const isDefault =
    sortBy === 'profit' &&
    sortDir === 'desc' &&
    minOps === 0 &&
    minClients === 0 &&
    nameQuery === '';

  return (
    <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', padding: '0' }}>
      {/* Header */}
      <div className="mb-4">
        <h2 className="fw-normal mb-1" style={{ color: '#1f2937', fontSize: '1.75rem' }}>
          Análisis por Ejecutivo
        </h2>
        <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
          Rendimiento detallado del equipo comercial
        </p>
      </div>

      {/* Filtros globales existentes */}

      {/* Contenedor con botón "Buscador" y "Limpiar" (igual patrón) */}

      {/* Main Content */}
      {executivesArray.length > 0 ? (
        <>
          {/* Stats Summary */}
          <div className="mb-4">
            <div
              className="card border-0"
              style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <div className="card-body p-4">
                <div className="row">
                  <div className="col-md-3 text-center">
                    <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Total Ejecutivos</p>
                    <h4 className="fw-semibold mb-0" style={{ color: '#1f2937' }}>
                      {executivesArray.length}
                    </h4>
                  </div>
                  <div className="col-md-3 text-center">
                    <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Total Operaciones</p>
                    <h4 className="fw-semibold mb-0" style={{ color: '#1f2937' }}>
                      {executivesArray.reduce((sum, [_, data]) => sum + data.ops, 0)}
                    </h4>
                  </div>
                  <div className="col-md-3 text-center">
                    <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Revenue Total</p>
                    <h4 className="fw-semibold mb-0" style={{ color: '#1f2937' }}>
                      {formatMoney(executivesArray.reduce((sum, [_, data]) => sum + data.income, 0))}
                    </h4>
                  </div>
                  <div className="col-md-3 text-center">
                    <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Profit Total</p>
                    <h4 className="fw-semibold mb-0" style={{ color: '#10b981' }}>
                      {formatMoney(executivesArray.reduce((sum, [_, data]) => sum + data.profit, 0))}
                    </h4>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-4 position-relative">
            {/* Botones: Limpiar + Buscador */}
            <div className="position-absolute top-0 end-0 mt-3 me-3 d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary d-inline-flex align-items-center"
                onClick={resetFilters}
                style={{ fontSize: '0.9rem' }}
                disabled={isDefault}
              >
                Limpiar
              </button>

              <button
                type="button"
                className="btn btn-dark d-inline-flex align-items-center"
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

          {/* Advanced Table */}
          <div className="mb-4">
            <AdvancedTable
              data={tableData}
              columns={columns}
              onRowClick={(row) => handleExecutiveClick(row.executive)}
              exportFileName="ejecutivos"
            />
          </div>

          {/* Small Analytics Cards - 4 arriba */}
          <div className="mb-3">
            <div className="row g-3">
              {/* Total Revenue */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onClick={() => handleCardClick('revenue')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <DollarSign size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Total Revenue
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {formatMoney(executivesArray.reduce((sum, [_, data]) => sum + data.income, 0))}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {executivesArray.reduce((sum, [_, data]) => sum + data.ops, 0)} operaciones
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Profit */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onClick={() => handleCardClick('profit')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TrendingUp size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Total Profit
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {formatMoney(executivesArray.reduce((sum, [_, data]) => sum + data.profit, 0))}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Margen: {formatPct(
                          executivesArray.reduce((sum, [_, data]) => sum + data.income, 0) > 0
                            ? (executivesArray.reduce((sum, [_, data]) => sum + data.profit, 0) / executivesArray.reduce((sum, [_, data]) => sum + data.income, 0)) * 100
                            : 0
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Margen Promedio */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onClick={() => handleCardClick('margin')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Target size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Margen Promedio
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {formatPct(
                          executivesArray.reduce((sum, [_, data]) => sum + data.income, 0) > 0
                            ? (executivesArray.reduce((sum, [_, data]) => sum + data.profit, 0) / executivesArray.reduce((sum, [_, data]) => sum + data.income, 0)) * 100
                            : 0
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Rentabilidad general
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '12px' }}>
                      <svg width="40" height="40" style={{ display: 'block' }}>
                        <circle cx="20" cy="20" r="18" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                        <circle
                          cx="20"
                          cy="20"
                          r="18"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="4"
                          strokeDasharray={`${2 * Math.PI * 18}`}
                          strokeDashoffset={`${2 * Math.PI * 18 * (1 - ((executivesArray.reduce((sum, [_, data]) => sum + data.income, 0) > 0 ? (executivesArray.reduce((sum, [_, data]) => sum + data.profit, 0) / executivesArray.reduce((sum, [_, data]) => sum + data.income, 0)) * 100 : 0) / 100))}`}
                          transform="rotate(-90 20 20)"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operaciones */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onClick={() => handleCardClick('operations')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Activity size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Operaciones
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {executivesArray.reduce((sum, [_, data]) => sum + data.ops, 0)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Total cerradas
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Small Analytics Cards - 4 abajo */}
          <div className="mb-4">
            <div className="row g-3">
              {/* Clientes Activos */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onClick={() => handleCardClick('clients')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Users size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Clientes Activos
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {(() => {
                          const allClients = new Set();
                          executivesArray.forEach(([_, data]) => {
                            data.clients.forEach(client => allClients.add(client));
                          });
                          return allClients.size;
                        })()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Cartera total
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ticket Promedio */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onClick={() => handleCardClick('ticket')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <TrendingUp size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Ticket Promedio
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {formatMoney(
                          executivesArray.reduce((sum, [_, data]) => sum + data.ops, 0) > 0
                            ? executivesArray.reduce((sum, [_, data]) => sum + data.income, 0) / executivesArray.reduce((sum, [_, data]) => sum + data.ops, 0)
                            : 0
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Por operación
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ejecutivos */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Users size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Ejecutivos
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {executivesArray.length}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Equipo activo
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Eficiencia */}
              <div className="col-lg-3 col-md-6">
                <div
                  className="card border-0 h-100"
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent',
                  }}
                  onClick={() => handleCardClick('efficiency')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex justify-content-between align-items-start mb-3">
                      <div className="d-flex align-items-center gap-2">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Activity size={16} color="#3b82f6" />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Eficiencia
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                        {formatMoney(
                          executivesArray.reduce((sum, [_, data]) => sum + data.ops, 0) > 0
                            ? executivesArray.reduce((sum, [_, data]) => sum + data.profit, 0) / executivesArray.reduce((sum, [_, data]) => sum + data.ops, 0)
                            : 0
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        Profit por operación
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Analytics Cards (existentes) */}
          <div className="row g-3">
            {/* Top 5 by Productivity */}
            <div className="col-lg-6">
              <div
                className="card border-0 h-100"
                style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              >
                <div className="card-body p-4">
                  <div className="d-flex align-items-center mb-4">
                    <div
                      className="d-flex align-items-center justify-content-center me-3"
                      style={{ width: '40px', height: '40px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}
                    >
                      <Target size={20} color="#6b7280" />
                    </div>
                    <div>
                      <h5 className="fw-normal mb-0" style={{ color: '#1f2937', fontSize: '1.1rem' }}>
                        Productividad
                      </h5>
                      <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>
                        Profit por operación
                      </p>
                    </div>
                  </div>

                  <div>
                    {sortedExecutives.slice(0, 5).map(([exec, data], index) => {
                      const profitPerOp = data.ops > 0 ? data.profit / data.ops : 0;

                      return (
                        <div
                          key={exec}
                          className="d-flex justify-content-between align-items-center py-3"
                          style={{ borderBottom: index < 4 ? '1px solid #f9fafb' : 'none' }}
                        >
                          <div>
                            <div style={{ color: '#1f2937', fontSize: '0.9rem', fontWeight: 500 }}>
                              {truncateText(exec, 25)}
                            </div>
                            <small className="text-muted" style={{ fontSize: '0.8rem' }}>
                              {data.ops} operaciones
                            </small>
                          </div>
                          <div className="text-end">
                            <div style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>
                              {formatMoney(profitPerOp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Top 5 by Client Revenue */}
            <div className="col-lg-6">
              <div
                className="card border-0 h-100"
                style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
              >
                <div className="card-body p-4">
                  <div className="d-flex align-items-center mb-4">
                    <div
                      className="d-flex align-items-center justify-content-center me-3"
                      style={{ width: '40px', height: '40px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}
                    >
                      <TrendingUp size={20} color="#6b7280" />
                    </div>
                    <div>
                      <h5 className="fw-normal mb-0" style={{ color: '#1f2937', fontSize: '1.1rem' }}>
                        Revenue por Cliente
                      </h5>
                      <p className="text-muted mb-0" style={{ fontSize: '0.8rem' }}>
                        Eficiencia comercial
                      </p>
                    </div>
                  </div>

                  <div>
                    {sortedExecutives.slice(0, 5).map(([exec, data], index) => {
                      const revenuePerClient = data.clients.size > 0 ? data.income / data.clients.size : 0;
                      const opsPerClient = data.clients.size > 0 ? data.ops / data.clients.size : 0;

                      return (
                        <div
                          key={exec}
                          className="d-flex justify-content-between align-items-center py-3"
                          style={{ borderBottom: index < 4 ? '1px solid #f9fafb' : 'none' }}
                        >
                          <div>
                            <div style={{ color: '#1f2937', fontSize: '0.9rem', fontWeight: 500 }}>
                              {truncateText(exec, 25)}
                            </div>
                            <small className="text-muted" style={{ fontSize: '0.8rem' }}>
                              {data.clients.size} clientes • {opsPerClient.toFixed(1)} ops/cliente
                            </small>
                          </div>
                          <div className="text-end">
                            <div style={{ color: '#1f2937', fontSize: '0.9rem', fontWeight: 600 }}>
                              {formatMoney(revenuePerClient)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          className="card border-0"
          style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <div className="card-body text-center py-5">
            <Users size={48} color="#d1d5db" className="mb-3" />
            <h5 className="fw-normal mb-2" style={{ color: '#6b7280' }}>
              No hay datos disponibles
            </h5>
            <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
              Ajusta los filtros o verifica los datos cargados
            </p>
          </div>
        </div>
      )}

      {/* Modal de detalle de ejecutivo */}
      {modalExecutive && (
        <ExecutiveModal
          isOpen={showModal}
          onClose={handleCloseModal}
          executiveName={modalExecutive}
          operations={operations || []}
          selectedMonth={selectedMonth}
        />
      )}

      {/* MODAL BUSCADOR */}
      <SearchModal open={isSearchOpen} onClose={() => setIsSearchOpen(false)} title="Buscador de ejecutivos">
        <Filters />
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Ordenar por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="form-select"
              style={{ fontSize: '0.85rem', border: '1px solid #e5e7eb' }}
            >
              <option value="profit">Profit</option>
              <option value="income">Revenue</option>
              <option value="profitMargin">Margen</option>
              <option value="ops">Operaciones</option>
              <option value="avgTicket">Ticket Promedio</option>
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Dirección
            </label>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as any)}
              className="form-select"
              style={{ fontSize: '0.85rem', border: '1px solid #e5e7eb' }}
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </div>

          <div className="col-md-4">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Buscar por nombre
            </label>
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              className="form-control"
              placeholder="Ej: Ana, Juan…"
              style={{ fontSize: '0.85rem', border: '1px solid #e5e7eb' }}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Mín. Operaciones
            </label>
            <input
              type="number"
              min={0}
              value={minOps}
              onChange={(e) => setMinOps(Number(e.target.value))}
              className="form-control"
              style={{ fontSize: '0.85rem', border: '1px solid #e5e7eb' }}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label mb-2" style={{ fontSize: '0.85rem', fontWeight: 500, color: '#6b7280' }}>
              Mín. Clientes
            </label>
            <input
              type="number"
              min={0}
              value={minClients}
              onChange={(e) => setMinClients(Number(e.target.value))}
              className="form-control"
              style={{ fontSize: '0.85rem', border: '1px solid #e5e7eb' }}
            />
          </div>

          {/* Acciones */}
          <div className="col-12 d-flex justify-content-end mt-2">

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
      {/* Modal de detalle de cards */}
      <CardDetailModal />
      {/* Modal de detalle de ejecutivo desde cards */}
      <ExecutiveDetailFromCard />
    </div>
  );
};