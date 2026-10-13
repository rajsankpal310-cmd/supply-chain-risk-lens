const fs = require('fs');
const readline = require('readline');

async function main() {
  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';
  console.log(`Checking file: ${csvPath}`);
  if (!fs.existsSync(csvPath)) {
    console.error(`File does not exist: ${csvPath}`);
    process.exit(1);
  }

  const fileStat = fs.statSync(csvPath);
  console.log(`Raw CSV file size: ${(fileStat.size / (1024 * 1024)).toFixed(2)} MB (${fileStat.size} bytes)`);

  // 1. Login to get token
  console.log('Logging in to localhost:5000...');
  let token = '';
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@nexuscfr.in', password: 'demo1234' }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginData)}`);
    }
    token = loginData.data.token;
    console.log(`Logged in successfully. Org ID: ${loginData.data.user.organizationId}`);
  } catch (err) {
    console.error('Failed to connect to backend on port 5000:', err.message);
    process.exit(1);
  }

  // 2. Parse CSV rows
  console.log('Reading CSV rows...');
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
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = parseCsvLine(line).map(h => h.trim());
      console.log('Headers detected:', headers);
    } else {
      const parts = parseCsvLine(line);
      const row = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = (parts[i] || '').trim();
      }
      allRows.push(row);
    }
  }

  console.log(`Parsed total rows: ${allRows.length}`);

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

  async function testValidate(label, rowCount) {
    const rows = rowCount === allRows.length ? allRows : allRows.slice(0, rowCount);
    console.log(`\n========================================`);
    console.log(`Starting ${label}: ${rows.length} rows`);
    const payload = JSON.stringify({ rows, mapping });
    const payloadBytes = Buffer.byteLength(payload, 'utf8');
    const payloadMB = (payloadBytes / (1024 * 1024)).toFixed(2);
    console.log(`JSON Payload size: ${payloadMB} MB (${payloadBytes} bytes)`);

    const start = Date.now();
    try {
      const res = await fetch('http://localhost:5000/api/upload/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: payload
      });

      const elapsed = Date.now() - start;
      const status = res.status;
      const contentType = res.headers.get('content-type') || '';
      console.log(`HTTP Status: ${status} (${elapsed}ms)`);
      console.log(`Response Content-Type: ${contentType}`);

      let bodyText = await res.text();
      let bodyJson = null;
      try {
        bodyJson = JSON.parse(bodyText);
      } catch (e) {
        // Not JSON
      }

      if (res.ok) {
        console.log(`SUCCESS! Scorecard:`, bodyJson?.data?.scorecard ? {
          totalRecords: bodyJson.data.scorecard.totalRecords,
          acceptedCount: bodyJson.data.scorecard.acceptedCount,
          rejectedCount: bodyJson.data.scorecard.rejectedCount,
          qualityScore: bodyJson.data.scorecard.overallQualityScore
        } : 'No scorecard in data');
        console.log(`Response body length: ${(bodyText.length / (1024 * 1024)).toFixed(2)} MB`);
      } else {
        console.error(`FAILED! Status: ${status}`);
        console.error(`Body preview (first 1000 chars):`, bodyText.slice(0, 1000));
      }
      return { success: res.ok, status, elapsed, payloadMB };
    } catch (err) {
      const elapsed = Date.now() - start;
      console.error(`NETWORK/FETCH ERROR after ${elapsed}ms:`, err.message);
      if (err.cause) {
        console.error(`Error cause:`, err.cause);
      }
      return { success: false, error: err.message, elapsed, payloadMB };
    }
  }

  // Run Test A: 100 rows
  await testValidate('Test A (100 rows)', 100);

  // Run Test B: 5,000 rows
  await testValidate('Test B (5,000 rows)', 5000);

  // Run Test C: 50,000 rows
  await testValidate('Test C (50,000 rows)', 50000);

  // Run Test D: Full dataset (228,425 rows)
  await testValidate('Test D (Full 228,425 rows)', allRows.length);
}

main().catch(err => {
  console.error('Fatal error in diagnosis script:', err);
});
