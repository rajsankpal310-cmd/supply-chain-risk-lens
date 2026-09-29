import { FirmRepository } from "../repositories/firm.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { recalculateFirmRisk } from "../utils/riskCalculator";

export class TransactionService {
  static async getTransactions(organizationId: string, query: any) {
    const {
      search,
      status,
      risk,
      buyerId,
      supplierId,
      from,
      to,
      sortBy = "invoiceDate",
      sortDir = "desc",
      page = 1,
      pageSize = 10,
    } = query;

    const where: any = {};

    if (status && status !== "ALL") where.paymentStatus = status;
    if (risk && risk !== "ALL") where.riskLevel = risk;
    if (buyerId && buyerId !== "ALL") where.buyerId = buyerId;
    if (supplierId && supplierId !== "ALL") where.supplierId = supplierId;
    if (from) where.invoiceDate = { ...(where.invoiceDate || {}), gte: new Date(from) };
    if (to) where.invoiceDate = { ...(where.invoiceDate || {}), lte: new Date(to) };
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { id: { contains: term } },
        { transactionId: { contains: term } },
        { buyer: { name: { contains: term } } },
        { sme: { name: { contains: term } } },
      ];
    }

    const total = await TransactionRepository.count(organizationId, where);
    const orderBy: any = {};
    orderBy[sortBy] = sortDir;

    const items = await TransactionRepository.findMany(
      organizationId,
      where,
      orderBy,
      (page - 1) * pageSize,
      pageSize,
    );

    return { items, total, page, pageSize };
  }

  static async getTransactionById(organizationId: string, id: string) {
    const transaction = await TransactionRepository.findById(id, organizationId);
    if (!transaction) throw { status: 404, message: "This resource is not available in your organization." };
    return transaction;
  }

  static async getRelatedTransactions(organizationId: string, id: string) {
    const txn = await TransactionRepository.findById(id, organizationId);
    if (!txn) return [];
    return TransactionRepository.findMany(
      organizationId,
      {
        id: { not: id },
        OR: [{ buyerId: txn.buyerId }, { smeId: txn.smeId }],
      },
      { invoiceDate: "desc" },
      0,
      6
    );
  }

  static async createTransaction(organizationId: string, data: any) {
    const invoiceDate = new Date(data.invoiceDate);
    const dueDate = new Date(data.dueDate);
    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : null;
    const creditPeriodDays = data.creditPeriodDays || Math.max(1, Math.round((dueDate.getTime() - invoiceDate.getTime()) / 86400000));

    let paymentDelayDays: number | null = null;
    if (paymentDate) {
      paymentDelayDays = Math.max(0, Math.round((paymentDate.getTime() - dueDate.getTime()) / 86400000));
    }

    const count = await TransactionRepository.count(organizationId);
    let id = data.id || `TXN-${String(count + 1).padStart(4, "0")}`;
    if (await TransactionRepository.findById(id)) {
      id = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    // Get firms belonging to organization
    const orgFirms = await FirmRepository.findAll(organizationId);
    const defaultSme = orgFirms[0]?.id || "FIRM-01";
    const defaultBuyer = orgFirms[1]?.id || orgFirms[0]?.id || "FIRM-02";

    const smeId = data.smeId || defaultSme;
    const buyerId = data.buyerId || defaultBuyer;

    const created = await TransactionRepository.create({
      id,
      organizationId, // Authoritative server-side assignment
      transactionId: data.transactionId || `INV-2026-${id}`,
      smeId,
      buyerId,
      supplierId: data.supplierId || null,
      invoiceAmount: Number(data.invoiceAmount),
      outstandingAmount: Number(data.outstandingAmount ?? data.invoiceAmount),
      invoiceDate,
      dueDate,
      paymentDate,
      creditPeriodDays,
      paymentDelayDays,
      paymentStatus: data.paymentStatus || (paymentDate ? "PAID" : "PENDING"),
      riskLevel: data.riskLevel || "LOW",
    });

    await recalculateFirmRisk(smeId, organizationId);
    await recalculateFirmRisk(buyerId, organizationId);

    return created;
  }

  static async updateTransaction(organizationId: string, id: string, patch: any) {
    const existing = await TransactionRepository.findById(id, organizationId);
    if (!existing) throw { status: 404, message: "This resource is not available in your organization." };

    const updateData = { ...patch };
    // Remove organizationId from client patch if attempted
    delete updateData.organizationId;

    if (updateData.invoiceDate) updateData.invoiceDate = new Date(updateData.invoiceDate);
    if (updateData.dueDate) updateData.dueDate = new Date(updateData.dueDate);
    if (updateData.paymentDate) updateData.paymentDate = new Date(updateData.paymentDate);

    if (updateData.paymentStatus === "PAID") {
      if (updateData.outstandingAmount === undefined) {
        updateData.outstandingAmount = 0;
      }
      if (!updateData.paymentDate && !existing.paymentDate) {
        updateData.paymentDate = new Date();
      }
      const payDate = updateData.paymentDate ? new Date(updateData.paymentDate) : (existing.paymentDate ? new Date(existing.paymentDate) : new Date());
      const dDate = updateData.dueDate ? new Date(updateData.dueDate) : new Date(existing.dueDate);
      updateData.paymentDelayDays = Math.max(0, Math.round((payDate.getTime() - dDate.getTime()) / 86400000));
    } else if (updateData.paymentStatus && updateData.paymentStatus !== "PAID" && existing.paymentStatus === "PAID") {
      if (updateData.outstandingAmount === undefined && Number(existing.outstandingAmount) === 0) {
        updateData.outstandingAmount = existing.invoiceAmount;
      }
      if (updateData.paymentDate === undefined) {
        updateData.paymentDate = null;
      }
      if (updateData.paymentDelayDays === undefined) {
        updateData.paymentDelayDays = null;
      }
    }

    const updated = await TransactionRepository.update(id, organizationId, updateData);

    await recalculateFirmRisk(existing.smeId, organizationId);
    await recalculateFirmRisk(existing.buyerId, organizationId);
    return updated;
  }

  static async deleteTransaction(organizationId: string, id: string) {
    const existing = await TransactionRepository.findById(id, organizationId);
    if (!existing) throw { status: 404, message: "This resource is not available in your organization." };

    await TransactionRepository.delete(id, organizationId);

    await recalculateFirmRisk(existing.smeId, organizationId);
    await recalculateFirmRisk(existing.buyerId, organizationId);
    return { success: true };
  }
}
