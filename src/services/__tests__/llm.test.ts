import { describe, it, expect, afterEach } from 'vitest';
import {
  generateScoreSummary,
  generateColumnDescriptions,
  extractAllergenWarnings,
  getLlmConfig,
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

  describe('getLlmConfig', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('identifies GMI Cloud provider when GMI_API_KEY is present', () => {
      process.env.GMI_API_KEY = 'gmi-test-key-123';
      const config = getLlmConfig();
      expect(config.provider).toBe('gmi');
      expect(config.apiKey).toBe('gmi-test-key-123');
      expect(config.baseUrl).toBe('https://api.gmicloud.ai/v1');
      expect(config.model).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct');
    });

    it('allows custom GMI model and base URL override', () => {
      process.env.GMI_API_KEY = 'gmi-test-key-123';
      process.env.GMI_BASE_URL = 'https://custom.gmicloud.ai/v1';
      process.env.GMI_MODEL = 'Qwen/Qwen2.5-72B-Instruct';
      const config = getLlmConfig();
      expect(config.baseUrl).toBe('https://custom.gmicloud.ai/v1');
      expect(config.model).toBe('Qwen/Qwen2.5-72B-Instruct');
    });

    it('falls back to none when no keys are provided', () => {
      delete process.env.GMI_API_KEY;
      delete process.env.GMICLOUD_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.LLM_API_KEY;
      delete process.env.GEMINI_API_KEY;
      const config = getLlmConfig();
      expect(config.provider).toBe('none');
      expect(config.apiKey).toBe('');
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
