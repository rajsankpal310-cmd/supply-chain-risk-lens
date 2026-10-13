const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function testInsert() {
  const orgId = '6ee28c8e-1f1c-4c4c-86a9-e45c2897993e';
  // Let's find one firm in this org
  const firm = await prisma.firm.findFirst({ where: { organizationId: orgId } });
  console.log('Sample firm in org:', firm);
  if (!firm) {
    console.error('No firm found!');
    return;
  }

  try {
    const txn = await prisma.transaction.create({
      data: {
        id: `TEST_TXN_${Date.now()}`,
        organizationId: orgId,
        transactionId: `TXN_${Date.now()}`,
        smeId: firm.id,
        buyerId: firm.id,
        invoiceAmount: 1000,
        outstandingAmount: 0,
        invoiceDate: new Date('2026-01-01'),
        dueDate: new Date('2026-02-01'),
        paymentDate: new Date('2026-02-01'),
        paymentStatus: 'PAID',
        riskLevel: 'LOW',
        sourceType: 'PRIMARY_TRANSACTION',
        dataStatus: 'VERIFIED'
      }
    });
    console.log('Successfully inserted test transaction:', txn.id);
    // Delete test transaction
    await prisma.transaction.delete({ where: { id: txn.id } });
    console.log('Successfully deleted test transaction.');
  } catch (err) {
    console.error('Failed to insert transaction:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testInsert();
