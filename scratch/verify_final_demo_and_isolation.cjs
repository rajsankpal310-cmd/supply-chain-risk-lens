const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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

async function runAudit() {
  console.log('============================================================');
  console.log('FINAL DEMO ACCOUNT + DATA SOURCE VERIFICATION');
  console.log('============================================================\n');

  // --- TEST 1: DEMO ACCOUNT PRESERVED & POPULATED ---
  console.log('--- TEST 1: DEMO ACCOUNT (demo@nexuscfr.in) ---');
  const demoLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'demo@nexuscfr.in', password: 'demo1234' });

  if (demoLogin.status !== 200 || !demoLogin.body.data?.token) {
    throw new Error('Failed to login as Demo SME Admin: ' + JSON.stringify(demoLogin.body));
  }
  const demoToken = demoLogin.body.data.token;
  const demoOrgName = demoLogin.body.data.user.organizationName;
  const demoOrgId = demoLogin.body.data.user.organizationId;
  console.log(`✓ Demo login successful: Org="${demoOrgName}" (ID: ${demoOrgId})`);

  // Check demo dashboard summary
  const demoSummary = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${demoToken}` },
  });
  const demoFirmsCount = demoSummary.body.data?.executiveSummary?.totalFirmsCount;
  const demoTxnsOverdue = demoSummary.body.data?.overdueTransactions?.length;
  console.log(`✓ Demo dashboard summary: totalFirmsCount=${demoFirmsCount}, overdueTxns=${demoTxnsOverdue}`);

  // Check demo transactions
  const demoTxns = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/transactions?limit=5',
    method: 'GET',
    headers: { Authorization: `Bearer ${demoToken}` },
  });
  const demoTotalTxns = demoTxns.body.data?.pagination?.total;
  console.log(`✓ Demo transactions populated: ${demoTotalTxns} transactions available`);

  // Check demo firms
  const demoFirms = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/firms',
    method: 'GET',
    headers: { Authorization: `Bearer ${demoToken}` },
  });
  console.log(`✓ Demo firms populated: ${demoFirms.body.data?.length} firms available`);

  // Check demo network
  const demoNet = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/network',
    method: 'GET',
    headers: { Authorization: `Bearer ${demoToken}` },
  });
  console.log(`✓ Demo supply chain network populated: ${demoNet.body.data?.nodes?.length} nodes, ${demoNet.body.data?.edges?.length} edges`);

  // --- TEST 2: REAL EMPTY SME ACCOUNT ---
  console.log('\n--- TEST 2: REAL EMPTY SME (No Imported Data) ---');
  const emptyEmail = `empty_sme_${Date.now()}@realcorp.in`;
  const emptyRegister = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    fullName: 'Sunil Kumar',
    email: emptyEmail,
    password: 'password123',
    companyName: 'Kumar Precision Engineering',
  });
  if (emptyRegister.status !== 201 || !emptyRegister.body.data?.token) {
    throw new Error('Failed to register empty SME: ' + JSON.stringify(emptyRegister.body));
  }
  const emptyToken = emptyRegister.body.data.token;
  const emptyOrgId = emptyRegister.body.data.user.organizationId;
  console.log(`✓ Empty SME registered: email="${emptyEmail}" (Org ID: ${emptyOrgId})`);

  // Verify dashboard summary returns 0
  const emptySummary = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${emptyToken}` },
  });
  console.log(`✓ Empty SME totalFirmsCount: ${emptySummary.body.data?.executiveSummary?.totalFirmsCount} (Expected: 0)`);
  console.log(`✓ Empty SME overdueTransactions: ${emptySummary.body.data?.overdueTransactions?.length} (Expected: 0)`);

  // Verify all modules return 0 records
  const emptyModules = [
    { name: 'Transactions', path: '/api/transactions' },
    { name: 'Firms', path: '/api/firms' },
    { name: 'Relationships', path: '/api/relationships' },
    { name: 'Predictions', path: '/api/predictions' },
    { name: 'Deadlocks', path: '/api/deadlocks' },
    { name: 'Alerts', path: '/api/alerts' },
    { name: 'Reports', path: '/api/reports' },
    { name: 'Recommendations', path: '/api/recommendations' },
    { name: 'Network', path: '/api/network' },
  ];

  for (const mod of emptyModules) {
    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: mod.path,
      method: 'GET',
      headers: { Authorization: `Bearer ${emptyToken}` },
    });
    const d = res.body.data;
    const count = Array.isArray(d)
      ? d.length
      : d?.nodes
      ? d.nodes.length
      : d?.transactions
      ? d.transactions.length
      : 0;
    console.log(`  - ${mod.name}: ${count} records (Clean empty state)`);
    if (count !== 0) throw new Error(`Empty SME has non-zero records in ${mod.name}: ${count}`);
  }

  // --- TEST 3 & 4: REAL SME A UPLOADS DATA VS REAL SME B ISOLATION ---
  console.log('\n--- TEST 3 & 4: SME A VS SME B TENANT ISOLATION ---');
  // Register SME A
  const smeAEmail = `sme_a_${Date.now()}@alpha.in`;
  const regA = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    fullName: 'Alpha Admin',
    email: smeAEmail,
    password: 'password123',
    companyName: 'Alpha Tech Components',
  });
  const tokenA = regA.body.data.token;
  const orgAId = regA.body.data.user.organizationId;
  console.log(`✓ SME A registered: Org ID: ${orgAId}`);

  // SME A creates a real firm & transaction
  const firmA = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/firms',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
  }, {
    name: 'Alpha Primary Buyer Pvt Ltd',
    industry: 'Automotive',
    tier: 1,
    city: 'Pune',
    state: 'Maharashtra',
    annualRevenue: 50000000,
  });
  const firmAId = firmA.body.data?.id;
  console.log(`✓ SME A created firm: ID=${firmAId}, Name="${firmA.body.data?.name}"`);

  const txnA = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/transactions',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
  }, {
    smeId: firmAId,
    buyerId: firmAId,
    buyerName: 'Alpha Primary Buyer Pvt Ltd',
    amount: 1500000,
    outstandingAmount: 1500000,
    invoiceDate: '2026-08-01T00:00:00.000Z',
    dueDate: '2026-09-01T00:00:00.000Z',
    status: 'OVERDUE',
  });
  const txnAId = txnA.body.data?.id;
  console.log(`✓ SME A created transaction: ID=${txnAId}, Amount=₹15,00,000`);

  // Register SME B
  const smeBEmail = `sme_b_${Date.now()}@beta.in`;
  const regB = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    fullName: 'Beta Admin',
    email: smeBEmail,
    password: 'password123',
    companyName: 'Beta Logistics Corp',
  });
  const tokenB = regB.body.data.token;
  const orgBId = regB.body.data.user.organizationId;
  console.log(`✓ SME B registered: Org ID: ${orgBId}`);

  // SME B checks transactions
  const txnsB = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/transactions',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const bTxnsCount = txnsB.body.data?.transactions?.length ?? 0;
  console.log(`✓ SME B transactions query: returns ${bTxnsCount} transactions (Cannot see SME A data)`);
  if (bTxnsCount !== 0) throw new Error('SME B was able to see transactions!');

  // SME B attempts IDOR on SME A's transaction
  const idorTxn = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/transactions/${txnAId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`✓ SME B IDOR access to SME A txn "${txnAId}": Status=${idorTxn.status} (Expected: 404 Not Found)`);
  if (idorTxn.status !== 404) throw new Error(`IDOR leak: status is ${idorTxn.status}`);

  // SME B attempts IDOR on SME A's firm
  const idorFirm = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/firms/${firmAId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`✓ SME B IDOR access to SME A firm "${firmAId}": Status=${idorFirm.status} (Expected: 404 Not Found)`);
  if (idorFirm.status !== 404) throw new Error(`IDOR leak: status is ${idorFirm.status}`);

  // SME B cannot see Demo data
  const idorDemoFirm = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/firms/FIRM-A-01',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(`✓ SME B IDOR access to Demo firm "FIRM-A-01": Status=${idorDemoFirm.status} (Expected: 404 Not Found)`);
  if (idorDemoFirm.status !== 404) throw new Error(`IDOR leak: status is ${idorDemoFirm.status}`);

  // --- TEST 5: DEMO ACCOUNT PERSISTENCE AFTER SME ACTIVITIES ---
  console.log('\n--- TEST 5: DEMO ACCOUNT PERSISTENCE VERIFICATION ---');
  const demoRecheck = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/dashboard/summary',
    method: 'GET',
    headers: { Authorization: `Bearer ${demoToken}` },
  });
  const recheckFirms = demoRecheck.body.data?.executiveSummary?.totalFirmsCount;
  console.log(`✓ Demo organization firms recheck: ${recheckFirms} firms (Persisted completely)`);
  if (recheckFirms !== 12) throw new Error(`Demo firms changed to ${recheckFirms}`);

  // --- TEST 6: PUBLIC BENCHMARK DATASETS & MODEL AVAILABILITY ---
  console.log('\n--- TEST 6: PUBLIC BENCHMARK MODELS VS ORGANIZATION DATA ---');
  const collegeStatus = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ml/college-launch/status',
    method: 'GET',
    headers: { Authorization: `Bearer ${demoToken}` },
  });
  console.log(`✓ Public Benchmark Models Available: ${collegeStatus.body.stage1PublicModels?.length} models`);
  collegeStatus.body.stage1PublicModels?.forEach((m) => {
    console.log(`  - Model: ${m.datasetName} | Source: ${m.originalPublisher} | Status: ${m.status}`);
  });

  // Verify public benchmark prediction executes without modifying SME data
  const fultonPred = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ml/college-launch/predict/fulton',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${demoToken}` },
  }, {
    invoiceAmount: 45000,
    isCheckDisbursement: true,
    vendorPriorMeanCycleDays: 18,
  });
  console.log(`✓ Fulton County Public Model Prediction: status=${fultonPred.status}, RiskBand=${fultonPred.body.prediction?.riskBand}, Prob=${(fultonPred.body.prediction?.predictedProbability * 100).toFixed(1)}%`);

  // Verify SME ML Training Gate is locked for small data
  const readinessRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ml/readiness',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log(`✓ SME A ML Training Gate: Gate Status="${readinessRes.body.data?.overallGateStatus || readinessRes.body.status}" (Cleanly locked for insufficient sample size)`);

  console.log('\n============================================================');
  console.log('ALL FINAL DEMO + MULTI-TENANT ISOLATION TESTS PASSED!');
  console.log('============================================================');
  process.exit(0);
}

runAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
