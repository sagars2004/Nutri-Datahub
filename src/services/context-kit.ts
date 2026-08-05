import { NutriEntity, TrustScoreResult } from '../types/nutri';
import { extractAllergenWarnings } from './llm';

export interface SchemaFieldDetail {
  name: string;
  type: string;
  description: string;
  isDocumented: boolean;
  isPii: boolean;
  tags: string[];
  glossaryTerms: string[];
}

export interface SchemaContext {
  totalFields: number;
  documentedFieldsCount: number;
  undocumentedFields: string[];
  fields: SchemaFieldDetail[];
}

export interface GovernanceContext {
  owners: string[];
  hasOwner: boolean;
  domain?: string;
  tags: string[];
  glossaryTerms: string[];
}

export interface LineageContext {
  upstreamCount: number;
  downstreamCount: number;
  upstreamUrns: string[];
  downstreamUrns: string[];
  upstreamPlatforms: string[];
  isSourceNode: boolean;
  isLeafNode: boolean;
}

export interface QualityContext {
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  assertionPassRatePct: number;
  failingAssertions: { urn: string; type: string }[];
  lastModifiedTimestamp?: number;
  hoursSinceLastUpdate?: number;
}

export interface DataHubContextPacket {
  urn: string;
  name: string;
  platform: string;
  entityType: string;
  description?: string;
  schema: SchemaContext;
  governance: GovernanceContext;
  lineage: LineageContext;
  quality: QualityContext;
  allergens: string[];
  trustScore?: number;
  scoreBreakdown?: TrustScoreResult['breakdown'];
}

/**
 * DataHub Agent Context Kit
 * Extracts, normalizes, and structures rich catalog metadata for AI Agents and Analytics Engines.
 */
export class DataHubContextKit {
  /**
   * Builds a structured DataHubContextPacket from a NutriEntity and optional TrustScoreResult
   */
  public static buildContextPacket(
    entity: NutriEntity,
    scoreResult?: TrustScoreResult
  ): DataHubContextPacket {
    const fields: SchemaFieldDetail[] = entity.fields.map((f) => {
      const isPii = f.tags.some((t) => /pii|sensitive|confidential|secret/i.test(t));
      const isDocumented = Boolean(
        (f.description && f.description.trim().length > 0) || f.glossaryTerms.length > 0
      );
      return {
        name: f.fieldPath,
        type: f.type,
        description: f.description || (f.glossaryTerms.length > 0 ? `Term: ${f.glossaryTerms.join(', ')}` : 'Undocumented / Needs Description'),
        isDocumented,
        isPii,
        tags: f.tags,
        glossaryTerms: f.glossaryTerms,
      };
    });

    const documentedFieldsCount = fields.filter((f) => f.isDocumented).length;
    const undocumentedFields = fields.filter((f) => !f.isDocumented).map((f) => f.name);

    const schema: SchemaContext = {
      totalFields: fields.length,
      documentedFieldsCount,
      undocumentedFields,
      fields,
    };

    const governance: GovernanceContext = {
      owners: entity.owners,
      hasOwner: entity.owners.length > 0,
      domain: entity.domain,
      tags: entity.tags,
      glossaryTerms: entity.glossaryTerms,
    };

    const lineage: LineageContext = {
      upstreamCount: entity.upstreamUrns.length,
      downstreamCount: entity.downstreamUrns.length,
      upstreamUrns: entity.upstreamUrns,
      downstreamUrns: entity.downstreamUrns,
      upstreamPlatforms: entity.upstreamPlatforms,
      isSourceNode: entity.upstreamUrns.length === 0,
      isLeafNode: entity.downstreamUrns.length === 0,
    };

    const failed = entity.assertions.filter((a) => !a.passed);
    const passed = entity.assertions.filter((a) => a.passed);
    const passRate = entity.assertions.length > 0
      ? Math.round((passed.length / entity.assertions.length) * 100)
      : 100;

    const hoursSinceLastUpdate = entity.lastModifiedTimestamp
      ? Math.round((Date.now() - entity.lastModifiedTimestamp) / (3600 * 1000) * 10) / 10
      : undefined;

    const quality: QualityContext = {
      totalAssertions: entity.assertions.length,
      passedAssertions: passed.length,
      failedAssertions: failed.length,
      assertionPassRatePct: passRate,
      failingAssertions: failed.map((a) => ({ urn: a.urn, type: a.type })),
      lastModifiedTimestamp: entity.lastModifiedTimestamp,
      hoursSinceLastUpdate,
    };

    const allergens = extractAllergenWarnings(entity);

    return {
      urn: entity.urn,
      name: entity.name,
      platform: entity.platform,
      entityType: entity.entityType,
      description: entity.description,
      schema,
      governance,
      lineage,
      quality,
      allergens,
      trustScore: scoreResult?.trustScore,
      scoreBreakdown: scoreResult?.breakdown,
    };
  }

  /**
   * Formats the context packet into a dense, clean text prompt block for LLM agents
   */
  public static toPromptContext(packet: DataHubContextPacket): string {
    const lines: string[] = [
      `### DATAHUB CONTEXT GRAPH: ${packet.name} (${packet.platform.toUpperCase()})`,
      `- **URN:** ${packet.urn}`,
      `- **Description:** ${packet.description || 'No description in DataHub'}`,
      `- **Domain:** ${packet.governance.domain || 'Unassigned'}`,
      `- **Owners:** ${packet.governance.hasOwner ? packet.governance.owners.join(', ') : '⚠️ No Owner Assigned'}`,
      `- **Trust Score:** ${packet.trustScore !== undefined ? `${packet.trustScore}/100` : 'Not computed'}`,
      `- **Freshness:** ${packet.quality.hoursSinceLastUpdate !== undefined ? `Updated ${packet.quality.hoursSinceLastUpdate}h ago` : 'Unknown'}`,
      `- **Lineage:** ${packet.lineage.upstreamCount} upstream source(s), ${packet.lineage.downstreamCount} downstream consumer(s)`,
      `- **Assertions:** ${packet.quality.totalAssertions} assertions (${packet.quality.passedAssertions} passed, ${packet.quality.failedAssertions} failed)`,
    ];

    if (packet.allergens.length > 0) {
      lines.push(`- **⚠️ Active Allergens/Warnings:** ${packet.allergens.join('; ')}`);
    }

    lines.push('\n**Table Schema & Columns:**');
    for (const f of packet.schema.fields) {
      const piiFlag = f.isPii ? ' [🔒 PII]' : '';
      const docFlag = !f.isDocumented ? ' [⚠️ Undocumented]' : '';
      lines.push(`  * \`${f.name}\` (${f.type})${piiFlag}${docFlag}: ${f.description}`);
    }

    return lines.join('\n');
  }

  /**
   * Extracts clean table and column definitions specifically formatted for Talk-to-Data SQL generators
   */
  public static toSqlContext(packet: DataHubContextPacket): string {
    const columns = packet.schema.fields
      .map((f) => `  ${f.name} ${f.type} -- ${f.description}`)
      .join(',\n');

    return `-- Platform: ${packet.platform}\n-- Entity: ${packet.name}\n-- Health Trust Score: ${packet.trustScore ?? 'N/A'}/100\nCREATE TABLE ${packet.name} (\n${columns}\n);`;
  }
}
