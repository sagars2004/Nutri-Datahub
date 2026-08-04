'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Sparkles, RefreshCw, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { NutriEntity, TrustScoreResult } from '@/types/nutri';

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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize greeting on entity change
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: `👋 I am the **DataHub Nutri Analytics Agent**. I have analyzed \`${entity.name}\` (${entity.platform}). How can I help you inspect its trust score or fix metadata gaps?`,
      },
    ]);
  }, [entity.urn, entity.name, entity.platform]);

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

  const quickPrompts = [
    { label: '🔍 Explain Score Breakdown', query: `Explain why ${entity.name} scored ${scoreResult?.trustScore || 'its current score'}/100 and identify the primary bottlenecks.` },
    { label: '🛠️ How to reach 90+ Score?', query: `What concrete steps and metadata updates are needed to raise ${entity.name}'s trust score to 90+?` },
    { label: '📊 Lineage & Downstream Impact', query: `Analyze how the upstream lineage of ${entity.name} affects downstream dashboards and consumers.` },
    { label: '📝 Generate dbt schema.yml patch', query: `Generate a complete dbt models/schema.yml YAML snippet with column descriptions and tests for ${entity.name}.` },
  ];

  return (
    <Card className="bg-slate-900 border-slate-800 shadow-xl overflow-hidden mt-4">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-950 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                DataHub Analytics Agent
                <Sparkles className="w-3 h-3 text-amber-400" />
              </h3>
              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                Live AI Assistant
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              Ask questions about score derivation, lineage root-cause, and remediation patches
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white h-7 px-2">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Collapsible Body */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Quick Action Prompt Chips */}
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-800/80">
            {quickPrompts.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.query)}
                disabled={isLoading}
                className="text-[11px] font-medium bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-full transition-all text-left"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Messages Area */}
          <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1 text-xs">
            {messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={index}
                  className={`flex gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center shrink-0 text-sky-400 text-[10px] mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                      isAssistant
                        ? 'bg-slate-950 border border-slate-800 text-slate-200 shadow-sm relative group'
                        : 'bg-sky-600 text-white font-medium'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans text-xs">
                      {msg.content}
                    </div>

                    {isAssistant && (
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
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
              <div className="flex gap-2.5 items-center text-slate-400 text-xs italic pl-8">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                Synthesizing metadata diagnosis & remediation plan...
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
            className="flex gap-2 pt-2 border-t border-slate-800"
          >
            <Input
              type="text"
              placeholder={`Ask Analytics Agent about ${entity.name}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="bg-slate-950 border-slate-800 text-xs text-white placeholder:text-slate-500 h-9"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-sky-600 hover:bg-sky-500 text-white h-9 px-3"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
};
