import React, { useState } from 'react';
import { NutriEntity, WeightConfig, TrustScoreResult } from '../types/nutri';
import { calculateTrustScore } from '../engine/scoring';
import { extractAllergenWarnings } from '../services/llm';

interface NutriLabelProps {
  entity: NutriEntity;
  verdictSummary?: string;
  columnDescriptions?: Record<string, string>;
  onWeightChange?: (weights: WeightConfig) => void;
  onSaveToDataHub?: () => void;
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

  const getScoreBadgeClass = (score: number) => {
    if (score >= 80) return 'badge-high';
    if (score >= 70) return 'badge-medium';
    return 'badge-low';
  };

  return (
    <div style={{ padding: '16px' }}>
      <div className="nutri-label-card">
        {/* FDA Header */}
        <div className="nutri-header">
          <h1 className="nutri-title">Data Nutrition Facts</h1>
          <div className="nutri-subtitle">
            <span>Serving Size: 1 {entity.entityType} ({entity.platform})</span>
            <span>URN: {entity.name}</span>
          </div>
        </div>

        {/* Amount Per Serving / Score */}
        <div className="nutri-section-score">
          <div className="nutri-score-row">
            <span className="nutri-score-label">Trust Score</span>
            <div className="nutri-score-val">
              {scoreResult.trustScore}
              <span className={`nutri-score-badge ${getScoreBadgeClass(scoreResult.trustScore)}`}>
                {scoreResult.needsAttention ? 'NEEDS ATTENTION' : 'HIGH TRUST'}
              </span>
            </div>
          </div>

          {/* Plain-English Verdict Box */}
          {verdictSummary && (
            <div className="nutri-verdict-box">
              "{verdictSummary}"
            </div>
          )}
        </div>

        {/* % Daily Value Sub-Score Breakdown */}
        <div className="nutri-dv-header">% Daily Value (% DV)*</div>

        <div className="nutri-subscore-row">
          <div>
            <span className="nutri-subscore-name">Freshness</span>
            <div className="nutri-subscore-details">{scoreResult.breakdown.freshnessDetails}</div>
          </div>
          <span className="nutri-subscore-val">{scoreResult.subScores.freshness}%</span>
        </div>

        <div className="nutri-subscore-row">
          <div>
            <span className="nutri-subscore-name">Completeness</span>
            <div className="nutri-subscore-details">{scoreResult.breakdown.completenessDetails}</div>
          </div>
          <span className="nutri-subscore-val">{scoreResult.subScores.completeness}%</span>
        </div>

        <div className="nutri-subscore-row">
          <div>
            <span className="nutri-subscore-name">Lineage Depth</span>
            <div className="nutri-subscore-details">{scoreResult.breakdown.lineageDetails}</div>
          </div>
          <span className="nutri-subscore-val">{scoreResult.subScores.lineage}%</span>
        </div>

        <div className="nutri-subscore-row">
          <div>
            <span className="nutri-subscore-name">Quality Test Coverage</span>
            <div className="nutri-subscore-details">{scoreResult.breakdown.testCoverageDetails}</div>
          </div>
          <span className="nutri-subscore-val">{scoreResult.subScores.testCoverage}%</span>
        </div>

        {/* Column Ingredients */}
        <div className="nutri-ingredients-section">
          <div className="nutri-ingredients-title">
            Ingredients ({entity.fields.length} Columns)
          </div>
          {entity.fields.slice(0, 8).map((field) => {
            const desc = columnDescriptions[field.fieldPath] || field.description;
            const isUndocumented = !desc || desc === 'Undocumented / Needs Description';
            return (
              <div key={field.fieldPath} className="nutri-ingredient-item">
                <span className="nutri-field-name">{field.fieldPath}</span>
                {isUndocumented ? (
                  <span className="nutri-undocumented-badge">Undocumented / Needs Description</span>
                ) : (
                  <span>{desc}</span>
                )}
              </div>
            );
          })}
          {entity.fields.length > 8 && (
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
              + {entity.fields.length - 8} more columns...
            </div>
          )}
        </div>

        {/* Allergens & Governance Warnings */}
        {warnings.length > 0 && (
          <div className="nutri-warnings-section">
            <div className="nutri-warnings-title">⚠️ Allergens & Governance Warnings</div>
            {warnings.map((warn, idx) => (
              <div key={idx} className="nutri-warning-item">
                • {warn}
              </div>
            ))}
          </div>
        )}

        {/* Action Controls */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          <button
            className="nutri-preset-btn"
            onClick={() => setShowWeightControls(!showWeightControls)}
          >
            {showWeightControls ? 'Hide Weighting Methodology' : '⚙️ Adjust Methodology'}
          </button>
          {onSaveToDataHub && (
            <button
              className="nutri-preset-btn active"
              onClick={onSaveToDataHub}
              disabled={isSaving}
            >
              {isSaving ? 'Syncing...' : '💾 Sync Score to DataHub'}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Weighting Slider Panel */}
      {showWeightControls && (
        <div className="nutri-controls-card" style={{ maxWidth: '480px', margin: '16px auto 0 auto' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 800, margin: '0 0 12px 0' }}>
            Scoring Methodology Presets
          </h3>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <button
              className={`nutri-preset-btn ${activePreset === 'FDA_STANDARD' ? 'active' : ''}`}
              onClick={() => handlePresetSelect('FDA_STANDARD')}
            >
              FDA Standard (25/25/25/25)
            </button>
            <button
              className={`nutri-preset-btn ${activePreset === 'FRESHNESS_HEAVY' ? 'active' : ''}`}
              onClick={() => handlePresetSelect('FRESHNESS_HEAVY')}
            >
              Freshness Heavy
            </button>
            <button
              className={`nutri-preset-btn ${activePreset === 'GOVERNANCE_HEAVY' ? 'active' : ''}`}
              onClick={() => handlePresetSelect('GOVERNANCE_HEAVY')}
            >
              Governance Heavy
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
            <div>
              <span>Freshness Weight: {Math.round(weights.freshnessWeight * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.freshnessWeight}
                onChange={(e) => handleCustomSliderChange('freshnessWeight', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <span>Completeness Weight: {Math.round(weights.completenessWeight * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.completenessWeight}
                onChange={(e) => handleCustomSliderChange('completenessWeight', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <span>Lineage Weight: {Math.round(weights.lineageWeight * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.lineageWeight}
                onChange={(e) => handleCustomSliderChange('lineageWeight', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <span>Test Coverage Weight: {Math.round(weights.testCoverageWeight * 100)}%</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={weights.testCoverageWeight}
                onChange={(e) => handleCustomSliderChange('testCoverageWeight', parseFloat(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
