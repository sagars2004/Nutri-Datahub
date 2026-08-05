import { NextRequest, NextResponse } from 'next/server';
import { fetchNutriEntity } from '@/services/datahub';
import { calculateTrustScore } from '@/engine/scoring';
import { chatWithAnalyticsAgent } from '@/services/agent';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urn, message, history = [], mode = 'governance' } = body;

    if (!urn) {
      return NextResponse.json({ error: 'Missing required field "urn"' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: 'Missing required field "message"' }, { status: 400 });
    }

    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity);

    const response = await chatWithAnalyticsAgent(entity, scoreResult, message, history, mode);

    return NextResponse.json({
      reply: response,
      urn,
      trustScore: scoreResult.trustScore,
    });
  } catch (error: any) {
    console.error('Error in /api/agent/chat:', error);
    return NextResponse.json(
      { error: error.message || 'Analytics Agent failed to process message' },
      { status: 500 }
    );
  }
}
