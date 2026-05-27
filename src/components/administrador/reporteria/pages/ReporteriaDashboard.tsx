// src/components/administrador/reporteria/pages/ReporteriaDashboard.tsx
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useReporteriaData } from '../context/ReporteriaDataContext';
import { formatMoney, truncateText } from '../utils/formatters';

export default function ReporteriaDashboard() {
  const { operations, monthly } = useReporteriaData();

  // PREPARACIÓN DE DATOS PARA GRÁFICOS

  // 1. Evolución temporal Revenue vs Profit (últimos 6 meses)
  const timeSeriesData = useMemo(() => {
    if (!monthly || monthly.length === 0) return [];

    const monthlyTotals = monthly.reduce((acc, item) => {
      const existing = acc.get(item.month) || { month: item.month, revenue: 0, profit: 0, ops: 0 };
      existing.revenue += item.income;
      existing.profit += item.profit;
      existing.ops += item.ops;
      acc.set(item.month, existing);
      return acc;
    }, new Map<string, { month: string; revenue: number; profit: number; ops: number }>());

    return Array.from(monthlyTotals.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [monthly]);

  // 2. Profit por Ejecutivo (Top 10)
  const executiveProfitData = useMemo(() => {
    if (!monthly || monthly.length === 0) return [];

    const executiveTotals = monthly.reduce((acc, item) => {
      const existing = acc.get(item.executive) || { executive: item.executive, profit: 0, ops: 0 };
      existing.profit += item.profit;
      existing.ops += item.ops;
      acc.set(item.executive, existing);
      return acc;
    }, new Map<string, { executive: string; profit: number; ops: number }>());

    return Array.from(executiveTotals.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        executiveShort: truncateText(item.executive, 20),
      }));
  }, [monthly]);

  // 3. Distribución de Margen (histograma)
  const marginDistributionData = useMemo(() => {
    if (!operations || operations.length === 0) return [];

    const ranges = [
      { label: '<0%', min: -Infinity, max: 0, count: 0 },
      { label: '0-10%', min: 0, max: 10, count: 0 },
      { label: '10-20%', min: 10, max: 20, count: 0 },
      { label: '20-30%', min: 20, max: 30, count: 0 },
      { label: '30-40%', min: 30, max: 40, count: 0 },
      { label: '>40%', min: 40, max: Infinity, count: 0 },
    ];

    operations.forEach((op) => {
      if (op.income && op.profit) {
        const margin = (op.profit / op.income) * 100;
        const range = ranges.find((r) => margin >= r.min && margin < r.max);
        if (range) range.count++;
      }
    });

    return ranges;
  }, [operations]);

  // 4. Revenue por Top Clientes (Top 10)
  const clientRevenueData = useMemo(() => {
    if (!operations || operations.length === 0) return [];

    const clientTotals = operations.reduce((acc, op) => {
      if (op.client && op.income) {
        const existing = acc.get(op.client) || { client: op.client, revenue: 0 };
        existing.revenue += op.income;
        acc.set(op.client, existing);
      }
      return acc;
    }, new Map<string, { client: string; revenue: number }>());

    return Array.from(clientTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        clientShort: truncateText(item.client, 25),
      }));
  }, [operations]);

  // 5. Comparación Mes Actual vs Anterior
  const monthComparisonData = useMemo(() => {
    if (!monthly || monthly.length === 0) return null;

    const monthlyTotals = monthly.reduce((acc, item) => {
      const existing = acc.get(item.month) || { month: item.month, revenue: 0, profit: 0, ops: 0 };
      existing.revenue += item.income;
      existing.profit += item.profit;
      existing.ops += item.ops;
      acc.set(item.month, existing);
      return acc;
    }, new Map<string, { month: string; revenue: number; profit: number; ops: number }>());

    const sorted = Array.from(monthlyTotals.values()).sort((a, b) => a.month.localeCompare(b.month));

    if (sorted.length < 2) return null;

    const current = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];

    return [
      { metric: 'Revenue', actual: current.revenue, anterior: previous.revenue },
      { metric: 'Profit', actual: current.profit, anterior: previous.profit },
      { metric: 'Ops', actual: current.ops, anterior: previous.ops },
    ];
  }, [monthly]);

  // 6. Scatter: Revenue vs Profit por Ejecutivo
  const executiveScatterData = useMemo(() => {
    if (!monthly || monthly.length === 0) return [];

    const executiveTotals = monthly.reduce((acc, item) => {
      const existing = acc.get(item.executive) || { executive: item.executive, revenue: 0, profit: 0, ops: 0 };
      existing.revenue += item.income;
      existing.profit += item.profit;
      existing.ops += item.ops;
      acc.set(item.executive, existing);
      return acc;
    }, new Map<string, { executive: string; revenue: number; profit: number; ops: number }>());

    return Array.from(executiveTotals.values());
  }, [monthly]);

  // Tooltip personalizado
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: 'white',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
            {label}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ margin: 0, fontSize: '0.8rem', color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? formatMoney(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: 'white',
            padding: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
            {truncateText(data.executive, 25)}
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>Revenue: {formatMoney(data.revenue)}</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#10b981' }}>Profit: {formatMoney(data.profit)}</p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#3b82f6' }}>Ops: {data.ops}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', padding: '0' }}>
      {/* Header */}
      <div className="mb-4">
        <h2 className="fw-normal mb-1" style={{ color: '#1f2937', fontSize: '1.75rem' }}>
          Dashboard Ejecutivo
        </h2>
        <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
          Análisis visual de rendimiento comercial
        </p>
      </div>

      {/* Grid de Gráficos */}
      <div className="row g-3">
        {/* 1. Evolución Temporal Revenue vs Profit */}
        <div className="col-12">
          <div
            className="card border-0"
            style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div className="card-body p-3">
              <h6 className="mb-3" style={{ color: '#374151', fontSize: '0.9rem', fontWeight: 600 }}>
                Evolución Temporal - Últimos 6 Meses
              </h6>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 2. Profit por Ejecutivo */}
        <div className="col-lg-6">
          <div
            className="card border-0"
            style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div className="card-body p-3">
              <h6 className="mb-3" style={{ color: '#374151', fontSize: '0.9rem', fontWeight: 600 }}>
                Profit por Ejecutivo - Top 10
              </h6>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={executiveProfitData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                  <YAxis dataKey="executiveShort" type="category" width={120} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="profit" fill="#10b981" radius={[0, 4, 4, 0]} name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 3. Distribución de Margen */}
        <div className="col-lg-6">
          <div
            className="card border-0"
            style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div className="card-body p-3">
              <h6 className="mb-3" style={{ color: '#374151', fontSize: '0.9rem', fontWeight: 600 }}>
                Distribución de Margen
              </h6>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={marginDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} name="Operaciones" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 4. Revenue por Top Clientes */}
        <div className="col-lg-6">
          <div
            className="card border-0"
            style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div className="card-body p-3">
              <h6 className="mb-3" style={{ color: '#374151', fontSize: '0.9rem', fontWeight: 600 }}>
                Revenue por Cliente - Top 10
              </h6>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={clientRevenueData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                  <YAxis dataKey="clientShort" type="category" width={150} tick={{ fontSize: 10, fill: '#6b7280' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 5. Comparación Mes Actual vs Anterior */}
        {monthComparisonData && (
          <div className="col-lg-6">
            <div
              className="card border-0"
              style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            >
              <div className="card-body p-3">
                <h6 className="mb-3" style={{ color: '#374151', fontSize: '0.9rem', fontWeight: 600 }}>
                  Mes Actual vs Anterior
                </h6>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="actual" fill="#10b981" radius={[4, 4, 0, 0]} name="Actual" />
                    <Bar dataKey="anterior" fill="#6b7280" radius={[4, 4, 0, 0]} name="Anterior" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 6. Scatter: Revenue vs Profit por Ejecutivo */}
        <div className="col-12">
          <div
            className="card border-0"
            style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          >
            <div className="card-body p-3">
              <h6 className="mb-3" style={{ color: '#374151', fontSize: '0.9rem', fontWeight: 600 }}>
                Eficiencia por Ejecutivo - Revenue vs Profit
              </h6>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    dataKey="revenue"
                    name="Revenue"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    label={{ value: 'Revenue', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#6b7280' } }}
                  />
                  <YAxis
                    type="number"
                    dataKey="profit"
                    name="Profit"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
                    label={{ value: 'Profit', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#6b7280' } }}
                  />
                  <Tooltip content={<CustomScatterTooltip />} />
                  <Scatter data={executiveScatterData} fill="#f59e0b">
                    {executiveScatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}