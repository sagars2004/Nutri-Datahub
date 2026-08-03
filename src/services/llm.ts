import { GoogleGenAI } from '@google/genai';
import { NutriEntity, TrustScoreResult } from '../types/nutri';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
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

  const ai = getAiClient();
  if (!ai) {
    return fallback;
  }

  try {
    const prompt = `You are Nutri, an AI data governance expert generating a nutrition label verdict for a dataset catalog entity.

Entity Name: "${entity.name}" (${entity.platform} ${entity.entityType})
Overall Trust Score: ${scoreResult.trustScore}/100
Sub-score Breakdown:
- Freshness (${scoreResult.subScores.freshness}%): ${scoreResult.breakdown.freshnessDetails}
- Completeness (${scoreResult.subScores.completeness}%): ${scoreResult.breakdown.completenessDetails}
- Lineage (${scoreResult.subScores.lineage}%): ${scoreResult.breakdown.lineageDetails}
- Test Coverage (${scoreResult.subScores.testCoverage}%): ${scoreResult.breakdown.testCoverageDetails}

Task: Write EXACTLY ONE concise, punchy sentence explaining the final score verdict to an analyst. Highlight the main strength and the primary gap holding the score back. Do not include markdown or quotes. Return only the single sentence.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 100,
      },
    });

    const text = response.text ? response.text.trim() : '';
    return text || fallback;
  } catch (error) {
    console.warn('Gemini API call failed for generateScoreSummary, using fallback:', error);
    return fallback;
  }
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

  const ai = getAiClient();
  if (!ai || entity.fields.length === 0) {
    return descriptions;
  }

  try {
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      return { ...descriptions, ...parsed };
    }
    return descriptions;
  } catch (error) {
    console.warn('Gemini API call failed for generateColumnDescriptions, using grounded fallback:', error);
    return descriptions;
  }
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
