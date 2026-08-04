import { GoogleGenAI } from '@google/genai';
import { NutriEntity, TrustScoreResult } from '../types/nutri';
import { extractAllergenWarnings } from './llm';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Generates an analytical response to user questions about a dataset's Nutri Trust Score,
 * lineage impact, and concrete remediation steps.
 */
export async function chatWithAnalyticsAgent(
  entity: NutriEntity,
  scoreResult: TrustScoreResult,
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  const warnings = extractAllergenWarnings(entity);
  const undocumentedFields = entity.fields.filter(
    (f) => (!f.description || f.description.trim().length === 0) && f.glossaryTerms.length === 0
  );

  // Fallback if Gemini key is missing
  const fallbackResponse = `
### 📊 Nutri Analytics Diagnosis for \`${entity.name}\` (${entity.platform})
* **Overall Trust Score:** ${scoreResult.trustScore}/100
* **Freshness:** ${scoreResult.subScores.freshness}% (${scoreResult.breakdown.freshnessDetails})
* **Completeness:** ${scoreResult.subScores.completeness}% (${scoreResult.breakdown.completenessDetails})
* **Lineage Depth:** ${scoreResult.subScores.lineage}% (${scoreResult.breakdown.lineageDetails})
* **Test Coverage:** ${scoreResult.subScores.testCoverage}% (${scoreResult.breakdown.testCoverageDetails})

**Identified Metadata Gaps:**
${undocumentedFields.length > 0 ? `- **${undocumentedFields.length} Undocumented Columns:** ${undocumentedFields.map((f) => `\`${f.fieldPath}\``).slice(0, 5).join(', ')}${undocumentedFields.length > 5 ? '...' : ''}` : '- All columns have descriptions.'}
${entity.owners.length === 0 ? '- **Missing Owner:** No CorpUser or CorpGroup is assigned.' : `- **Owner:** ${entity.owners.join(', ')}`}
${entity.assertions.length === 0 ? '- **Zero Quality Tests:** No dbt tests or DataHub assertions configured.' : ''}

**Recommended Action:**
Add column descriptions and test assertions in your transformation repository to raise this score.
  `.trim();

  const ai = getAiClient();
  if (!ai) {
    return fallbackResponse;
  }

  try {
    const systemPrompt = `You are Nutri Analytics Agent, an elite DataHub metadata and data governance expert.
You are helping a data engineer, analyst, or platform lead inspect and improve the health of the following dataset:

Entity Details:
- Name: "${entity.name}"
- Platform: ${entity.platform} (${entity.entityType})
- URN: ${entity.urn}
- Owners: ${entity.owners.length > 0 ? entity.owners.join(', ') : 'None assigned (Holding score back)'}
- Domain: ${entity.domain || 'None assigned'}
- Tags: ${entity.tags.join(', ') || 'None'}
- Total Columns: ${entity.fields.length}
- Undocumented Columns (${undocumentedFields.length}): ${undocumentedFields.map((f) => f.fieldPath).join(', ') || 'None'}
- Upstream Dependencies (${entity.upstreamUrns.length}): ${entity.upstreamUrns.join(', ') || 'None (Source Layer)'}
- Downstream Dependents (${entity.downstreamUrns.length}): ${entity.downstreamUrns.join(', ') || 'None (Terminal/Leaf node)'}
- Assertions/Tests (${entity.assertions.length}): ${entity.assertions.map((a) => `${a.type} (${a.passed ? 'PASSED' : 'FAILED'})`).join(', ') || 'No assertions found'}

Deterministic Nutri Trust Score Breakdown:
- Overall Score: ${scoreResult.trustScore}/100
- Freshness Sub-score (${scoreResult.subScores.freshness}%): ${scoreResult.breakdown.freshnessDetails}
- Completeness Sub-score (${scoreResult.subScores.completeness}%): ${scoreResult.breakdown.completenessDetails}
- Lineage Sub-score (${scoreResult.subScores.lineage}%): ${scoreResult.breakdown.lineageDetails}
- Test Coverage Sub-score (${scoreResult.subScores.testCoverage}%): ${scoreResult.breakdown.testCoverageDetails}
- Active Quality & Governance Warnings: ${warnings.join('; ') || 'None'}

Your Mission:
1. Answer the user's question accurately using ONLY grounded facts from the metadata above.
2. If asked how to reach a higher score (e.g. 90+), provide specific, quantified actions (e.g., "Document these 3 columns to gain +12 points in Completeness").
3. If asked for code or schema patches, generate clean, ready-to-copy dbt schema.yml, SQL comments, or DataHub mutation snippets.
4. Keep answers crisp, structured, professional, and formatted in clean GitHub markdown with bold headers and bullet points.`;

    const conversationContents = [
      systemPrompt,
      ...history.map((h) => `${h.role === 'user' ? 'User' : 'Agent'}: ${h.content}`),
      `User: ${userMessage}`,
    ].join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: conversationContents,
      config: {
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    });

    return response.text?.trim() || fallbackResponse;
  } catch (error) {
    console.warn('Gemini call failed for Analytics Agent, using fallback:', error);
    return fallbackResponse;
  }
}
