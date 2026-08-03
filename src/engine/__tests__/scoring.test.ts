import { describe, it, expect } from 'vitest';
import {
  calculateFreshnessScore,
  calculateCompletenessScore,
  calculateLineageScore,
  calculateTestCoverageScore,
  calculateTrustScore,
} from '../scoring';
import { NutriEntity } from '../../types/nutri';

const MS_PER_HOUR = 60 * 60 * 1000;
const NOW = 1722710400000; // Fixed timestamp for reproducible tests

describe('Nutri Scoring Engine - Pure Unit Tests', () => {

  const perfectEntity: NutriEntity = {
    urn: 'urn:li:dataset:(snowflake,db.schema.perfect_table,PROD)',
    name: 'perfect_table',
    platform: 'snowflake',
    entityType: 'DATASET',
    description: 'Highly governed e-commerce orders table',
    owners: ['urn:li:corpuser:sagar'],
    domain: 'urn:li:domain:ecommerce',
    glossaryTerms: ['urn:li:glossaryTerm:orders'],
    tags: ['Authoritative Source'],
    lastModifiedTimestamp: NOW - 2 * MS_PER_HOUR, // 2h old
    expectedCadenceMs: 24 * MS_PER_HOUR,
    stalenessThresholdMs: 72 * MS_PER_HOUR,
    fields: [
      { fieldPath: 'id', type: 'INT', description: 'Order Primary Key', tags: [], glossaryTerms: [] },
      { fieldPath: 'amount', type: 'DECIMAL', description: 'Order Total Amount', tags: [], glossaryTerms: [] },
    ],
    upstreamUrns: ['urn:li:dataset:(snowflake,db.schema.raw_orders,PROD)'],
    downstreamUrns: ['urn:li:dataset:(dbt,models.stg_orders,PROD)', 'urn:li:chart:(looker,dashboards.1,PROD)'],
    upstreamPlatforms: ['snowflake', 'dbt'],
    assertions: [
      { urn: 'urn:li:assertion:1', type: 'FRESHNESS', passed: true },
      { urn: 'urn:li:assertion:2', type: 'NULL_CHECK', passed: true },
    ],
  };

  const degradedEntity: NutriEntity = {
    urn: 'urn:li:dataset:(postgres,db.schema.orphan_table,PROD)',
    name: 'orphan_table',
    platform: 'postgres',
    entityType: 'DATASET',
    owners: [], // Missing owner
    domain: undefined, // Missing domain
    glossaryTerms: [],
    tags: [],
    lastModifiedTimestamp: NOW - 90 * MS_PER_HOUR, // 90h old (exceeds 72h threshold -> stale)
    expectedCadenceMs: 24 * MS_PER_HOUR,
    stalenessThresholdMs: 72 * MS_PER_HOUR,
    fields: [
      { fieldPath: 'col1', type: 'VARCHAR', description: '', tags: [], glossaryTerms: [] }, // Undocumented
      { fieldPath: 'col2', type: 'INT', description: '', tags: [], glossaryTerms: [] },       // Undocumented
    ],
    upstreamUrns: [],
    downstreamUrns: [],
    upstreamPlatforms: [],
    assertions: [
      { urn: 'urn:li:assertion:1', type: 'NULL_CHECK', passed: false },
    ],
  };

  describe('Freshness Sub-Score', () => {
    it('returns 100 if updated within expected cadence', () => {
      const res = calculateFreshnessScore(perfectEntity, NOW);
      expect(res.score).toBe(100);
      expect(res.details).toContain('within expected');
    });

    it('returns 0 if updated beyond staleness threshold', () => {
      const res = calculateFreshnessScore(degradedEntity, NOW);
      expect(res.score).toBe(0);
      expect(res.details).toContain('Stale!');
    });

    it('returns 30 if lastModifiedTimestamp is missing', () => {
      const entityWithoutTime = { ...perfectEntity, lastModifiedTimestamp: undefined };
      const res = calculateFreshnessScore(entityWithoutTime, NOW);
      expect(res.score).toBe(30);
      expect(res.details).toContain('No refresh timestamp recorded');
    });
  });

  describe('Completeness Sub-Score', () => {
    it('returns 100 for 100% documented fields + full governance metadata', () => {
      const res = calculateCompletenessScore(perfectEntity);
      expect(res.score).toBe(100);
      expect(res.details).toContain('Full governance metadata present');
    });

    it('penalizes undocumented fields and missing governance metadata', () => {
      const res = calculateCompletenessScore(degradedEntity);
      expect(res.score).toBe(0); // 0% fields documented + 0 governance score
      expect(res.details).toContain('0/2 columns documented');
      expect(res.details).toContain('missing owner');
    });
  });

  describe('Lineage Depth & Diversity Sub-Score', () => {
    it('gives top score for multi-hop lineage across multiple platforms', () => {
      const res = calculateLineageScore(perfectEntity);
      expect(res.score).toBe(100);
      expect(res.details).toContain('3 lineage connections across 2 platform(s)');
    });

    it('penalizes isolated entities with zero connections', () => {
      const res = calculateLineageScore(degradedEntity);
      expect(res.score).toBe(32); // 20 * 0.6 + 50 * 0.4 = 12 + 20 = 32
      expect(res.details).toContain('0 lineage connections');
    });
  });

  describe('Test Coverage Sub-Score', () => {
    it('returns 100 if all assertions pass', () => {
      const res = calculateTestCoverageScore(perfectEntity);
      expect(res.score).toBe(100);
      expect(res.details).toContain('2/2 assertions passing');
    });

    it('returns 0 if all assertions fail', () => {
      const res = calculateTestCoverageScore(degradedEntity);
      expect(res.score).toBe(0);
      expect(res.details).toContain('0/1 assertions passing');
    });

    it('returns 50 neutral score if no assertions are defined', () => {
      const entityNoAssertions = { ...perfectEntity, assertions: [] };
      const res = calculateTestCoverageScore(entityNoAssertions);
      expect(res.score).toBe(50);
      expect(res.details).toContain('No assertions defined');
    });
  });

  describe('Overall Trust Score Aggregation', () => {
    it('computes 100 overall Trust Score for perfect entity', () => {
      const result = calculateTrustScore(perfectEntity, undefined, NOW);
      expect(result.trustScore).toBe(100);
      expect(result.needsAttention).toBe(false);
      expect(result.subScores).toEqual({
        freshness: 100,
        completeness: 100,
        lineage: 100,
        testCoverage: 100,
      });
    });

    it('computes low overall score (<70) and flags needsAttention for degraded entity', () => {
      const result = calculateTrustScore(degradedEntity, undefined, NOW);
      // fresh: 0, comp: 0, lin: 32, test: 0 -> weighted sum: 32 * 0.25 = 8
      expect(result.trustScore).toBe(8);
      expect(result.needsAttention).toBe(true);
    });

    it('respects custom weight configurations', () => {
      const result = calculateTrustScore(
        perfectEntity,
        {
          freshnessWeight: 0.5,
          completenessWeight: 0.5,
          lineageWeight: 0,
          testCoverageWeight: 0,
          needsAttentionThreshold: 80,
        },
        NOW
      );
      expect(result.trustScore).toBe(100);
      expect(result.weights.freshnessWeight).toBe(0.5);
    });
  });
});
