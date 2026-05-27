// src/components/TrendIndicator.tsx
import React from 'react';
import { TrendingUp, TrendingDown } from "lucide-react";

interface TrendIndicatorProps {
  trend: string;
  profitPctChange: number | null;
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({ trend, profitPctChange }) => {
  if (trend === 'new') return <span className="badge bg-info">Nuevo</span>;
  if (trend === 'stable') return <span className="badge bg-secondary">Estable</span>;
  if (trend === 'up') return (
    <span className="badge bg-success">
      <TrendingUp size={12} className="me-1" />
      +{profitPctChange?.toFixed(1)}%
    </span>
  );
  if (trend === 'down') return (
    <span className="badge bg-danger">
      <TrendingDown size={12} className="me-1" />
      {profitPctChange?.toFixed(1)}%
    </span>
  );
  return null;
};