// Test the actual date parsing against real data from the sheets

const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  ene: 0, abr: 3, ago: 7, set: 8, dic: 11,
};

function parseValidityDate(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;

  const asNum = Number(str.replace(/[, ]/g, ''));
  if (!isNaN(asNum) && asNum > 40000 && asNum < 60000) {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + asNum * 86400000);
    if (!isNaN(d.getTime())) return d;
  }

  const clean = str
    .replace(/válido\s*hasta\s*/i, '')
    .replace(/valid\s*until\s*/i, '')
    .replace(/hasta\s*/i, '')
    .replace(/validez\s*:/i, '')
    .trim();

  const m1 = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    const d = new Date(+m1[3], +m1[2] - 1, +m1[1]);
    if (!isNaN(d.getTime())) return d;
  }

  const m2 = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    const d = new Date(+m2[1], +m2[2] - 1, +m2[3]);
    if (!isNaN(d.getTime())) return d;
  }

  const m3 = clean.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (m3) {
    const y = new Date().getFullYear();
    const d = new Date(y, +m3[2] - 1, +m3[1]);
    if (!isNaN(d.getTime())) {
      if (d.getTime() < Date.now() - 30 * 86400000) d.setFullYear(y + 1);
      return d;
    }
  }

  const m4 = clean.match(/^(\d{1,2})\s+([a-záéíóúüñ]{3,})\s*(\d{4})?$/i);
  if (m4) {
    const mon = MONTH_NAMES[m4[2].toLowerCase().slice(0, 3)];
    if (mon !== undefined) {
      const y = m4[3] ? +m4[3] : new Date().getFullYear();
      const d = new Date(y, mon, +m4[1]);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const m5 = clean.match(/^([a-záéíóúüñ]{3,})\s+(\d{1,2})[,\s]*(\d{4})?$/i);
  if (m5) {
    const mon = MONTH_NAMES[m5[1].toLowerCase().slice(0, 3)];
    if (mon !== undefined) {
      const y = m5[3] ? +m5[3] : new Date().getFullYear();
      const d = new Date(y, mon, +m5[2]);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const native = new Date(clean);
  if (!isNaN(native.getTime()) && native.getFullYear() > 2000 && native.getFullYear() < 2100) {
    return native;
  }

  return null;
}

function daysUntil(date) {
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const expMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((expMidnight.getTime() - todayMidnight.getTime()) / 86400000);
}

const testDates = [
  // AIR dates
  '30 abril', '20/04/2026', '30/04/2026', '2026-04-20', '2026-04-16', '20 abril', '2026-04-26',
  // LCL dates
  '14 abril',
  // FCL dates
  '10/04/2026', '12/04/2026', '21/04/2026', '22/04/2026', '25/04/2026', '28/04/2026', '05/05/2026',
  // Potential edge cases
  '20 de abril', '20 de abril de 2026', '21/04', '21-04-2026',
];

console.log(`Today: ${new Date().toISOString().split('T')[0]}\n`);
console.log('Date                     | Parsed           | DaysUntil | In 24hr | In 48hr');
console.log('-------------------------|------------------|-----------|---------|--------');

for (const raw of testDates) {
  const parsed = parseValidityDate(raw);
  if (!parsed) {
    console.log(`${raw.padEnd(25)}: PARSE FAILED`);
    continue;
  }
  const days = daysUntil(parsed);
  const in24 = days === 1 ? '✓' : '';
  const in48 = days === 2 ? '✓' : '';
  const parsedStr = parsed.toISOString().split('T')[0];
  console.log(`${raw.padEnd(25)}| ${parsedStr.padEnd(17)}| ${String(days).padEnd(10)}| ${in24.padEnd(8)}| ${in48}`);
}
