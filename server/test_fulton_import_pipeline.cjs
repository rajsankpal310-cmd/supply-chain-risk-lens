require('dotenv').config();
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { UploadService } = require('./dist/services/upload.service');
const { DashboardService } = require('./dist/services/dashboard.service');
const { TransactionService } = require('./dist/services/transaction.service');

async function run() {
  const orgId = '6ee28c8e-1f1c-4c4c-86a9-e45c2897993e'; // Raj's organization
  const userId = 'db2811b9-07eb-4ee5-a167-aa50ae63be68'; // Raj's userId
  const csvPath = 'C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv';

  console.log('--- Step 1: Parsing 228,425 rows from Fulton CSV ---');
  const startTime = Date.now();

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

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

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

  console.log(`Parsed ${rows.length} rows in ${(Date.now() - startTime) / 1000}s`);

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

  const metadata = {
    sourceType: 'GOVERNMENT_DISBURSEMENT',
    sourceName: 'Vendor_Payments_20261007.csv',
    sourceOrg: 'Fulton County Finance',
    license: 'Open Data',
    dataGranularity: 'TRANSACTION_LEVEL',
  };

  console.log('--- Step 2: Executing import pipeline ---');
  const importStart = Date.now();
  const importResult = await UploadService.importTransactions(
    orgId,
    userId,
    rows,
    mapping,
    metadata
  );

  console.log(`Import completed in ${(Date.now() - importStart) / 1000}s:`, {
    imported: importResult.imported,
    rejected: importResult.rejected,
    duplicates: importResult.duplicates,
    qualityScore: importResult.qualityScore,
    qualityGrade: importResult.qualityGrade,
    batchId: importResult.batchId,
  });

  console.log('--- Step 3: Testing deterministic duplicate-import protection ---');
  try {
    await UploadService.importTransactions(
      orgId,
      userId,
      rows,
      mapping,
      metadata
    );
    console.error('FAIL: Duplicate import was allowed!');
  } catch (err) {
    console.log('SUCCESS: Duplicate import blocked with status:', err.status, 'Message:', err.message);
  }

  console.log('--- Step 4: Direct PostgreSQL Verification for organization ---', orgId);
  const totalTxnCount = await prisma.transaction.count({ where: { organizationId: orgId } });
  const batch = await prisma.importBatch.findUnique({ where: { id: importResult.batchId } });

  const agg = await prisma.transaction.aggregate({
    where: { organizationId: orgId },
    _min: { invoiceDate: true, paymentDate: true },
    _max: { invoiceDate: true, paymentDate: true },
    _sum: { invoiceAmount: true, outstandingAmount: true },
    _avg: { paymentDelayDays: true },
  });

  // Calculate unique vs duplicate transaction IDs in DB
  const distinctTxnIdCount = await prisma.transaction.findMany({
    where: { organizationId: orgId },
    distinct: ['transactionId'],
    select: { transactionId: true },
  });

  const earliestDate = agg._min.invoiceDate;
  const latestDate = agg._max.paymentDate || agg._max.invoiceDate;
  const totalInvoiceAmount = agg._sum.invoiceAmount || 0;
  const totalOutstanding = agg._sum.outstandingAmount || 0;
  const totalPaidAmount = totalInvoiceAmount - totalOutstanding;

  console.log({
    organizationId: orgId,
    transactionCountInDb: totalTxnCount,
    batchAcceptedCount: batch.acceptedCount,
    batchRejectedCount: batch.rejectedCount,
    uniqueTransactionIds: distinctTxnIdCount.length,
    duplicateTransactionIds: totalTxnCount - distinctTxnIdCount.length,
    earliestInvoiceDate: earliestDate ? earliestDate.toISOString() : null,
    latestInvoiceOrPaymentDate: latestDate ? latestDate.toISOString() : null,
    totalInvoiceAmount: `₹${totalInvoiceAmount.toLocaleString('en-IN')}`,
    totalPaidAmount: `₹${totalPaidAmount.toLocaleString('en-IN')}`,
    totalOutstanding: `₹${totalOutstanding.toLocaleString('en-IN')}`,
    avgPaymentDelayDays: agg._avg.paymentDelayDays,
  });

  console.log('--- Step 5: Dashboard and Transactions Query Verification ---');
  const dashboardData = await DashboardService.getSummary(orgId, 'SME_ADMIN');
  console.log('Dashboard KPIs:');
  for (const kpi of dashboardData.kpis) {
    console.log(`- ${kpi.label}: ${kpi.value} (${kpi.trendLabel})`);
  }

  const txnsPage = await TransactionService.getTransactions(orgId, { page: 1, pageSize: 5 });
  console.log(`Transactions API: total=${txnsPage.total}, returned=${txnsPage.items.length} items`);
  console.log('First 2 transactions:');
  for (const t of txnsPage.items.slice(0, 2)) {
    console.log(`- Invoice ${t.transactionId || t.id}: Buyer=${t.buyer?.name}, Amount=${t.invoiceAmount}, Delay=${t.paymentDelayDays}d, Status=${t.paymentStatus}`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
