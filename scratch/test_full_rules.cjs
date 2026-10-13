const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Register ts-node
const tsNode = require(path.join(__dirname, '../server/node_modules/ts-node'));
tsNode.register({
  transpileOnly: true,
  project: path.join(__dirname, '../server/tsconfig.json')
});

const { DataCleaner } = require('../server/src/pipeline/dataCleaner');
const { BusinessValidator } = require('../server/src/pipeline/businessValidator');
const { DuplicateDetector } = require('../server/src/pipeline/duplicateDetector');
const { QualityAnalyzer } = require('../server/src/pipeline/qualityAnalyzer');

async function testFullRules() {
  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';
  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  const rawRows = [];

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
      const row = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = (parts[i] || '').trim();
      }
      rawRows.push(row);
    }
  }

  console.log(`Read ${rawRows.length} rows.`);

  const mapping = {
    'transaction_id': 'Vendor Invoice Number',
    'supplier_id': 'Vendor Code',
    'supplier_name': 'Vendor Legal Name',
    'buyer_id': 'Department Code',
    'buyer_name': 'Department Name',
    'invoice_amount': 'Amount',
    'invoice_date': 'Vendor Invoice Date',
    'payment_date': 'Disbursement Date',
    'payment_status': 'Check Status',
    'document_id': 'Check Number'
  };

  const cleanedRows = rawRows.map(r => DataCleaner.cleanRow(r, mapping));
  const valResults = BusinessValidator.validateRows(cleanedRows);

  const errorRuleCounts = {};
  let totalInvalidRows = 0;

  for (const v of valResults) {
    if (!v.isValid) {
      totalInvalidRows++;
      for (const e of v.errors) {
        errorRuleCounts[e.rule] = (errorRuleCounts[e.rule] || 0) + 1;
      }
    }
  }

  console.log(`Business Validation Results:`);
  console.log(`Total rows: ${rawRows.length}`);
  console.log(`Valid rows before duplicate check: ${rawRows.length - totalInvalidRows}`);
  console.log(`Invalid rows before duplicate check: ${totalInvalidRows}`);
  console.log(`Error rule counts:`, errorRuleCounts);

  // Now check duplicates intra-batch
  const seenTxnIds = new Map();
  let exactDupCount = 0;
  let exactDupOnValidRow = 0;
  let exactDupOnInvalidRow = 0;

  for (let i = 0; i < cleanedRows.length; i++) {
    const r = cleanedRows[i];
    const isValid = valResults[i].isValid;
    if (r.transactionId) {
      if (seenTxnIds.has(r.transactionId)) {
        exactDupCount++;
        if (isValid) exactDupOnValidRow++;
        else exactDupOnInvalidRow++;
      } else {
        seenTxnIds.set(r.transactionId, i);
      }
    }
  }

  console.log(`Duplicate Analysis:`);
  console.log(`Exact duplicates total: ${exactDupCount}`);
  console.log(`Exact duplicates on valid rows: ${exactDupOnValidRow}`);
  console.log(`Exact duplicates on invalid rows: ${exactDupOnInvalidRow}`);
  console.log(`Net accepted rows (valid && !exactDuplicate): ${(rawRows.length - totalInvalidRows) - exactDupOnValidRow}`);
}

testFullRules();
