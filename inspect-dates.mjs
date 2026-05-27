function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = [];
    let field = '';
    let inQuotes = false;
    for (let j = 0; j < trimmed.length; j++) {
      const ch = trimmed[j];
      const next = trimmed[j + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') { field += '"'; j++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(field.trim()); field = '';
      } else {
        field += ch;
      }
    }
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

async function inspect(url, label, col) {
  const r = await fetch(url);
  const text = await r.text();
  const data = parseCSV(text);
  console.log(`\n=== ${label} (col ${col}) - ${data.length} rows ===`);
  data.slice(0, 5).forEach((row, i) => {
    console.log(`  row${i}: [${row[col] || ''}]  (${row.length} cols total)`);
  });
  const vals = [...new Set(data.slice(2).map(r => r[col]).filter(Boolean))];
  console.log(`Unique date values (${vals.length}):`, vals.slice(0, 30).join(' | '));
}

const AIR = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWBXW_l3kB2V0A9D732Le0AjyGnXDjgV8nasTz1Z3gWUbCklXKICxTE4kEMjYMoaTG4v78XB2aVrHe/pub?output=csv';
const LCL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQYi3-CA6itt2SBNYumE3fuxpE0SSAtMMPn7K2LaqRPmduRvU3hSu11Vznn8NtG2yuDriuuL2E8VvOG/pub?output=csv';
const FCL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSWzBbNU6lsWnVEhRgzTPNEjtq-eH59rGSQf3QS6UGiRHT98A-g3LumdtuFHKb5lcGmERT4nZjAbMhm/pub?output=csv';

Promise.all([
  inspect(AIR, 'AIR', 15),
  inspect(LCL, 'LCL', 10),
  inspect(FCL, 'FCL', 12),
]).catch(console.error);
