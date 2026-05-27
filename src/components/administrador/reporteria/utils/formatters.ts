// src/utils/formatters.ts
export function formatMoney(n?: number | null) {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat('es-CL', { 
    style: 'currency', 
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(n);
}

export function formatPct(n?: number | null) {
  if (n === undefined || n === null) return "—";
  return `${n.toFixed(1)}%`;
}

export function truncateText(text: string | null | undefined, maxLength: number = 20): string {
  if (!text || typeof text !== 'string') return 'N/A';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

export function getFirstWord(text: string | null | undefined): string {
  if (!text || typeof text !== 'string') return 'N/A';
  const words = text.trim().split(/\s+/);
  return words[0] || 'N/A';
}