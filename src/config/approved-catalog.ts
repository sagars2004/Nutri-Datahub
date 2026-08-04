export interface CatalogDataset {
  urn: string;
  name: string;
  platform: string;
}

export const APPROVED_SHOWCASE_DATASETS: CatalogDataset[] = [
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.orders,PROD)', name: 'orders', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.order_items,PROD)', name: 'order_items', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.customers,PROD)', name: 'customers', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.products,PROD)', name: 'products', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.inventories,PROD)', name: 'inventories', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.shipments,PROD)', name: 'shipments', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.product_categories,PROD)', name: 'product_categories', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce_db.public.suppliers,PROD)', name: 'suppliers', platform: 'snowflake' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:dbt,ecommerce_analytics.stg_orders,PROD)', name: 'stg_orders', platform: 'dbt' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:dbt,ecommerce_analytics.fct_orders,PROD)', name: 'fct_orders', platform: 'dbt' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:dbt,ecommerce_analytics.dim_customers,PROD)', name: 'dim_customers', platform: 'dbt' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:dbt,ecommerce_analytics.fct_daily_revenue,PROD)', name: 'fct_daily_revenue', platform: 'dbt' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:postgres,app_db.public.users,PROD)', name: 'users', platform: 'postgres' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:postgres,app_db.public.payments,PROD)', name: 'payments', platform: 'postgres' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:postgres,app_db.public.audit_logs,PROD)', name: 'audit_logs', platform: 'postgres' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:tableau,executive_dashboards.sales_performance,PROD)', name: 'Sales Performance Dashboard', platform: 'tableau' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:powerbi,finance_reports.quarterly_burn,PROD)', name: 'Quarterly Financial Burn', platform: 'powerbi' },
  { urn: 'urn:li:dataset:(urn:li:dataPlatform:looker,marketing_analytics.campaign_roi,PROD)', name: 'Campaign ROI Explorer', platform: 'looker' },
];
