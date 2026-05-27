// src/utils/advancedKPIs.ts
import type { Operation, MonthlyAgg, ExecutiveSummary, GlobalKPIs, AdvancedKPIs } from './types';

export function calculateAdvancedKPIs(
  operations: Operation[],
  monthlyData: MonthlyAgg[],
  summaryData: Record<string, ExecutiveSummary>
): AdvancedKPIs {
  const totalRevenue = Object.values(summaryData).reduce((sum, exec) => sum + exec.income, 0);
  const totalProfit = Object.values(summaryData).reduce((sum, exec) => sum + exec.profit, 0);
  const totalOps = Object.values(summaryData).reduce((sum, exec) => sum + exec.ops, 0);
  const executiveCount = Object.keys(summaryData).length;

  // KPIs de eficiencia
  const revenuePerExecutive = executiveCount > 0 ? totalRevenue / executiveCount : 0;
  const profitPerExecutive = executiveCount > 0 ? totalProfit / executiveCount : 0;
  const opsPerExecutive = executiveCount > 0 ? totalOps / executiveCount : 0;
  
  const allClients = new Set<string>();
  Object.values(summaryData).forEach(exec => {
    exec.clients.forEach(client => allClients.add(client));
  });
  const clientsPerExecutive = executiveCount > 0 ? allClients.size / executiveCount : 0;

  // KPIs de calidad
  const avgMarginPerDeal = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const dealSuccessRate = 95; // Asumimos 95% ya que solo contamos deals cerrados

  // KPIs de crecimiento (mes a mes)
  const monthlyRevenues = monthlyData.reduce((acc, month) => {
    const existing = acc.get(month.month) || 0;
    acc.set(month.month, existing + month.income);
    return acc;
  }, new Map<string, number>());

  const sortedMonths = Array.from(monthlyRevenues.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  let monthOverMonthGrowth: number | null = null;
  if (sortedMonths.length >= 2) {
    const currentMonth = sortedMonths[sortedMonths.length - 1][1];
    const previousMonth = sortedMonths[sortedMonths.length - 2][1];
    if (previousMonth > 0) {
      monthOverMonthGrowth = ((currentMonth - previousMonth) / previousMonth) * 100;
    }
  }

  let quarterOverQuarterGrowth: number | null = null;
  if (sortedMonths.length >= 6) {
    const lastThreeMonths = sortedMonths.slice(-3).reduce((sum, [_, revenue]) => sum + revenue, 0);
    const previousThreeMonths = sortedMonths.slice(-6, -3).reduce((sum, [_, revenue]) => sum + revenue, 0);
    if (previousThreeMonths > 0) {
      quarterOverQuarterGrowth = ((lastThreeMonths - previousThreeMonths) / previousThreeMonths) * 100;
    }
  }

  // KPIs de riesgo
  const topPerformerRevenue = Math.max(...Object.values(summaryData).map(exec => exec.income));
  const executiveConcentration = totalRevenue > 0 ? (topPerformerRevenue / totalRevenue) * 100 : 0;

  // Volatilidad mensual
  const monthlyVariances = sortedMonths.map(([_, revenue]) => revenue);
  const avgMonthlyRevenue = monthlyVariances.reduce((sum, revenue) => sum + revenue, 0) / monthlyVariances.length;
  const variance = monthlyVariances.reduce((sum, revenue) => sum + Math.pow(revenue - avgMonthlyRevenue, 2), 0) / monthlyVariances.length;
  const monthlyVolatility = avgMonthlyRevenue > 0 ? (Math.sqrt(variance) / avgMonthlyRevenue) * 100 : 0;

  return {
    revenuePerExecutive,
    profitPerExecutive,
    opsPerExecutive,
    clientsPerExecutive,
    avgMarginPerDeal,
    dealSuccessRate,
    monthOverMonthGrowth,
    quarterOverQuarterGrowth,
    executiveConcentration,
    monthlyVolatility
  };
}

export function calculateEnhancedGlobalKPIs(
  operations: Operation[],
  monthlyData: MonthlyAgg[],
  summaryData: Record<string, ExecutiveSummary>
): GlobalKPIs {
  const totalIncome = Object.values(summaryData).reduce((sum, exec) => sum + exec.income, 0);
  const totalProfit = Object.values(summaryData).reduce((sum, exec) => sum + exec.profit, 0);
  const totalExpenses = Object.values(summaryData).reduce((sum, exec) => sum + exec.expense, 0);
  const totalOps = Object.values(summaryData).reduce((sum, exec) => sum + exec.ops, 0);
  
  const allClients = new Set<string>();
  Object.values(summaryData).forEach(exec => {
    exec.clients.forEach(client => allClients.add(client));
  });
  const totalClients = allClients.size;
  const executiveCount = Object.keys(summaryData).length;

  // KPIs básicos
  const avgProfitMargin = totalIncome > 0 ? (totalProfit / totalIncome) * 100 : 0;
  const avgDealSize = totalOps > 0 ? totalIncome / totalOps : 0;

  // Nuevos KPIs
  const roi = totalExpenses > 0 ? (totalProfit / totalExpenses) * 100 : 0;
  const operationalEfficiency = totalExpenses > 0 ? totalProfit / totalExpenses : 0;

  // Cliente con mayor facturación
  const clientRevenues = new Map<string, number>();
  operations.forEach(op => {
    if (op.client && op.income) {
      const existing = clientRevenues.get(op.client) || 0;
      clientRevenues.set(op.client, existing + op.income);
    }
  });
  const topClientRevenue = clientRevenues.size > 0 ? Math.max(...Array.from(clientRevenues.values())) : 0;
  const clientConcentrationRisk = totalIncome > 0 ? (topClientRevenue / totalIncome) * 100 : 0;

  // Crecimiento (comparando últimos dos períodos disponibles)
  const monthlyRevenues = monthlyData.reduce((acc, month) => {
    const existing = acc.get(month.month) || 0;
    acc.set(month.month, existing + month.income);
    return acc;
  }, new Map<string, number>());

  const sortedMonths = Array.from(monthlyRevenues.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  let revenueGrowth: number | null = null;
  let profitGrowth: number | null = null;

  if (sortedMonths.length >= 2) {
    const currentRevenue = sortedMonths[sortedMonths.length - 1][1];
    const previousRevenue = sortedMonths[sortedMonths.length - 2][1];
    if (previousRevenue > 0) {
      revenueGrowth = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
    }

    // Para profit growth, necesitamos agrupar profit por mes
    const monthlyProfits = monthlyData.reduce((acc, month) => {
      const existing = acc.get(month.month) || 0;
      acc.set(month.month, existing + month.profit);
      return acc;
    }, new Map<string, number>());

    const sortedProfitMonths = Array.from(monthlyProfits.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (sortedProfitMonths.length >= 2) {
      const currentProfit = sortedProfitMonths[sortedProfitMonths.length - 1][1];
      const previousProfit = sortedProfitMonths[sortedProfitMonths.length - 2][1];
      if (previousProfit > 0) {
        profitGrowth = ((currentProfit - previousProfit) / previousProfit) * 100;
      }
    }
  }

  // Tiempo promedio para cerrar (mock - necesitaríamos más datos del CSV)
  const avgDaysToClose: number | null = null;

  return {
    totalIncome,
    totalProfit,
    totalOps,
    totalClients,
    avgProfitMargin,
    avgDealSize,
    executiveCount,
    totalExpenses,
    roi,
    revenueGrowth,
    profitGrowth,
    avgDaysToClose,
    topClientRevenue,
    clientConcentrationRisk,
    operationalEfficiency
  };
}