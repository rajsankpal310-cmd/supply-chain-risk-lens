-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "companySize" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SME_ADMIN',
    "avatarInitials" TEXT NOT NULL DEFAULT 'US',
    "firmId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SME',
    "city" TEXT NOT NULL,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "buyersCount" INTEGER NOT NULL DEFAULT 0,
    "suppliersCount" INTEGER NOT NULL DEFAULT 0,
    "avgPaymentDelayDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outstandingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "annualTurnover" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashBufferDays" INTEGER NOT NULL DEFAULT 30,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "financialStress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'HEALTHY',
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "smeId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "supplierId" TEXT,
    "invoiceAmount" DOUBLE PRECISION NOT NULL,
    "outstandingAmount" DOUBLE PRECISION NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "creditPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "paymentDelayDays" INTEGER,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "sourceFirmId" TEXT NOT NULL,
    "targetFirmId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SUPPLIES_TO',
    "avgTransactionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditPeriodDays" INTEGER NOT NULL DEFAULT 30,
    "dependencyLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "criticality" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PAYMENT_DELAY',
    "probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedDelayDays" INTEGER,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "predictedDate" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "factors" TEXT NOT NULL DEFAULT '[]',
    "horizon" TEXT NOT NULL DEFAULT '[]',
    "modelVersion" TEXT NOT NULL DEFAULT 'phase2-demo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'BUYER_PAYMENT_DELAY',
    "affectedFirmId" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "delayDays" INTEGER NOT NULL DEFAULT 60,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 5000000,
    "durationDays" INTEGER NOT NULL DEFAULT 90,
    "recoveryRate" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "rootFirmId" TEXT NOT NULL,
    "cascadeRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maximumImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationResult" (
    "id" TEXT NOT NULL,
    "simulationRunId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "hop" INTEGER NOT NULL DEFAULT 0,
    "initialRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT 'STRESSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadlock" (
    "id" TEXT NOT NULL,
    "rootFirmId" TEXT NOT NULL,
    "rootFirmName" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "deadlockRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "chain" TEXT NOT NULL DEFAULT '[]',
    "totalExposure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deadlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INVOICE_FINANCING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "riskAddressed" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "estimatedRequirement" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'HIGH',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationRun" (
    "id" TEXT NOT NULL,
    "budget" DOUBLE PRECISION NOT NULL,
    "cascadeRiskBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cascadeRiskAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedLossBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedLossAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allocations" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptimizationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'PAYMENT_DELAY',
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lastGeneratedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NOT_GENERATED',
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Transaction_smeId_idx" ON "Transaction"("smeId");

-- CreateIndex
CREATE INDEX "Transaction_buyerId_idx" ON "Transaction"("buyerId");

-- CreateIndex
CREATE INDEX "Transaction_supplierId_idx" ON "Transaction"("supplierId");

-- CreateIndex
CREATE INDEX "Transaction_invoiceDate_idx" ON "Transaction"("invoiceDate");

-- CreateIndex
CREATE INDEX "Transaction_dueDate_idx" ON "Transaction"("dueDate");

-- CreateIndex
CREATE INDEX "Transaction_paymentStatus_idx" ON "Transaction"("paymentStatus");

-- CreateIndex
CREATE INDEX "Relationship_sourceFirmId_idx" ON "Relationship"("sourceFirmId");

-- CreateIndex
CREATE INDEX "Relationship_targetFirmId_idx" ON "Relationship"("targetFirmId");

-- CreateIndex
CREATE INDEX "Prediction_firmId_idx" ON "Prediction"("firmId");

-- CreateIndex
CREATE INDEX "SimulationRun_scenarioId_idx" ON "SimulationRun"("scenarioId");

-- CreateIndex
CREATE INDEX "SimulationRun_rootFirmId_idx" ON "SimulationRun"("rootFirmId");

-- CreateIndex
CREATE INDEX "SimulationResult_simulationRunId_idx" ON "SimulationResult"("simulationRunId");

-- CreateIndex
CREATE INDEX "SimulationResult_firmId_idx" ON "SimulationResult"("firmId");

-- CreateIndex
CREATE INDEX "Recommendation_firmId_idx" ON "Recommendation"("firmId");

-- CreateIndex
CREATE INDEX "Recommendation_status_idx" ON "Recommendation"("status");

-- CreateIndex
CREATE INDEX "Alert_firmId_idx" ON "Alert"("firmId");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_read_idx" ON "Alert"("read");

-- CreateIndex
CREATE UNIQUE INDEX "Report_key_key" ON "Report"("key");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_smeId_fkey" FOREIGN KEY ("smeId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_sourceFirmId_fkey" FOREIGN KEY ("sourceFirmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_targetFirmId_fkey" FOREIGN KEY ("targetFirmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResult" ADD CONSTRAINT "SimulationResult_simulationRunId_fkey" FOREIGN KEY ("simulationRunId") REFERENCES "SimulationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

