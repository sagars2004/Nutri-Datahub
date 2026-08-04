import { NextRequest, NextResponse } from 'next/server';
import { fetchNutriEntity, writeTrustScoreToDataHub } from '@/services/datahub';
import { calculateTrustScore } from '@/engine/scoring';
import { generateScoreSummary, generateColumnDescriptions, extractAllergenWarnings } from '@/services/llm';
import { APPROVED_SHOWCASE_DATASETS } from '@/config/approved-catalog';

export const dynamic = 'force-dynamic';

const MCP_SERVER_INFO = {
  name: 'nutri-datahub-mcp',
  version: '0.1.0',
};

const MCP_TOOLS = [
  {
    name: 'get_data_nutrition_facts',
    description: 'Computes and returns standardized Data Nutrition Facts and Trust Score (0-100) for a DataHub dataset or entity.',
    inputSchema: {
      type: 'object',
      properties: {
        urn: {
          type: 'string',
          description: 'The DataHub entity URN (e.g. urn:li:dataset:(urn:li:dataPlatform:dbt,b2fd91.ORDER_ENTRY_DB.analytics.order_details,PROD))',
        },
      },
      required: ['urn'],
    },
  },
  {
    name: 'search_catalog_datasets',
    description: 'Searches the approved catalog datasets across Snowflake, dbt, PostgreSQL, Tableau, PowerBI, and Looker with metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search text to filter datasets by name or URN',
        },
        platform: {
          type: 'string',
          description: 'Optional platform filter (e.g. snowflake, dbt, postgres, tableau, powerbi, looker)',
        },
      },
    },
  },
  {
    name: 'write_trust_score',
    description: 'Persists the computed Nutri Trust Score and sub-scores back into DataHub GMS as structured properties and governance tags.',
    inputSchema: {
      type: 'object',
      properties: {
        urn: {
          type: 'string',
          description: 'The DataHub entity URN to write structured properties to',
        },
      },
      required: ['urn'],
    },
  },
  {
    name: 'explain_score',
    description: 'Provides an AI governance explanation and root-cause breakdown of a dataset Trust Score, identifying gaps and remediation advice.',
    inputSchema: {
      type: 'object',
      properties: {
        urn: {
          type: 'string',
          description: 'The DataHub entity URN to explain',
        },
        question: {
          type: 'string',
          description: 'Optional specific question about the dataset health, lineage, or how to reach a higher trust score',
        },
      },
      required: ['urn'],
    },
  },
];

async function handleMcpToolCall(name: string, args: any) {
  if (name === 'get_data_nutrition_facts') {
    const urn = args?.urn;
    if (!urn) throw new Error('Missing parameter "urn"');

    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity);
    const verdictSummary = await generateScoreSummary(entity, scoreResult);
    const columnDescriptions = await generateColumnDescriptions(entity);
    const allergenWarnings = extractAllergenWarnings(entity);

    return {
      entity: {
        urn: entity.urn,
        name: entity.name,
        platform: entity.platform,
        entityType: entity.entityType,
        owners: entity.owners,
        domain: entity.domain,
        tags: entity.tags,
        fieldsCount: entity.fields.length,
        upstreamCount: entity.upstreamUrns.length,
        downstreamCount: entity.downstreamUrns.length,
        assertionsCount: entity.assertions.length,
      },
      trustScore: scoreResult.trustScore,
      subScores: scoreResult.subScores,
      breakdown: scoreResult.breakdown,
      verdictSummary,
      allergenWarnings,
      columnDescriptions,
    };
  }

  if (name === 'search_catalog_datasets') {
    const query = (args?.query || '').toLowerCase().trim();
    const platform = (args?.platform || '').toLowerCase().trim();

    let results = APPROVED_SHOWCASE_DATASETS;
    if (platform && platform !== 'all') {
      results = results.filter((d) => d.platform.toLowerCase() === platform);
    }
    if (query) {
      results = results.filter(
        (d) => d.name.toLowerCase().includes(query) || d.urn.toLowerCase().includes(query)
      );
    }

    return {
      total: results.length,
      datasets: results,
    };
  }

  if (name === 'write_trust_score') {
    const urn = args?.urn;
    if (!urn) throw new Error('Missing parameter "urn"');

    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity);
    const synced = await writeTrustScoreToDataHub(urn, scoreResult);

    return {
      urn,
      synced,
      trustScore: scoreResult.trustScore,
      needsAttentionTagApplied: scoreResult.needsAttention,
      message: `Successfully persisted Trust Score ${scoreResult.trustScore}/100 into DataHub structured properties.`,
    };
  }

  if (name === 'explain_score') {
    const urn = args?.urn;
    if (!urn) throw new Error('Missing parameter "urn"');
    const question = args?.question || 'Why did this dataset receive this Trust Score, and how can it be improved?';

    const entity = await fetchNutriEntity(urn);
    const scoreResult = calculateTrustScore(entity);
    const verdictSummary = await generateScoreSummary(entity, scoreResult);
    const allergenWarnings = extractAllergenWarnings(entity);

    const explanation = `
### Nutri Trust Score Diagnostics for \`${entity.name}\` (${entity.platform})
* **Overall Trust Score:** ${scoreResult.trustScore}/100
* **Verdict:** ${verdictSummary}

#### Sub-Score Breakdown:
- **Freshness (${scoreResult.subScores.freshness}%):** ${scoreResult.breakdown.freshnessDetails}
- **Completeness (${scoreResult.subScores.completeness}%):** ${scoreResult.breakdown.completenessDetails}
- **Lineage (${scoreResult.subScores.lineage}%):** ${scoreResult.breakdown.lineageDetails}
- **Test Coverage (${scoreResult.subScores.testCoverage}%):** ${scoreResult.breakdown.testCoverageDetails}

#### Warnings & Gaps:
${allergenWarnings.length > 0 ? allergenWarnings.map((w) => `- ⚠️ ${w}`).join('\n') : '- No active quality or governance warnings.'}

#### Concrete Remediation Steps:
${scoreResult.subScores.completeness < 80 ? '1. **Add Field Descriptions**: Provide column-level documentation in your dbt schema.yml or DataHub metadata editor.\n' : ''}${scoreResult.subScores.testCoverage < 80 ? '2. **Add Data Quality Assertions**: Configure dbt tests (unique, not_null) or DataHub assertions to protect data integrity.\n' : ''}${entity.owners.length === 0 ? '3. **Assign Owner**: Tag a technical or business owner group in DataHub.\n' : ''}
    `.trim();

    return {
      urn,
      question,
      explanation,
      trustScore: scoreResult.trustScore,
    };
  }

  throw new Error(`Unknown MCP tool: ${name}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jsonrpc, id, method, params } = body;

    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: MCP_SERVER_INFO,
          capabilities: {
            tools: {},
          },
        },
      });
    }

    if (method === 'tools/list') {
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
        },
      });
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      const data = await handleMcpToolCall(toolName, toolArgs);

      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
            },
          ],
        },
      });
    }

    if (method === 'ping') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: {} });
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
    }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32603,
        message: error.message || 'Internal MCP server error',
      },
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    mcp: MCP_SERVER_INFO,
    endpoints: {
      post: '/api/mcp',
      description: 'Model Context Protocol JSON-RPC 2.0 endpoint for DataHub Nutrition Facts',
    },
    toolsCount: MCP_TOOLS.length,
    availableTools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
