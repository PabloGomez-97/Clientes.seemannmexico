// src/components/administrador/reporteria/components/Filters.tsx
import React from 'react';
import { Filter } from 'lucide-react';
import { useReporteriaData } from '../context/ReporteriaDataContext';
import { truncateText } from '../utils/formatters';

export const Filters: React.FC = () => {
  const {
    selectedExecutive,
    setSelectedExecutive,
    selectedMonth,
    setSelectedMonth,
    executiveOptions,
    availableMonths,
    operations
  } = useReporteriaData();

  const hasActiveFilters = selectedExecutive !== "all" || selectedMonth !== "all";

  return (
    <div className="card border-0 shadow-sm bg-white mb-4">
      <div className="card-body p-3">
        <div className="row align-items-center">
          <div className="col-md-8">
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <div className="d-flex align-items-center">
                <Filter size={18} className="text-primary me-2" />
                <span className="fw-semibold text-dark me-3">Filtros:</span>
              </div>
              
              <div style={{ minWidth: '200px' }}>
                <select
                  value={selectedExecutive}
                  onChange={(e) => setSelectedExecutive(e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="all">Todos los ejecutivos</option>
                  {executiveOptions.map(exec => (
                    <option key={exec} value={exec}>{truncateText(exec, 25)}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ minWidth: '150px' }}>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="form-select form-select-sm"
                >
                  <option value="all">Todos los períodos</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className="col-md-4 text-end">
            {hasActiveFilters && (
              <button 
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setSelectedExecutive("all");
                  setSelectedMonth("all");
                }}
              >
                Limpiar filtros
              </button>
            )}
            <span className="text-muted small ms-3">
              {operations?.length.toLocaleString() || 0} operaciones
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};