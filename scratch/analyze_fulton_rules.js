const fs = require('fs');
const readline = require('readline');
const { DataCleaner } = require('../server/dist/pipeline/dataCleaner');
const { BusinessValidator } = require('../server/dist/pipeline/businessValidator');
const { DuplicateDetector } = require('../server/dist/pipeline/duplicateDetector');
const { QualityAnalyzer } = require('../server/dist/pipeline/qualityAnalyzer');

async function run() {
  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';
  const mapping = {
    transaction_id: 'Vendor Invoice Number',
    supplier_id: 'Vendor Code',
    supplier_name: 'Vendor Legal Name',
    buyer_id: 'Department Code',
    buyer_name: 'Department Name',
    invoice_amount: 'Amount',
    invoice_date: 'Vendor Invoice Date',
    payment_date: 'Disbursement Date',
    payment_status: 'Check Status',
    document_id: 'Check Number',
  };

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  function parseCsvLine(line) {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }

  let headers = null;
  const rows = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line).map(h => h.trim());
    } else {
      const parts = parseCsvLine(line);
      const row = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = (parts[i] || '').trim();
      }
      rows.push(row);
    }
  }

  console.log('Total raw rows parsed:', rows.length);

  const cleaned = rows.map(r => DataCleaner.cleanRow(r, mapping));
  console.log('Cleaned rows:', cleaned.length);

  const valResults = BusinessValidator.validateRows(cleaned);
  const validRows = valResults.filter(r => r.isValid);
  const invalidRows = valResults.filter(r => !r.isValid);
  console.log('Valid rows from BusinessValidator:', validRows.length);
  console.log('Invalid rows from BusinessValidator:', invalidRows.length);

  // Group invalid reasons
  const ruleCounts = {};
  for (const inv of invalidRows) {
    for (const err of inv.errors) {
      ruleCounts[err.rule] = (ruleCounts[err.rule] || 0) + 1;
    }
  }
  console.log('Invalid error rules count:', ruleCounts);

  // In-memory duplicate detector
  const seenTxnIds = new Set();
  let exactDupCount = 0;
  let exactDupOnValid = 0;
  let exactDupOnInvalid = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    const val = valResults[i];
    if (c.transactionId) {
      if (seenTxnIds.has(c.transactionId)) {
        exactDupCount++;
        if (val.isValid) {
          exactDupOnValid++;
        } else {
          exactDupOnInvalid++;
        }
      } else {
        seenTxnIds.add(c.transactionId);
      }
    }
  }

  console.log('Exact dup count total:', exactDupCount);
  console.log('Exact dup count on valid rows:', exactDupOnValid);
  console.log('Exact dup count on invalid rows:', exactDupOnInvalid);

  console.log('If accepted = validRows - exactDupOnValid:', validRows.length - exactDupOnValid);
  console.log('If rejected = invalidRows + exactDupOnValid:', invalidRows.length + exactDupOnValid);

  console.log('Notice: 228425 - exactDupCount =', 228425 - exactDupCount);
  console.log('Notice: validRows - total_dup =', validRows.length - exactDupCount);
}

run().catch(console.error);
