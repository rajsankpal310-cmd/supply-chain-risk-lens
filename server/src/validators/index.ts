import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  fullName: z.string().min(2),
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  industry: z.string().default("Manufacturing"),
  companySize: z.string().default("11-50"),
});

export const transactionSchema = z.object({
  smeId: z.string(),
  buyerId: z.string(),
  supplierId: z.string().optional(),
  invoiceAmount: z.number().positive(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  paymentDate: z.string().optional(),
  creditPeriodDays: z.number().int().optional(),
  outstandingAmount: z.number().min(0).optional(),
  paymentStatus: z.enum(["PAID", "PENDING", "DELAYED", "CRITICAL", "OVERDUE", "PARTIALLY_PAID", "DEFAULTED"]).optional(),
});

export const firmSchema = z.object({
  name: z.string().min(2),
  industry: z.string(),
  role: z.enum(["SME", "BUYER", "SUPPLIER", "BUYER_SUPPLIER"]).default("SME"),
  city: z.string(),
  annualTurnover: z.number().default(0),
  cashBufferDays: z.number().int().default(30),
});

export const scenarioSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["BUYER_PAYMENT_DELAY", "SUPPLIER_FAILURE", "MAJOR_BUYER_LOSS", "CASH_FLOW_SHOCK", "NATURAL_DISASTER", "CUSTOM"]),
  affectedFirmId: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("HIGH"),
  delayDays: z.number().int().default(60),
  amount: z.number().default(5000000),
  durationDays: z.number().int().default(90),
  recoveryRate: z.number().default(45),
});

export const relationshipSchema = z.object({
  sourceFirmId: z.string().min(1, "sourceFirmId is required"),
  targetFirmId: z.string().min(1, "targetFirmId is required"),
  type: z.enum(["SUPPLIES_TO", "BUYS_FROM", "PARTNER_WITH"]).default("SUPPLIES_TO"),
  dependencyLevel: z.number().min(0).max(100).default(50),
  annualVolume: z.number().min(0).default(0),
  paymentTermsDays: z.number().int().min(0).default(30),
});

export const transactionImportSchema = z
  .object({
    transactions: z.array(z.record(z.any())).optional(),
    rows: z.array(z.record(z.any())).optional(),
    mapping: z.record(z.string()).optional(),
    count: z.number().optional(),
    sourceType: z.enum(["PRIMARY_TRANSACTION", "PUBLIC_DATASET", "EXTERNAL_REFERENCE", "DERIVED", "DEMO_ONLY"]).default("PRIMARY_TRANSACTION"),
    sourceName: z.string().optional(),
    sourceOrg: z.string().optional(),
    sourceUrl: z.string().optional(),
    datasetVersion: z.string().optional(),
    license: z.string().optional(),
    dataGranularity: z.string().optional(),
    sourceDate: z.string().optional(),
  })
  .refine((data) => (data.transactions && data.transactions.length > 0) || (data.rows && data.rows.length > 0), {
    message: "At least one transaction record or row is required",
  });

export const optimizationSchema = z.object({
  budget: z.number().positive(),
});
