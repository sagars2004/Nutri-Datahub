'use client';

import React, { useState } from 'react';
import { NutriEntity, WeightConfig, TrustScoreResult } from '../types/nutri';
import { calculateTrustScore } from '../engine/scoring';
import { extractAllergenWarnings } from '../services/llm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, RefreshCw, AlertTriangle, ShieldCheck, Database, CheckCircle2, Sparkles } from 'lucide-react';

interface NutriLabelProps {
  entity: NutriEntity;
  verdictSummary?: string;
  columnDescriptions?: Record<string, string>;
  onWeightChange?: (weights: WeightConfig) => void;
  onSaveToDataHub?: (weights?: WeightConfig) => void;
  isSaving?: boolean;
}

const PRESETS: Record<string, WeightConfig> = {
  FDA_STANDARD: {
    freshnessWeight: 0.25,
    completenessWeight: 0.25,
    lineageWeight: 0.25,
    testCoverageWeight: 0.25,
    needsAttentionThreshold: 70,
  },
  FRESHNESS_HEAVY: {
    freshnessWeight: 0.5,
    completenessWeight: 0.2,
    lineageWeight: 0.15,
    testCoverageWeight: 0.15,
    needsAttentionThreshold: 70,
  },
  GOVERNANCE_HEAVY: {
    freshnessWeight: 0.15,
    completenessWeight: 0.5,
    lineageWeight: 0.15,
    testCoverageWeight: 0.2,
    needsAttentionThreshold: 75,
  },
};

export const NutriLabel: React.FC<NutriLabelProps> = ({
  entity,
  verdictSummary,
  columnDescriptions = {},
  onWeightChange,
  onSaveToDataHub,
  isSaving = false,
}) => {
  const [weights, setWeights] = useState<WeightConfig>(PRESETS.FDA_STANDARD);
  const [activePreset, setActivePreset] = useState<string>('FDA_STANDARD');
  const [showWeightControls, setShowWeightControls] = useState<boolean>(false);

  const scoreResult: TrustScoreResult = calculateTrustScore(entity, weights);
  const warnings = extractAllergenWarnings(entity);

  const handlePresetSelect = (presetKey: string) => {
    setActivePreset(presetKey);
    const newWeights = PRESETS[presetKey];
    setWeights(newWeights);
    if (onWeightChange) onWeightChange(newWeights);
  };

  const handleCustomSliderChange = (key: keyof WeightConfig, val: number) => {
    setActivePreset('CUSTOM');
    const updated = { ...weights, [key]: val };
    setWeights(updated);
    if (onWeightChange) onWeightChange(updated);
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 70) return 'warning';
    return 'danger';
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4 font-sans">
      {/* Outer FDA Card Wrapper */}
      <div className="bg-white dark:bg-slate-900 border-[3px] border-black dark:border-slate-700 rounded-xl p-6 shadow-2xl transition-all">
        
        {/* FDA Header */}
        <div className="border-b-[10px] border-black dark:border-slate-700 pb-3 mb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-black dark:text-white font-sans">
              Data Nutrition Facts
            </h1>
            <Badge variant="outline" className="font-mono text-xs uppercase px-2.5 py-1 border-black dark:border-slate-700">
              {entity.platform}
            </Badge>
          </div>
          <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
            <span>Serving Size: 1 {entity.entityType}</span>
            <span className="truncate max-w-[200px]" title={entity.name}>Asset: {entity.name}</span>
          </div>
        </div>

        {/* Amount Per Serving / Score Section */}
        <div className="border-b-[6px] border-black dark:border-slate-700 py-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Overall Trust Score
            </span>
            <div className="flex items-center gap-3">
              <span className="text-4xl sm:text-5xl font-black text-black dark:text-white font-mono">
                {scoreResult.trustScore}
              </span>
              <Badge variant={getScoreBadgeVariant(scoreResult.trustScore)} className="text-xs font-extrabold px-3 py-1 uppercase">
                {scoreResult.needsAttention ? 'NEEDS ATTENTION' : 'HIGH TRUST'}
              </Badge>
            </div>
          </div>

          {/* Plain-English AI Verdict Summary Callout */}
          {verdictSummary && (
            <div className="bg-slate-100 dark:bg-slate-800/80 border-l-4 border-black dark:border-slate-600 p-3 rounded-r-md text-xs sm:text-sm text-slate-900 dark:text-slate-100 italic leading-snug flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>"{verdictSummary}"</span>
            </div>
          )}
        </div>

        {/* % Daily Value Header */}
        <div className="text-right text-[11px] font-black border-b border-black dark:border-slate-700 py-1.5 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          % Daily Value (% DV)*
        </div>

        {/* Sub-Score Rows */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          
          {/* Freshness */}
          <div className="py-2.5 flex justify-between items-center">
            <div>
              <span className="font-bold text-sm text-black dark:text-white">Freshness</span>
              <div className="text-xs text-slate-500 dark:text-slate-400">{scoreResult.breakdown.freshnessDetails}</div>
            </div>
            <span className="font-black text-base font-mono text-black dark:text-white">{scoreResult.subScores.freshness}%</span>
          </div>

          {/* Completeness */}
          <div className="py-2.5 flex justify-between items-center">
            <div>
              <span className="font-bold text-sm text-black dark:text-white">Completeness</span>
              <div className="text-xs text-slate-500 dark:text-slate-400">{scoreResult.breakdown.completenessDetails}</div>
            </div>
            <span className="font-black text-base font-mono text-black dark:text-white">{scoreResult.subScores.completeness}%</span>
          </div>

          {/* Lineage Depth */}
          <div className="py-2.5 flex justify-between items-center">
            <div>
              <span className="font-bold text-sm text-black dark:text-white">Lineage Depth</span>
              <div className="text-xs text-slate-500 dark:text-slate-400">{scoreResult.breakdown.lineageDetails}</div>
            </div>
            <span className="font-black text-base font-mono text-black dark:text-white">{scoreResult.subScores.lineage}%</span>
          </div>

          {/* Quality Test Coverage */}
          <div className="py-2.5 flex justify-between items-center">
            <div>
              <span className="font-bold text-sm text-black dark:text-white">Quality Test Coverage</span>
              <div className="text-xs text-slate-500 dark:text-slate-400">{scoreResult.breakdown.testCoverageDetails}</div>
            </div>
            <span className="font-black text-base font-mono text-black dark:text-white">{scoreResult.subScores.testCoverage}%</span>
          </div>

        </div>

        {/* Column Ingredients Section */}
        <div className="border-t-[6px] border-black dark:border-slate-700 pt-3 mt-3">
          <div className="text-xs font-black uppercase tracking-wider text-black dark:text-white mb-2 flex justify-between items-center">
            <span>Ingredients ({entity.fields.length} Columns)</span>
            <span className="text-[10px] text-slate-500 font-normal">Grounded Metadata</span>
          </div>
          
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            {entity.fields.map((field) => {
              const desc = columnDescriptions[field.fieldPath] || field.description;
              const isUndocumented = !desc || desc === 'Undocumented / Needs Description';
              return (
                <div key={field.fieldPath} className="text-xs py-1 border-b border-dashed border-slate-200 dark:border-slate-800 flex justify-between items-start gap-2">
                  <span className="font-mono font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-900 dark:text-slate-200 shrink-0">
                    {field.fieldPath}
                  </span>
                  {isUndocumented ? (
                    <span className="text-rose-600 dark:text-rose-400 italic font-bold text-right">
                      Undocumented / Needs Description
                    </span>
                  ) : (
                    <span className="text-slate-700 dark:text-slate-300 text-right leading-snug">
                      {desc}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Allergens & Governance Warnings */}
        {warnings.length > 0 && (
          <div className="mt-4 border-l-4 border-rose-600 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-r-md space-y-1">
            <div className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              Allergens & Governance Warnings
            </div>
            {warnings.map((warn, idx) => (
              <div key={idx} className="text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-1.5 pl-1">
                • {warn}
              </div>
            ))}
          </div>
        )}

        {/* Card Action Controls */}
        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWeightControls(!showWeightControls)}
            className="text-xs font-bold border-black dark:border-slate-700 text-black dark:text-white"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
            {showWeightControls ? 'Hide Methodology Sliders' : 'Adjust Weight Methodology'}
          </Button>

          {onSaveToDataHub && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onSaveToDataHub(weights)}
              disabled={isSaving}
              className="text-xs font-bold bg-black hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-black dark:hover:bg-slate-200 shadow-md"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Syncing GMS...
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 mr-1.5" />
                  Sync Score to DataHub
                </>
              )}
            </Button>
          )}
        </div>

      </div>

      {/* Methodology Customization Drawer/Panel */}
      {showWeightControls && (
        <Card className="bg-white dark:bg-slate-900 border-2 border-black dark:border-slate-700 p-4 space-y-4 animate-fade-in shadow-xl">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-black dark:text-white flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
              Scoring Methodology Presets & Sliders
            </h3>
            <span className="text-xs text-slate-500 font-medium">Real-Time Recalculation</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activePreset === 'FDA_STANDARD' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetSelect('FDA_STANDARD')}
              className="text-xs font-bold"
            >
              FDA Standard (25/25/25/25)
            </Button>
            <Button
              variant={activePreset === 'FRESHNESS_HEAVY' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetSelect('FRESHNESS_HEAVY')}
              className="text-xs font-bold"
            >
              Freshness Heavy (50/20/15/15)
            </Button>
            <Button
              variant={activePreset === 'GOVERNANCE_HEAVY' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetSelect('GOVERNANCE_HEAVY')}
              className="text-xs font-bold"
            >
              Governance Heavy (15/50/15/20)
            </Button>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>Freshness Weight</span>
                <span>{Math.round(weights.freshnessWeight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.freshnessWeight}
                onChange={(e) => handleCustomSliderChange('freshnessWeight', parseFloat(e.target.value))}
                className="w-full accent-black dark:accent-white cursor-pointer"
              />
            </div>

            <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>Completeness Weight</span>
                <span>{Math.round(weights.completenessWeight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.completenessWeight}
                onChange={(e) => handleCustomSliderChange('completenessWeight', parseFloat(e.target.value))}
                className="w-full accent-black dark:accent-white cursor-pointer"
              />
            </div>

            <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>Lineage Weight</span>
                <span>{Math.round(weights.lineageWeight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.lineageWeight}
                onChange={(e) => handleCustomSliderChange('lineageWeight', parseFloat(e.target.value))}
                className="w-full accent-black dark:accent-white cursor-pointer"
              />
            </div>

            <div className="space-y-1 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border">
              <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>Test Coverage Weight</span>
                <span>{Math.round(weights.testCoverageWeight * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.testCoverageWeight}
                onChange={(e) => handleCustomSliderChange('testCoverageWeight', parseFloat(e.target.value))}
                className="w-full accent-black dark:accent-white cursor-pointer"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
