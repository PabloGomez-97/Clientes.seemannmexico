// src/components/administrador/Facturaciones-Ejecutivos/types.ts
// Shared types for Executive Reporting

export interface QuoteStats {
  totalQuotes: number;
  completedQuotes: number;
  pendingQuotes: number;
  airQuotes: number;
  seaQuotes: number;
  truckQuotes: number;
  totalIncome: number;
  totalExpense: number;
  totalProfit: number;
  profitMargin: number;
  averagePerQuote: number;
  averageProfitPerQuote: number;
  completionRate: number;
  uniqueConsignees: number;
}

export interface ExecutiveComparison {
  nombre: string;
  stats: QuoteStats;
}
