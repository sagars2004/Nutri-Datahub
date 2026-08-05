-- ============================================================================
-- 🥗 Nutri Talk-to-Data SQL Query Generation Example
-- Asset URN: urn:li:dataset:(urn:li:dataPlatform:dbt,analytics.fct_orders,PROD)
-- Target Engine: Snowflake Data Warehouse
-- Nutri Trust Score: 100/100 (✅ HEALTHY - 100% Documentation & Tests Passed)
-- ============================================================================

-- Query: Calculate monthly revenue breakdown with tier breakdown
SELECT
    DATE_TRUNC('month', order_timestamp) AS order_month,
    customer_tier,
    COUNT(DISTINCT order_id) AS total_orders,
    SUM(total_amount_usd) AS gross_revenue_usd,
    AVG(total_amount_usd) AS avg_order_value_usd
FROM analytics.fct_orders
WHERE order_timestamp >= DATEADD('month', -12, CURRENT_DATE())
GROUP BY 1, 2
ORDER BY 1 DESC, 4 DESC;


-- ============================================================================
-- 🥗 Nutri Talk-to-Data SQL Query Generation Example with Data Safety Warning
-- Asset URN: urn:li:dataset:(urn:li:dataPlatform:postgres,prod_db.public.audit_logs,PROD)
-- Target Engine: PostgreSQL
-- Nutri Trust Score: 21/100 (⚠️ NEEDS ATTENTION - Low Governance & Stale Data)
-- ============================================================================

/*
 > [!WARNING]
 > 🚨 DATA NUTRITION SAFETY WARNING (Nutri Trust Score: 21/100)
 > Active Quality Warnings:
 >   - Stale Data (Last modified > 180 days ago)
 >   - 80% Undocumented Columns (Missing descriptions on sensitive fields)
 >   - No assigned Owner (Unowned Asset)
 >   - 0 Quality Assertions (Unverified test coverage)
 > DO NOT USE IN EXECUTIVE REPORTING OR FINANCIAL AUDITS WITHOUT AUDITING.
*/

SELECT
    log_id,
    event_name,
    user_id,
    ip_address,
    created_at
FROM prod_db.public.audit_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC
LIMIT 100;
