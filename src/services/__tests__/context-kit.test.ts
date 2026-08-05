import { describe, it, expect } from 'vitest';
import { DataHubContextKit } from '../context-kit';
import { NutriEntity, TrustScoreResult } from '../../types/nutri';

describe('DataHub Agent Context Kit Unit Tests', () => {
  const sampleEntity: NutriEntity = {
    urn: 'urn:li:dataset:(snowflake,ecommerce_db.public.orders,PROD)',
    name: 'orders',
    platform: 'snowflake',
    entityType: 'DATASET',
    description: 'E-commerce transactional purchase orders',
    owners: ['urn:li:corpuser:sarah.chen@company.com'],
    domain: 'Sales',
    glossaryTerms: ['Core Order'],
    tags: ['Tier 1', 'PII_Data'],
    lastModifiedTimestamp: Date.now() - 7200000,
    fields: [
      {
        fieldPath: 'order_id',
        type: 'VARCHAR(64)',
        description: 'Order primary UUID',
        tags: ['Identifier'],
        glossaryTerms: ['Primary Key'],
      },
      {
        fieldPath: 'customer_email',
        type: 'VARCHAR(255)',
        description: 'Customer contact email',
        tags: ['PII_Data'],
        glossaryTerms: [],
      },
      {
        fieldPath: 'secret_token',
        type: 'VARCHAR(128)',
        description: '', // Undocumented
        tags: [],
        glossaryTerms: [],
      },
    ],
    upstreamUrns: ['urn:li:dataset:(postgres,app_db.public.payments,PROD)'],
    downstreamUrns: ['urn:li:dataset:(dbt,ecommerce_analytics.fct_orders,PROD)'],
    upstreamPlatforms: ['postgres'],
    assertions: [
      { urn: 'a1', type: 'DATA_QUALITY', passed: true },
      { urn: 'a2', type: 'VOLUME', passed: false },
    ],
  };

  const sampleScoreResult: TrustScoreResult = {
    trustScore: 82,
    subScores: { freshness: 100, completeness: 66, lineage: 80, testCoverage: 50 },
    weights: { freshnessWeight: 0.25, completenessWeight: 0.25, lineageWeight: 0.25, testCoverageWeight: 0.25, needsAttentionThreshold: 70 },
    breakdown: { freshnessDetails: '2h ago', completenessDetails: '2/3 docs', lineageDetails: '1 up, 1 down', testCoverageDetails: '1/2 pass' },
    needsAttention: false,
    evaluatedAt: Date.now(),
  };

  it('builds a structured DataHubContextPacket with exact field metrics', () => {
    const packet = DataHubContextKit.buildContextPacket(sampleEntity, sampleScoreResult);

    expect(packet.name).toBe('orders');
    expect(packet.schema.totalFields).toBe(3);
    expect(packet.schema.documentedFieldsCount).toBe(2);
    expect(packet.schema.undocumentedFields).toEqual(['secret_token']);
    expect(packet.governance.hasOwner).toBe(true);
    expect(packet.lineage.upstreamCount).toBe(1);
    expect(packet.lineage.downstreamCount).toBe(1);
    expect(packet.quality.failedAssertions).toBe(1);
    expect(packet.quality.assertionPassRatePct).toBe(50);
    expect(packet.allergens).toContain('Contains Sensitive/PII Data (PII_Data)');
    expect(packet.allergens).toContain('Column "customer_email" flagged with PII_Data');
    expect(packet.allergens).toContain('Failing Quality Check: VOLUME');
  });

  it('formats context into a dense text prompt block for LLM agents', () => {
    const packet = DataHubContextKit.buildContextPacket(sampleEntity, sampleScoreResult);
    const promptText = DataHubContextKit.toPromptContext(packet);

    expect(promptText).toContain('### DATAHUB CONTEXT GRAPH: orders (SNOWFLAKE)');
    expect(promptText).toContain('**Trust Score:** 82/100');
    expect(promptText).toContain('`order_id` (VARCHAR(64))');
    expect(promptText).toContain('`customer_email` (VARCHAR(255)) [🔒 PII]');
    expect(promptText).toContain('`secret_token` (VARCHAR(128)) [⚠️ Undocumented]');
  });

  it('formats clean SQL context for Talk-to-Data SQL assistants', () => {
    const packet = DataHubContextKit.buildContextPacket(sampleEntity, sampleScoreResult);
    const sqlText = DataHubContextKit.toSqlContext(packet);

    expect(sqlText).toContain('CREATE TABLE orders (');
    expect(sqlText).toContain('order_id VARCHAR(64) -- Order primary UUID');
    expect(sqlText).toContain('Health Trust Score: 82/100');
  });
});
