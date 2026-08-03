import { describe, it, expect } from 'vitest';
import { fetchNutriEntity, writeTrustScoreToDataHub } from '../datahub';
import { calculateTrustScore } from '../../engine/scoring';

describe('DataHub API Read & Write Integration Tests', () => {
  const sampleUrn = 'urn:li:dataset:(urn:li:dataPlatform:snowflake,b2fd91.order_entry_db.order_entry.product_categories,PROD)';

  it('fetches and normalizes a Dataset entity from local DataHub GMS', async () => {
    const entity = await fetchNutriEntity(sampleUrn);
    
    expect(entity).toBeDefined();
    expect(entity.urn).toBe(sampleUrn);
    expect(entity.name).toBe('PRODUCT_CATEGORIES');
    expect(entity.platform).toBe('snowflake');
    expect(entity.entityType).toBe('DATASET');
    expect(Array.isArray(entity.fields)).toBe(true);
    expect(Array.isArray(entity.owners)).toBe(true);
    expect(Array.isArray(entity.upstreamUrns)).toBe(true);
  });

  it('executes writeTrustScoreToDataHub and persists structured properties to DataHub', async () => {
    const entity = await fetchNutriEntity(sampleUrn);
    const scoreResult = calculateTrustScore(entity);

    const success = await writeTrustScoreToDataHub(sampleUrn, scoreResult);
    expect(success).toBe(true);
  });
});
