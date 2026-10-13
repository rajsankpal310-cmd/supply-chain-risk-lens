import { CanonicalInvoiceContract } from "../../pipeline/canonicalContract";

export type IndianSmeTargetId =
  | "PAYMENT_DELAY_RISK"
  | "PAYMENT_DELAY_SEVERITY"
  | "SEVERE_DELINQUENCY_RISK"
  | "MSMEDA_45D_STATUTORY_BREACH"
  | "SME_FINANCIAL_STRESS";

export interface TargetSupportEvaluation {
  targetId: IndianSmeTargetId;
  supported: boolean;
  reason: string;
  requiredFields: string[];
  missingFields: string[];
  observedMaturedCount: number;
  censoredCount: number;
  positiveCount?: number;
  negativeCount?: number;
  meanValue?: number;
  medianValue?: number;
}

export interface ComputedTargetRow {
  transaction_id: string;
  isMatured: boolean;
  isCensored: boolean;
  paymentDelayDays: number | null; // actual delay in days
  isPaymentDelayed: boolean | null; // PAYMENT_DELAY_RISK (binary)
  delaySeverityDays: number | null; // PAYMENT_DELAY_SEVERITY (continuous)
  isSevereDelinquency: boolean | null; // SEVERE_DELINQUENCY_RISK (DPD >= 90)
  isMsmeda45dBreach: boolean | null; // MSMEDA Section 15 breach (>45 days from invoice date)
  smeFinancialStressScore: number | null; // UNSUPPORTED unless longitudinal ratios present
}

export class IndianSmeTargetRegistry {
  /**
   * Evaluates support for all Indian SME targets based on actually observed fields.
   * If required fields are absent or insufficient, target is marked UNSUPPORTED.
   */
  static evaluateTargetSupport(
    records: CanonicalInvoiceContract[],
    referenceDate: Date = new Date()
  ): Record<IndianSmeTargetId, TargetSupportEvaluation> {
    if (!records || records.length === 0) {
      return {
        PAYMENT_DELAY_RISK: {
          targetId: "PAYMENT_DELAY_RISK",
          supported: false,
          reason: "Zero records provided to evaluate target support.",
          requiredFields: ["payment_date", "due_date"],
          missingFields: ["payment_date", "due_date"],
          observedMaturedCount: 0,
          censoredCount: 0,
        },
        PAYMENT_DELAY_SEVERITY: {
          targetId: "PAYMENT_DELAY_SEVERITY",
          supported: false,
          reason: "Zero records provided to evaluate target support.",
          requiredFields: ["payment_date", "due_date"],
          missingFields: ["payment_date", "due_date"],
          observedMaturedCount: 0,
          censoredCount: 0,
        },
        SEVERE_DELINQUENCY_RISK: {
          targetId: "SEVERE_DELINQUENCY_RISK",
          supported: false,
          reason: "Zero records provided to evaluate target support.",
          requiredFields: ["due_date"],
          missingFields: ["due_date"],
          observedMaturedCount: 0,
          censoredCount: 0,
        },
        MSMEDA_45D_STATUTORY_BREACH: {
          targetId: "MSMEDA_45D_STATUTORY_BREACH",
          supported: false,
          reason: "Zero records provided to evaluate target support.",
          requiredFields: ["invoice_date"],
          missingFields: ["invoice_date"],
          observedMaturedCount: 0,
          censoredCount: 0,
        },
        SME_FINANCIAL_STRESS: {
          targetId: "SME_FINANCIAL_STRESS",
          supported: false,
          reason: "Zero records provided. Financial stress requires multi-period balance sheet/P&L records.",
          requiredFields: ["current_ratio", "debt_service_coverage", "ebitda_margin"],
          missingFields: ["current_ratio", "debt_service_coverage", "ebitda_margin"],
          observedMaturedCount: 0,
          censoredCount: 0,
        },
      };
    }

    let recordsWithDueDate = 0;
    let recordsWithInvoiceDate = 0;
    let recordsWithPaymentDate = 0;
    let delayedRiskPos = 0;
    let delayedRiskNeg = 0;
    let severePos = 0;
    let severeNeg = 0;
    let msmedaPos = 0;
    let msmedaNeg = 0;
    let totalDelayDays = 0;
    let maturedCount = 0;
    let censoredCount = 0;

    for (const r of records) {
      if (r.due_date && !isNaN(new Date(r.due_date).getTime())) recordsWithDueDate++;
      if (r.invoice_date && !isNaN(new Date(r.invoice_date).getTime())) recordsWithInvoiceDate++;
      if (r.payment_date && !isNaN(new Date(r.payment_date).getTime())) {
        recordsWithPaymentDate++;
        maturedCount++;

        const pDate = new Date(r.payment_date).getTime();
        const dDate = new Date(r.due_date).getTime();
        const iDate = new Date(r.invoice_date).getTime();

        const delayDays = Math.round((pDate - dDate) / (1000 * 60 * 60 * 24));
        const statutoryAge = Math.round((pDate - iDate) / (1000 * 60 * 60 * 24));

        if (delayDays > 0) {
          delayedRiskPos++;
          totalDelayDays += delayDays;
        } else {
          delayedRiskNeg++;
        }

        if (delayDays >= 90) {
          severePos++;
        } else {
          severeNeg++;
        }

        if (statutoryAge > 45) {
          msmedaPos++;
        } else {
          msmedaNeg++;
        }
      } else {
        // Open/unpaid invoice
        censoredCount++;
        if (r.due_date) {
          const dDate = new Date(r.due_date).getTime();
          const currentOverdueDays = Math.round((referenceDate.getTime() - dDate) / (1000 * 60 * 60 * 24));
          if (currentOverdueDays >= 90) {
            severePos++;
          }
        }
      }
    }

    const hasPaymentDates = recordsWithPaymentDate >= 10; // minimum statistical requirement
    const hasDueDates = recordsWithDueDate === records.length;
    const hasInvoiceDates = recordsWithInvoiceDate === records.length;

    // PAYMENT_DELAY_RISK
    const paymentDelaySupported = hasPaymentDates && hasDueDates;
    const paymentDelayRisk: TargetSupportEvaluation = {
      targetId: "PAYMENT_DELAY_RISK",
      supported: paymentDelaySupported,
      reason: paymentDelaySupported
        ? `Supported: ${recordsWithPaymentDate} completed payment dates observed against valid due dates.`
        : `UNSUPPORTED: Insufficient completed payment dates (${recordsWithPaymentDate}/${records.length} observed, min 10 required). Cannot evaluate payment delay risk without historical closure dates.`,
      requiredFields: ["payment_date", "due_date"],
      missingFields: [
        ...(hasPaymentDates ? [] : ["payment_date"]),
        ...(hasDueDates ? [] : ["due_date"]),
      ],
      observedMaturedCount: maturedCount,
      censoredCount,
      positiveCount: delayedRiskPos,
      negativeCount: delayedRiskNeg,
    };

    // PAYMENT_DELAY_SEVERITY
    const delaySeveritySupported = hasPaymentDates && hasDueDates;
    const paymentDelaySeverity: TargetSupportEvaluation = {
      targetId: "PAYMENT_DELAY_SEVERITY",
      supported: delaySeveritySupported,
      reason: delaySeveritySupported
        ? `Supported: Continuous payment delay observed across ${maturedCount} settled invoices.`
        : `UNSUPPORTED: Insufficient resolved payment records to measure continuous delay magnitude.`,
      requiredFields: ["payment_date", "due_date"],
      missingFields: [
        ...(hasPaymentDates ? [] : ["payment_date"]),
        ...(hasDueDates ? [] : ["due_date"]),
      ],
      observedMaturedCount: maturedCount,
      censoredCount,
      meanValue: maturedCount > 0 ? totalDelayDays / maturedCount : undefined,
    };

    // SEVERE_DELINQUENCY_RISK (DPD >= 90)
    const severeSupported = hasDueDates && (recordsWithPaymentDate > 0 || censoredCount > 0);
    const severeDelinquency: TargetSupportEvaluation = {
      targetId: "SEVERE_DELINQUENCY_RISK",
      supported: severeSupported,
      reason: severeSupported
        ? `Supported: RBI SMA-2/NPA 90-day overdue threshold evaluated on ${records.length} invoices.`
        : `UNSUPPORTED: Incomplete due_date fields.`,
      requiredFields: ["due_date"],
      missingFields: hasDueDates ? [] : ["due_date"],
      observedMaturedCount: maturedCount,
      censoredCount,
      positiveCount: severePos,
      negativeCount: severeNeg,
    };

    // MSMEDA_45D_STATUTORY_BREACH
    const msmedaSupported = hasInvoiceDates && hasPaymentDates;
    const msmedaBreach: TargetSupportEvaluation = {
      targetId: "MSMEDA_45D_STATUTORY_BREACH",
      supported: msmedaSupported,
      reason: msmedaSupported
        ? `Supported: Section 15 MSMED Act 45-day statutory payment ceiling evaluated on ${maturedCount} settlements.`
        : `UNSUPPORTED: Requires both settled payment dates and invoice dates to audit statutory 45-day compliance.`,
      requiredFields: ["invoice_date", "payment_date"],
      missingFields: [
        ...(hasInvoiceDates ? [] : ["invoice_date"]),
        ...(hasPaymentDates ? [] : ["payment_date"]),
      ],
      observedMaturedCount: maturedCount,
      censoredCount,
      positiveCount: msmedaPos,
      negativeCount: msmedaNeg,
    };

    // SME_FINANCIAL_STRESS - Strictly require longitudinal financial accounting statements
    // We check if raw_payload contains financial statement fields
    const hasFinancialStatements = records.some(
      (r) =>
        r.raw_payload &&
        ("current_ratio" in r.raw_payload ||
          "debt_service_coverage" in r.raw_payload ||
          "ebitda_margin" in r.raw_payload)
    );

    const financialStress: TargetSupportEvaluation = {
      targetId: "SME_FINANCIAL_STRESS",
      supported: hasFinancialStatements,
      reason: hasFinancialStatements
        ? `Supported: Balance sheet and liquidity ratios discovered in audited financial records.`
        : `UNSUPPORTED: Ingested records are transactional trade invoices without multi-year longitudinal audited financial ratios (Current Ratio, DSCR, Interest Coverage). Never synthesizing financial stress.`,
      requiredFields: ["current_ratio", "debt_service_coverage", "ebitda_margin"],
      missingFields: hasFinancialStatements
        ? []
        : ["current_ratio", "debt_service_coverage", "ebitda_margin"],
      observedMaturedCount: 0,
      censoredCount: records.length,
    };

    return {
      PAYMENT_DELAY_RISK: paymentDelayRisk,
      PAYMENT_DELAY_SEVERITY: paymentDelaySeverity,
      SEVERE_DELINQUENCY_RISK: severeDelinquency,
      MSMEDA_45D_STATUTORY_BREACH: msmedaBreach,
      SME_FINANCIAL_STRESS: financialStress,
    };
  }

  /**
   * Computes ground truth targets for individual records strictly from observed timestamps.
   */
  static computeTargets(
    records: CanonicalInvoiceContract[],
    referenceDate: Date = new Date()
  ): ComputedTargetRow[] {
    return records.map((r) => {
      const hasPayment = !!(r.payment_date && !isNaN(new Date(r.payment_date).getTime()));
      const iDate = new Date(r.invoice_date).getTime();
      const dDate = new Date(r.due_date).getTime();

      if (hasPayment) {
        const pDate = new Date(r.payment_date!).getTime();
        const delayDays = Math.round((pDate - dDate) / (1000 * 60 * 60 * 24));
        const statutoryAge = Math.round((pDate - iDate) / (1000 * 60 * 60 * 24));

        return {
          transaction_id: r.transaction_id,
          isMatured: true,
          isCensored: false,
          paymentDelayDays: delayDays,
          isPaymentDelayed: delayDays > 0,
          delaySeverityDays: Math.max(0, delayDays),
          isSevereDelinquency: delayDays >= 90,
          isMsmeda45dBreach: statutoryAge > 45,
          smeFinancialStressScore: null, // UNSUPPORTED
        };
      }

      // Unpaid / Right-censored
      const overdueDays = Math.round((referenceDate.getTime() - dDate) / (1000 * 60 * 60 * 24));
      return {
        transaction_id: r.transaction_id,
        isMatured: overdueDays > 0,
        isCensored: true,
        paymentDelayDays: null,
        isPaymentDelayed: null,
        delaySeverityDays: null,
        isSevereDelinquency: overdueDays >= 90,
        isMsmeda45dBreach: null,
        smeFinancialStressScore: null,
      };
    });
  }
}
