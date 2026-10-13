const fs = require('fs');
const readline = require('readline');

async function checkRuleDifference() {
  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';
  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  let countIssuedNoDisbursement = 0;
  let countIssuedWithDisbursement = 0;
  let lineCount = 0;

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
      const statusIdx = headers.indexOf('Check Status');
      const disbIdx = headers.indexOf('Disbursement Date');
      const status = (parts[statusIdx] || '').trim().toUpperCase();
      const disb = (parts[disbIdx] || '').trim();

      if (status.includes('ISSUE')) {
        if (!disb) {
          countIssuedNoDisbursement++;
        } else {
          countIssuedWithDisbursement++;
        }
      }
    }
  }

  console.log(`Total rows: ${lineCount}`);
  console.log(`Check Status with 'ISSUE' and NO Disbursement Date: ${countIssuedNoDisbursement}`);
  console.log(`Check Status with 'ISSUE' and WITH Disbursement Date: ${countIssuedWithDisbursement}`);
}

checkRuleDifference();
