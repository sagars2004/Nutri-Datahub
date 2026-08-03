'use client';

import React, { useState, useEffect } from 'react';
import { NutriLabel } from '../components/NutriLabel';
import { NutriEntity, WeightConfig, TrustScoreResult } from '../types/nutri';

export default function HomePage() {
  const [catalogList, setCatalogList] = useState<{ urn: string; name: string; platform: string }[]>([]);
  const [selectedUrn, setSelectedUrn] = useState<string>('');
  const [customUrn, setCustomUrn] = useState<string>('');
  
  const [currentEntity, setCurrentEntity] = useState<NutriEntity | null>(null);
  const [verdictSummary, setVerdictSummary] = useState<string>('');
  const [columnDescriptions, setColumnDescriptions] = useState<Record<string, string>>({});
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // Fetch catalog list on load
  useEffect(() => {
    fetch('/api/catalog')
      .then((res) => res.json())
      .then((data) => {
        if (data.entities && data.entities.length > 0) {
          setCatalogList(data.entities);
          setSelectedUrn(data.entities[0].urn);
          loadEntityDetails(data.entities[0].urn);
        }
      })
      .catch((err) => {
        console.error('Failed to load catalog list:', err);
        setErrorMessage('Could not connect to DataHub API');
      });
  }, []);

  const loadEntityDetails = async (urnToLoad: string) => {
    setIsLoading(true);
    setErrorMessage('');
    setSaveSuccessMsg('');
    try {
      const res = await fetch(`/api/entity?urn=${encodeURIComponent(urnToLoad)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load entity details');
      }
      setCurrentEntity(data.entity);
      setVerdictSummary(data.verdictSummary);
      setColumnDescriptions(data.columnDescriptions || {});
    } catch (err: any) {
      setErrorMessage(err.message || 'Error loading asset metadata from DataHub');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newUrn = e.target.value;
    setSelectedUrn(newUrn);
    setCustomUrn('');
    loadEntityDetails(newUrn);
  };

  const handleCustomUrnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrn.trim()) {
      setSelectedUrn(customUrn.trim());
      loadEntityDetails(customUrn.trim());
    }
  };

  const handleSyncToDataHub = async (weights?: WeightConfig) => {
    if (!currentEntity) return;
    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      const res = await fetch('/api/entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urn: currentEntity.urn, weights }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Write-back failed');
      setSaveSuccessMsg(`Successfully synced score (${data.scoreResult.trustScore}/100) to DataHub GMS!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to sync score to DataHub');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchScan = async () => {
    setIsBatchRunning(true);
    setBatchResults([]);
    try {
      const results: any[] = [];
      for (const item of catalogList) {
        const res = await fetch('/api/entity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urn: item.urn }),
        });
        const data = await res.json();
        if (res.ok) {
          results.push({
            name: item.name,
            platform: item.platform,
            urn: item.urn,
            trustScore: data.scoreResult.trustScore,
            needsAttention: data.scoreResult.needsAttention,
            subScores: data.scoreResult.subScores,
          });
        }
      }
      setBatchResults(results);
    } catch (err: any) {
      setErrorMessage('Batch scan failed: ' + err.message);
    } finally {
      setIsBatchRunning(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#0f172a' }}>
      {/* Top Navigation Header */}
      <header style={{ backgroundColor: '#000000', color: '#ffffff', padding: '16px 24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.03em' }}>🥗 NUTRI</span>
            <span style={{ fontSize: '0.8125rem', backgroundColor: '#2563eb', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>
              DataHub Hackathon 2026
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
            <span>DataHub GMS Connected (localhost:8080)</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '32px auto', padding: '0 24px' }}>
        
        {/* Asset Selector Header Card */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 16px 0' }}>
            Select Catalog Entity for Trust Score Inspection
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Dropdown Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#475569' }}>
                Showcase Catalog Datasets
              </label>
              <select
                value={selectedUrn}
                onChange={handleSelectChange}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem', backgroundColor: '#f8fafc', fontWeight: 600 }}
              >
                {catalogList.map((item) => (
                  <option key={item.urn} value={item.urn}>
                    [{item.platform.toUpperCase()}] {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom URN Form */}
            <form onSubmit={handleCustomUrnSubmit}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '6px', color: '#475569' }}>
                Or Inspect Custom DataHub URN
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="urn:li:dataset:(...)"
                  value={customUrn}
                  onChange={(e) => setCustomUrn(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
                <button
                  type="submit"
                  style={{ padding: '10px 16px', borderRadius: '6px', backgroundColor: '#000000', color: '#ffffff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  Inspect URN
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Notifications */}
        {errorMessage && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 600 }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {saveSuccessMsg && (
          <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontWeight: 600 }}>
            ✅ {saveSuccessMsg}
          </div>
        )}

        {/* Live Nutri Label Component View */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '64px', fontSize: '1rem', fontWeight: 700, color: '#64748b' }}>
            Fetching asset metadata from DataHub GraphQL...
          </div>
        ) : currentEntity ? (
          <NutriLabel
            entity={currentEntity}
            verdictSummary={verdictSummary}
            columnDescriptions={columnDescriptions}
            onSaveToDataHub={handleSyncToDataHub}
            isSaving={isSaving}
          />
        ) : null}

        {/* Batch Catalog Scanner Section */}
        <div style={{ marginTop: '48px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0' }}>
                Batch Catalog Trust Score Inspector
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                Scan, calculate Trust Scores, and sync structured properties across all catalog entities.
              </p>
            </div>
            <button
              onClick={handleBatchScan}
              disabled={isBatchRunning}
              style={{ padding: '10px 20px', borderRadius: '6px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: 800, border: 'none', cursor: 'pointer' }}
            >
              {isBatchRunning ? 'Scanning Catalog...' : '🚀 Batch Scan & Sync All Entities'}
            </button>
          </div>

          {batchResults.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '10px' }}>Platform</th>
                    <th style={{ padding: '10px' }}>Dataset Name</th>
                    <th style={{ padding: '10px' }}>Trust Score</th>
                    <th style={{ padding: '10px' }}>Freshness</th>
                    <th style={{ padding: '10px' }}>Completeness</th>
                    <th style={{ padding: '10px' }}>Lineage</th>
                    <th style={{ padding: '10px' }}>Quality Tests</th>
                    <th style={{ padding: '10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResults.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{item.platform.toUpperCase()}</td>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '10px', fontWeight: 900, fontSize: '1rem' }}>{item.trustScore}/100</td>
                      <td style={{ padding: '10px' }}>{item.subScores.freshness}%</td>
                      <td style={{ padding: '10px' }}>{item.subScores.completeness}%</td>
                      <td style={{ padding: '10px' }}>{item.subScores.lineage}%</td>
                      <td style={{ padding: '10px' }}>{item.subScores.testCoverage}%</td>
                      <td style={{ padding: '10px' }}>
                        {item.needsAttention ? (
                          <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem' }}>
                            NEEDS ATTENTION
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, fontSize: '0.75rem' }}>
                            HIGH TRUST
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
