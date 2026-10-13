const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function run() {
  console.log('Loading pipeline and app modules directly...');
  // Register ts-node from server dependencies
  const tsNode = require('ts-node');
  tsNode.register({
    transpileOnly: true,
    project: path.join(__dirname, '../server/tsconfig.json')
  });

  const { PipelineOrchestrator } = require('./src/pipeline/pipelineOrchestrator');
  const app = require('./src/app').default;
  const request = require('supertest');

  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';
  console.log(`Checking CSV: ${csvPath}`);
  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  const allRows = [];

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
      allRows.push(row);
    }
  }

  console.log(`Loaded ${allRows.length} CSV rows successfully.`);

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

  // Login via supertest
  console.log('Logging in via supertest...');
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'demo@nexuscfr.in', password: 'demo1234' });
  
  if (loginRes.status !== 200) {
    throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
  }
  const token = loginRes.body.data.token;
  console.log('Login successful.');

  async function testDataset(name, count) {
    console.log(`\n========================================`);
    console.log(`Running ${name}: ${count} rows`);
    const rows = count === allRows.length ? allRows : allRows.slice(0, count);
    const start = Date.now();

    const res = await request(app)
      .post('/api/upload/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows, mapping });

    const elapsed = Date.now() - start;
    console.log(`HTTP Status: ${res.status} (${elapsed}ms)`);
    if (res.status === 200) {
      const scorecard = res.body.data.scorecard;
      console.log(`SUCCESS! Total: ${scorecard.totalRecords}, Accepted: ${scorecard.acceptedCount}, Rejected: ${scorecard.rejectedCount}, Score: ${scorecard.overallQualityScore}`);
      console.log(`Returned rowResults length: ${res.body.data.rowResults?.length}`);
    } else {
      console.error(`FAILED! Status: ${res.status}`);
      console.error('Error body:', JSON.stringify(res.body, null, 2));
    }
    return res.status === 200;
  }

  console.log('Executing test suite...');
  const ok100 = await testDataset('Test A (100 rows)', 100);
  if (!ok100) process.exit(1);

  const ok5k = await testDataset('Test B (5,000 rows)', 5000);
  if (!ok5k) process.exit(1);

  const ok50k = await testDataset('Test C (50,000 rows)', 50000);
  if (!ok50k) process.exit(1);

  const okAll = await testDataset('Test D (Full 228,425 rows)', allRows.length);
  if (!okAll) process.exit(1);

  console.log('\n>>> ALL DATASET TESTS (A, B, C, D) PASSED SUCCESSFULLY! <<<');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
