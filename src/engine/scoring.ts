import { NutriEntity, SubScores, WeightConfig, SubScoreBreakdown, TrustScoreResult } from '../types/nutri';
import defaultConfig from '../config/nutri-config.json' assert { type: 'json' };

export const DEFAULT_WEIGHTS: WeightConfig = {
  freshnessWeight: defaultConfig.freshnessWeight,
  completenessWeight: defaultConfig.completenessWeight,
  lineageWeight: defaultConfig.lineageWeight,
  testCoverageWeight: defaultConfig.testCoverageWeight,
  needsAttentionThreshold: defaultConfig.needsAttentionThreshold,
};

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Calculates Freshness Sub-Score (0-100)
 */
export function calculateFreshnessScore(
  entity: NutriEntity,
  currentTime: number = Date.now()
): { score: number; details: string } {
  if (!entity.lastModifiedTimestamp) {
    return {
      score: 30,
      details: 'No refresh timestamp recorded in metadata (-70 pts)',
    };
  }

  const expectedCadenceMs = entity.expectedCadenceMs || (defaultConfig.defaultExpectedCadenceHours * MS_PER_HOUR);
  const stalenessThresholdMs = entity.stalenessThresholdMs || (defaultConfig.defaultStalenessThresholdHours * MS_PER_HOUR);

  const ageMs = Math.max(0, currentTime - entity.lastModifiedTimestamp);
  const ageHours = (ageMs / MS_PER_HOUR).toFixed(1);

  if (ageMs <= expectedCadenceMs) {
    return {
      score: 100,
      details: `Updated ${ageHours}h ago (within expected ${expectedCadenceMs / MS_PER_HOUR}h cadence)`,
    };
  }

  if (ageMs >= stalenessThresholdMs) {
    return {
      score: 0,
      details: `Stale! Updated ${ageHours}h ago (exceeds staleness limit of ${stalenessThresholdMs / MS_PER_HOUR}h)`,
    };
  }

  // Linear decay between expected cadence and staleness threshold
  const decayRange = stalenessThresholdMs - expectedCadenceMs;
  const decayAmount = ageMs - expectedCadenceMs;
  const score = Math.round(100 * (1 - decayAmount / decayRange));

  return {
    score,
    details: `Updated ${ageHours}h ago (decaying trust score: ${score}/100)`,
  };
}

/**
 * Calculates Completeness Sub-Score (0-100)
 */
export function calculateCompletenessScore(
  entity: NutriEntity
): { score: number; details: string } {
  let fieldScore = 100;
  let fieldDetails = '';

  if (entity.fields.length > 0) {
    const documentedFields = entity.fields.filter(
      (f) => f.description && f.description.trim().length > 0
    ).length;
    const ratio = documentedFields / entity.fields.length;
    fieldScore = Math.round(ratio * 100);
    fieldDetails = `${documentedFields}/${entity.fields.length} columns documented (${fieldScore}%)`;
  } else {
    // For non-dataset entities or assets without columns
    fieldScore = entity.description && entity.description.trim().length > 0 ? 100 : 50;
    fieldDetails = entity.description ? 'Entity has high-level description' : 'Missing description';
  }

  // Governance sub-metrics (50% of total score)
  const hasOwner = entity.owners.length > 0;
  const hasDomain = Boolean(entity.domain);
  const hasGlossary = entity.glossaryTerms.length > 0;

  const govScore = (hasOwner ? 40 : 0) + (hasDomain ? 30 : 0) + (hasGlossary ? 30 : 0);

  const finalScore = Math.round(fieldScore * 0.5 + govScore * 0.5);

  const govGaps: string[] = [];
  if (!hasOwner) govGaps.push('missing owner');
  if (!hasDomain) govGaps.push('missing domain');
  if (!hasGlossary) govGaps.push('no glossary terms');

  const govSummary = govGaps.length === 0 ? 'Full governance metadata present' : `Governance gaps: ${govGaps.join(', ')}`;
  const details = `${fieldDetails}. ${govSummary}.`;

  return { score: finalScore, details };
}

/**
 * Calculates Lineage Depth & Diversity Sub-Score (0-100)
 */
export function calculateLineageScore(
  entity: NutriEntity
): { score: number; details: string } {
  const totalEdges = entity.upstreamUrns.length + entity.downstreamUrns.length;
  
  // Edge count score (60% weight)
  let edgeScore = 20;
  if (totalEdges >= 3) {
    edgeScore = 100;
  } else if (totalEdges >= 1) {
    edgeScore = 60;
  }

  // Platform diversity score (40% weight)
  const distinctPlatforms = new Set([entity.platform, ...entity.upstreamPlatforms]);
  const platformCount = distinctPlatforms.size;
  const platformScore = platformCount > 1 ? 100 : 50;

  const finalScore = Math.round(edgeScore * 0.6 + platformScore * 0.4);
  const details = `${totalEdges} lineage connections across ${platformCount} platform(s) (${Array.from(distinctPlatforms).join(', ')})`;

  return { score: finalScore, details };
}

/**
 * Calculates Test Coverage & Assertion Sub-Score (0-100)
 */
export function calculateTestCoverageScore(
  entity: NutriEntity
): { score: number; details: string } {
  if (entity.assertions.length === 0) {
    return {
      score: 50,
      details: 'No assertions defined (neutral 50/100 default)',
    };
  }

  const passedCount = entity.assertions.filter((a) => a.passed).length;
  const totalCount = entity.assertions.length;
  const score = Math.round((passedCount / totalCount) * 100);

  return {
    score,
    details: `${passedCount}/${totalCount} assertions passing (${score}%)`,
  };
}

/**
 * Main Pure Function: Calculates overall Nutri Trust Score (0-100)
 */
export function calculateTrustScore(
  entity: NutriEntity,
  customWeights?: Partial<WeightConfig>,
  currentTime: number = Date.now()
): TrustScoreResult {
  const weights: WeightConfig = { ...DEFAULT_WEIGHTS, ...customWeights };

  const freshness = calculateFreshnessScore(entity, currentTime);
  const completeness = calculateCompletenessScore(entity);
  const lineage = calculateLineageScore(entity);
  const testCoverage = calculateTestCoverageScore(entity);

  const subScores: SubScores = {
    freshness: freshness.score,
    completeness: completeness.score,
    lineage: lineage.score,
    testCoverage: testCoverage.score,
  };

  const rawScore =
    subScores.freshness * weights.freshnessWeight +
    subScores.completeness * weights.completenessWeight +
    subScores.lineage * weights.lineageWeight +
    subScores.testCoverage * weights.testCoverageWeight;

  const trustScore = Math.min(100, Math.max(0, Math.round(rawScore)));
  const needsAttention = trustScore < weights.needsAttentionThreshold;

  const breakdown: SubScoreBreakdown = {
    freshnessDetails: freshness.details,
    completenessDetails: completeness.details,
    lineageDetails: lineage.details,
    testCoverageDetails: testCoverage.details,
  };

  return {
    trustScore,
    subScores,
    weights,
    breakdown,
    needsAttention,
    evaluatedAt: currentTime,
  };
}
