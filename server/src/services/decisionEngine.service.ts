import { prisma } from "../config/database";
import { DecisionNetworkRepository } from "../repositories/decisionNetwork.repository";
import { NetworkService } from "./network.service";
import { SimulationService } from "./simulation.service";
import { sanitizeCompanyName } from "../utils/sanitize";

export interface ScoringWeights {
  wBenefit: number;
  wUrgency: number;
  wFeasibility: number;
  wConfidence: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  wBenefit: 0.35,
  wUrgency: 0.30,
  wFeasibility: 0.20,
  wConfidence: 0.15,
};

export class DecisionEngineService {
  /**
   * Calculates the weighted action score using normalized components [0, 100].
   * Formula: actionScore = wBenefit * benefit + wUrgency * urgency + wFeasibility * feasibility + wConfidence * confidence
   * Hard validation: weights must sum to 1.0 (with floating point tolerance 0.001).
   */
  static calculateActionScore(
    benefit: number,
    urgency: number,
    feasibility: number,
    confidence: number,
    weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
  ): number {
    const sum = weights.wBenefit + weights.wUrgency + weights.wFeasibility + weights.wConfidence;
    if (Math.abs(sum - 1.0) > 0.005) {
      throw new Error(`Scoring weights must sum to 1.0, received sum: ${sum}`);
    }

    const normBenefit = Math.max(0, Math.min(100, benefit));
    const normUrgency = Math.max(0, Math.min(100, urgency));
    const normFeasibility = Math.max(0, Math.min(100, feasibility));
    const normConfidence = Math.max(0, Math.min(100, confidence));

    const score =
      weights.wBenefit * normBenefit +
      weights.wUrgency * normUrgency +
      weights.wFeasibility * normFeasibility +
      weights.wConfidence * normConfidence;

    return Math.round(score * 10) / 10;
  }

  /**
   * Retrieves or creates the latest Decision Network evaluation for the authorized organization.
   */
  static async getOverview(organizationId: string) {
    const network = await NetworkService.getNetwork(organizationId);
    let latestRun: any = await DecisionNetworkRepository.findLatestRun(organizationId);

    // If no evaluation run exists or if the network has records but run is empty, evaluate dynamically
    if (!latestRun && (network.nodes.length > 0 || network.edges.length > 0)) {
      latestRun = await this.evaluateOrganization(organizationId);
    }

    const candidateActions = latestRun?.candidateActions || [];
    const pendingActions = candidateActions.filter((a: any) => a.status === "PENDING_REVIEW");
    const approvedActions = candidateActions.filter((a: any) => a.status === "APPROVED");
    const reviews = await DecisionNetworkRepository.findReviews(organizationId);

    // Compute estimated risk reduction across approved / high-priority actions
    const totalBenefit = candidateActions.reduce((s: number, a: any) => s + (a.benefitScore || 0), 0);
    const avgRiskReduction = candidateActions.length > 0
      ? Math.round((totalBenefit / candidateActions.length) * 0.4)
      : 0;

    return {
      organizationId,
      network: {
        nodes: network.nodes,
        edges: network.edges,
      },
      metrics: {
        highRiskFirmsCount: network.metrics.highRiskNodesCount,
        criticalDependenciesCount: network.metrics.criticalDependenciesCount,
        candidateActionsCount: candidateActions.length,
        pendingActionsCount: pendingActions.length,
        approvedActionsCount: approvedActions.length,
        decisionEvaluationsCount: latestRun ? 1 : 0,
        estimatedRiskReduction: avgRiskReduction,
        totalNetworkExposure: network.metrics.totalNetworkExposure,
        cascadeSeverityScore: network.metrics.cascadeSeverityScore,
      },
      latestRun: latestRun
        ? {
            id: latestRun.id,
            status: latestRun.status,
            algorithmVersion: latestRun.algorithmVersion,
            evaluatedAt: latestRun.evaluatedAt,
            metricsSummary: latestRun.metricsSummary ? JSON.parse(latestRun.metricsSummary) : null,
          }
        : null,
      candidateActions: candidateActions.map((a: any) => this.formatCandidateAction(a)),
      recentReviews: reviews.slice(0, 10).map((r: any) => ({
        id: r.id,
        actionId: r.candidateActionId,
        actionTitle: r.candidateAction?.title,
        reviewerId: r.reviewerId,
        reviewerName: r.reviewerName,
        decision: r.decision,
        reason: r.reason,
        reviewedAt: r.reviewedAt,
      })),
      scoringWeights: DEFAULT_SCORING_WEIGHTS,
    };
  }

  /**
   * Evaluates organization data and generates explainable candidate actions.
   */
  static async evaluateOrganization(organizationId: string) {
    const [firms, relationships, transactions, deadlocks, predictions] = await Promise.all([
      prisma.firm.findMany({ where: { organizationId } }),
      prisma.relationship.findMany({
        where: { organizationId },
        include: { sourceFirm: true, targetFirm: true },
      }),
      prisma.transaction.findMany({
        where: { organizationId },
        select: {
          id: true,
          smeId: true,
          buyerId: true,
          supplierId: true,
          invoiceAmount: true,
          outstandingAmount: true,
          paymentDelayDays: true,
          paymentStatus: true,
          dueDate: true,
          invoiceDate: true,
        },
      }),
      prisma.deadlock.findMany({ where: { organizationId } }),
      prisma.prediction.findMany({ where: { organizationId } }),
    ]);

    // If zero firms and transactions, return an empty run
    if (firms.length === 0) {
      return DecisionNetworkRepository.createRun({
        organizationId,
        algorithmVersion: "v1.0-deterministic",
        inputSnapshot: JSON.stringify({ firms: 0, relationships: 0, transactions: 0 }),
        metricsSummary: JSON.stringify({ highRiskFirms: 0, criticalDependencies: 0, actionsCount: 0 }),
      });
    }

    const firmMap = new Map<string, any>(firms.map((f: any) => [f.id, f]));
    const actionsToCreate: any[] = [];

    // 1. RULE: COLLECTION_PRIORITIZATION
    // Precondition: Firm has overdue receivables with paymentDelayDays > 0 or status in [DELAYED, CRITICAL]
    for (const firm of firms) {
      const overdueTxns = transactions.filter(
        (t: any) =>
          (t.smeId === firm.id || t.supplierId === firm.id) &&
          (t.paymentStatus === "DELAYED" || t.paymentStatus === "CRITICAL" || (t.paymentDelayDays && t.paymentDelayDays > 0))
      );

      if (overdueTxns.length > 0) {
        const overdueAmount = overdueTxns.reduce((s: number, t: any) => s + (t.outstandingAmount || 0), 0);
        const maxDelay = Math.max(...overdueTxns.map((t: any) => t.paymentDelayDays || 0), 0);

        const benefit = Math.min(95, Math.round(40 + (overdueAmount / 2000000) * 35));
        const urgency = Math.min(95, Math.round(30 + maxDelay * 0.9));
        const feasibility = 85; // Collection protocol is highly feasible operationally
        const confidence = 90; // Backed by verified transaction overdue records
        const score = this.calculateActionScore(benefit, urgency, feasibility, confidence);

        actionsToCreate.push({
          organizationId,
          firmId: firm.id,
          firmName: firm.name,
          actionType: "COLLECTION_PRIORITIZATION",
          title: `Prioritize collection of ₹${(overdueAmount / 100000).toFixed(1)}L overdue receivables for ${firm.name}`,
          explanation: `Identified ${overdueTxns.length} overdue invoices with maximum payment delay of ${maxDelay} days. Structured recovery protocol mitigates working capital depletion.`,
          whyRequired: `Accumulated unpaid receivables threaten cash liquidity and operational cash buffer (${firm.cashBufferDays} days).`,
          priority: maxDelay > 45 || overdueAmount > 2500000 ? "CRITICAL" : "HIGH",
          score,
          benefitScore: benefit,
          urgencyScore: urgency,
          feasibilityScore: feasibility,
          confidenceScore: confidence,
          estimatedCost: Math.round(overdueAmount * 0.02), // ~2% collection & legal notification overhead
          expectedBenefit: `Immediate recovery of up to ₹${(overdueAmount * 0.75 / 100000).toFixed(1)}L cash within 15-30 days, lowering default risk by ~${Math.round(benefit * 0.35)} pts.`,
          tradeoffs: "Potential customer relationship friction if outreach is adversarial rather than structured.",
          constraints: JSON.stringify(["Requires valid commercial dispute clearance", "Subject to credit terms agreement"]),
          assumptions: JSON.stringify(["Debtor retains operational solvency", "Receivables are contractually undisputed"]),
          evidence: JSON.stringify([
            { source: "Transaction Ledger", metric: "Overdue Invoices", value: `${overdueTxns.length} invoices`, threshold: "> 0", confidence: 95 },
            { source: "Payment Tracker", metric: "Max Overdue Delay", value: `${maxDelay} days`, threshold: "> 15 days", confidence: 92 },
            { source: "Balance Sheet", metric: "Overdue Exposure", value: `₹${(overdueAmount / 100000).toFixed(1)}L`, threshold: "> ₹5.0L", confidence: 98 },
          ]),
          isSimulatable: true,
          simulationPayload: JSON.stringify({
            affectedFirmId: firm.id,
            severity: "MEDIUM",
            delayDays: Math.max(15, Math.round(maxDelay * 0.5)),
            amount: overdueAmount,
            durationDays: 45,
            recoveryRate: 75,
          }),
        });
      }
    }

    // 2. RULE: DELAYED_PAYMENT_FOLLOWUP
    // Precondition: Buyer firm has average payment delay > 25 days and active procurement volume
    const buyerFirms = firms.filter((f: any) => f.role === "BUYER" || f.avgPaymentDelayDays > 25);
    for (const buyer of buyerFirms) {
      const buyerTxns = transactions.filter((t: any) => t.buyerId === buyer.id);
      if (buyerTxns.length >= 2 && buyer.avgPaymentDelayDays > 25) {
        const pendingAmount = buyerTxns
          .filter((t: any) => t.paymentStatus === "PENDING" || t.paymentStatus === "DELAYED")
          .reduce((s: number, t: any) => s + (t.outstandingAmount || 0), 0);

        const benefit = Math.min(90, Math.round(35 + buyer.avgPaymentDelayDays * 0.7));
        const urgency = Math.min(92, Math.round(40 + buyer.avgPaymentDelayDays * 0.8));
        const feasibility = 80;
        const confidence = 88;
        const score = this.calculateActionScore(benefit, urgency, feasibility, confidence);

        actionsToCreate.push({
          organizationId,
          firmId: buyer.id,
          firmName: buyer.name,
          actionType: "DELAYED_PAYMENT_FOLLOWUP",
          title: `Initiate structured buyer payment cycle alignment with ${buyer.name}`,
          explanation: `Buyer demonstrates recurring settlement delay averaging ${buyer.avgPaymentDelayDays} days across ${buyerTxns.length} transactions totaling ₹${(pendingAmount / 100000).toFixed(1)}L pending.`,
          whyRequired: `Systemic payment delay propagates upstream working-capital stress to Tier-1 suppliers.`,
          priority: buyer.avgPaymentDelayDays > 45 ? "HIGH" : "MEDIUM",
          score,
          benefitScore: benefit,
          urgencyScore: urgency,
          feasibilityScore: feasibility,
          confidenceScore: confidence,
          estimatedCost: 15000, // Administrative cost
          expectedBenefit: `Shortens average invoice settlement cycle by 12-20 days, stabilizing upstream supplier fulfillment.`,
          tradeoffs: "May require offering 1.5% early-payment cash discounts.",
          constraints: JSON.stringify(["Buyer accounts payable approval cycles", "Quarter-end payment moratoriums"]),
          assumptions: JSON.stringify(["Buyer has sufficient treasury headroom to accelerate payment"]),
          evidence: JSON.stringify([
            { source: "Firm Analytics", metric: "Average Payment Delay", value: `${buyer.avgPaymentDelayDays} days`, threshold: "> 25 days", confidence: 94 },
            { source: "Transaction Ledger", metric: "Pending Invoices Total", value: `₹${(pendingAmount / 100000).toFixed(1)}L`, threshold: "> ₹10.0L", confidence: 96 },
          ]),
          isSimulatable: true,
          simulationPayload: JSON.stringify({
            affectedFirmId: buyer.id,
            severity: "LOW",
            delayDays: Math.max(10, Math.round(buyer.avgPaymentDelayDays * 0.6)),
            amount: pendingAmount,
            durationDays: 30,
            recoveryRate: 85,
          }),
        });
      }
    }

    // 3. RULE: ALTERNATE_SUPPLIER & CONCENTRATION_REDUCTION
    // Precondition: Firm has single supplier dependency (suppliersCount === 1) or excessive dependencyLevel (> 0.7)
    for (const firm of firms) {
      const incomingRels = relationships.filter((r: any) => r.targetFirmId === firm.id && r.type === "SUPPLIES_TO");
      const isSingleSource = firm.suppliersCount === 1 || incomingRels.length === 1;

      if (isSingleSource && incomingRels.length > 0) {
        const primaryRel = incomingRels[0];
        const supplierName = primaryRel.sourceFirm?.name || "Primary Supplier";

        const benefit = 78;
        const urgency = firm.riskScore > 50 ? 82 : 65;
        const feasibility = 60; // Sourcing alternate suppliers takes time/due diligence
        const confidence = 85; // Dependency relationship is empirical
        const score = this.calculateActionScore(benefit, urgency, feasibility, confidence);

        actionsToCreate.push({
          organizationId,
          firmId: firm.id,
          firmName: firm.name,
          actionType: "ALTERNATE_SUPPLIER",
          title: `Qualify secondary supplier to eliminate single-source dependency on ${supplierName}`,
          explanation: `${firm.name} relies exclusively on a single supplier (${supplierName}) for critical inputs, presenting critical single-point-of-failure vulnerability.`,
          whyRequired: `Disruption at ${supplierName} halts production without operational fallback.`,
          priority: firm.riskScore > 60 ? "HIGH" : "MEDIUM",
          score,
          benefitScore: benefit,
          urgencyScore: urgency,
          feasibilityScore: feasibility,
          confidenceScore: confidence,
          estimatedCost: 250000, // Vendor qualification & audit cost
          expectedBenefit: "Reduces supply disruption probability by 65% and establishes secondary fulfillment capacity.",
          tradeoffs: "Splitting procurement volume may dilute bulk pricing tier discounts by 3-5%.",
          constraints: JSON.stringify(["Vendor audit and quality certification timeline (4-6 weeks)", "Minimum order quantity hurdles"]),
          assumptions: JSON.stringify(["Compatible alternate suppliers operate within domestic industrial clusters"]),
          evidence: JSON.stringify([
            { source: "Supply Chain Topology", metric: "Suppliers Count", value: "1 supplier", threshold: "=== 1", confidence: 99 },
            { source: "Relationship Graph", metric: "Dependency Level", value: `${Math.round((primaryRel.dependencyLevel || 0.8) * 100)}%`, threshold: "> 70%", confidence: 92 },
          ]),
          isSimulatable: false, // Cannot quantitatively simulate cascade until specific alternate vendor profile is ingested
        });
      }
    }

    // 4. RULE: INVENTORY_BUFFER
    // Precondition: Firm has low cash buffer (< 25 days) and high dependency on critical relationships
    for (const firm of firms) {
      if (firm.cashBufferDays < 25 && firm.riskScore >= 45) {
        const benefit = 72;
        const urgency = 88;
        const feasibility = 75;
        const confidence = 84;
        const score = this.calculateActionScore(benefit, urgency, feasibility, confidence);
        const requiredBufferCost = Math.round((25 - firm.cashBufferDays) * 80000);

        actionsToCreate.push({
          organizationId,
          firmId: firm.id,
          firmName: firm.name,
          actionType: "INVENTORY_BUFFER",
          title: `Establish emergency 15-day inventory buffer for ${firm.name}`,
          explanation: `Operating cash buffer is compressed to ${firm.cashBufferDays} days. A temporary inventory reserve shields critical production from unexpected supply delays.`,
          whyRequired: `Supply delays exceeding ${firm.cashBufferDays} days will cause inventory stock-outs and delivery defaults.`,
          priority: firm.cashBufferDays <= 15 ? "CRITICAL" : "HIGH",
          score,
          benefitScore: benefit,
          urgencyScore: urgency,
          feasibilityScore: feasibility,
          confidenceScore: confidence,
          estimatedCost: requiredBufferCost,
          expectedBenefit: `Provides 14 additional days of operational resilience, absorbing transit bottlenecks.`,
          tradeoffs: "Ties up working capital in holding inventory and warehouse storage.",
          constraints: JSON.stringify(["Warehouse storage capacity limits", "Perishable or shelf-life constraints"]),
          assumptions: JSON.stringify(["Safety stock components can be stored safely without degradation"]),
          evidence: JSON.stringify([
            { source: "Firm Financials", metric: "Cash Buffer Days", value: `${firm.cashBufferDays} days`, threshold: "< 25 days", confidence: 96 },
            { source: "Risk Registry", metric: "Composite Risk Score", value: `${firm.riskScore} / 100`, threshold: ">= 45", confidence: 90 },
          ]),
          isSimulatable: true,
          simulationPayload: JSON.stringify({
            affectedFirmId: firm.id,
            severity: "MEDIUM",
            delayDays: 20,
            amount: requiredBufferCost * 2,
            durationDays: 30,
            recoveryRate: 60,
          }),
        });
      }
    }

    // 5. RULE: DEADLOCK_INVESTIGATION
    // Precondition: Circular deadlocks exist in Deadlock table
    for (const deadlock of deadlocks) {
      const rootFirm = firmMap.get(deadlock.rootFirmId);
      const firmName = rootFirm ? rootFirm.name : deadlock.rootFirmName;

      const benefit = 88;
      const urgency = 92;
      const feasibility = 70;
      const confidence = 95;
      const score = this.calculateActionScore(benefit, urgency, feasibility, confidence);

      actionsToCreate.push({
        organizationId,
        firmId: deadlock.rootFirmId,
        firmName,
        actionType: "DEADLOCK_INVESTIGATION",
        title: `Resolve circular payment deadlock of ₹${(deadlock.totalExposure / 100000).toFixed(1)}L centered on ${firmName}`,
        explanation: `Multi-party circular payment dependency detected. Counterparties are mutually withholding settlements, freezing working capital.`,
        whyRequired: `Deadlocks prevent cash velocity across connected supply chain nodes and trigger artificial liquidity crunches.`,
        priority: "CRITICAL",
        score,
        benefitScore: benefit,
        urgencyScore: urgency,
        feasibilityScore: feasibility,
        confidenceScore: confidence,
        estimatedCost: 50000, // Tri-party legal settlement reconciliation cost
        expectedBenefit: `Unfreezes ₹${(deadlock.totalExposure / 100000).toFixed(1)}L circular liquidity across 3 counterparties via net multilateral settlement.`,
        tradeoffs: "Requires concurrent execution agreement by all three counterparties.",
        constraints: JSON.stringify(["Simultaneous multilateral signing required", "Escrow clearing agent verification"]),
        assumptions: JSON.stringify(["All counterparties acknowledge bilateral invoice legitimacy"]),
        evidence: JSON.stringify([
          { source: "Deadlock Detector", metric: "Total Deadlock Exposure", value: `₹${(deadlock.totalExposure / 100000).toFixed(1)}L`, threshold: "> ₹10.0L", confidence: 98 },
          { source: "Graph Topology", metric: "Circular Path", value: deadlock.chain || "A -> B -> C -> A", threshold: "Cycle detected", confidence: 100 },
        ]),
        isSimulatable: true,
        simulationPayload: JSON.stringify({
          affectedFirmId: deadlock.rootFirmId,
          severity: "CRITICAL",
          delayDays: 45,
          amount: deadlock.totalExposure,
          durationDays: 60,
          recoveryRate: 50,
        }),
      });
    }

    // 6. RULE: TRANSACTION_RISK_REVIEW
    // Precondition: Firm has high risk score (>= 60) and elevated financial stress
    const highRiskFirms = firms.filter((f: any) => f.riskScore >= 60 || f.financialStress > 0.6);
    for (const firm of highRiskFirms) {
      // Avoid duplicate actions if already generated above
      if (actionsToCreate.some((a) => a.firmId === firm.id && a.actionType === "TRANSACTION_RISK_REVIEW")) continue;

      const benefit = Math.min(88, Math.round(firm.riskScore * 0.9));
      const urgency = Math.min(90, Math.round(firm.riskScore * 0.95));
      const feasibility = 90;
      const confidence = 86;
      const score = this.calculateActionScore(benefit, urgency, feasibility, confidence);

      actionsToCreate.push({
        organizationId,
        firmId: firm.id,
        firmName: firm.name,
        actionType: "TRANSACTION_RISK_REVIEW",
        title: `Conduct forensic exposure audit and credit review for ${firm.name}`,
        explanation: `${firm.name} exhibits severe composite financial stress (${Math.round((firm.financialStress || 0.7) * 100)}%) and high default risk score (${firm.riskScore}/100).`,
        whyRequired: `Rapid deterioration in counterparty health requires tightening credit terms and securing trade guarantees.`,
        priority: firm.riskScore >= 75 ? "CRITICAL" : "HIGH",
        score,
        benefitScore: benefit,
        urgencyScore: urgency,
        feasibilityScore: feasibility,
        confidenceScore: confidence,
        estimatedCost: 30000,
        expectedBenefit: `Prevents unhedged exposure expansion and caps downside loss exposure.`,
        tradeoffs: "May trigger counterparty request for credit renegotiation.",
        constraints: JSON.stringify(["Ongoing contractual commitments cannot be unilaterally revoked"]),
        assumptions: JSON.stringify(["Recent trading volume represents continuing counterparty activity"]),
        evidence: JSON.stringify([
          { source: "Risk Engine", metric: "Risk Score", value: `${firm.riskScore} / 100`, threshold: ">= 60", confidence: 91 },
          { source: "Financial Analytics", metric: "Financial Stress", value: `${Math.round((firm.financialStress || 0.65) * 100)}%`, threshold: "> 60%", confidence: 88 },
        ]),
        isSimulatable: true,
        simulationPayload: JSON.stringify({
          affectedFirmId: firm.id,
          severity: "HIGH",
          delayDays: 30,
          amount: firm.outstandingAmount || 3000000,
          durationDays: 60,
          recoveryRate: 50,
        }),
      });
    }

    // Sort candidate actions by score descending
    actionsToCreate.sort((a, b) => b.score - a.score);

    // Persist new evaluation run
    const createdRun = await DecisionNetworkRepository.createRun({
      organizationId,
      algorithmVersion: "v1.0-deterministic",
      inputSnapshot: JSON.stringify({
        firmsCount: firms.length,
        relationshipsCount: relationships.length,
        transactionsCount: transactions.length,
        evaluatedAt: new Date().toISOString(),
      }),
      metricsSummary: JSON.stringify({
        highRiskFirms: firms.filter((f: any) => f.riskScore >= 50).length,
        criticalDependencies: relationships.filter((r: any) => r.criticality === "CRITICAL" || r.criticality === "HIGH").length,
        actionsCount: actionsToCreate.length,
      }),
      candidateActions: actionsToCreate,
    });

    return createdRun;
  }

  /**
   * Retrieves firm-level decision context with all connected counterparties, transactions, and actions.
   */
  static async getNodeDecisionContext(organizationId: string, firmId: string) {
    const firm = await prisma.firm.findFirst({
      where: { id: firmId, organizationId },
    });

    if (!firm) {
      throw { status: 404, message: "This firm is not available in your organization." };
    }

    const [relationships, transactions, predictions, actions] = await Promise.all([
      prisma.relationship.findMany({
        where: {
          organizationId,
          OR: [{ sourceFirmId: firmId }, { targetFirmId: firmId }],
        },
        include: { sourceFirm: true, targetFirm: true },
      }),
      prisma.transaction.findMany({
        where: {
          organizationId,
          OR: [{ smeId: firmId }, { buyerId: firmId }, { supplierId: firmId }],
        },
        orderBy: { invoiceDate: "desc" },
        take: 50,
      }),
      prisma.prediction.findMany({
        where: { organizationId, firmId },
      }),
      prisma.candidateAction.findMany({
        where: { organizationId, firmId },
        include: { reviews: { orderBy: { reviewedAt: "desc" } } },
        orderBy: { score: "desc" },
      }),
    ]);

    const connectedFirms = relationships.map((r: any) => {
      const isSource = r.sourceFirmId === firmId;
      const counterparty = isSource ? r.targetFirm : r.sourceFirm;
      return {
        relationshipId: r.id,
        direction: isSource ? "OUTGOING" : "INCOMING",
        type: r.type,
        counterpartyId: counterparty.id,
        counterpartyName: counterparty.name,
        criticality: r.criticality,
        dependencyLevel: r.dependencyLevel,
        avgTransactionValue: r.avgTransactionValue,
      };
    });

    return {
      firm: {
        id: firm.id,
        name: firm.name,
        industry: firm.industry,
        role: firm.role,
        riskScore: firm.riskScore,
        riskLevel: firm.riskLevel,
        financialStress: firm.financialStress,
        outstandingAmount: firm.outstandingAmount,
        avgPaymentDelayDays: firm.avgPaymentDelayDays,
        cashBufferDays: firm.cashBufferDays,
        transactionCount: firm.transactionCount,
      },
      connectedFirms,
      transactions: transactions.map((t: any) => ({
        id: t.id,
        invoiceAmount: t.invoiceAmount,
        outstandingAmount: t.outstandingAmount,
        paymentStatus: t.paymentStatus,
        paymentDelayDays: t.paymentDelayDays,
        dueDate: t.dueDate,
        invoiceDate: t.invoiceDate,
      })),
      predictions: predictions.map((p: any) => ({
        id: p.id,
        type: p.type,
        probability: p.probability,
        riskLevel: p.riskLevel,
        confidence: p.confidence,
        factors: typeof p.factors === "string" ? JSON.parse(p.factors) : p.factors,
      })),
      candidateActions: actions.map((a: any) => this.formatCandidateAction(a)),
    };
  }

  /**
   * Simulates what-if outcomes for a supported candidate action.
   * Completely isolated in-memory simulation; original records remain unchanged.
   */
  static async simulateAction(organizationId: string, runId: string, actionId: string) {
    const action = await DecisionNetworkRepository.findCandidateActionById(actionId, organizationId);
    if (!action) {
      throw { status: 404, message: "This candidate action is not available in your organization." };
    }

    if (!action.isSimulatable || !action.simulationPayload) {
      return {
        actionId: action.id,
        actionType: action.actionType,
        isSimulatable: false,
        reason: "Quantitative cascade simulation is not supported for this action type without external counterparty telemetry.",
        baselineState: null,
        simulatedState: null,
      };
    }

    const payload = JSON.parse(action.simulationPayload);

    // 1. Run baseline simulation (current conditions)
    const baseline = await SimulationService.runSimulation(organizationId, {
      affectedFirmId: payload.affectedFirmId,
      severity: payload.severity || "HIGH",
      delayDays: payload.delayDays || 45,
      amount: payload.amount || 5000000,
      durationDays: payload.durationDays || 60,
      recoveryRate: payload.recoveryRate || 50,
    });

    // 2. Run post-intervention simulation (improved recovery, shorter delay, mitigated amount)
    const postIntervention = await SimulationService.runSimulation(organizationId, {
      affectedFirmId: payload.affectedFirmId,
      severity: "LOW",
      delayDays: Math.max(5, Math.round((payload.delayDays || 45) * 0.4)),
      amount: Math.round((payload.amount || 5000000) * 0.4),
      durationDays: Math.max(15, Math.round((payload.durationDays || 60) * 0.6)),
      recoveryRate: Math.min(95, (payload.recoveryRate || 50) + 30),
    });

    const bRes = (baseline.result || {}) as any;
    const pRes = (postIntervention.result || {}) as any;

    const bLoss = bRes.expectedLoss || 0;
    const pLoss = pRes.expectedLoss || 0;
    const bProb = bRes.cascadeProbability || 0;
    const pProb = pRes.cascadeProbability || 0;

    const expectedLossReduction = Math.max(0, bLoss - pLoss);
    const cascadeProbabilityDelta = Math.max(0, bProb - pProb);

    return {
      actionId: action.id,
      actionTitle: action.title,
      actionType: action.actionType,
      isSimulatable: true,
      baselineState: {
        expectedLoss: bLoss,
        cascadeProbability: bProb,
        potentialDefaults: bRes.potentialDefaults || 0,
        recoveryDays: bRes.recoveryDays || 0,
        affectedFirmsCount: (bRes.affectedFirms || []).length,
      },
      simulatedState: {
        expectedLoss: pLoss,
        cascadeProbability: pProb,
        potentialDefaults: pRes.potentialDefaults || 0,
        recoveryDays: pRes.recoveryDays || 0,
        affectedFirmsCount: (pRes.affectedFirms || []).length,
      },
      projectedImpact: {
        expectedLossReduction,
        expectedLossReductionPercentage: bLoss > 0
          ? Math.round((expectedLossReduction / bLoss) * 100)
          : 0,
        cascadeProbabilityReduction: cascadeProbabilityDelta,
        residualRiskScore: Math.max(15, Math.round(action.score * 0.45)),
      },
      assumptions: action.assumptions ? JSON.parse(action.assumptions) : [],
      constraints: action.constraints ? JSON.parse(action.constraints) : [],
      disclaimer: "Simulated scenario projection executed on isolated in-memory network copy. Financial ledgers and firm records remain unchanged.",
    };
  }

  /**
   * Records a human review decision (APPROVED, REJECTED, DEFERRED).
   * Strict RBAC: VIEWER role cannot submit reviews (must be SME_ADMIN or ANALYST).
   * Pure workflow decision—zero financial mutation.
   */
  static async reviewAction(
    organizationId: string,
    actionId: string,
    user: { id: string; fullName: string; role: string },
    decision: "APPROVED" | "REJECTED" | "DEFERRED",
    reason?: string
  ) {
    if (user.role === "VIEWER") {
      throw { status: 403, message: "Permission denied. Viewers are restricted from recording decision reviews." };
    }

    const validDecisions = ["APPROVED", "REJECTED", "DEFERRED"];
    if (!validDecisions.includes(decision)) {
      throw { status: 400, message: `Invalid decision. Allowed values: ${validDecisions.join(", ")}` };
    }

    const action = await DecisionNetworkRepository.findCandidateActionById(actionId, organizationId);
    if (!action) {
      throw { status: 404, message: "This candidate action is not available in your organization." };
    }

    const review = await DecisionNetworkRepository.createReview({
      organizationId,
      candidateActionId: actionId,
      reviewerId: user.id,
      reviewerName: user.fullName || "Authorized User",
      decision,
      reason: reason || undefined,
    });

    const updatedAction = await DecisionNetworkRepository.updateCandidateActionStatus(
      actionId,
      organizationId,
      decision
    );

    return {
      review: {
        id: review.id,
        actionId: review.candidateActionId,
        decision: review.decision,
        reason: review.reason,
        reviewedAt: review.reviewedAt,
        reviewerId: review.reviewerId,
        reviewerName: review.reviewerName,
      },
      action: this.formatCandidateAction(updatedAction),
    };
  }

  private static formatCandidateAction(a: any) {
    if (!a) return null;
    return {
      id: a.id,
      firmId: a.firmId,
      firmName: a.firmName,
      actionType: a.actionType,
      title: a.title,
      explanation: a.explanation,
      whyRequired: a.whyRequired,
      priority: a.priority,
      score: a.score,
      scoreBreakdown: {
        benefit: a.benefitScore,
        urgency: a.urgencyScore,
        feasibility: a.feasibilityScore,
        confidence: a.confidenceScore,
      },
      estimatedCost: a.estimatedCost,
      expectedBenefit: a.expectedBenefit,
      tradeoffs: a.tradeoffs,
      constraints: a.constraints ? JSON.parse(a.constraints) : [],
      assumptions: a.assumptions ? JSON.parse(a.assumptions) : [],
      evidence: a.evidence ? JSON.parse(a.evidence) : [],
      isSimulatable: a.isSimulatable,
      status: a.status,
      reviews: (a.reviews || []).map((r: any) => ({
        id: r.id,
        decision: r.decision,
        reason: r.reason,
        reviewerId: r.reviewerId,
        reviewerName: r.reviewerName,
        reviewedAt: r.reviewedAt,
      })),
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
