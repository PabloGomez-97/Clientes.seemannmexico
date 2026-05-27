// src/components/administrador/reporteria/pages/ReporteriaKPIs.tsx
import React from 'react';
import { useReporteriaData } from '../context/ReporteriaDataContext';
import { Filters } from '../components/Filters';
import { EnhancedKPISection } from '../components/EnhancedKPISection';

export default function ReporteriaKPIs() {
  const { operations, globalKPIs, advancedKPIs } = useReporteriaData();
  const [selectedKPI, setSelectedKPI] = React.useState<string>("none");

  if (!operations) {
    return (
      <div className="text-center py-5">
        <h4 className="text-muted">No hay datos cargados</h4>
        <p className="text-muted">Por favor, sube un archivo CSV desde el Dashboard</p>
      </div>
    );
  }

  if (!globalKPIs || !advancedKPIs) {
    return (
      <div className="text-center py-5">
        <h4 className="text-muted">Cargando KPIs...</h4>
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">KPIs Globales</h2>
          <p className="text-muted mb-0">Indicadores clave de rendimiento y métricas avanzadas</p>
        </div>
      </div>

      <Filters />

      <EnhancedKPISection
        globalKPIs={globalKPIs}
        advancedKPIs={advancedKPIs}
        selectedKPI={selectedKPI}
        onKPISelect={setSelectedKPI}
      />
    </>
  );
}