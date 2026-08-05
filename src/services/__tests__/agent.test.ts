import { describe, it, expect } from 'vitest';
import { chatWithAnalyticsAgent } from '../agent';
import { NutriEntity, TrustScoreResult } from '../../types/nutri';

describe('DataHub Analytics Agent Unit Tests', () => {
  const healthyEntity: NutriEntity = {
    urn: 'urn:li:dataset:(snowflake,ecommerce_db.public.fct_orders,PROD)',
    name: 'fct_orders',
    platform: 'snowflake',
    entityType: 'DATASET',
    description: 'Gold tier analytical orders fact table',
    owners: ['urn:li:corpuser:sarah.chen@company.com'],
    domain: 'Sales',
    glossaryTerms: ['Core Fact'],
    tags: ['Tier 1', 'Verified'],
    lastModifiedTimestamp: Date.now() - 3600000,
    fields: [
      { fieldPath: 'order_id', type: 'VARCHAR', description: 'Order ID', tags: [], glossaryTerms: [] },
      { fieldPath: 'amount', type: 'DECIMAL(12,2)', description: 'Order amount', tags: [], glossaryTerms: [] },
    ],
    upstreamUrns: ['urn:li:dataset:(snowflake,stg_orders,PROD)'],
    downstreamUrns: ['urn:li:dataset:(tableau,sales_dashboard,PROD)'],
    upstreamPlatforms: ['snowflake'],
    assertions: [{ urn: 'a1', type: 'FRESHNESS', passed: true }],
  };

  const healthyScore: TrustScoreResult = {
    trustScore: 95,
    subScores: { freshness: 100, completeness: 100, lineage: 100, testCoverage: 100 },
    weights: { freshnessWeight: 0.25, completenessWeight: 0.25, lineageWeight: 0.25, testCoverageWeight: 0.25, needsAttentionThreshold: 70 },
    breakdown: { freshnessDetails: 'Fresh', completenessDetails: 'All docs', lineageDetails: 'Lineage complete', testCoverageDetails: 'All passing' },
    needsAttention: false,
    evaluatedAt: Date.now(),
  };

  const riskyEntity: NutriEntity = {
    urn: 'urn:li:dataset:(postgres,app_db.public.payments,PROD)',
    name: 'payments',
    platform: 'postgres',
    entityType: 'DATASET',
    description: '',
    owners: [],
    domain: '',
    glossaryTerms: [],
    tags: ['PII'],
    lastModifiedTimestamp: Date.now() - 1000000000,
    fields: [
      { fieldPath: 'payment_id', type: 'VARCHAR', description: '', tags: [], glossaryTerms: [] },
    ],
    upstreamUrns: [],
    downstreamUrns: [],
    upstreamPlatforms: [],
    assertions: [{ urn: 'a2', type: 'DATA_QUALITY', passed: false }],
  };

  const riskyScore: TrustScoreResult = {
    trustScore: 42,
    subScores: { freshness: 20, completeness: 10, lineage: 0, testCoverage: 0 },
    weights: { freshnessWeight: 0.25, completenessWeight: 0.25, lineageWeight: 0.25, testCoverageWeight: 0.25, needsAttentionThreshold: 70 },
    breakdown: { freshnessDetails: 'Stale', completenessDetails: 'Missing docs & owners', lineageDetails: 'Isolated', testCoverageDetails: 'Failing tests' },
    needsAttention: true,
    evaluatedAt: Date.now(),
  };

  it('generates governance diagnosis in governance mode', async () => {
    const reply = await chatWithAnalyticsAgent(healthyEntity, healthyScore, 'Explain score', [], 'governance');
    expect(reply).toContain('Nutri Governance Diagnosis');
    expect(reply).toContain('95/100');
    expect(reply).toContain('**Freshness:** 100%');
  });

  it('generates Talk-to-Data SQL query with safety confirmation for healthy dataset', async () => {
    const reply = await chatWithAnalyticsAgent(healthyEntity, healthyScore, 'Write SQL', [], 'talk_to_data');
    expect(reply).toContain('DataHub Talk-to-Data SQL for `fct_orders`');
    expect(reply).toContain('SELECT');
    expect(reply).toContain('FROM fct_orders');
    expect(reply).toContain('Healthy Data Nutrition (Trust Score: 95/100)');
  });

  it('prepends prominent Nutrition Safety Warning when querying low-trust dataset', async () => {
    const reply = await chatWithAnalyticsAgent(riskyEntity, riskyScore, 'Write SQL', [], 'talk_to_data');
    expect(reply).toContain('Data Nutrition Safety Warning');
    expect(reply).toContain('42/100');
    expect(reply).toContain('Failing Quality Check: DATA_QUALITY');
  });
});
