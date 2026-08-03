/**
 * Nutri Core TypeScript Types & Interfaces
 */

export type EntityType = 'DATASET' | 'DASHBOARD' | 'CHART' | 'DATA_JOB';

export interface NutriField {
  fieldPath: string;
  type: string;
  description?: string;
  tags: string[];
  glossaryTerms: string[];
}

export interface NutriAssertion {
  urn: string;
  type: string;
  passed: boolean;
  lastRunTimestamp?: number;
}

export interface NutriEntity {
  urn: string;
  name: string;
  platform: string;
  entityType: EntityType;
  description?: string;
  owners: string[];
  domain?: string;
  glossaryTerms: string[];
  tags: string[];
  
  // Freshness metadata
  lastModifiedTimestamp?: number; // ms timestamp
  expectedCadenceMs?: number;    // expected update interval in ms (e.g. 24h)
  stalenessThresholdMs?: number; // maximum threshold before entity is considered stale

  // Schema / Completeness metadata
  fields: NutriField[];

  // Lineage metadata
  upstreamUrns: string[];
  downstreamUrns: string[];
  upstreamPlatforms: string[];

  // Assertion / Test Coverage metadata
  assertions: NutriAssertion[];
}

export interface SubScores {
  freshness: number;    // 0 - 100
  completeness: number; // 0 - 100
  lineage: number;      // 0 - 100
  testCoverage: number; // 0 - 100
}

export interface WeightConfig {
  freshnessWeight: number;    // Default: 0.25
  completenessWeight: number; // Default: 0.25
  lineageWeight: number;      // Default: 0.25
  testCoverageWeight: number; // Default: 0.25
  needsAttentionThreshold: number; // Default: 70
}

export interface SubScoreBreakdown {
  freshnessDetails: string;
  completenessDetails: string;
  lineageDetails: string;
  testCoverageDetails: string;
}

export interface TrustScoreResult {
  trustScore: number; // Normalized 0 - 100 integer
  subScores: SubScores;
  weights: WeightConfig;
  breakdown: SubScoreBreakdown;
  needsAttention: boolean; // True if trustScore < needsAttentionThreshold
  evaluatedAt: number;     // ms timestamp of evaluation
}
