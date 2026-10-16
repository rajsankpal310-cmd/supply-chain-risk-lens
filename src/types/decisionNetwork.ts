import type { NetworkEdge, NetworkNode, RiskLevel } from "./index";

export type ActionType =
  | "COLLECTION_PRIORITIZATION"
  | "DELAYED_PAYMENT_FOLLOWUP"
  | "ALTERNATE_SUPPLIER"
  | "CONCENTRATION_REDUCTION"
  | "INVENTORY_BUFFER"
  | "DEADLOCK_INVESTIGATION"
  | "TRANSACTION_RISK_REVIEW";

export type EvaluationStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "DEFERRED";

export interface DecisionReviewRecord {
  id: string;
  actionId: string;
  actionTitle?: string;
  decision: "APPROVED" | "REJECTED" | "DEFERRED";
  reason?: string;
  reviewerId: string;
  reviewerName: string;
  reviewedAt: string;
}

export interface CandidateAction {
  id: string;
  firmId: string;
  firmName: string;
  actionType: ActionType | string;
  title: string;
  explanation: string;
  whyRequired: string;
  priority: RiskLevel;
  score: number;
  scoreBreakdown: {
    benefit: number;
    urgency: number;
    feasibility: number;
    confidence: number;
  };
  estimatedCost?: number | null;
  expectedBenefit: string;
  tradeoffs?: string | null;
  constraints: string[];
  assumptions: string[];
  evidence: Array<{
    source: string;
    metric: string;
    value: string;
    threshold: string;
    confidence: number;
  }>;
  isSimulatable: boolean;
  status: EvaluationStatus;
  reviews: DecisionReviewRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface DecisionNetworkMetrics {
  highRiskFirmsCount: number;
  criticalDependenciesCount: number;
  candidateActionsCount: number;
  pendingActionsCount: number;
  approvedActionsCount: number;
  decisionEvaluationsCount: number;
  estimatedRiskReduction: number;
  totalNetworkExposure: number;
  cascadeSeverityScore: number;
}

export interface DecisionNetworkOverview {
  organizationId: string;
  network: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  };
  metrics: DecisionNetworkMetrics;
  latestRun: {
    id: string;
    status: string;
    algorithmVersion: string;
    evaluatedAt: string;
    metricsSummary?: any;
  } | null;
  candidateActions: CandidateAction[];
  recentReviews: DecisionReviewRecord[];
  scoringWeights: {
    wBenefit: number;
    wUrgency: number;
    wFeasibility: number;
    wConfidence: number;
  };
}

export interface DecisionNodeContext {
  firm: {
    id: string;
    name: string;
    industry: string;
    role: string;
    riskScore: number;
    riskLevel: RiskLevel;
    financialStress: number;
    outstandingAmount: number;
    avgPaymentDelayDays: number;
    cashBufferDays: number;
    transactionCount: number;
  };
  connectedFirms: Array<{
    relationshipId: string;
    direction: "INCOMING" | "OUTGOING";
    type: string;
    counterpartyId: string;
    counterpartyName: string;
    criticality: string;
    dependencyLevel: number;
    avgTransactionValue: number;
  }>;
  transactions: Array<{
    id: string;
    invoiceAmount: number;
    outstandingAmount: number;
    paymentStatus: string;
    paymentDelayDays?: number;
    dueDate: string;
    invoiceDate: string;
  }>;
  predictions: Array<{
    id: string;
    type: string;
    probability: number;
    riskLevel: string;
    confidence: number;
    factors: any[];
  }>;
  candidateActions: CandidateAction[];
}

export interface DecisionSimulationResult {
  actionId: string;
  actionTitle?: string;
  actionType: string;
  isSimulatable: boolean;
  reason?: string;
  baselineState?: {
    expectedLoss: number;
    cascadeProbability: number;
    potentialDefaults: number;
    recoveryDays: number;
    affectedFirmsCount: number;
  } | null;
  simulatedState?: {
    expectedLoss: number;
    cascadeProbability: number;
    potentialDefaults: number;
    recoveryDays: number;
    affectedFirmsCount: number;
  } | null;
  projectedImpact?: {
    expectedLossReduction: number;
    expectedLossReductionPercentage: number;
    cascadeProbabilityReduction: number;
    residualRiskScore: number;
  };
  assumptions?: string[];
  constraints?: string[];
  disclaimer?: string;
}
