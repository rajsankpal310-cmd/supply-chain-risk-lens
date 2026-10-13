const fs = require('fs');
const readline = require('readline');

async function testDuplicates() {
  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';
  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  const seenTxnIds = new Map();
  let lineCount = 0;
  let dupCount = 0;

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
      lineCount++;
      const parts = parseCsvLine(line);
      const invoiceNumIdx = headers.indexOf('Vendor Invoice Number');
      const invoiceNum = (parts[invoiceNumIdx] || '').trim();
      if (invoiceNum) {
        if (seenTxnIds.has(invoiceNum)) {
          dupCount++;
          if (dupCount <= 5) {
            console.log(`Duplicate found: '${invoiceNum}' on line ${lineCount}, first seen on line ${seenTxnIds.get(invoiceNum)}`);
          }
        } else {
          seenTxnIds.set(invoiceNum, lineCount);
        }
      }
    }
  }

  console.log(`Total data rows: ${lineCount}`);
  console.log(`Unique Vendor Invoice Numbers: ${seenTxnIds.size}`);
  console.log(`Duplicate Vendor Invoice Numbers: ${dupCount}`);
}

testDuplicates();
