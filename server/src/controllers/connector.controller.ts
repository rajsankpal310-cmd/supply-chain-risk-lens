import { NextFunction, Request, Response } from "express";
import { ConnectorRegistry } from "../connectors/connectorRegistry";
import { SourceRegistry } from "../connectors/sourceRegistry";
import { PrimaryDataOnboardingService } from "../pipeline/primaryDataOnboardingService";
import { QuarantineService } from "../pipeline/quarantineService";
import { ControlledFileIngestionService } from "../pipeline/controlledFileIngestionService";
import { AuditLogService } from "../pipeline/auditLogService";
import { PROVIDER_MAPPING_REGISTRY } from "../pipeline/canonicalContract";
import { sendError, sendSuccess } from "../utils/response";

export class ConnectorController {
  static async listConnectors(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const connectors = ConnectorRegistry.listConnectorsForTenant(organizationId);
      return sendSuccess(res, connectors);
    } catch (error) {
      next(error);
    }
  }

  static async getConnector(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const id = String(req.params.id);
      const detail = ConnectorRegistry.getConnectorDetail(organizationId, id);

      if (!detail) {
        return sendError(res, "Enterprise connector not found", 404);
      }

      return sendSuccess(res, detail);
    } catch (error) {
      next(error);
    }
  }

  static async testConnector(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const actorEmail = (req as any).user!.email || "operator@nexuscfr.in";
      const id = String(req.params.id);
      const credentials = req.body.credentials || {};

      const result = await ConnectorRegistry.testConnection(
        organizationId,
        id,
        credentials,
        actorEmail
      );

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async getCanonicalContract(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, {
        schemaVersion: "3.9-CANONICAL",
        registry: PROVIDER_MAPPING_REGISTRY,
      });
    } catch (error) {
      next(error);
    }
  }

  // Phase 5: Primary Data Onboarding Handlers

  static async registerSource(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const actorEmail = (req as any).user!.email || "compliance@nexuscfr.in";
      const { sourceType, sourceSystem, sourceName, provider, sourceOwner, provenance } = req.body;

      const source = SourceRegistry.registerSource(organizationId, {
        sourceType,
        sourceSystem,
        sourceName,
        provider: provider || sourceType,
        sourceOwner: sourceOwner || { fullName: "System Owner", email: actorEmail },
        provenance,
        actorEmail,
      });

      return sendSuccess(res, source, 201);
    } catch (error) {
      next(error);
    }
  }

  static async listSources(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const sources = SourceRegistry.listSourcesForTenant(organizationId);
      return sendSuccess(res, sources);
    } catch (error) {
      next(error);
    }
  }

  static async authorizeSource(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const actorEmail = (req as any).user!.email || "compliance@nexuscfr.in";
      const sourceId = String(req.params.sourceId);
      const {
        legalConsentReferenceId,
        extractionPurpose,
        dataScope,
        retentionPolicy,
        provenanceClassification,
      } = req.body;

      if (!legalConsentReferenceId) {
        return sendError(res, "Legal consent reference ID is mandatory for enterprise authorization.", 400);
      }

      const updated = SourceRegistry.recordAuthorization(organizationId, sourceId, {
        authorizedByActor: actorEmail,
        legalConsentReferenceId,
        extractionPurpose: extractionPurpose || "SME Financial Risk & Supply Chain Resilience",
        dataScope: dataScope || "INVOICE_TRANSACTION_LEDGERS",
        retentionPolicy: retentionPolicy || "7_YEARS_STATUTORY",
        provenanceClassification: provenanceClassification || "REAL_OBSERVED_ENTERPRISE",
      });

      return sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  static async onboardSourceData(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const actorEmail = (req as any).user!.email || "operator@nexuscfr.in";
      const sourceId = String(req.params.sourceId);
      const { connectorId, batchId, rawRecords } = req.body;

      if (!rawRecords || !Array.isArray(rawRecords) || rawRecords.length === 0) {
        return sendError(res, "rawRecords array is required for data onboarding.", 400);
      }

      const result = await PrimaryDataOnboardingService.executeOnboarding({
        organizationId,
        sourceId,
        connectorId: connectorId || "CONN-FILE-CONTROLLED",
        batchId: batchId || `BAT-${Date.now().toString(36)}`,
        rawRecords,
        actorEmail,
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async listQuarantine(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const statusFilter = req.query.status as any;
      const records = QuarantineService.listQuarantinedRecords(organizationId, statusFilter);
      return sendSuccess(res, records);
    } catch (error) {
      next(error);
    }
  }

  static async reviewQuarantine(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const actorEmail = (req as any).user!.email || "compliance@nexuscfr.in";
      const quarantineId = String(req.params.quarantineId);
      const { decision, notes } = req.body;

      if (decision !== "APPROVED_RELEASE" && decision !== "PERMANENTLY_REJECTED") {
        return sendError(res, "Invalid decision. Must be APPROVED_RELEASE or PERMANENTLY_REJECTED.", 400);
      }

      const resolved = QuarantineService.reviewQuarantineRecord(
        organizationId,
        quarantineId,
        decision,
        actorEmail,
        notes || "Quarantine review executed."
      );

      return sendSuccess(res, resolved);
    } catch (error) {
      next(error);
    }
  }

  static async testSourceConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const actorEmail = (req as any).user!.email || "operator@nexuscfr.in";
      const sourceId = String(req.params.sourceId);
      const { simulateFailure } = req.body;

      const result = SourceRegistry.testConnection(organizationId, sourceId, actorEmail, {
        simulateFailure: Boolean(simulateFailure),
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async ingestControlledFile(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const actorEmail = (req as any).user!.email || "compliance@nexuscfr.in";
      const {
        filename,
        rawPayload,
        sourceName,
        corporateEntityName,
        corporateRegistrationNumber,
        authorizedSignatoryName,
        signatoryTitle,
        legalConsentReferenceId,
        extractionPurpose,
        dataScope,
        retentionPolicy,
        provenance,
      } = req.body;

      if (!filename || !rawPayload) {
        return sendError(res, "filename and rawPayload are required for controlled file ingestion.", 400);
      }

      const result = await ControlledFileIngestionService.ingestControlledFile({
        organizationId,
        uploaderEmail: actorEmail,
        filename,
        rawPayload,
        sourceName,
        corporateEntityName: corporateEntityName || "Client Enterprise Ltd",
        corporateRegistrationNumber,
        authorizedSignatoryName: authorizedSignatoryName || "Authorized Signatory",
        signatoryTitle: signatoryTitle || "Director of Finance",
        legalConsentReferenceId,
        extractionPurpose,
        dataScope,
        retentionPolicy,
        provenance: provenance || "SIMULATED_BENCHMARK",
      });

      return sendSuccess(res, result, 201);
    } catch (error: any) {
      if (error.message?.includes("AUTHORIZATION GATE BLOCKED")) {
        return sendError(res, error.message, 403, "AUTHORIZATION_REQUIRED");
      }
      next(error);
    }
  }

  static async getAuditEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const eventType = req.query.eventType as any;
      const entityId = req.query.entityId as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;

      const events = AuditLogService.getEvents(organizationId, {
        eventType,
        entityId,
        limit,
      });

      return sendSuccess(res, events);
    } catch (error) {
      next(error);
    }
  }

  static async downloadTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = ControlledFileIngestionService.getAuthorizedExportTemplateCsv();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="nexus_cfr_authorized_export_template.csv"');
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  static async getTemplateSpec(req: Request, res: Response, next: NextFunction) {
    try {
      const spec = ControlledFileIngestionService.getAuthorizedExportSpecification();
      return sendSuccess(res, spec);
    } catch (error) {
      next(error);
    }
  }

  static async getAcquisitionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const status = await ControlledFileIngestionService.getRealDataAcquisitionStatus(organizationId);
      return sendSuccess(res, status);
    } catch (error) {
      next(error);
    }
  }
}
