-- CreateTable
CREATE TABLE "public"."ImportBatch" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'DEMO_ONLY',
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceDate" TIMESTAMP(3),
    "datasetVersion" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedBy" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "dataStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."Firm" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'DEMO_ONLY',
ADD COLUMN "dataStatus" TEXT NOT NULL DEFAULT 'DEMO';

-- AlterTable
ALTER TABLE "public"."Transaction" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'DEMO_ONLY',
ADD COLUMN "sourceName" TEXT,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "dataStatus" TEXT NOT NULL DEFAULT 'DEMO',
ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "ImportBatch_sourceType_idx" ON "public"."ImportBatch"("sourceType");

-- CreateIndex
CREATE INDEX "Transaction_sourceType_idx" ON "public"."Transaction"("sourceType");

-- CreateIndex
CREATE INDEX "Transaction_batchId_idx" ON "public"."Transaction"("batchId");

-- AddForeignKey
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "public"."ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
