import { describe, it, expect } from 'vitest';
import {
  generateScoreSummary,
  generateColumnDescriptions,
  extractAllergenWarnings,
} from '../llm';
import { NutriEntity, TrustScoreResult } from '../../types/nutri';

describe('LLM Plain-Language & Warning Layer Unit Tests', () => {

  const testEntity: NutriEntity = {
    urn: 'urn:li:dataset:(snowflake,db.orders,PROD)',
    name: 'orders',
    platform: 'snowflake',
    entityType: 'DATASET',
    description: 'E-commerce orders table',
    owners: [], // Unowned -> triggers warning
    domain: 'urn:li:domain:sales',
    glossaryTerms: [],
    tags: ['PII', 'Restricted'], // PII tags -> triggers allergen callout
    lastModifiedTimestamp: Date.now() - 3600000,
    fields: [
      {
        fieldPath: 'customer_email',
        type: 'VARCHAR',
        description: 'Customer email address',
        tags: ['PII'],
        glossaryTerms: [],
      },
      {
        fieldPath: 'internal_code',
        type: 'VARCHAR',
        description: '', // Undocumented
        tags: [],
        glossaryTerms: [],
      },
    ],
    upstreamUrns: ['urn:li:dataset:(snowflake,raw_orders,PROD)'],
    downstreamUrns: [],
    upstreamPlatforms: ['snowflake'],
    assertions: [
      { urn: 'a1', type: 'FRESHNESS', passed: true },
      { urn: 'a2', type: 'NULL_CHECK', passed: false }, // Failing -> triggers warning
    ],
  };

  const mockScoreResult: TrustScoreResult = {
    trustScore: 68,
    subScores: {
      freshness: 100,
      completeness: 40,
      lineage: 60,
      testCoverage: 50,
    },
    weights: {
      freshnessWeight: 0.25,
      completenessWeight: 0.25,
      lineageWeight: 0.25,
      testCoverageWeight: 0.25,
      needsAttentionThreshold: 70,
    },
    breakdown: {
      freshnessDetails: 'Updated 1h ago',
      completenessDetails: '1/2 columns documented. Governance gaps: missing owner.',
      lineageDetails: '1 connection',
      testCoverageDetails: '1/2 assertions passing',
    },
    needsAttention: true,
    evaluatedAt: Date.now(),
  };

  describe('generateScoreSummary', () => {
    it('returns grounded fallback summary when no GEMINI_API_KEY is present', async () => {
      const summary = await generateScoreSummary(testEntity, mockScoreResult);
      expect(summary).toContain('Scored 68/100');
      expect(summary).toContain('Freshness: 100%');
      expect(summary).toContain('Completeness: 40%');
    });
  });

  describe('generateColumnDescriptions', () => {
    it('preserves existing descriptions and flags ungrounded columns as Undocumented', async () => {
      const descriptions = await generateColumnDescriptions(testEntity);
      expect(descriptions['customer_email']).toBe('Customer email address');
      expect(descriptions['internal_code']).toBe('Undocumented / Needs Description');
    });
  });

  describe('extractAllergenWarnings', () => {
    it('surfaces PII tags, failing quality checks, and unowned asset warnings', () => {
      const warnings = extractAllergenWarnings(testEntity);
      expect(warnings).toContain('Contains Sensitive/PII Data (PII, Restricted)');
      expect(warnings).toContain('Column "customer_email" flagged with PII');
      expect(warnings).toContain('Failing Quality Check: NULL_CHECK');
      expect(warnings).toContain('Unowned Asset (No Owner Assigned)');
    });
  });
});
