export type SourceType =
  | "PRIMARY_TRANSACTION"
  | "PUBLIC_DATASET"
  | "EXTERNAL_REFERENCE"
  | "DEMO_ONLY"
  | "SIMULATED"
  | "SYNTHETIC"
  | "SURVEY"
  | "ADMINISTRATIVE";

export type DataStatus =
  | "REAL_OBSERVED"
  | "PUBLIC_DATASET"
  | "EXTERNAL_REFERENCE"
  | "ADMINISTRATIVE_AGGREGATE"
  | "SURVEY_MICRODATA"
  | "SIMULATED"
  | "PUBLIC_SIMULATED_DATA"
  | "SYNTHETIC"
  | "DEMO"
  | "VERIFIED"
  | "EXTERNAL"
  | "UNVERIFIED";

export interface ProvenanceMetadata {
  sourceType?: SourceType | string;
  sourceName?: string;
  sourceOrg?: string | null;
  sourceUrl?: string | null;
  sourceDate?: Date | string | null;
  datasetVersion?: string | null;
  license?: string | null;
  dataGranularity?: string | null;
  dataStatus?: DataStatus | string | null;
  importedBy?: string | null;
}

export interface ClassifiedProvenance {
  sourceType: SourceType;
  sourceName: string;
  sourceOrg: string | null;
  sourceUrl: string | null;
  sourceDate: Date | null;
  datasetVersion: string | null;
  license: string | null;
  dataGranularity: string;
  dataStatus: DataStatus;
  importedBy: string | null;
}

export class SourceClassifier {
  static readonly ALLOWED_SOURCE_TYPES: Set<SourceType> = new Set([
    "PRIMARY_TRANSACTION",
    "PUBLIC_DATASET",
    "EXTERNAL_REFERENCE",
    "DEMO_ONLY",
    "SIMULATED",
    "SYNTHETIC",
    "SURVEY",
    "ADMINISTRATIVE",
  ]);

  static classify(metadata?: ProvenanceMetadata): ClassifiedProvenance {
    let rawType = (metadata?.sourceType || "PRIMARY_TRANSACTION").toString().toUpperCase() as SourceType;
    if (!this.ALLOWED_SOURCE_TYPES.has(rawType)) {
      rawType = "PRIMARY_TRANSACTION";
    }

    let dataStatus: DataStatus;

    // 1. Honor explicit valid dataStatus if provided
    const explicitStatus = metadata?.dataStatus?.toString().toUpperCase();
    if (explicitStatus === "SIMULATED" || explicitStatus === "PUBLIC_SIMULATED_DATA") {
      dataStatus = "PUBLIC_SIMULATED_DATA";
    } else if (explicitStatus === "REAL_OBSERVED" || explicitStatus === "VERIFIED") {
      dataStatus = "VERIFIED";
    } else if (explicitStatus === "ADMINISTRATIVE_AGGREGATE" || explicitStatus === "EXTERNAL") {
      dataStatus = "ADMINISTRATIVE_AGGREGATE";
    } else if (explicitStatus === "SURVEY_MICRODATA") {
      dataStatus = "SURVEY_MICRODATA";
    } else if (explicitStatus === "SYNTHETIC") {
      dataStatus = "SYNTHETIC";
    } else if (explicitStatus === "DEMO") {
      dataStatus = "DEMO";
    } else if (explicitStatus === "UNVERIFIED") {
      dataStatus = "UNVERIFIED";
    } else {
      // 2. Deterministic derivation from sourceType and metadata context
      switch (rawType) {
        case "DEMO_ONLY":
          dataStatus = "DEMO";
          break;
        case "SIMULATED":
          dataStatus = "PUBLIC_SIMULATED_DATA";
          break;
        case "SYNTHETIC":
          dataStatus = "SYNTHETIC";
          break;
        case "SURVEY":
          dataStatus = "SURVEY_MICRODATA";
          break;
        case "ADMINISTRATIVE":
        case "EXTERNAL_REFERENCE":
          dataStatus = "ADMINISTRATIVE_AGGREGATE";
          break;
        case "PUBLIC_DATASET":
          const lowerName = (metadata?.sourceName || "").toLowerCase();
          if (lowerName.includes("simulat") || lowerName.includes("benchmark") || lowerName.includes("model")) {
            dataStatus = "PUBLIC_SIMULATED_DATA";
          } else {
            dataStatus = "PUBLIC_DATASET";
          }
          break;
        case "PRIMARY_TRANSACTION":
        default:
          dataStatus = "VERIFIED";
          break;
      }
    }

    let parsedDate: Date | null = null;
    if (metadata?.sourceDate) {
      const d = new Date(metadata.sourceDate);
      if (!isNaN(d.getTime())) {
        parsedDate = d;
      }
    }

    return {
      sourceType: rawType,
      sourceName: (metadata?.sourceName || (rawType === "DEMO_ONLY" ? "System Demo Data" : "Direct Ingestion")).trim(),
      sourceOrg: metadata?.sourceOrg ? metadata.sourceOrg.trim() : null,
      sourceUrl: metadata?.sourceUrl ? metadata.sourceUrl.trim() : null,
      sourceDate: parsedDate,
      datasetVersion: metadata?.datasetVersion ? metadata.datasetVersion.trim() : null,
      license: metadata?.license ? metadata.license.trim() : null,
      dataGranularity: metadata?.dataGranularity ? metadata.dataGranularity.trim() : "TRANSACTION_LEVEL",
      dataStatus,
      importedBy: metadata?.importedBy || null,
    };
  }
}
