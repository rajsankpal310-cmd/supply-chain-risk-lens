import {
  UniversalMappingEngine,
  UniversalMappingResult,
  InferredDataType,
} from "./universalMappingEngine";

export type InferredType = "NUMERIC" | "DATE" | "STRING" | "BOOLEAN" | "EMPTY";

export interface ColumnProfile {
  header: string;
  inferredType: InferredType;
  missingCount: number;
  missingRate: number; // 0 to 1
  sampleValues: string[];
  suggestedConcept?: string;
  confidence?: number;
  reason?: string;
  signals?: string[];
  needsReview?: boolean;
}

export interface SchemaDetectionResult {
  headers: string[];
  profiles: ColumnProfile[];
  suggestedMapping: Record<string, string>;
  rawRowCount: number;
  datasetProfile?: UniversalMappingResult["datasetProfile"];
  mappingCandidates?: UniversalMappingResult["mappingCandidates"];
  requiredFieldsStatus?: UniversalMappingResult["requiredFieldsStatus"];
  optionalFieldsStatus?: UniversalMappingResult["optionalFieldsStatus"];
}

export class SchemaDetector {
  static detectType(values: string[]): InferredType {
    const profile = UniversalMappingEngine.profileColumn("sample", values);
    return profile.inferredType as InferredType;
  }

  static isValidDateString(str: string): boolean {
    return UniversalMappingEngine.isValidDate(str);
  }

  static inspect(
    headers: string[],
    rows: Record<string, any>[],
    userOverrides: Record<string, string> = {}
  ): SchemaDetectionResult {
    const universal = UniversalMappingEngine.inspectAndMap(headers, rows, userOverrides);

    const profiles: ColumnProfile[] = headers.map((h) => {
      const colProf = universal.columnProfiles[h];
      const candidate = universal.mappingCandidates.find((c) => c.sourceColumn === h);

      return {
        header: h,
        inferredType: (colProf ? colProf.inferredType : "STRING") as InferredType,
        missingCount: colProf ? colProf.totalCount - colProf.nonNullCount : 0,
        missingRate: colProf ? colProf.nullRate : 0,
        sampleValues: colProf ? colProf.sampleValues : [],
        suggestedConcept: candidate ? candidate.canonicalField : undefined,
        confidence: candidate ? candidate.confidence : undefined,
        reason: candidate ? candidate.reason : undefined,
        signals: candidate ? candidate.signals : undefined,
        needsReview: candidate ? candidate.needsReview : false,
      };
    });

    return {
      headers,
      profiles,
      suggestedMapping: universal.suggestedMapping,
      rawRowCount: rows.length,
      datasetProfile: universal.datasetProfile,
      mappingCandidates: universal.mappingCandidates,
      requiredFieldsStatus: universal.requiredFieldsStatus,
      optionalFieldsStatus: universal.optionalFieldsStatus,
    };
  }
}
