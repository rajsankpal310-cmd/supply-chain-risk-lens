import { CanonicalInvoiceContract } from "../../pipeline/canonicalContract";

export interface IndianSmeFeatureVector {
  transaction_id: string;
  invoice_amount: number;
  log_amount: number;
  credit_period_days: number;
  statutory_credit_stretch_days: number; // max(0, credit_period - 45)
  buyer_historical_delay_rate: number; // 0 to 1
  buyer_historical_mean_delay_days: number;
  buyer_prior_invoice_count: number;
  buyer_concentration_ratio: number; // share of SME's prior invoice value
  buyer_relationship_days: number; // days since first transaction with buyer
  month_of_year: number; // 1-12
  day_of_week: number; // 0-6
  is_indian_fy_end_quarter: number; // 1 if Q4 (Jan-Mar) or Q2 (Jul-Sep), else 0
}

export class IndianSmeFeatureEngine {
  /**
   * Generates strictly pre-t0 leakage-safe feature vectors for Indian SME invoices.
   * Rolling historical metrics are computed ONLY using invoices issued and settled prior to invoice_date.
   */
  static extractFeatures(records: CanonicalInvoiceContract[]): IndianSmeFeatureVector[] {
    // 1. Chronologically sort by invoice_date
    const sorted = [...records].sort(
      (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );

    const features: IndianSmeFeatureVector[] = [];

    // Prior history accumulators
    interface BuyerHistory {
      settledInvoices: {
        settlementDateMs: number;
        delayDays: number;
        wasDelayed: boolean;
      }[];
      totalAmount: number;
      firstInvoiceMs: number;
      invoiceCount: number;
    }

    const buyerMap = new Map<string, BuyerHistory>();
    let totalSmePriorVolume = 0;

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const t0 = new Date(current.invoice_date).getTime();
      const dueDateMs = new Date(current.due_date).getTime();
      const creditPeriod = Math.max(1, Math.round((dueDateMs - t0) / (1000 * 60 * 60 * 24)));
      const statutoryStretch = Math.max(0, creditPeriod - 45);

      const buyerId = current.buyer_id;
      const bHistory = buyerMap.get(buyerId);

      let buyerDelayRate = 0.25; // Bayesian prior: typical 25% MSME delay base
      let buyerMeanDelay = 0;
      let buyerInvoices = 0;
      let buyerConcentration = 0;
      let relationshipDays = 0;

      if (bHistory) {
        // Filter strictly to payments settled PRIOR to t0
        const strictlyPriorSettlements = bHistory.settledInvoices.filter(
          (s) => s.settlementDateMs < t0
        );

        buyerInvoices = strictlyPriorSettlements.length;
        if (buyerInvoices > 0) {
          const delayedCount = strictlyPriorSettlements.filter((s) => s.wasDelayed).length;
          buyerDelayRate = delayedCount / buyerInvoices;
          const sumDelay = strictlyPriorSettlements.reduce((sum, s) => sum + Math.max(0, s.delayDays), 0);
          buyerMeanDelay = sumDelay / buyerInvoices;
        }

        if (totalSmePriorVolume > 0) {
          buyerConcentration = bHistory.totalAmount / totalSmePriorVolume;
        }

        relationshipDays = Math.max(0, Math.round((t0 - bHistory.firstInvoiceMs) / (1000 * 60 * 60 * 24)));
      }

      const invDate = new Date(current.invoice_date);
      const month = invDate.getUTCMonth() + 1;
      const dayOfWeek = invDate.getUTCDay();
      // Indian Financial Year Q4 is Jan-Mar (highest liquidity crunch / tax closing)
      const isIndianFyEnd = month >= 1 && month <= 3 ? 1 : 0;

      const vec: IndianSmeFeatureVector = {
        transaction_id: current.transaction_id,
        invoice_amount: current.invoice_amount,
        log_amount: Math.log(1 + Math.max(0, current.invoice_amount)),
        credit_period_days: creditPeriod,
        statutory_credit_stretch_days: statutoryStretch,
        buyer_historical_delay_rate: Number(buyerDelayRate.toFixed(4)),
        buyer_historical_mean_delay_days: Number(buyerMeanDelay.toFixed(2)),
        buyer_prior_invoice_count: buyerInvoices,
        buyer_concentration_ratio: Number(Math.min(1, buyerConcentration).toFixed(4)),
        buyer_relationship_days: relationshipDays,
        month_of_year: month,
        day_of_week: dayOfWeek,
        is_indian_fy_end_quarter: isIndianFyEnd,
      };

      features.push(vec);

      // Now update history for future records
      totalSmePriorVolume += current.invoice_amount;

      let bHist = buyerMap.get(buyerId);
      if (!bHist) {
        bHist = {
          settledInvoices: [],
          totalAmount: 0,
          firstInvoiceMs: t0,
          invoiceCount: 0,
        };
        buyerMap.set(buyerId, bHist);
      }

      bHist.totalAmount += current.invoice_amount;
      bHist.invoiceCount += 1;

      if (current.payment_date) {
        const paymentDateMs = new Date(current.payment_date).getTime();
        const delayDays = Math.round((paymentDateMs - dueDateMs) / (1000 * 60 * 60 * 24));
        bHist.settledInvoices.push({
          settlementDateMs: paymentDateMs,
          delayDays,
          wasDelayed: delayDays > 0,
        });
      }
    }

    return features;
  }
}
