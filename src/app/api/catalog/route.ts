import { NextResponse } from 'next/server';
import { queryDataHubGraphQL } from '../../../services/datahub';

export const dynamic = 'force-dynamic';

import { APPROVED_SHOWCASE_DATASETS } from '@/config/approved-catalog';

export async function GET() {
  try {
    const listQuery = `
      query listDatasets {
        search(input: { type: DATASET, query: "*", start: 0, count: 50 }) {
          total
          searchResults {
            entity {
              ... on Dataset {
                urn
                name
                platform { name }
              }
            }
          }
        }
      }
    `;

    let entities: any[] = [];
    try {
      const data = await queryDataHubGraphQL(listQuery);
      const results = data?.search?.searchResults || [];
      entities = results
        .filter((r: any) => r?.entity?.urn)
        .map((r: any) => ({
          urn: r.entity.urn,
          name: r.entity.name || r.entity.urn.split(',').pop()?.replace(',PROD)', '') || 'dataset',
          platform: r.entity.platform?.name || 'snowflake',
        }));
    } catch (e) {
      console.warn('Catalog search query failed or DataHub offline, using approved default catalog:', e);
    }

    if (!entities || entities.length === 0) {
      entities = APPROVED_SHOWCASE_DATASETS;
    }

    return NextResponse.json({ entities });
  } catch (error: any) {
    console.error('Catalog API route error:', error);
    return NextResponse.json({ entities: APPROVED_SHOWCASE_DATASETS });
  }
}
