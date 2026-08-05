import { describe, it, expect } from 'vitest';
import { DataHubContractEngine } from '../contracts';
import { NutriEntity } from '../../types/nutri';

describe('DataHub Data Contracts & Assertions Engine Tests', () => {
  const passingEntity: NutriEntity = {
    urn: 'urn:li:dataset:(snowflake,ecommerce.orders,PROD)',
    name: 'orders',
    platform: 'snowflake',
    entityType: 'DATASET',
    description: 'Orders table',
    owners: ['urn:li:corpuser:sarah.chen'],
    domain: 'Sales',
    glossaryTerms: [],
    tags: [],
    lastModifiedTimestamp: Date.now() - 3600000, // 1h ago
    fields: [
      { fieldPath: 'id', type: 'INT', description: 'Primary key', tags: [], glossaryTerms: [] },
    ],
    upstreamUrns: [],
    downstreamUrns: [],
    upstreamPlatforms: [],
    assertions: [
      { urn: 'a1', type: 'FRESHNESS', passed: true },
      { urn: 'a2', type: 'DATA_QUALITY', passed: true },
    ],
  };

  const failingEntity: NutriEntity = {
    urn: 'urn:li:dataset:(snowflake,ecommerce.stale_table,PROD)',
    name: 'stale_table',
    platform: 'snowflake',
    entityType: 'DATASET',
    description: '',
    owners: [], // Violates governance contract
    domain: '',
    glossaryTerms: [],
    tags: [],
    lastModifiedTimestamp: Date.now() - 300 * 3600 * 1000, // 300h ago (breaches SLA)
    fields: [
      { fieldPath: 'raw_data', type: 'VARCHAR', description: '', tags: [], glossaryTerms: [] },
    ],
    upstreamUrns: [],
    downstreamUrns: [],
    upstreamPlatforms: [],
    assertions: [
      { urn: 'a3', type: 'VOLUME', passed: false }, // Failing assertion
    ],
  };

  it('evaluates passing contract for compliant entity', () => {
    const report = DataHubContractEngine.evaluateContract(passingEntity);
    expect(report.status).toBe('PASSED');
    expect(report.compliancePct).toBe(100);
    expect(report.contractViolations.length).toBe(0);
    expect(report.passedClauses).toBe(4); // 1 SLA + 1 Schema + 2 Assertions
  });

  it('evaluates failed contract with specific SLA, schema, and assertion violation details', () => {
    const report = DataHubContractEngine.evaluateContract(failingEntity);
    expect(report.status).toBe('FAILED');
    expect(report.failedClauses).toBeGreaterThan(0);
    expect(report.contractViolations.some((v) => v.includes('SLA Breach'))).toBe(true);
    expect(report.contractViolations.some((v) => v.includes('Schema Violation'))).toBe(true);
    expect(report.contractViolations.some((v) => v.includes('Contract Failure'))).toBe(true);
  });
});
