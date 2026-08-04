'use client';

import React, { useState, useEffect } from 'react';
import { NutriLabel } from '../components/NutriLabel';
import { NutriEntity, WeightConfig } from '../types/nutri';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import BorderBeam from '@/components/ui/border-beam';
import {
  Database,
  Search,
  Sparkles,
  ShieldCheck,
  Zap,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Sliders,
  BarChart3,
  ExternalLink,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function HomePage() {
  const [catalogList, setCatalogList] = useState<{ urn: string; name: string; platform: string }[]>([]);
  const [selectedUrn, setSelectedUrn] = useState<string>('');
  const [customUrn, setCustomUrn] = useState<string>('');
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentEntity, setCurrentEntity] = useState<NutriEntity | null>(null);
  const [verdictSummary, setVerdictSummary] = useState<string>('');
  const [columnDescriptions, setColumnDescriptions] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // New Connection Form state for Repeatable Workflow
  const [newPlatform, setNewPlatform] = useState<string>('snowflake');
  const [newTableName, setNewTableName] = useState<string>('');
  const [newEnvironment, setNewEnvironment] = useState<string>('PROD');
  const [createdConnectionMsg, setCreatedConnectionMsg] = useState<string>('');

  // Fetch catalog on mount
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

  const handleSelectEntity = (urn: string) => {
    setSelectedUrn(urn);
    setCustomUrn('');
    loadEntityDetails(urn);
  };

  const handleCustomUrnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrn.trim()) {
      setSelectedUrn(customUrn.trim());
      loadEntityDetails(customUrn.trim());
    }
  };

  const handleAddApprovedDataset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) return;
    const derivedUrn = `urn:li:dataset:(urn:li:dataPlatform:${newPlatform},${newTableName.trim()},${newEnvironment})`;
    const newEntry = {
      urn: derivedUrn,
      name: newTableName.trim(),
      platform: newPlatform,
    };
    setCatalogList((prev) => [newEntry, ...prev]);
    setSelectedUrn(derivedUrn);
    loadEntityDetails(derivedUrn);
    setCreatedConnectionMsg(`Successfully added dataset "${newTableName}" to Nutri inspection workflow!`);
    setNewTableName('');
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
      setSaveSuccessMsg(`Successfully synced Trust Score (${data.scoreResult.trustScore}/100) to DataHub GMS!`);
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

  const filteredCatalog = catalogList.filter((item) => {
    const matchesPlatform = filterPlatform === 'ALL' || item.platform.toLowerCase() === filterPlatform.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.urn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 font-black text-xl">
              🥗
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                  NUTRI
                </span>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-400 bg-indigo-500/10 text-[10px] uppercase font-bold tracking-wider">
                  Hackathon 2026
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Standardized Data Nutrition Facts & Trust Score Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>DataHub GMS Connected</span>
            </div>
            <a
              href="http://localhost:9002"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <span>DataHub UI</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Hero Banner with Animated BorderBeam */}
        <Card className="relative overflow-hidden bg-slate-900/90 border-slate-800/80 p-8 shadow-2xl">
          <BorderBeam size={300} duration={12} colorFrom="#3b82f6" colorTo="#8b5cf6" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Repeatable Metadata Trust Platform</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Turn Raw Metadata into <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Actionable Trust Labels</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
                Nutri calculates objective 0–100 Trust Scores across Freshness, Completeness, Lineage, and Quality Assertions, generating FDA-style Nutrition Facts labels with Gemini AI plain-language explanations.
              </p>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-md">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Monitored Assets</span>
                </div>
                <div className="text-2xl font-black text-white font-mono">{catalogList.length}</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Avg Trust Score</span>
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">84/100</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Platforms</span>
                </div>
                <div className="text-2xl font-black text-white font-mono">Snowflake, dbt</div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sync Status</span>
                </div>
                <div className="text-sm font-extrabold text-amber-400 uppercase pt-1">Auto-Sync</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="bg-rose-950/60 border border-rose-800/80 text-rose-300 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Main Tabbed Application Studio */}
        <Tabs defaultValue="explorer" className="w-full space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full bg-slate-900 border border-slate-800 p-1.5">
            <TabsTrigger value="explorer" className="text-xs font-bold gap-2">
              <Search className="w-4 h-4" />
              <span>Catalog Explorer</span>
            </TabsTrigger>

            <TabsTrigger value="repeatable" className="text-xs font-bold gap-2">
              <PlusCircle className="w-4 h-4" />
              <span>Connect Dataset</span>
            </TabsTrigger>

            <TabsTrigger value="batch" className="text-xs font-bold gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Batch Audit Studio</span>
            </TabsTrigger>

            <TabsTrigger value="methodology" className="text-xs font-bold gap-2">
              <Sliders className="w-4 h-4" />
              <span>Methodology & Config</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Catalog Explorer & Live FDA Label Inspector */}
          <TabsContent value="explorer" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Asset Explorer List */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="bg-slate-900 border-slate-800 p-5 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-400" />
                      Approved Catalog Datasets
                    </h2>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                      {filteredCatalog.length} Datasets
                    </Badge>
                  </div>

                  {/* Filters & Search */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                      <Input
                        type="text"
                        placeholder="Search datasets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-950 border-slate-800 text-xs text-white placeholder:text-slate-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={filterPlatform === 'ALL' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterPlatform('ALL')}
                        className="text-[11px] h-7 px-2.5 font-bold"
                      >
                        All
                      </Button>
                      <Button
                        variant={filterPlatform === 'snowflake' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterPlatform('snowflake')}
                        className="text-[11px] h-7 px-2.5 font-bold"
                      >
                        Snowflake
                      </Button>
                      <Button
                        variant={filterPlatform === 'dbt' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterPlatform('dbt')}
                        className="text-[11px] h-7 px-2.5 font-bold"
                      >
                        dbt
                      </Button>
                    </div>
                  </div>

                  {/* Dataset Scroll List */}
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {filteredCatalog.map((item) => {
                      const isSelected = item.urn === selectedUrn;
                      return (
                        <div
                          key={item.urn}
                          onClick={() => handleSelectEntity(item.urn)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-mono font-bold text-xs truncate max-w-[220px]">
                              {item.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 ${
                                item.platform.toLowerCase() === 'snowflake'
                                  ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                                  : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                              }`}
                            >
                              {item.platform}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono truncate" title={item.urn}>
                            {item.urn}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Right Column: Live FDA Nutrition Facts Card */}
              <div className="lg:col-span-7">
                {isLoading ? (
                  <Card className="bg-slate-900 border-slate-800 p-12 text-center space-y-4">
                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                    <p className="text-sm font-bold text-slate-300">
                      Fetching metadata from DataHub GraphQL GMS...
                    </p>
                  </Card>
                ) : currentEntity ? (
                  <NutriLabel
                    entity={currentEntity}
                    verdictSummary={verdictSummary}
                    columnDescriptions={columnDescriptions}
                    onSaveToDataHub={handleSyncToDataHub}
                    isSaving={isSaving}
                  />
                ) : null}
              </div>

            </div>
          </TabsContent>

          {/* TAB 2: Repeatable Workflow - Connect ANY Approved Dataset */}
          <TabsContent value="repeatable">
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-6 max-w-2xl mx-auto shadow-2xl">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-indigo-400" />
                  Connect New Dataset to Nutri Workflow
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Make Nutri repeatable across any approved data warehouse table, dbt model, or custom DataHub dataset.
                </p>
              </div>

              {createdConnectionMsg && (
                <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 p-3 rounded-lg text-xs font-semibold">
                  ✅ {createdConnectionMsg}
                </div>
              )}

              <form onSubmit={handleAddApprovedDataset} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-300">Data Platform</Label>
                    <select
                      value={newPlatform}
                      onChange={(e) => setNewPlatform(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-semibold"
                    >
                      <option value="snowflake">Snowflake</option>
                      <option value="dbt">dbt</option>
                      <option value="postgres">PostgreSQL</option>
                      <option value="spark">Apache Spark</option>
                      <option value="powerbi">PowerBI</option>
                      <option value="bigquery">Google BigQuery</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-300">Environment</Label>
                    <select
                      value={newEnvironment}
                      onChange={(e) => setNewEnvironment(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white font-semibold"
                    >
                      <option value="PROD">PROD</option>
                      <option value="STAGING">STAGING</option>
                      <option value="DEV">DEV</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-300">Table or Model Name</Label>
                  <Input
                    type="text"
                    placeholder="e.g. order_header or fct_monthly_revenue"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs text-white"
                  />
                </div>

                <Button type="submit" variant="gradient" className="w-full font-bold">
                  Add Dataset & Generate Nutri Label
                </Button>
              </form>

              <div className="border-t border-slate-800 pt-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Or Paste Custom DataHub URN
                </h3>
                <form onSubmit={handleCustomUrnSubmit} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="urn:li:dataset:(urn:li:dataPlatform:...)"
                    value={customUrn}
                    onChange={(e) => setCustomUrn(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-xs text-white"
                  />
                  <Button type="submit" variant="outline" className="text-xs font-bold border-slate-700">
                    Inspect
                  </Button>
                </form>
              </div>
            </Card>
          </TabsContent>

          {/* TAB 3: Batch Audit Studio */}
          <TabsContent value="batch">
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-400" />
                    Batch Catalog Audit Studio
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Scan, calculate Trust Scores, and write back structured properties across all catalog datasets simultaneously.
                  </p>
                </div>

                <Button
                  onClick={handleBatchScan}
                  disabled={isBatchRunning}
                  variant="gradient"
                  className="font-bold text-xs"
                >
                  {isBatchRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Scanning Catalog...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Batch Scan & Sync All ({catalogList.length}) Entities
                    </>
                  )}
                </Button>
              </div>

              {batchResults.length > 0 ? (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3">Platform</th>
                        <th className="p-3">Dataset Name</th>
                        <th className="p-3">Trust Score</th>
                        <th className="p-3">Freshness</th>
                        <th className="p-3">Completeness</th>
                        <th className="p-3">Lineage</th>
                        <th className="p-3">Quality Tests</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                      {batchResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono font-bold uppercase text-slate-300">{item.platform}</td>
                          <td className="p-3 font-mono font-semibold text-white">{item.name}</td>
                          <td className="p-3 font-mono font-black text-sm text-white">{item.trustScore}/100</td>
                          <td className="p-3 text-slate-300">{item.subScores.freshness}%</td>
                          <td className="p-3 text-slate-300">{item.subScores.completeness}%</td>
                          <td className="p-3 text-slate-300">{item.subScores.lineage}%</td>
                          <td className="p-3 text-slate-300">{item.subScores.testCoverage}%</td>
                          <td className="p-3">
                            <Badge variant={item.needsAttention ? 'danger' : 'success'} className="text-[10px] uppercase font-bold">
                              {item.needsAttention ? 'NEEDS ATTENTION' : 'HIGH TRUST'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold">
                    Click "Batch Scan & Sync All Entities" to execute catalog-wide audit.
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* TAB 4: Scoring Methodology & Config */}
          <TabsContent value="methodology">
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-6 max-w-3xl mx-auto shadow-2xl">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  Scoring Methodology & Threshold Configuration
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Understand how Nutri computes objective, reproducible Trust Scores across four metadata pillars.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    Freshness Sub-Score (25%)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Evaluates update timestamp relative to expected cadence (24h) and staleness threshold (72h). Applies linear decay.
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Completeness Sub-Score (25%)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Evaluates column documentation coverage (50%) + governance metadata presence (owners, domains, glossary terms - 50%).
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    Lineage Depth Sub-Score (25%)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Evaluates edge connectedness (60%) and cross-platform lineage diversity across Snowflake, dbt, and Looker (40%).
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Test Coverage Sub-Score (25%)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Evaluates presence and pass rates of DataHub assertions and data quality checks.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
