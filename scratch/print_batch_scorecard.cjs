const path = require('path');
require(path.join(__dirname, '../server/node_modules/dotenv')).config({ path: path.join(__dirname, '../server/.env') });
const { PrismaClient } = require(path.join(__dirname, '../server/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function printBatchScorecard() {
  const batch = await prisma.importBatch.findUnique({
    where: { id: '0b6f231f-a3a4-4e4e-940d-0bcb4bd5d59e' }
  });
  console.log('Batch record:');
  console.log({
    id: batch.id,
    recordCount: batch.recordCount,
    acceptedCount: batch.acceptedCount,
    rejectedCount: batch.rejectedCount,
    duplicateCount: batch.duplicateCount,
  });
  if (batch.qualityReport) {
    const report = JSON.parse(batch.qualityReport);
    console.log('Scorecard from batch:', {
      totalRecords: report.totalRecords,
      acceptedCount: report.acceptedCount,
      rejectedCount: report.rejectedCount,
      exactDuplicateCount: report.exactDuplicateCount,
      potentialDuplicateCount: report.potentialDuplicateCount,
      rejectionReasons: report.rejectionReasons
    });
  }
  await prisma.$disconnect();
}

printBatchScorecard();
