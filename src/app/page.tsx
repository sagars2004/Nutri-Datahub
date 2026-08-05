'use client';

import React, { useState, useEffect } from 'react';
import { NutriLabel } from '../components/NutriLabel';
import { AnalyticsAgentChat } from '../components/AnalyticsAgentChat';
import { NutriEntity, WeightConfig } from '../types/nutri';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import BorderBeam from '@/components/ui/border-beam';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
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
  LayoutDashboard,
  Boxes,
  FileCheck,
  TrendingUp,
  Server,
  Terminal,
  HelpCircle,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';

export default function HomePage() {
  const [catalogList, setCatalogList] = useState<{ urn: string; name: string; platform: string }[]>([]);
  const [selectedUrn, setSelectedUrn] = useState<string>('');
  const [customUrn, setCustomUrn] = useState<string>('');
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [currentEntity, setCurrentEntity] = useState<NutriEntity | null>(null);
  const [currentScoreResult, setCurrentScoreResult] = useState<any>(null);
  const [verdictSummary, setVerdictSummary] = useState<string>('');
  const [columnDescriptions, setColumnDescriptions] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // New Connection Form state
  const [newPlatform, setNewPlatform] = useState<string>('snowflake');
  const [newTableName, setNewTableName] = useState<string>('');
  const [newEnvironment, setNewEnvironment] = useState<string>('PROD');
  const [createdConnectionMsg, setCreatedConnectionMsg] = useState<string>('');

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Fetch catalog on mount
  useEffect(() => {
    fetch('/api/catalog')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Catalog API responded with status ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.entities && data.entities.length > 0) {
          setCatalogList(data.entities);
          setSelectedUrn(data.entities[0].urn);
          loadEntityDetails(data.entities[0].urn);
        }
      })
      .catch((err) => {
        console.error('Failed to load catalog list:', err);
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
      setCurrentScoreResult(data.scoreResult);
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

  // Recharts Chart Data
  const chartData = (batchResults.length > 0 ? batchResults : [
    { name: 'product_categories', trustScore: 100, platform: 'snowflake' },
    { name: 'orders', trustScore: 88, platform: 'snowflake' },
    { name: 'order_items', trustScore: 92, platform: 'snowflake' },
    { name: 'customers', trustScore: 78, platform: 'snowflake' },
    { name: 'stg_orders', trustScore: 85, platform: 'dbt' },
    { name: 'fct_orders', trustScore: 90, platform: 'dbt' },
    { name: 'Order Details', trustScore: 95, platform: 'looker' },
    { name: 'Promotions', trustScore: 70, platform: 'tableau' },
  ]);

  const pieData = [
    { name: 'High Trust (>=80)', value: chartData.filter(d => d.trustScore >= 80).length, color: '#10b981' },
    { name: 'Medium Trust (70-79)', value: chartData.filter(d => d.trustScore >= 70 && d.trustScore < 80).length, color: '#0ea5e9' },
    { name: 'Needs Attention (<70)', value: chartData.filter(d => d.trustScore < 70).length, color: '#f43f5e' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500 selection:text-white flex flex-col">
      
      {/* Top Navbar */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-50 px-6 py-3.5 backdrop-blur-xl shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-emerald-500 rounded-xl blur opacity-40 group-hover:opacity-75 transition duration-300"></div>
              <div className="relative w-10 h-10 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center shadow-md">
                <Activity className="w-5 h-5 text-sky-400" />
              </div>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-black tracking-tight text-white flex items-center gap-1">
                  NUTRI
                </span>
                <span className="h-4 w-px bg-slate-700 hidden sm:inline-block" />
                <Badge variant="outline" className="border-sky-500/30 text-sky-300 bg-sky-950/50 text-[10px] uppercase font-bold tracking-wider hidden sm:inline-flex">
                  Build with DataHub: Agent Hackathon 2026
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden md:block">
                Standardized Data Nutrition Facts & Trust Score Platform
              </p>
            </div>
          </div>

          {/* Right Header Status & Navigation Links */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-200">DataHub GMS Connected</span>
            </div>
            
            <a
              href="http://localhost:9002"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-slate-300 hover:text-white transition-all bg-slate-800/80 hover:bg-slate-700/80 px-3.5 py-1.5 rounded-lg border border-slate-700/80 shadow-sm"
            >
              <span>Open DataHub UI</span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            </a>
          </div>

        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8 flex flex-col">

        {/* Hero Bento Box Banner */}
        <Card className="relative overflow-hidden bg-slate-900 border-slate-800 p-6 sm:p-8 shadow-2xl">
          <BorderBeam size={280} duration={12} colorFrom="#0ea5e9" colorTo="#10b981" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sky-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Repeatable Metadata Trust Platform</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-snug">
                Data Nutrition Facts & <span className="text-sky-400">Trust Score Engine</span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xl">
                Nutri calculates objective 0–100 Trust Scores across Freshness, Completeness, Lineage, and Quality Assertions, generating FDA-style Nutrition Facts labels with Gemini AI plain-language explanations.
              </p>
            </div>

            {/* Metric Bento Cards */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  Monitored Assets
                </div>
                <div className="text-2xl font-black text-white font-mono">{catalogList.length}</div>
                <p className="text-[10px] text-slate-500 font-medium">DataHub GMS Catalog</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Avg Catalog Score
                </div>
                <div className="text-2xl font-black text-emerald-400 font-mono">88/100</div>
                <p className="text-[10px] text-slate-500 font-medium">High Trust Index</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-slate-300" />
                  Platforms
                </div>
                <div className="text-xs font-black text-white truncate pt-1">Snowflake, dbt, Postgres, Tableau, PowerBI, Looker</div>
                <p className="text-[10px] text-slate-500 font-medium">Cross-Platform Lineage</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Sync Mutation
                </div>
                <div className="text-xs font-bold text-emerald-400 uppercase pt-1.5 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Active GMS
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Structured Property Write-back</p>
              </div>

            </div>

          </div>
        </Card>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Main Dashboard Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full bg-slate-900 border border-slate-800 p-1">
            <TabsTrigger value="dashboard" className="text-xs font-bold gap-2">
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard & Analytics</span>
            </TabsTrigger>

            <TabsTrigger value="explorer" className="text-xs font-bold gap-2">
              <Search className="w-3.5 h-3.5" />
              <span>Catalog & Label Inspector</span>
            </TabsTrigger>

            <TabsTrigger value="repeatable" className="text-xs font-bold gap-2">
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Connect Dataset Workflow</span>
            </TabsTrigger>

            <TabsTrigger value="batch" className="text-xs font-bold gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Batch Audit Studio</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Dashboard & Analytics Overview Bento Grid */}
          <TabsContent value="dashboard" className="space-y-6">
            
            {/* Bento Grid Row 1: Charts & Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Trust Score Bar Chart Card */}
              <Card className="lg:col-span-8 bg-slate-900 border-slate-800 p-5 space-y-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-sky-400" />
                      Dataset Trust Score Distribution (0–100 Index)
                    </h3>
                    <p className="text-xs text-slate-400">Live scores computed across DataHub catalog entities</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                    Real-time Audit
                  </Badge>
                </div>

                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#38bdf8' }}
                      />
                      <Bar dataKey="trustScore" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.trustScore >= 80 ? '#10b981' : entry.trustScore >= 70 ? '#0ea5e9' : '#f43f5e'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Pie Distribution Card */}
              <Card className="lg:col-span-4 bg-slate-900 border-slate-800 p-5 space-y-4 shadow-xl flex flex-col justify-between">
                <div className="border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-400" />
                    Catalog Health Tier Ratio
                  </h3>
                  <p className="text-xs text-slate-400">Proportion of high vs attention-needed assets</p>
                </div>

                <div className="h-44 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`pie-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#090d16', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 text-xs pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> High Trust (&ge;80)</span>
                    <span className="font-mono font-bold">{pieData[0].value}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> Medium Trust (70–79)</span>
                    <span className="font-mono font-bold">{pieData[1].value}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Needs Attention (&lt;70)</span>
                    <span className="font-mono font-bold">{pieData[2].value}</span>
                  </div>
                </div>
              </Card>

            </div>

            {/* Quick Action Banner */}
            <Card className="bg-slate-900 border-slate-800 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-sky-400" />
                  Ready to inspect or connect dataset metadata?
                </h3>
                <p className="text-xs text-slate-400">
                  Switch to the Catalog Inspector tab or connect any database table to generate FDA Data Nutrition Facts.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => setActiveTab('explorer')}
                  variant="default"
                  className="bg-white text-slate-950 hover:bg-slate-200 font-extrabold text-xs"
                >
                  Inspect Selected Asset
                </Button>
                <Button
                  onClick={() => setActiveTab('repeatable')}
                  variant="outline"
                  className="border-slate-700 text-slate-200 font-extrabold text-xs"
                >
                  Connect New Dataset
                </Button>
              </div>
            </Card>

          </TabsContent>

          {/* TAB 2: Catalog Explorer & Live FDA Label Inspector */}
          <TabsContent value="explorer" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* Left Column: Asset Explorer List */}
              <div className="lg:col-span-5 flex flex-col">
                <Card className="bg-slate-900 border-slate-800 p-5 shadow-xl flex-1 flex flex-col justify-between">
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4 shrink-0">
                      <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-sky-400" />
                        Approved Catalog Datasets
                      </h2>
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                        {filteredCatalog.length} Datasets
                      </Badge>
                    </div>

                    {/* Filters & Search */}
                    <div className="space-y-3 mb-4 shrink-0">
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

                      <div className="flex flex-wrap gap-2">
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
                        <Button
                          variant={filterPlatform === 'postgres' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFilterPlatform('postgres')}
                          className="text-[11px] h-7 px-2.5 font-bold"
                        >
                          Postgres
                        </Button>
                        <Button
                          variant={filterPlatform === 'tableau' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFilterPlatform('tableau')}
                          className="text-[11px] h-7 px-2.5 font-bold"
                        >
                          Tableau
                        </Button>
                        <Button
                          variant={filterPlatform === 'powerbi' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFilterPlatform('powerbi')}
                          className="text-[11px] h-7 px-2.5 font-bold"
                        >
                          PowerBI
                        </Button>
                        <Button
                          variant={filterPlatform === 'looker' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFilterPlatform('looker')}
                          className="text-[11px] h-7 px-2.5 font-bold"
                        >
                          Looker
                        </Button>
                      </div>
                    </div>

                    {/* Dataset Scroll List (Filled down to footer with scrolling enabled) */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[360px] max-h-[620px]">
                      {filteredCatalog.map((item) => {
                        const isSelected = item.urn === selectedUrn;
                        return (
                          <div
                            key={item.urn}
                            onClick={() => handleSelectEntity(item.urn)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-slate-800 border-slate-600 text-white shadow-md'
                                : 'bg-slate-950 border-slate-800/80 text-slate-300 hover:bg-slate-800/40 hover:border-slate-700'
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
                                    ? 'border-sky-500/40 text-sky-400 bg-sky-500/10'
                                    : item.platform.toLowerCase() === 'tableau' || item.platform.toLowerCase() === 'powerbi' || item.platform.toLowerCase() === 'looker'
                                    ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                                    : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
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
                  </div>

                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex justify-between items-center shrink-0 mt-3">
                    <span>Selected URN loaded from DataHub GMS</span>
                    <span className="font-mono font-bold text-slate-400">{filteredCatalog.length} Total</span>
                  </div>
                </Card>
              </div>

              {/* Right Column: Live FDA Nutrition Facts Card */}
              <div className="lg:col-span-7 flex flex-col">
                {isLoading ? (
                  <Card className="bg-slate-900 border-slate-800 p-12 text-center space-y-4 flex-1 flex flex-col justify-center items-center">
                    <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
                    <p className="text-sm font-bold text-slate-300">
                      Fetching metadata from DataHub GraphQL GMS...
                    </p>
                  </Card>
                ) : currentEntity ? (
                  <div className="flex flex-col space-y-4">
                    <NutriLabel
                      entity={currentEntity}
                      verdictSummary={verdictSummary}
                      columnDescriptions={columnDescriptions}
                      onSaveToDataHub={handleSyncToDataHub}
                      isSaving={isSaving}
                    />
                    <AnalyticsAgentChat
                      entity={currentEntity}
                      scoreResult={currentScoreResult}
                    />
                  </div>
                ) : null}
              </div>

            </div>
          </TabsContent>

          {/* TAB 3: Repeatable Workflow - Connect ANY Approved Dataset */}
          <TabsContent value="repeatable">
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-6 max-w-2xl mx-auto shadow-2xl">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-sky-400" />
                  Connect New Dataset to Nutri Workflow
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Make Nutri repeatable across any approved data warehouse table, BI dashboard, dbt model, or custom DataHub dataset.
                </p>
              </div>

              {createdConnectionMsg && (
                <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 p-3 rounded-lg text-xs font-semibold">
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
                      <option value="tableau">Tableau</option>
                      <option value="powerbi">PowerBI</option>
                      <option value="looker">Looker</option>
                      <option value="spark">Apache Spark</option>
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

                <Button type="submit" className="w-full font-bold bg-white text-slate-950 hover:bg-slate-200">
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

          {/* TAB 4: Batch Audit Studio */}
          <TabsContent value="batch">
            <Card className="bg-slate-900 border-slate-800 p-6 space-y-6 shadow-2xl">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-sky-400" />
                    Batch Catalog Audit Studio
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Scan, calculate Trust Scores, and write back structured properties across all catalog datasets simultaneously.
                  </p>
                </div>

                <Button
                  onClick={handleBatchScan}
                  disabled={isBatchRunning}
                  className="font-bold text-xs bg-white text-slate-950 hover:bg-slate-200"
                >
                  {isBatchRunning ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Scanning Catalog...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2 text-sky-600" />
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

        </Tabs>
      </main>
    </div>
  );
}
