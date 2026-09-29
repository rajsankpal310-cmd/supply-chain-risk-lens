import { RelationshipRepository } from "../repositories/relationship.repository";

export class RelationshipService {
  static async getRelationships(organizationId: string) {
    return RelationshipRepository.findAll(organizationId, { dependencyLevel: "desc" });
  }

  static async getRelationshipById(organizationId: string, id: string) {
    const rel = await RelationshipRepository.findById(id, organizationId);
    if (!rel) throw { status: 404, message: "This resource is not available in your organization." };
    return rel;
  }

  static async createRelationship(organizationId: string, data: any) {
    const count = await RelationshipRepository.count(organizationId);
    const id = data.id || `REL-${String(count + 1).padStart(3, "0")}`;
    return RelationshipRepository.create({ ...data, id, organizationId });
  }

  static async updateRelationship(organizationId: string, id: string, patch: any) {
    const existing = await RelationshipRepository.findById(id, organizationId);
    if (!existing) throw { status: 404, message: "This resource is not available in your organization." };
    delete patch.organizationId;
    return RelationshipRepository.update(id, organizationId, patch);
  }

  static async deleteRelationship(organizationId: string, id: string) {
    const existing = await RelationshipRepository.findById(id, organizationId);
    if (!existing) throw { status: 404, message: "This resource is not available in your organization." };
    await RelationshipRepository.delete(id, organizationId);
    return { success: true };
  }
}
