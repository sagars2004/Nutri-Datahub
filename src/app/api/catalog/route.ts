import { NextResponse } from 'next/server';
import { queryDataHubGraphQL, fetchNutriEntity } from '../../../services/datahub';

const SHOWCASE_URNS = [
  'urn:li:dataset:(urn:li:dataPlatform:snowflake,b2fd91.order_entry_db.order_entry.product_categories,PROD)',
  'urn:li:dataset:(urn:li:dataPlatform:snowflake,b2fd91.order_entry_db.order_entry.orders,PROD)',
  'urn:li:dataset:(urn:li:dataPlatform:snowflake,b2fd91.order_entry_db.order_entry.order_items,PROD)',
  'urn:li:dataset:(urn:li:dataPlatform:snowflake,b2fd91.order_entry_db.order_entry.customers,PROD)',
  'urn:li:dataset:(urn:li:dataPlatform:dbt,dbt_ecommerce.stg_orders,PROD)',
  'urn:li:dataset:(urn:li:dataPlatform:dbt,dbt_ecommerce.fct_orders,PROD)',
];

export async function GET() {
  try {
    const listQuery = `
      query listDatasets {
        search(input: { type: DATASET, query: "*", start: 0, count: 10 }) {
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
      const results = data.search?.searchResults || [];
      entities = results.map((r: any) => ({
        urn: r.entity.urn,
        name: r.entity.name,
        platform: r.entity.platform?.name || 'dataset',
      }));
    } catch (e) {
      console.warn('Catalog search query failed, using showcase URNs:', e);
    }

    if (entities.length === 0) {
      entities = SHOWCASE_URNS.map((urn) => ({
        urn,
        name: urn.split(',').pop()?.replace(',PROD)', '') || urn,
        platform: urn.includes('snowflake') ? 'snowflake' : 'dbt',
      }));
    }

    return NextResponse.json({ entities });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list catalog' }, { status: 500 });
  }
}
