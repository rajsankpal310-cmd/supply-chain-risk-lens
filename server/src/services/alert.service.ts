import { AlertRepository } from "../repositories/alert.repository";

export class AlertService {
  static async getAlerts(organizationId: string) {
    const alerts = await AlertRepository.findAll(organizationId);
    return alerts.map((a: any) => ({
      ...a,
      date: a.date.toISOString().slice(0, 10),
    }));
  }

  static async markRead(organizationId: string, id: string, read = true) {
    const alert = await AlertRepository.findById(id, organizationId);
    if (!alert) throw { status: 404, message: "This resource is not available in your organization." };

    const updated = await AlertRepository.update(id, organizationId, { read });

    return {
      ...updated,
      date: updated!.date.toISOString().slice(0, 10),
    };
  }

  static async markAllRead(organizationId: string) {
    await AlertRepository.updateMany(organizationId, { read: true });
    return this.getAlerts(organizationId);
  }

  static async archive(organizationId: string, id: string) {
    const alert = await AlertRepository.findById(id, organizationId);
    if (!alert) throw { status: 404, message: "This resource is not available in your organization." };

    const updated = await AlertRepository.update(id, organizationId, { archived: true, read: true });

    return {
      ...updated,
      date: updated!.date.toISOString().slice(0, 10),
    };
  }
}
