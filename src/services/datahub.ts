import { NutriEntity, EntityType, TrustScoreResult } from '../types/nutri';

const GRAPHQL_URL = process.env.DATAHUB_GRAPHQL_URL || 'http://localhost:8080/api/graphql';

/**
 * Generic GraphQL Client for DataHub GMS
 */
export async function queryDataHubGraphQL<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const resp = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`DataHub GraphQL HTTP ${resp.status}: ${errorText}`);
  }

  const json = await resp.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`DataHub GraphQL Error: ${json.errors[0].message}`);
  }

  return json.data;
}

/**
 * Ensures Nutri structured property definitions and tag exist in DataHub catalog.
 */
export async function ensureNutriPropertiesExist(): Promise<void> {
  const properties = [
    { id: 'nutriTrustScore', name: 'Nutri Trust Score', desc: 'Overall Nutri Trust Score (0-100)' },
    { id: 'nutriFreshnessScore', name: 'Nutri Freshness Sub-Score', desc: 'Freshness Sub-Score (0-100)' },
    { id: 'nutriCompletenessScore', name: 'Nutri Completeness Sub-Score', desc: 'Completeness Sub-Score (0-100)' },
    { id: 'nutriLineageScore', name: 'Nutri Lineage Sub-Score', desc: 'Lineage Depth Sub-Score (0-100)' },
    { id: 'nutriTestCoverageScore', name: 'Nutri Test Coverage Sub-Score', desc: 'Test Coverage Sub-Score (0-100)' },
  ];

  for (const prop of properties) {
    const createPropMutation = `
      mutation createProp($id: String!, $name: String!, $desc: String!) {
        createStructuredProperty(input: {
          id: $id,
          displayName: $name,
          description: $desc,
          valueType: "urn:li:dataType:datahub.number",
          entityTypes: ["urn:li:entityType:datahub.dataset", "urn:li:entityType:datahub.dashboard", "urn:li:entityType:datahub.chart"]
        }) {
          urn
        }
      }
    `;
    try {
      await queryDataHubGraphQL(createPropMutation, prop);
    } catch (e) {
      // Ignore if property already exists
    }
  }

  // Ensure nutri:needs-attention tag exists
  const createTagMutation = `
    mutation createNeedsAttentionTag {
      createTag(input: {
        name: "nutri:needs-attention",
        description: "Flagged by Nutri score engine for low trust score (<70)"
      })
    }
  `;
  try {
    await queryDataHubGraphQL(createTagMutation);
  } catch (e) {
    // Ignore if tag already exists
  }
}

/**
 * Fetches a single dataset or dashboard entity from DataHub and normalizes into NutriEntity
 */
export async function fetchNutriEntity(urn: string): Promise<NutriEntity> {
  const query = `
    query getEntity($urn: String!) {
      dataset(urn: $urn) {
        urn
        name
        platform { name }
        subTypes { typeNames }
        ownership {
          owners {
            owner {
              ... on CorpUser { urn }
              ... on CorpGroup { urn }
            }
          }
        }
        domain { domain { urn properties { name } } }
        institutionalMemory { elements { description } }
        glossaryTerms { terms { term { urn properties { name } } } }
        tags { tags { tag { urn properties { name } } } }
        lastIngested
        operations(limit: 1) {
          timestampMillis
        }
        schemaMetadata {
          fields {
            fieldPath
            description
            type
            tags { tags { tag { urn properties { name } } } }
            glossaryTerms { terms { term { urn properties { name } } } }
          }
        }
        upstream: relationships(input: { types: ["DownstreamOf"], direction: OUTGOING }) {
          total
          relationships { entity { urn type ... on Dataset { platform { name } } } }
        }
        downstream: relationships(input: { types: ["DownstreamOf"], direction: INCOMING }) {
          total
          relationships { entity { urn type } }
        }
        assertions {
          total
          assertions {
            urn
            info { type }
            runEvents(limit: 1) {
              runEvents {
                result { type }
              }
            }
          }
        }
      }
    }
  `;

  const data = await queryDataHubGraphQL(query, { urn });
  const ds = data.dataset;

  if (!ds) {
    throw new Error(`Entity not found in DataHub: ${urn}`);
  }

  const fields = (ds.schemaMetadata?.fields || []).map((f: any) => ({
    fieldPath: f.fieldPath,
    type: String(f.type),
    description: f.description || '',
    tags: (f.tags?.tags || []).map((t: any) => t.tag?.properties?.name || t.tag?.urn),
    glossaryTerms: (f.glossaryTerms?.terms || []).map((t: any) => t.term?.properties?.name || t.term?.urn),
  }));

  const upstreamUrns: string[] = [];
  const upstreamPlatforms: string[] = [];
  for (const rel of ds.upstream?.relationships || []) {
    if (rel.entity?.urn) {
      upstreamUrns.push(rel.entity.urn);
      if (rel.entity.platform?.name) {
        upstreamPlatforms.push(rel.entity.platform.name);
      }
    }
  }

  const downstreamUrns = (ds.downstream?.relationships || [])
    .map((rel: any) => rel.entity?.urn)
    .filter(Boolean);

  const assertions = (ds.assertions?.assertions || []).map((a: any) => {
    const lastResult = a.runEvents?.runEvents?.[0]?.result?.type;
    return {
      urn: a.urn,
      type: a.info?.type || 'DATA_QUALITY',
      passed: lastResult === 'SUCCESS',
    };
  });

  const owners = (ds.ownership?.owners || []).map((o: any) => o.owner?.urn).filter(Boolean);
  const glossaryTerms = (ds.glossaryTerms?.terms || []).map((t: any) => t.term?.properties?.name || t.term?.urn);
  const tags = (ds.tags?.tags || []).map((t: any) => t.tag?.properties?.name || t.tag?.urn);

  const lastModifiedTimestamp = ds.operations?.[0]?.timestampMillis || ds.lastIngested || undefined;

  return {
    urn: ds.urn,
    name: ds.name,
    platform: ds.platform?.name || 'unknown',
    entityType: 'DATASET' as EntityType,
    description: ds.institutionalMemory?.elements?.[0]?.description || '',
    owners,
    domain: ds.domain?.domain?.properties?.name || ds.domain?.domain?.urn,
    glossaryTerms,
    tags,
    lastModifiedTimestamp,
    fields,
    upstreamUrns,
    downstreamUrns,
    upstreamPlatforms,
    assertions,
  };
}

/**
 * Writes computed Nutri Trust Score & Sub-scores back into DataHub as structured properties and tags
 */
export async function writeTrustScoreToDataHub(
  entityUrn: string,
  scoreResult: TrustScoreResult
): Promise<boolean> {
  await ensureNutriPropertiesExist();

  const propertyUpdates = [
    { propertyUrn: 'urn:li:structuredProperty:nutriTrustScore', value: scoreResult.trustScore },
    { propertyUrn: 'urn:li:structuredProperty:nutriFreshnessScore', value: scoreResult.subScores.freshness },
    { propertyUrn: 'urn:li:structuredProperty:nutriCompletenessScore', value: scoreResult.subScores.completeness },
    { propertyUrn: 'urn:li:structuredProperty:nutriLineageScore', value: scoreResult.subScores.lineage },
    { propertyUrn: 'urn:li:structuredProperty:nutriTestCoverageScore', value: scoreResult.subScores.testCoverage },
  ];

  const upsertMutation = `
    mutation upsertProps($assetUrn: String!, $params: [StructuredPropertyInputParams!]!) {
      upsertStructuredProperties(input: {
        assetUrn: $assetUrn,
        structuredPropertyInputParams: $params
      }) {
        properties {
          structuredProperty { urn }
        }
      }
    }
  `;

  const params = propertyUpdates.map((p) => ({
    structuredPropertyUrn: p.propertyUrn,
    values: [{ numberValue: p.value }],
  }));

  await queryDataHubGraphQL(upsertMutation, { assetUrn: entityUrn, params });

  // Auto-apply nutri:needs-attention tag if trust score < threshold
  if (scoreResult.needsAttention) {
    const addTagMutation = `
      mutation addNeedsAttentionTag($resourceUrn: String!) {
        addTag(input: {
          tagUrn: "urn:li:tag:nutri:needs-attention",
          resourceUrn: $resourceUrn
        })
      }
    `;
    try {
      await queryDataHubGraphQL(addTagMutation, { resourceUrn: entityUrn });
    } catch (e) {
      // Tag may already be attached
    }
  }

  return true;
}
