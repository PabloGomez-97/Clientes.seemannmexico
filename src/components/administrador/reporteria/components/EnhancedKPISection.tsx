// src/components/EnhancedKPISection.tsx
import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Award, 
  Target,
  Activity,
  PieChart,
  BarChart3,
  AlertTriangle,
  Zap
} from "lucide-react";
import type { GlobalKPIs, AdvancedKPIs } from '../utils/types';
import { formatMoney, formatPct } from '../utils/formatters';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  trend?: { value: number; isPositive: boolean };
  bgColor?: string;
  isSelected?: boolean;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  bgColor = "primary",
  isSelected = false,
  onClick
}) => {
  return (
    <div 
      className={`card h-100 shadow-sm ${isSelected ? `border-${bgColor} bg-${bgColor} bg-opacity-10` : 'border-light'} ${onClick ? 'cursor-pointer' : ''}`} 
      style={{ 
        borderWidth: isSelected ? '2px' : '1px',
        transition: 'all 0.2s ease'
      }}
      onClick={onClick}
    >
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className={`p-2 rounded ${isSelected ? `bg-${bgColor} bg-opacity-20` : 'bg-light'}`}>
            <Icon size={20} className={`${isSelected ? `text-${bgColor}` : 'text-muted'}`} />
          </div>
          {trend && (
            <div className={`d-flex align-items-center small fw-bold ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
              {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        <div>
          <p className="text-muted small mb-1">{title}</p>
          <h5 className={`fw-bold mb-1 ${isSelected ? `text-${bgColor}` : ''}`}>{value}</h5>
          {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

interface EnhancedKPISectionProps {
  globalKPIs: GlobalKPIs;
  advancedKPIs: AdvancedKPIs;
  selectedKPI: string;
  onKPISelect: (kpi: string) => void;
}

export const EnhancedKPISection: React.FC<EnhancedKPISectionProps> = ({
  globalKPIs,
  advancedKPIs,
  selectedKPI,
  onKPISelect
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <>
      {/* KPIs Principales con Toggle */}
      <div className="row g-3 mb-4">
        <div className="col-lg-3 col-md-6">
          <KPICard
            title="Facturación Total"
            value={formatMoney(globalKPIs.totalIncome)}
            subtitle={`${globalKPIs.totalOps} operaciones`}
            icon={DollarSign}
            bgColor="primary"
            isSelected={selectedKPI === 'revenue'}
            onClick={() => onKPISelect('revenue')}
          />
        </div>
        <div className="col-lg-3 col-md-6">
          <KPICard
            title="Profit Total"
            value={formatMoney(globalKPIs.totalProfit)}
            subtitle={`Margen: ${formatPct(globalKPIs.avgProfitMargin)}`}
            icon={TrendingUp}
            bgColor="success"
            isSelected={selectedKPI === 'profit'}
            onClick={() => onKPISelect('profit')}
          />
        </div>
        <div className="col-lg-3 col-md-6">
          <KPICard
            title="Clientes Activos"
            value={globalKPIs.totalClients.toString()}
            subtitle={`${formatPct(globalKPIs.clientConcentrationRisk)} concentración`}
            icon={Users}
            bgColor="info"
            isSelected={selectedKPI === 'clients'}
            onClick={() => onKPISelect('clients')}
          />
        </div>
        <div className="col-lg-3 col-md-6">
          <KPICard
            title="Ticket Promedio"
            value={formatMoney(globalKPIs.avgDealSize)}
            subtitle={`${formatPct(advancedKPIs.dealSuccessRate)} éxito`}
            icon={Award}
            bgColor="warning"
            isSelected={selectedKPI === 'ticket'}
            onClick={() => onKPISelect('ticket')}
          />
        </div>
      </div>

      {/* Toggle para KPIs Avanzados */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="text-muted mb-0">Métricas Adicionales</h6>
        <button 
          className={`btn btn-sm ${showAdvanced ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Ocultar' : 'Mostrar'} KPIs Avanzados
        </button>
      </div>

      {/* KPIs Avanzados */}
      {showAdvanced && (
        <div className="row g-3 mb-4">
          <div className="col-lg-2 col-md-4 col-6">
            <KPICard
              title="ROI"
              value={formatPct(globalKPIs.roi)}
              icon={Target}
              bgColor="success"
            />
          </div>
          <div className="col-lg-2 col-md-4 col-6">
            <KPICard
              title="Eficiencia Op."
              value={globalKPIs.operationalEfficiency.toFixed(2)}
              subtitle="Profit/Gasto"
              icon={Zap}
              bgColor="warning"
            />
          </div>
          <div className="col-lg-2 col-md-4 col-6">
            <KPICard
              title="Revenue/Ejecutivo"
              value={formatMoney(advancedKPIs.revenuePerExecutive)}
              icon={Activity}
              bgColor="info"
            />
          </div>
          <div className="col-lg-2 col-md-4 col-6">
            <KPICard
              title="Concentración"
              value={formatPct(advancedKPIs.executiveConcentration)}
              subtitle="Top performer"
              icon={PieChart}
              bgColor="secondary"
            />
          </div>
          <div className="col-lg-2 col-md-4 col-6">
            <KPICard
              title="Volatilidad"
              value={formatPct(advancedKPIs.monthlyVolatility)}
              icon={AlertTriangle}
              bgColor="danger"
            />
          </div>
          <div className="col-lg-2 col-md-4 col-6">
            <KPICard
              title="Crecimiento MoM"
              value={formatPct(advancedKPIs.monthOverMonthGrowth)}
              icon={BarChart3}
              bgColor="primary"
              trend={advancedKPIs.monthOverMonthGrowth ? { 
                value: advancedKPIs.monthOverMonthGrowth, 
                isPositive: advancedKPIs.monthOverMonthGrowth > 0 
              } : undefined}
            />
          </div>
        </div>
      )}
    </>
  );
};