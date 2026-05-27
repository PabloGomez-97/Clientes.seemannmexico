// src/components/administrador/reporteria/context/ReporteriaDataContext.tsx
import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Operation, MonthlyAgg, WeeklyAgg, ExecutiveSummary } from '../utils/types';
import { aggregateMonthly, aggregateWeekly } from '../utils/dataProcessing';
import { calculateEnhancedGlobalKPIs, calculateAdvancedKPIs } from '../utils/advancedKPIs';

interface DataContextType {
  // Data
  operations: Operation[] | null;
  setOperations: (ops: Operation[] | null) => void;
  
  // Computed data
  monthly: MonthlyAgg[];
  weekly: WeeklyAgg[];
  summaryData: Record<string, ExecutiveSummary> | null;
  
  // Filters
  selectedExecutive: string;
  setSelectedExecutive: (exec: string) => void;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  
  // Options
  availableMonths: string[];
  executiveOptions: string[];
  
  // KPIs
  globalKPIs: any;
  advancedKPIs: any;
  topPerformers: any[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const ReporteriaDataProvider: React.FC<{ 
  children: ReactNode;
  operations: Operation[] | null;
  setOperations: (ops: Operation[] | null) => void;
}> = ({ children, operations, setOperations }) => {
  const [selectedExecutive, setSelectedExecutive] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Computed data
  const monthly = useMemo(() => (operations ? aggregateMonthly(operations) : []), [operations]);
  const weekly = useMemo(() => (operations ? aggregateWeekly(operations) : []), [operations]);
  
  const availableMonths = useMemo(() => {
    if (!monthly) return [];
    return Array.from(new Set(monthly.map(m => m.month))).sort();
  }, [monthly]);

  const executiveOptions = useMemo(() => {
    if (!operations) return [];
    return Array.from(new Set(operations.map(op => op.executive).filter(exec => exec && exec.trim())));
  }, [operations]);

  const summaryData = useMemo(() => {
    if (!monthly) return null;

    let filteredMonthlyData = monthly;

    if (selectedMonth !== "all") {
      filteredMonthlyData = filteredMonthlyData.filter(m => m.month === selectedMonth);
    }

    if (selectedExecutive !== "all") {
      filteredMonthlyData = filteredMonthlyData.filter(m => m.executive === selectedExecutive);
    }

    const byExec: Record<string, ExecutiveSummary> = {};
    
    for (const monthData of filteredMonthlyData) {
      if (!byExec[monthData.executive]) {
        byExec[monthData.executive] = { ops: 0, income: 0, expense: 0, profit: 0, commission: 0, clients: new Set() };
      }
      byExec[monthData.executive].ops += monthData.ops;
      byExec[monthData.executive].income += monthData.income;
      byExec[monthData.executive].expense += monthData.expense;
      byExec[monthData.executive].profit += monthData.profit;
      byExec[monthData.executive].clients = new Set([...byExec[monthData.executive].clients, ...Array.from(monthData.clients || [])]);
    }

    return byExec;
  }, [monthly, selectedMonth, selectedExecutive]);

  const globalKPIs = useMemo(() => {
    if (!summaryData || !operations || !monthly) return null;
    return calculateEnhancedGlobalKPIs(operations, monthly, summaryData);
  }, [summaryData, operations, monthly]);

  const advancedKPIs = useMemo(() => {
    if (!summaryData || !operations || !monthly) return null;
    return calculateAdvancedKPIs(operations, monthly, summaryData);
  }, [summaryData, operations, monthly]);

  const topPerformers = useMemo(() => {
    if (!summaryData || Object.keys(summaryData).length === 0) return [];
    return Object.entries(summaryData)
      .map(([exec, data]) => ({
        executive: exec || 'Sin nombre',
        profit: data.profit || 0,
        profitMargin: data.income > 0 ? (data.profit / data.income) * 100 : 0,
        income: data.income || 0,
        ops: data.ops || 0
      }))
      .filter(performer => performer.executive && performer.executive !== 'Sin nombre')
      .sort((a, b) => b.profit - a.profit);
  }, [summaryData]);

  const value = {
    operations,
    setOperations,
    monthly,
    weekly,
    summaryData,
    selectedExecutive,
    setSelectedExecutive,
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    executiveOptions,
    globalKPIs,
    advancedKPIs,
    topPerformers
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useReporteriaData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useReporteriaData must be used within a ReporteriaDataProvider');
  }
  return context;
};