'use client';

import React, { useState } from 'react';
import { NutriEntity, WeightConfig, TrustScoreResult } from '../types/nutri';
import { calculateTrustScore } from '../engine/scoring';
import { extractAllergenWarnings } from '../utils/warnings';
import { DataHubContractEngine, DataContractReport } from '../services/contracts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, RefreshCw, AlertTriangle, Database, Sparkles, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, FileText, Share2, Copy, Check, X } from 'lucide-react';

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
  const [showContracts, setShowContracts] = useState<boolean>(false);
  const [showEmbedCode, setShowEmbedCode] = useState<boolean>(false);
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const scoreResult: TrustScoreResult = calculateTrustScore(entity, weights);
  const warnings = extractAllergenWarnings(entity);
  const contractReport: DataContractReport = DataHubContractEngine.evaluateContract(entity);

  const embedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/embed/${encodeURIComponent(entity.urn)}`
    : `/embed/${encodeURIComponent(entity.urn)}`;

  const iframeSnippet = `<iframe src="${embedUrl}" width="420" height="680" frameborder="0" style="border-radius: 12px; overflow: hidden;" title="Data Nutrition Facts - ${entity.name}"></iframe>`;

  const handleCopyEmbed = () => {
    navigator.clipboard.writeText(iframeSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(embedUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

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
    <div className="w-full space-y-4 font-sans h-full flex flex-col justify-between">
      
      {/* Dark Theme FDA Nutrition Facts Box with Structured White Outlines */}
      <div className="bg-slate-900 text-white border-[4px] border-slate-100 rounded-xl p-6 shadow-2xl transition-all flex-1 flex flex-col justify-between">
        
        <div>
          {/* FDA Header Bar */}
          <div className="border-b-[10px] border-slate-100 pb-3 mb-3">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-white font-sans">
                Data Nutrition Facts
              </h1>
              <span className="font-mono text-xs uppercase font-extrabold px-2.5 py-1 bg-slate-800 text-slate-100 border border-slate-300 rounded">
                {entity.platform}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-slate-300 mt-1">
              <span>Serving Size: 1 {entity.entityType}</span>
              <span className="font-mono truncate max-w-[220px]" title={entity.name}>Asset: {entity.name}</span>
            </div>
          </div>

          {/* Amount Per Serving / Score Section */}
          <div className="border-b-[6px] border-slate-100 py-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                Overall Trust Score
              </span>
              <div className="flex items-center gap-3">
                <span className="text-4xl sm:text-5xl font-black text-white font-mono">
                  {scoreResult.trustScore}
                </span>
                <Badge variant={getScoreBadgeVariant(scoreResult.trustScore)} className="text-xs font-extrabold px-3 py-1 uppercase border border-slate-300">
                  {scoreResult.needsAttention ? 'NEEDS ATTENTION' : 'HIGH TRUST'}
                </Badge>
              </div>
            </div>

            {/* Plain-English AI Verdict Summary Callout */}
            {verdictSummary && (
              <div className="bg-slate-950/80 border-l-4 border-sky-400 p-3 rounded-r-md text-xs sm:text-sm text-slate-200 italic leading-snug flex items-start gap-2 border-y border-r border-slate-800">
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <span>"{verdictSummary}"</span>
              </div>
            )}
          </div>

          {/* % Daily Value Header */}
          <div className="text-right text-[11px] font-black border-b border-slate-100 py-1.5 text-slate-300 uppercase tracking-wider">
            % Daily Value (% DV)*
          </div>

          {/* Sub-Score Rows */}
          <div className="divide-y divide-slate-800">
            
            {/* Freshness */}
            <div className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-sm text-white">Freshness</span>
                <div className="text-xs text-slate-400 font-medium">{scoreResult.breakdown.freshnessDetails}</div>
              </div>
              <span className="font-black text-base font-mono text-white">{scoreResult.subScores.freshness}%</span>
            </div>

            {/* Completeness */}
            <div className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-sm text-white">Completeness</span>
                <div className="text-xs text-slate-400 font-medium">{scoreResult.breakdown.completenessDetails}</div>
              </div>
              <span className="font-black text-base font-mono text-white">{scoreResult.subScores.completeness}%</span>
            </div>

            {/* Lineage Depth */}
            <div className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-sm text-white">Lineage Depth</span>
                <div className="text-xs text-slate-400 font-medium">{scoreResult.breakdown.lineageDetails}</div>
              </div>
              <span className="font-black text-base font-mono text-white">{scoreResult.subScores.lineage}%</span>
            </div>

            {/* Quality Test Coverage & Contract Compliance */}
            <div className="py-2.5 flex justify-between items-center">
              <div>
                <span className="font-bold text-sm text-white">Quality Test Coverage</span>
                <div className="text-xs text-slate-400 font-medium">{scoreResult.breakdown.testCoverageDetails}</div>
              </div>
              <span className="font-black text-base font-mono text-white">{scoreResult.subScores.testCoverage}%</span>
            </div>

          </div>

          {/* DataHub Contract Compliance Badge Bar */}
          <div className="mt-3 p-2.5 bg-slate-950/90 border border-slate-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              {contractReport.status === 'PASSED' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  DataHub Data Contract
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    contractReport.status === 'PASSED'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {contractReport.compliancePct}% Passed ({contractReport.passedClauses}/{contractReport.totalClauses})
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {contractReport.status === 'PASSED' ? 'All SLA, Schema & Quality clauses passing' : `${contractReport.failedClauses} contract clause(s) breached`}
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowContracts(!showContracts)}
              className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1"
            >
              {showContracts ? 'Hide' : 'Inspect'}
              {showContracts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Expandable Contract Clauses Inspector */}
          {showContracts && (
            <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs animate-fade-in">
              <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                Active Contract Clauses ({contractReport.clauses.length})
              </div>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {contractReport.clauses.map((clause) => (
                  <div key={clause.id} className="p-1.5 rounded bg-slate-900/90 border border-slate-800/80 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${clause.status === 'PASSED' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        {clause.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{clause.actual}</div>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                      clause.status === 'PASSED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {clause.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column Ingredients Section */}
          <div className="border-t-[6px] border-slate-100 pt-3 mt-3">
            <div className="text-xs font-black uppercase tracking-wider text-white mb-2 flex justify-between items-center">
              <span>Ingredients ({entity.fields.length} Columns)</span>
              <span className="text-[10px] text-slate-400 font-bold">Grounded Schema</span>
            </div>
            
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {entity.fields.map((field) => {
                const desc = columnDescriptions[field.fieldPath] || field.description;
                const isUndocumented = !desc || desc === 'Undocumented / Needs Description';
                return (
                  <div key={field.fieldPath} className="text-xs py-1 border-b border-dashed border-slate-800 flex justify-between items-start gap-2">
                    <span className="font-mono font-bold bg-slate-950 px-1.5 py-0.5 rounded text-sky-300 border border-slate-800 shrink-0">
                      {field.fieldPath}
                    </span>
                    {isUndocumented ? (
                      <span className="text-rose-400 font-bold italic text-right">
                        Undocumented / Needs Description
                      </span>
                    ) : (
                      <span className="text-slate-300 text-right leading-snug font-medium">
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
            <div className="mt-4 border-l-4 border-rose-500 bg-rose-950/70 border-y border-r border-rose-900 p-3 rounded-r-md space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Allergens & Governance Warnings
              </div>
              {warnings.map((warn, idx) => (
                <div key={idx} className="text-xs text-rose-200 font-bold flex items-center gap-1.5 pl-1">
                  • {warn}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card Action Controls */}
        <div className="mt-5 pt-3 border-t-2 border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWeightControls(!showWeightControls)}
              className="text-xs font-extrabold border-2 border-slate-300 bg-slate-800 text-white hover:bg-slate-700"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
              {showWeightControls ? 'Hide Sliders' : 'Weights'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEmbedCode(!showEmbedCode)}
              className="text-xs font-extrabold border-2 border-slate-300 bg-slate-800 text-white hover:bg-slate-700"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
              Embed
            </Button>
          </div>

          {onSaveToDataHub && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onSaveToDataHub(weights)}
              disabled={isSaving}
              className="text-xs font-extrabold bg-white text-slate-950 hover:bg-slate-200 shadow-md"
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

      {/* Embed Code Snippet Modal Window */}
      {showEmbedCode && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowEmbedCode(false)}
        >
          <Card 
            className="bg-slate-900 border-2 border-slate-700 w-full max-w-lg p-6 space-y-4 shadow-2xl text-slate-100 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="w-4.5 h-4.5 text-sky-400" />
                Embed Nutrition Facts in BI & Documentation
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEmbedCode(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Direct Embed URL (for browser tabs or link shares)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    readOnly
                    value={embedUrl}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500 selection:bg-sky-500/30"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUrl}
                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium shrink-0 h-9"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1 text-sky-400" />}
                    {copiedUrl ? 'Copied' : 'Copy URL'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  HTML iframe Snippet (for Notion, Confluence, BI Tools)
                </label>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap max-h-40 scrollbar-thin selection:bg-sky-500/30">
                  {iframeSnippet}
                </pre>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2.5 pt-2 border-t border-slate-800/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEmbedCode(false)}
                className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs px-4"
              >
                Close
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleCopyEmbed}
                className="bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold flex items-center gap-1.5 px-4 shadow-md transition-all"
              >
                {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedEmbed ? 'Copied iframe!' : 'Copy iframe Snippet'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Methodology Customization Drawer/Panel */}
      {showWeightControls && (
        <Card className="bg-slate-900 border-2 border-slate-800 p-4 space-y-4 animate-fade-in shadow-xl text-slate-100">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-sky-400" />
              Scoring Methodology Presets & Sliders
            </h3>
            <span className="text-[11px] text-slate-400 font-semibold">Real-Time Recalculation</span>
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
            <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-bold text-slate-200">
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
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-bold text-slate-200">
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
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-bold text-slate-200">
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
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <div className="flex justify-between font-bold text-slate-200">
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
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
