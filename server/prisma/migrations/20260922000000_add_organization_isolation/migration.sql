-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "public"."Organization"("code");

-- Insert default organization for existing data preservation
INSERT INTO "public"."Organization" ("id", "name", "code", "status", "createdAt", "updatedAt")
VALUES ('ORG-DEFAULT', 'Apex Manufacturing Consortium', 'ORG_A', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Alter User Table
ALTER TABLE "public"."User" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."User" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."User" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "User_organizationId_idx" ON "public"."User"("organizationId");
ALTER TABLE "public"."User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Firm Table
ALTER TABLE "public"."Firm" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Firm" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Firm" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Firm_organizationId_idx" ON "public"."Firm"("organizationId");
ALTER TABLE "public"."Firm" ADD CONSTRAINT "Firm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter ImportBatch Table
ALTER TABLE "public"."ImportBatch" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."ImportBatch" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."ImportBatch" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "ImportBatch_organizationId_idx" ON "public"."ImportBatch"("organizationId");
ALTER TABLE "public"."ImportBatch" ADD CONSTRAINT "ImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Transaction Table
ALTER TABLE "public"."Transaction" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Transaction" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Transaction" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Transaction_organizationId_idx" ON "public"."Transaction"("organizationId");
ALTER TABLE "public"."Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Relationship Table
ALTER TABLE "public"."Relationship" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Relationship" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Relationship" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Relationship_organizationId_idx" ON "public"."Relationship"("organizationId");
ALTER TABLE "public"."Relationship" ADD CONSTRAINT "Relationship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Prediction Table
ALTER TABLE "public"."Prediction" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Prediction" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Prediction" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Prediction_organizationId_idx" ON "public"."Prediction"("organizationId");
ALTER TABLE "public"."Prediction" ADD CONSTRAINT "Prediction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Scenario Table
ALTER TABLE "public"."Scenario" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Scenario" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Scenario" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Scenario_organizationId_idx" ON "public"."Scenario"("organizationId");
ALTER TABLE "public"."Scenario" ADD CONSTRAINT "Scenario_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter SimulationRun Table
ALTER TABLE "public"."SimulationRun" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."SimulationRun" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."SimulationRun" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "SimulationRun_organizationId_idx" ON "public"."SimulationRun"("organizationId");
ALTER TABLE "public"."SimulationRun" ADD CONSTRAINT "SimulationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Deadlock Table
ALTER TABLE "public"."Deadlock" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Deadlock" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Deadlock" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Deadlock_organizationId_idx" ON "public"."Deadlock"("organizationId");
ALTER TABLE "public"."Deadlock" ADD CONSTRAINT "Deadlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Recommendation Table
ALTER TABLE "public"."Recommendation" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Recommendation" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Recommendation" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Recommendation_organizationId_idx" ON "public"."Recommendation"("organizationId");
ALTER TABLE "public"."Recommendation" ADD CONSTRAINT "Recommendation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter OptimizationRun Table
ALTER TABLE "public"."OptimizationRun" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."OptimizationRun" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."OptimizationRun" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "OptimizationRun_organizationId_idx" ON "public"."OptimizationRun"("organizationId");
ALTER TABLE "public"."OptimizationRun" ADD CONSTRAINT "OptimizationRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Alert Table
ALTER TABLE "public"."Alert" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Alert" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Alert" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX "Alert_organizationId_idx" ON "public"."Alert"("organizationId");
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter Report Table
ALTER TABLE "public"."Report" ADD COLUMN "organizationId" TEXT;
UPDATE "public"."Report" SET "organizationId" = 'ORG-DEFAULT' WHERE "organizationId" IS NULL;
ALTER TABLE "public"."Report" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "public"."Report_key_key";
CREATE UNIQUE INDEX "Report_organizationId_key_key" ON "public"."Report"("organizationId", "key");
CREATE INDEX "Report_organizationId_idx" ON "public"."Report"("organizationId");
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
