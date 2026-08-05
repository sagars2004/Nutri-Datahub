import React from 'react';
import { fetchNutriEntity } from '@/services/datahub';
import { calculateTrustScore } from '@/engine/scoring';
import { generateScoreSummary, generateColumnDescriptions } from '@/services/llm';
import { NutriLabel } from '@/components/NutriLabel';

export const dynamic = 'force-dynamic';

interface EmbedPageProps {
  params: Promise<{
    urn: string[];
  }>;
}

export default async function EmbedPage({ params }: EmbedPageProps) {
  const resolvedParams = await params;
  const rawUrn = resolvedParams.urn.join('/');
  const urn = decodeURIComponent(rawUrn);

  try {
    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity);
    const verdict = await generateScoreSummary(entity, scoreResult);
    const columnDescriptions = await generateColumnDescriptions(entity);

    return (
      <main className="min-h-screen bg-slate-950 p-3 sm:p-6 flex items-center justify-center font-sans text-slate-100">
        <div className="w-full max-w-md">
          <NutriLabel
            entity={entity}
            verdictSummary={verdict}
            columnDescriptions={columnDescriptions}
          />
        </div>
      </main>
    );
  } catch (error: any) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center text-slate-300 font-sans">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md text-center space-y-2">
          <h2 className="text-lg font-bold text-rose-400">Unable to load Nutrition Facts</h2>
          <p className="text-xs text-slate-400 font-mono break-all">{urn}</p>
          <p className="text-xs text-slate-500">{error.message || 'Entity not found in DataHub catalog.'}</p>
        </div>
      </div>
    );
  }
}
