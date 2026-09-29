import { AlertRepository } from "../repositories/alert.repository";
import { FirmRepository } from "../repositories/firm.repository";
import { PredictionRepository } from "../repositories/prediction.repository";
import { RecommendationRepository } from "../repositories/recommendation.repository";
import { RelationshipRepository } from "../repositories/relationship.repository";
import { TransactionRepository } from "../repositories/transaction.repository";

export class FirmService {
  static async getFirms(organizationId: string, query: any = {}) {
    const { search, industry, riskLevel, status } = query;
    const where: any = {};
    if (industry && industry !== "ALL") where.industry = industry;
    if (riskLevel && riskLevel !== "ALL") where.riskLevel = riskLevel;
    if (status && status !== "ALL") where.status = status;
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term } },
        { id: { contains: term } },
        { city: { contains: term } },
      ];
    }
    return FirmRepository.findAll(organizationId, where);
  }

  static async getFirmById(organizationId: string, id: string) {
    const firm = await FirmRepository.findById(id, organizationId);
    if (!firm) throw { status: 404, message: "This resource is not available in your organization." };
    return firm;
  }

  static async getFirmTransactions(organizationId: string, id: string) {
    await this.getFirmById(organizationId, id);
    return TransactionRepository.findAllForFirm(organizationId, id, 25);
  }

  static async getFirmRelationships(organizationId: string, id: string) {
    await this.getFirmById(organizationId, id);
    return RelationshipRepository.findForFirm(organizationId, id);
  }

  static async createFirm(organizationId: string, data: any) {
    const count = await FirmRepository.count(organizationId);
    const firmData = {
      ...data,
      organizationId,
      id: data.id || `FIRM-${Date.now()}-${count + 1}`,
    };
    return FirmRepository.create(firmData);
  }

  static async updateFirm(organizationId: string, id: string, patch: any) {
    const firm = await FirmRepository.findById(id, organizationId);
    if (!firm) throw { status: 404, message: "This resource is not available in your organization." };
    delete patch.organizationId;
    return FirmRepository.update(id, organizationId, patch);
  }

  static async deleteFirm(organizationId: string, id: string) {
    const firm = await FirmRepository.findById(id, organizationId);
    if (!firm) throw { status: 404, message: "This resource is not available in your organization." };

    const txns = await TransactionRepository.findMany(
      organizationId,
      {
        OR: [{ smeId: id }, { buyerId: id }, { supplierId: id }],
      },
      { invoiceDate: "desc" },
      0,
      100
    );
    for (const t of txns) {
      await TransactionRepository.delete(t.id, organizationId);
    }

    const rels = await RelationshipRepository.findForFirm(organizationId, id);
    for (const r of rels) {
      await RelationshipRepository.delete(r.id, organizationId);
    }

    await RecommendationRepository.deleteMany(organizationId, { firmId: id });
    await AlertRepository.deleteMany(organizationId, { firmId: id });
    await PredictionRepository.deleteMany(organizationId, { firmId: id });

    await FirmRepository.delete(id, organizationId);
    return { success: true };
  }
}
