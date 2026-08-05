import { describe, it, expect } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

describe('DataHub Actions Webhook Route Tests', () => {
  it('rejects requests without entityUrn', async () => {
    const req = new NextRequest('http://localhost:3000/api/actions/webhook', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(400);
    const data = await resp.json();
    expect(data.error).toContain('Missing required field');
  });

  it('successfully calculates trust score and contract compliance on webhook event', async () => {
    const urn = 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.orders,PROD)';
    const req = new NextRequest('http://localhost:3000/api/actions/webhook', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'MetadataChangeEvent',
        entityUrn: urn,
      }),
    });
    const resp = await POST(req);
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.success).toBe(true);
    expect(data.entityUrn).toBe(urn);
    expect(data.trustScore).toBeDefined();
    expect(data.contractStatus).toBeDefined();
  });
});
