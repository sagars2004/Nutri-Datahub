import { GoogleGenAI } from '@google/genai';
import { NutriEntity, TrustScoreResult } from '../types/nutri';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmConfig {
  provider: 'gmi' | 'openai' | 'gemini' | 'custom' | 'none';
  apiKey: string;
  baseUrl?: string;
  model: string;
}

/**
 * Resolves active LLM configuration from environment variables.
 * Priority: GMI Cloud / OpenAI-compatible > Gemini > none
 */
export function getLlmConfig(): LlmConfig {
  // 1. GMI Cloud Model Hub
  const gmiKey = process.env.GMI_API_KEY || process.env.GMICLOUD_API_KEY;
  if (gmiKey && gmiKey.trim().length > 0) {
    return {
      provider: 'gmi',
      apiKey: gmiKey.trim(),
      baseUrl: process.env.GMI_BASE_URL || process.env.GMI_LLM_BASE_URL || 'https://api.gmicloud.ai/v1',
      model: process.env.GMI_MODEL || process.env.LLM_MODEL || 'meta-llama/Meta-Llama-3.1-70B-Instruct',
    };
  }

  // 2. Generic OpenAI-compatible endpoint
  const openAiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
  if (openAiKey && openAiKey.trim().length > 0) {
    return {
      provider: (process.env.LLM_PROVIDER as any) || 'openai',
      apiKey: openAiKey.trim(),
      baseUrl: process.env.OPENAI_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  // 3. Google Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 0) {
    return {
      provider: 'gemini',
      apiKey: geminiKey.trim(),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    };
  }

  return {
    provider: 'none',
    apiKey: '',
    model: 'none',
  };
}

/**
 * Universal LLM caller supporting GMI Cloud (OpenAI-compatible), standard OpenAI, and Google Gemini
 */
export async function callUniversalLlm(options: {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  responseJson?: boolean;
}): Promise<string | null> {
  const config = getLlmConfig();
  if (config.provider === 'none') {
    return null;
  }

  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 800;

  // Handler for GMI Cloud and OpenAI-compatible providers
  if (config.provider === 'gmi' || config.provider === 'openai' || config.provider === 'custom') {
    try {
      const endpoint = `${config.baseUrl?.replace(/\/$/, '')}/chat/completions`;
      const bodyPayload: any = {
        model: config.model,
        messages: options.messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (options.responseJson) {
        bodyPayload.response_format = { type: 'json_object' };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Universal LLM provider (${config.provider}) returned status ${response.status}:`, errText);
        return null;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return content ? content.trim() : null;
    } catch (error) {
      console.warn(`Universal LLM call failed (${config.provider}):`, error);
      return null;
    }
  }

  // Handler for Google Gemini
  if (config.provider === 'gemini') {
    try {
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const prompt = options.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

      const genConfig: any = {
        temperature,
        maxOutputTokens: maxTokens,
      };
      if (options.responseJson) {
        genConfig.responseMimeType = 'application/json';
      }

      const response = await ai.models.generateContent({
        model: config.model || 'gemini-2.5-flash',
        contents: prompt,
        config: genConfig,
      });

      return response.text ? response.text.trim() : null;
    } catch (error) {
      console.warn('Gemini LLM call failed:', error);
      return null;
    }
  }

  return null;
}

/**
 * Generates a 1-sentence plain-English verdict summarizing the dataset's score.
 * Strictly grounded in deterministic sub-scores.
 */
export async function generateScoreSummary(
  entity: NutriEntity,
  scoreResult: TrustScoreResult
): Promise<string> {
  const fallback = `Scored ${scoreResult.trustScore}/100. Freshness: ${scoreResult.subScores.freshness}%, Completeness: ${scoreResult.subScores.completeness}%, Lineage: ${scoreResult.subScores.lineage}%, Assertions: ${scoreResult.subScores.testCoverage}%.`;

  const prompt = `You are Nutri, an AI data governance expert generating a nutrition label verdict for a dataset catalog entity.

Entity Name: "${entity.name}" (${entity.platform} ${entity.entityType})
Overall Trust Score: ${scoreResult.trustScore}/100
Sub-score Breakdown:
- Freshness (${scoreResult.subScores.freshness}%): ${scoreResult.breakdown.freshnessDetails}
- Completeness (${scoreResult.subScores.completeness}%): ${scoreResult.breakdown.completenessDetails}
- Lineage (${scoreResult.subScores.lineage}%): ${scoreResult.breakdown.lineageDetails}
- Test Coverage (${scoreResult.subScores.testCoverage}%): ${scoreResult.breakdown.testCoverageDetails}

Task: Write EXACTLY ONE concise, punchy sentence explaining the final score verdict to an analyst. Highlight the main strength and the primary gap holding the score back. Do not include markdown or quotes. Return only the single sentence.`;

  const llmResult = await callUniversalLlm({
    messages: [
      { role: 'system', content: 'You are Nutri, a concise data governance analyst.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    maxTokens: 100,
  });

  return llmResult || fallback;
}

/**
 * Generates human-readable descriptions for entity fields.
 * CRITICAL RULE: If a column lacks documentation, mark it as "Undocumented / Needs Description" - NEVER hallucinate facts.
 */
export async function generateColumnDescriptions(
  entity: NutriEntity
): Promise<Record<string, string>> {
  const descriptions: Record<string, string> = {};

  // Default grounding
  for (const field of entity.fields) {
    if (field.description && field.description.trim().length > 0) {
      descriptions[field.fieldPath] = field.description.trim();
    } else if (field.glossaryTerms.length > 0) {
      descriptions[field.fieldPath] = `Glossary Term: ${field.glossaryTerms.join(', ')}`;
    } else {
      descriptions[field.fieldPath] = 'Undocumented / Needs Description';
    }
  }

  if (entity.fields.length === 0) {
    return descriptions;
  }

  const fieldsPayload = entity.fields.map((f) => ({
    name: f.fieldPath,
    type: f.type,
    existingDescription: f.description || '',
    glossaryTerms: f.glossaryTerms,
    tags: f.tags,
  }));

  const prompt = `You are Nutri, an AI catalog documentation assistant.
Given a list of database table columns:
${JSON.stringify(fieldsPayload, null, 2)}

Task: Provide a clean 1-sentence description per column.
RULES:
1. If existingDescription is present, refine it into clear, plain English.
2. If existingDescription is empty BUT glossary terms exist, describe the column using the glossary terms.
3. CRITICAL: If existingDescription is empty AND no glossary terms exist, set the description to EXACTLY "Undocumented / Needs Description". NEVER hallucinate or invent a description.

Return ONLY a valid JSON object mapping column name to string description. Example:
{"col_name": "Description text..."}`;

  const llmResult = await callUniversalLlm({
    messages: [
      { role: 'system', content: 'You are an AI catalog documentation assistant. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    maxTokens: 500,
    responseJson: true,
  });

  if (llmResult) {
    try {
      const parsed = JSON.parse(llmResult);
      return { ...descriptions, ...parsed };
    } catch {
      // Fall back gracefully to grounded descriptions
    }
  }

  return descriptions;
}

/**
 * Extracts Allergen / Warning flags (PII callouts, governance warnings, assertion failures)
 */
export function extractAllergenWarnings(entity: NutriEntity): string[] {
  const warnings: string[] = [];

  // PII & Sensitive Tags
  const piiTags = entity.tags.filter((t) =>
    /pii|sensitive|confidential|restricted|secret/i.test(t)
  );
  if (piiTags.length > 0) {
    warnings.push(`Contains Sensitive/PII Data (${piiTags.join(', ')})`);
  }

  // Field-level PII Tags
  for (const field of entity.fields) {
    const fieldPii = field.tags.filter((t) => /pii|sensitive/i.test(t));
    if (fieldPii.length > 0) {
      warnings.push(`Column "${field.fieldPath}" flagged with ${fieldPii.join(', ')}`);
    }
  }

  // Assertion failures
  const failedAssertions = entity.assertions.filter((a) => !a.passed);
  for (const fa of failedAssertions) {
    warnings.push(`Failing Quality Check: ${fa.type}`);
  }

  // Governance warnings
  if (entity.owners.length === 0) {
    warnings.push('Unowned Asset (No Owner Assigned)');
  }

  return warnings;
}
