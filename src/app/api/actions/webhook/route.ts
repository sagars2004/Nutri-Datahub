import { NextRequest, NextResponse } from 'next/server';
import { fetchNutriEntity, writeTrustScoreToDataHub } from '@/services/datahub';
import { calculateTrustScore } from '@/engine/scoring';
import { DataHubContractEngine } from '@/services/contracts';

export const dynamic = 'force-dynamic';

export interface DataHubActionEvent {
  eventType: 'MetadataChangeEvent' | 'AssertionRunEvent' | 'EntityChangeEvent' | 'TagChangeEvent' | 'Custom';
  entityUrn: string;
  timestamp?: number;
  payload?: any;
}

/**
 * DataHub Actions Webhook Handler
 * Receives real-time Kafka / Webhook triggers from DataHub Actions,
 * recalculates Trust Scores, checks Data Contracts, and synchronizes state.
 */
export async function POST(req: NextRequest) {
  try {
    const body: DataHubActionEvent = await req.json();
    const { eventType = 'MetadataChangeEvent', entityUrn, payload } = body;

    const urn = entityUrn || payload?.entityUrn || payload?.urn;

    if (!urn) {
      return NextResponse.json(
        { error: 'Missing required field "entityUrn" in webhook payload' },
        { status: 400 }
      );
    }

    // 1. Fetch updated entity & compute score
    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity);
    const contractReport = DataHubContractEngine.evaluateContract(entity);

    // 2. Sync updated score back to DataHub Structured Properties
    const synced = await writeTrustScoreToDataHub(urn, scoreResult);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${eventType} for ${entity.name}`,
      entityUrn: urn,
      name: entity.name,
      platform: entity.platform,
      trustScore: scoreResult.trustScore,
      subScores: scoreResult.subScores,
      contractStatus: contractReport.status,
      contractCompliancePct: contractReport.compliancePct,
      syncedToDataHub: synced,
      downstreamImpactedUrns: entity.downstreamUrns,
      processedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/actions/webhook:', error);
    return NextResponse.json(
      { error: error.message || 'DataHub Actions Webhook failed' },
      { status: 500 }
    );
  }
}
