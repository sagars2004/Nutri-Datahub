import { NextRequest, NextResponse } from 'next/server';
import { fetchNutriEntity, writeTrustScoreToDataHub } from '../../../services/datahub';
import { calculateTrustScore } from '../../../engine/scoring';
import { generateScoreSummary, generateColumnDescriptions } from '../../../services/llm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urn = searchParams.get('urn');

  if (!urn) {
    return NextResponse.json({ error: 'Missing required query parameter "urn"' }, { status: 400 });
  }

  try {
    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity);
    const verdictSummary = await generateScoreSummary(entity, scoreResult);
    const columnDescriptions = await generateColumnDescriptions(entity);

    return NextResponse.json({
      entity,
      scoreResult,
      verdictSummary,
      columnDescriptions,
    });
  } catch (error: any) {
    console.error('Error fetching entity in API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch entity' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { urn, weights } = body;

    if (!urn) {
      return NextResponse.json({ error: 'Missing urn in request body' }, { status: 400 });
    }

    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity, weights);
    const success = await writeTrustScoreToDataHub(urn, scoreResult);

    return NextResponse.json({
      success,
      urn,
      scoreResult,
    });
  } catch (error: any) {
    console.error('Error writing score to DataHub in API route:', error);
    return NextResponse.json({ error: error.message || 'Failed to write score to DataHub' }, { status: 500 });
  }
}
