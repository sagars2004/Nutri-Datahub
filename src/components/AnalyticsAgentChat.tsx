'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Sparkles, RefreshCw, Copy, Check, X, Database, Wrench, MessageSquare } from 'lucide-react';
import { NutriEntity, TrustScoreResult } from '@/types/nutri';
import { AgentMode } from '@/services/agent';

interface AnalyticsAgentChatProps {
  entity: NutriEntity;
  scoreResult?: TrustScoreResult | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AnalyticsAgentChat: React.FC<AnalyticsAgentChatProps> = ({ entity, scoreResult }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<AgentMode>('governance');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const trustScore = scoreResult?.trustScore ?? 50;
  const isHealthy = trustScore >= 70;

  // Initialize greeting on entity or mode change
  useEffect(() => {
    if (mode === 'talk_to_data') {
      setMessages([
        {
          role: 'assistant',
          content: isHealthy
            ? `💬 **DataHub Talk-to-Data Assistant** ready for \`${entity.name}\` (${entity.platform.toUpperCase()}).\n✅ Trust Score is **${trustScore}/100**. Ask me to write verified SQL queries, calculations, or aggregations grounded in DataHub schema metadata.`
            : `🚨 **DataHub Talk-to-Data Assistant** ready for \`${entity.name}\` (${entity.platform.toUpperCase()}).\n⚠️ **Warning: Trust Score is ${trustScore}/100** (below threshold). Ask me for sample queries, but inspect results before financial or production use.`,
        },
      ]);
    } else {
      setMessages([
        {
          role: 'assistant',
          content: `👋 I am the **DataHub Nutri Governance & Remediation Agent**. I have analyzed \`${entity.name}\` (${entity.platform.toUpperCase()}). Overall Trust Score: **${trustScore}/100**.\n\nAsk me how to improve this score, generate dbt \`schema.yml\` documentation patches, or inspect lineage impact.`,
        },
      ]);
    }
  }, [entity.urn, entity.name, entity.platform, mode, trustScore, isHealthy]);

  useEffect(() => {
    if (isExpanded) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const resp = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urn: entity.urn,
          message: userText,
          history: newMessages.slice(-6),
          mode,
        }),
      });

      const data = await resp.json();
      if (data.reply) {
        setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: `⚠️ ${data.error || 'Failed to get analysis.'}` },
        ]);
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `⚠️ Error reaching Analytics Agent: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const governancePrompts = [
    { label: '🔍 Explain Bottlenecks', query: `Explain why ${entity.name} scored ${trustScore}/100 and identify the primary bottlenecks holding it back.` },
    { label: '🛠️ Reach 95+ Score', query: `What concrete steps and metadata updates are needed to raise ${entity.name}'s trust score to 95+?` },
    { label: '📝 dbt schema.yml patch', query: `Generate a complete dbt models/schema.yml YAML snippet with column descriptions and tests for ${entity.name}.` },
    { label: '📊 Lineage Analysis', query: `Analyze how the upstream lineage of ${entity.name} affects downstream dashboards and consumers.` },
  ];

  const talkToDataPrompts = [
    { label: '⚡ Top 10 Records', query: `Write a safe SQL query to preview the top 10 rows from ${entity.name} with key columns.` },
    { label: '📈 Aggregate Metric', query: `Write an analytical aggregation query counting records and summarizing metrics on ${entity.name}.` },
    { label: '🛡️ Check PII & Assertions', query: `Which columns in ${entity.name} are marked as PII or have failing assertions?` },
    { label: '🔗 Upstream Join', query: `Write a SQL query demonstrating how to join ${entity.name} with its upstream dependencies.` },
  ];

  const activePrompts = mode === 'talk_to_data' ? talkToDataPrompts : governancePrompts;

  return (
    <>
      {/* Semi-transparent Glassmorphism Popup Window */}
      {isExpanded && (
        <div className="fixed bottom-20 right-6 z-50 w-[440px] max-w-[calc(100vw-2.5rem)] h-[560px] flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl rounded-2xl overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  mode === 'talk_to_data'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
                }`}
              >
                {mode === 'talk_to_data' ? <Database className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1">
                    {mode === 'talk_to_data' ? 'Talk-to-Data Assistant' : 'Governance & Remediation Agent'}
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 px-1.5 ${
                      isHealthy
                        ? 'border-emerald-700/60 text-emerald-400 bg-emerald-950/40'
                        : 'border-amber-700/60 text-amber-400 bg-amber-950/40'
                    }`}
                  >
                    Score: {trustScore}/100
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-400 truncate max-w-[240px]">
                  {entity.name} • {entity.platform.toUpperCase()}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-800/80 h-7 w-7 rounded-full"
              title="Minimize chat"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Popup Body */}
          <div className="p-3.5 flex-1 flex flex-col min-h-0 space-y-3">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800 shrink-0">
              <button
                onClick={() => setMode('governance')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-medium transition-all ${
                  mode === 'governance'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-3 h-3" />
                Governance & Remediation
              </button>
              <button
                onClick={() => setMode('talk_to_data')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded-md text-[11px] font-medium transition-all ${
                  mode === 'talk_to_data'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database className="w-3 h-3" />
                Talk-to-Data (SQL)
              </button>
            </div>

            {/* Quick Action Prompt Chips */}
            <div className="flex flex-wrap gap-1 pb-2 border-b border-slate-800/80 shrink-0 max-h-[68px] overflow-y-auto">
              {activePrompts.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip.query)}
                  disabled={isLoading}
                  className="text-[10px] font-medium bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded-full transition-all text-left truncate"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs min-h-0">
              {messages.map((msg, index) => {
                const isAssistant = msg.role === 'assistant';
                return (
                  <div
                    key={index}
                    className={`flex gap-2 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAssistant && (
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] mt-0.5 ${
                          mode === 'talk_to_data'
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                            : 'bg-sky-500/20 border border-sky-500/40 text-sky-400'
                        }`}
                      >
                        {mode === 'talk_to_data' ? <Database className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                      </div>
                    )}

                    <div
                      className={`p-2.5 rounded-xl max-w-[88%] leading-relaxed ${
                        isAssistant
                          ? 'bg-slate-950/90 border border-slate-800 text-slate-200 shadow-sm relative group'
                          : 'bg-sky-600 text-white font-medium'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans text-xs">
                        {msg.content}
                      </div>

                      {isAssistant && (
                        <button
                          onClick={() => handleCopy(msg.content, index)}
                          className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Copy message"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-2 items-center text-slate-400 text-xs italic pl-7">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                  {mode === 'talk_to_data'
                    ? 'Generating SQL query...'
                    : 'Synthesizing metadata diagnosis...'}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
              className="flex gap-1.5 pt-2 border-t border-slate-800 shrink-0"
            >
              <Input
                type="text"
                placeholder={mode === 'talk_to_data' ? `Ask Talk-to-Data for SQL on ${entity.name}...` : `Ask Agent about ${entity.name}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="bg-slate-950/90 border-slate-800 text-xs text-white placeholder:text-slate-500 h-8 focus-visible:ring-sky-500"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className={`${
                  mode === 'talk_to_data' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'
                } text-white h-8 px-3`}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Corner Trigger Icon Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-full border shadow-2xl backdrop-blur-md transition-all transform hover:scale-105 cursor-pointer ${
          isExpanded
            ? 'bg-slate-800/90 border-slate-600 text-white shadow-sky-500/20'
            : 'bg-slate-900/90 hover:bg-slate-800/90 border-sky-500/50 text-white shadow-sky-500/10'
        }`}

      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
        </span>

        <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
          <Bot className="w-3.5 h-3.5" />
        </div>

        <span className="text-xs font-semibold text-slate-100 flex items-center gap-1">
          Analytics Agent
          <Sparkles className="w-3 h-3 text-amber-400" />
        </span>

        <Badge
          variant="outline"
          className={`text-[10px] py-0 px-1.5 ${
            isHealthy
              ? 'border-emerald-700/60 text-emerald-400 bg-emerald-950/50'
              : 'border-amber-700/60 text-amber-400 bg-amber-950/50'
          }`}
        >
          {trustScore}/100
        </Badge>
      </button>
    </>
  );
};

