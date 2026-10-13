const http = require('http');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function request(options, postData = null, rawHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ ...options, headers: { ...options.headers, ...rawHeaders } }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('NEXUS-CFR 100 MB UPLOAD LIMIT VALIDATION TEST');
  console.log('====================================================\n');

  // STEP 1: AUTHENTICATE AS SME ADMIN
  console.log('--- 1. Authenticating as SME Admin ---');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'demo@nexuscfr.in', password: 'demo1234' });

  if (loginRes.status !== 200 || !loginRes.body?.data?.token) {
    throw new Error(`Login failed with status ${loginRes.status}: ${loginRes.raw}`);
  }
  const token = loginRes.body.data.token;
  console.log(`✓ Authenticated: ${loginRes.body.data.user.email} (Org: ${loginRes.body.data.user.organizationName})`);

  // STEP 2: TEST OVERSIZED FILE REJECTION (> 100 MB)
  console.log('\n--- 2. Testing Intentionally Oversized File (> 100 MB) ---');
  const oversizedBytes = 101 * 1024 * 1024; // 101 MB = 105,906,176 bytes
  
  // Test A: Declared metadata file size exceeding 100 MB (101 MB)
  const oversizedBodyRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/upload/validate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    fileSize: oversizedBytes,
    rows: [{ transaction_id: 'TXN-1', sme_id: 'SME-1', buyer_id: 'BUYER-1', invoice_amount: 1000 }],
  });

  console.log(`✓ Oversized declared fileSize rejection: Status=${oversizedBodyRes.status}`);
  console.log(`  Response message: "${oversizedBodyRes.body?.error?.message}"`);
  if (oversizedBodyRes.status !== 413) {
    throw new Error(`Expected HTTP 413 for oversized fileSize, got ${oversizedBodyRes.status}`);
  }
  if (oversizedBodyRes.body?.error?.message !== 'File is too large. Maximum supported size is 100 MB.') {
    throw new Error(`Unexpected error message: ${oversizedBodyRes.body?.error?.message}`);
  }

  // Test B: Also test on /api/upload/import with oversized declared size
  const oversizedImportRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/upload/import',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    fileSize: oversizedBytes,
    transactions: [{ transaction_id: 'TXN-1', sme_id: 'SME-1', buyer_id: 'BUYER-1', invoice_amount: 1000 }],
  });

  console.log(`✓ Oversized import fileSize rejection: Status=${oversizedImportRes.status}`);
  console.log(`  Response message: "${oversizedImportRes.body?.error?.message}"`);
  if (oversizedImportRes.status !== 413) {
    throw new Error(`Expected HTTP 413 for oversized import, got ${oversizedImportRes.status}`);
  }
  if (oversizedImportRes.body?.error?.message !== 'File is too large. Maximum supported size is 100 MB.') {
    throw new Error(`Unexpected error message: ${oversizedImportRes.body?.error?.message}`);
  }

  // STEP 3: TEST LARGE VENDOR PAYMENTS CSV UPLOAD (UNDER 100 MB)
  console.log('\n--- 3. Testing Valid Large Vendor Payments Dataset (< 100 MB) ---');
  const fultonJsonPath = path.join(__dirname, '../server/data/acquisition/fulton_vendor_payments_raw.json');
  if (!fs.existsSync(fultonJsonPath)) {
    throw new Error(`Fulton dataset missing at ${fultonJsonPath}`);
  }

  const fultonRaw = JSON.parse(fs.readFileSync(fultonJsonPath, 'utf8'));
  console.log(`✓ Loaded Fulton dataset: ${fultonRaw.length} raw records (${(fs.statSync(fultonJsonPath).size / (1024 * 1024)).toFixed(2)} MB JSON)`);

  // Build a realistic large vendor invoice dataset from the real records
  const runId = Date.now().toString().slice(-6);
  const sampleCount = Math.min(500, fultonRaw.length);
  const largeCsvRows = [];
  for (let i = 0; i < sampleCount; i++) {
    const item = fultonRaw[i];
    const isPaid = item.check_status === 'Paid';
    largeCsvRows.push({
      transaction_id: `FULTON-${runId}-${item.check_no || (i + 1000)}-${i}`,
      sme_id: item.vendor_legal_name || 'FULTON_VENDOR_LLC',
      buyer_id: item.department_name ? `Fulton_${item.department_name.replace(/[^a-zA-Z0-9]/g, '_')}` : 'Fulton_County_Gov',
      invoice_amount: parseFloat(item.amount) > 0 ? parseFloat(item.amount) : 50000,
      outstanding_amount: isPaid ? 0 : (parseFloat(item.amount) || 50000),
      invoice_date: item.disb_date ? item.disb_date.slice(0, 10) : '2026-04-10',
      due_date: '2026-05-10',
      payment_date: isPaid ? (item.check_clearance_or_cancel_date ? item.check_clearance_or_cancel_date.slice(0, 10) : '2026-05-08') : null,
      payment_status: isPaid ? 'PAID' : 'PENDING',
    });
  }

  console.log(`✓ Prepared ${largeCsvRows.length} canonical vendor payment records`);

  // 3A: Validate Dataset via API
  const validateRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/upload/validate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    fileSize: 15 * 1024 * 1024, // 15 MB file size
    rows: largeCsvRows,
    mapping: {},
  });

  console.log(`✓ Validation executed: Status=${validateRes.status}`);
  if (validateRes.status !== 200 || !validateRes.body.success) {
    throw new Error(`Validation failed: ${validateRes.raw}`);
  }
  const scorecard = validateRes.body.data.scorecard;
  console.log(`  Quality Score: ${scorecard.overallQualityScore}/100 (Grade ${scorecard.qualityGrade})`);
  console.log(`  Accepted Records: ${scorecard.acceptedCount}/${scorecard.totalRecords}`);

  // 3B: Import Dataset via API (Preserving Provenance & ImportBatch)
  const originalFileName = 'Fulton_Vendor_Payments_2026_Q2.csv';
  const importRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/upload/import',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    transactions: largeCsvRows,
    fileSize: 15 * 1024 * 1024,
    sourceType: 'PRIMARY_TRANSACTION',
    sourceName: originalFileName,
    sourceOrg: 'Fulton County Vendor Division',
    datasetVersion: '2026.Q2',
  });

  console.log(`✓ Ingestion executed: Status=${importRes.status}`);
  if (importRes.status !== 201 || !importRes.body.success) {
    throw new Error(`Import failed: ${importRes.raw}`);
  }
  const batchId = importRes.body.data.batchId;
  const importedCount = importRes.body.data.imported;
  console.log(`  Imported: ${importedCount} records (Batch ID: ${batchId})`);

  // 3C: Verify ImportBatch preserves original file name & provenance
  const batchRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/upload/batches/${batchId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  console.log(`✓ Verified ImportBatch record: Status=${batchRes.status}`);
  if (batchRes.status !== 200 || !batchRes.body.data) {
    throw new Error(`Failed to fetch import batch ${batchId}`);
  }
  console.log(`  Source Name (Original File): "${batchRes.body.data.sourceName}"`);
  console.log(`  Status: ${batchRes.body.data.status}, Accepted: ${batchRes.body.data.acceptedCount}`);
  if (batchRes.body.data.sourceName !== originalFileName) {
    throw new Error(`Expected sourceName "${originalFileName}", got "${batchRes.body.data.sourceName}"`);
  }

  // STEP 4: TEST VALID XLSX WORKBOOK GENERATION & PARSING
  console.log('\n--- 4. Testing Valid XLSX Workbook Ingestion (< 100 MB) ---');
  const xlsxData = [
    ['transaction_id', 'sme_id', 'buyer_id', 'invoice_amount', 'outstanding_amount', 'invoice_date', 'due_date', 'payment_date', 'payment_status'],
    [`XLSX-${runId}-INV-001`, 'Precision Forge Pvt Ltd', 'Mahindra & Mahindra', 750000, 750000, '2026-06-01', '2026-07-01', '', 'OVERDUE'],
    [`XLSX-${runId}-INV-002`, 'Precision Forge Pvt Ltd', 'Ashok Leyland', 1200000, 0, '2026-06-15', '2026-07-15', '2026-07-10', 'PAID'],
    [`XLSX-${runId}-INV-003`, 'Precision Forge Pvt Ltd', 'Bharat Heavy Electricals', 450000, 450000, '2026-07-01', '2026-08-01', '', 'PENDING'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(xlsxData);
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`✓ Generated real in-memory XLSX workbook (${xlsxBuffer.length} bytes)`);

  // Read back using XLSX engine (same as frontend parseFile)
  const parsedWb = XLSX.read(xlsxBuffer, { type: 'buffer', cellDates: true });
  const parsedSheet = parsedWb.Sheets[parsedWb.SheetNames[0]];
  const parsedJson = XLSX.utils.sheet_to_json(parsedSheet, { header: 1, defval: '' });
  const xlsxHeaders = parsedJson[0];
  const xlsxRows = parsedJson.slice(1).map(rowArr => {
    const obj = {};
    xlsxHeaders.forEach((h, i) => { obj[h] = String(rowArr[i] ?? ''); });
    return obj;
  });

  console.log(`✓ Parsed XLSX workbook: ${xlsxHeaders.length} headers, ${xlsxRows.length} rows`);

  const xlsxImportRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/upload/import',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  }, {
    transactions: xlsxRows,
    fileSize: xlsxBuffer.length,
    sourceType: 'PRIMARY_TRANSACTION',
    sourceName: 'Precision_Forge_Invoices_Q2.xlsx',
    sourceOrg: 'Precision Forge Pvt Ltd',
  });

  console.log(`✓ XLSX Ingestion executed: Status=${xlsxImportRes.status}, Imported=${xlsxImportRes.body.data?.imported}`);
  if (xlsxImportRes.status !== 201 || xlsxImportRes.body.data?.imported !== 3) {
    throw new Error(`XLSX import failed: ${xlsxImportRes.raw}`);
  }

  console.log('\n====================================================');
  console.log('ALL 100 MB UPLOAD LIMIT TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
