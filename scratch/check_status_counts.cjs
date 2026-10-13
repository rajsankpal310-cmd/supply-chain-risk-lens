const fs = require('fs');
const readline = require('readline');

async function checkStatuses() {
  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';
  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  const statusCounts = {};

  function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) { result.push(cur); cur = ''; }
      else { cur += char; }
    }
    result.push(cur);
    return result;
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line).map(h => h.trim());
    } else {
      const parts = parseCsvLine(line);
      const statusIdx = headers.indexOf('Check Status');
      const status = (parts[statusIdx] || '').trim();
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  }

  console.log('Status counts in CSV:', statusCounts);
}

checkStatuses();
