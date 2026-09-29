import { ReportRepository } from "../repositories/report.repository";

export class ReportService {
  static async getReports(organizationId: string) {
    const reports = await ReportRepository.findAll(organizationId);
    return reports.map((r: any) => ({
      ...r,
      createdAt: r.createdAt.toISOString().slice(0, 10),
      lastGeneratedAt: r.lastGeneratedAt ? r.lastGeneratedAt.toISOString().slice(0, 10) : undefined,
      downloadUrl: null,
    }));
  }

  static async getReportById(organizationId: string, id: string) {
    const report = await ReportRepository.findById(id, organizationId);
    if (!report) throw { status: 404, message: "This resource is not available in your organization." };
    return {
      ...report,
      createdAt: report.createdAt.toISOString().slice(0, 10),
      lastGeneratedAt: report.lastGeneratedAt ? report.lastGeneratedAt.toISOString().slice(0, 10) : undefined,
      downloadUrl: null,
    };
  }

  static async generateReport(organizationId: string, id: string) {
    let report = await ReportRepository.findById(id, organizationId);
    if (!report) {
      report = await ReportRepository.create({
        id,
        organizationId,
        name: "Executive Risk Summary",
        description: "Portfolio risk summary report",
        key: `EXECUTIVE_SUMMARY_${id}`,
        status: "PROCESSING",
      });
    }

    const updated = await ReportRepository.update(id, organizationId, {
      status: "READY",
      lastGeneratedAt: new Date(),
    });

    return {
      ...updated,
      createdAt: updated!.createdAt.toISOString().slice(0, 10),
      lastGeneratedAt: updated!.lastGeneratedAt ? updated!.lastGeneratedAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      downloadUrl: null,
    };
  }

  static async generate(organizationId: string, id: string) {
    return this.generateReport(organizationId, id);
  }
}
