const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  const orgs = await prisma.organization.findMany();
  console.log('Organizations in DB:');
  for (const org of orgs) {
    console.log(`- Org ID: ${org.id}, Name: ${org.name}`);
  }

  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('\nRecent ImportBatches:');
  for (const b of batches) {
    console.log(`- ID: ${b.id}`);
    console.log(`  Org: ${b.organizationId}, Source: ${b.sourceName}, File: ${b.sourceUrl || 'N/A'}`);
    console.log(`  Records: ${b.recordCount}, Accepted: ${b.acceptedCount}, Rejected: ${b.rejectedCount}, Duplicates: ${b.duplicateCount}`);
    console.log(`  Status: ${b.status}, DataStatus: ${b.dataStatus}, CreatedAt: ${b.createdAt.toISOString()}`);
  }

  const totalTxns = await prisma.transaction.count();
  console.log(`\nTotal transactions in database: ${totalTxns}`);

  for (const org of orgs) {
    const count = await prisma.transaction.count({ where: { organizationId: org.id } });
    console.log(`\nTransactions for Org ${org.id} (${org.name}): ${count}`);
    if (count > 0) {
      const aggregates = await prisma.transaction.aggregate({
        where: { organizationId: org.id },
        _min: { invoiceDate: true, paymentDate: true },
        _max: { invoiceDate: true, paymentDate: true },
        _sum: { invoiceAmount: true, outstandingAmount: true },
        _count: { id: true, transactionId: true }
      });
      console.log('Aggregates for org:', {
        count: aggregates._count.id,
        minInvoiceDate: aggregates._min.invoiceDate,
        maxInvoiceDate: aggregates._max.invoiceDate,
        minPaymentDate: aggregates._min.paymentDate,
        maxPaymentDate: aggregates._max.paymentDate,
        totalInvoiceAmount: aggregates._sum.invoiceAmount,
        totalOutstandingAmount: aggregates._sum.outstandingAmount,
      });

      // Sample statuses
      const statuses = await prisma.transaction.groupBy({
        by: ['paymentStatus'],
        where: { organizationId: org.id },
        _count: { id: true }
      });
      console.log('Status distribution:', statuses);

      // Check distinct transaction IDs
      const rawCount = await prisma.$queryRawUnsafe(
        `SELECT COUNT(DISTINCT "transactionId") as distinct_txn_ids, COUNT("transactionId") as total_txn_ids FROM "Transaction" WHERE "organizationId" = '${org.id}';`
      );
      console.log('Distinct transaction IDs in org:', rawCount);
    }
  }

  const firms = await prisma.firm.findMany({
    select: { id: true, name: true, organizationId: true, role: true, riskScore: true, riskLevel: true },
    take: 15
  });
  console.log('\nSample firms in DB:', firms);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Audit DB error:', err);
  process.exit(1);
});
