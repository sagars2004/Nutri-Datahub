# DataHub Nutri Catalog Audit Report
*Generated on: 2026-08-05T19:51:51.474Z*

### Summary Metrics:
* **Total Evaluated:** 18
* **Average Trust Score:** 85/100
* **Healthy Assets (≥70):** 16
* **Needs Attention (<70):** 2

| Platform | Dataset Name | Trust Score | Freshness | Completeness | Lineage | Test Coverage | Status |
|---|---|---|---|---|---|---|---|
| `snowflake` | **orders** | **100** | 100% | 100% | 100% | 100% | ✅ Healthy |
| `snowflake` | **order_items** | **89** | 100% | 100% | 56% | 100% | ✅ Healthy |
| `snowflake` | **customers** | **94** | 100% | 100% | 76% | 100% | ✅ Healthy |
| `snowflake` | **products** | **89** | 100% | 100% | 56% | 100% | ✅ Healthy |
| `snowflake` | **inventories** | **89** | 100% | 100% | 56% | 100% | ✅ Healthy |
| `snowflake` | **shipments** | **77** | 100% | 100% | 56% | 50% | ✅ Healthy |
| `snowflake` | **product_categories** | **89** | 100% | 100% | 56% | 100% | ✅ Healthy |
| `snowflake` | **suppliers** | **64** | 50% | 100% | 56% | 50% | ⚠️ Needs Attention |
| `dbt` | **stg_orders** | **94** | 100% | 100% | 76% | 100% | ✅ Healthy |
| `dbt` | **fct_orders** | **100** | 100% | 100% | 100% | 100% | ✅ Healthy |
| `dbt` | **dim_customers** | **100** | 100% | 100% | 100% | 100% | ✅ Healthy |
| `dbt` | **fct_daily_revenue** | **89** | 100% | 100% | 56% | 100% | ✅ Healthy |
| `postgres` | **users** | **77** | 100% | 100% | 56% | 50% | ✅ Healthy |
| `postgres` | **payments** | **77** | 100% | 100% | 56% | 50% | ✅ Healthy |
| `postgres` | **audit_logs** | **21** | 0% | 0% | 32% | 50% | ⚠️ Needs Attention |
| `tableau` | **Sales Performance Dashboard** | **94** | 100% | 100% | 76% | 100% | ✅ Healthy |
| `powerbi` | **Quarterly Financial Burn** | **94** | 100% | 100% | 76% | 100% | ✅ Healthy |
| `looker` | **Campaign ROI Explorer** | **92** | 92% | 100% | 76% | 100% | ✅ Healthy |