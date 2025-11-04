-- ============================================================================
-- Monitoring Views for Power BI Dashboard
-- Creates optimized views for cost tracking, performance monitoring, and alerts
-- ============================================================================

USE DATABASE VIDEXA_SHARED;
CREATE SCHEMA IF NOT EXISTS REPORTING;
CREATE SCHEMA IF NOT EXISTS AUDIT_LOGS;
USE SCHEMA AUDIT_LOGS;

-- Create placeholder tables for views (will be populated by AgentNexus backend)
CREATE TABLE IF NOT EXISTS CORTEX_INTERACTIONS (
    id VARCHAR PRIMARY KEY,
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    org_id VARCHAR,
    user_id VARCHAR,
    query_type VARCHAR,
    model VARCHAR,
    prompt_text TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost DECIMAL(10,6),
    cache_hit BOOLEAN DEFAULT FALSE,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS BUDGET_ALERTS (
    id VARCHAR PRIMARY KEY,
    timestamp TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    org_id VARCHAR,
    alert_level VARCHAR,
    budget_used_pct DECIMAL(5,2),
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE
);

USE SCHEMA REPORTING;

-- ============================================================================
-- View 1: Daily Cost by Organization
-- ============================================================================

CREATE OR REPLACE VIEW V_DAILY_COST_BY_ORG AS
SELECT
    DATE(ci.timestamp) AS date,
    ci.org_id,
    o.org_name,
    COUNT(*) AS total_interactions,
    SUM(ci.total_tokens) AS total_tokens,
    SUM(ci.input_tokens) AS total_input_tokens,
    SUM(ci.output_tokens) AS total_output_tokens,
    ROUND(SUM(ci.estimated_cost), 4) AS total_cost,
    SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) AS cache_hits,
    ROUND(100.0 * SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS cache_hit_rate_pct,
    ROUND(AVG(ci.latency_ms), 0) AS avg_latency_ms,
    SUM(CASE WHEN ci.success THEN 1 ELSE 0 END) AS successful_requests,
    SUM(CASE WHEN NOT ci.success THEN 1 ELSE 0 END) AS failed_requests,
    o.MONTHLY_COST_LIMIT,
    ROUND(100.0 * SUM(ci.estimated_cost) / NULLIF(o.MONTHLY_COST_LIMIT, 0), 2) AS daily_budget_pct
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
GROUP BY DATE(ci.timestamp), ci.org_id, o.org_name, o.MONTHLY_COST_LIMIT
ORDER BY date DESC, total_cost DESC;

-- Grant access
GRANT SELECT ON VIEW V_DAILY_COST_BY_ORG TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 2: Monthly Cost Summary by Organization
-- ============================================================================

CREATE OR REPLACE VIEW V_MONTHLY_COST_BY_ORG AS
SELECT
    DATE_TRUNC('MONTH', ci.timestamp) AS month,
    ci.org_id,
    o.org_name,
    COUNT(*) AS total_interactions,
    SUM(ci.total_tokens) AS total_tokens,
    ROUND(SUM(ci.estimated_cost), 2) AS total_cost,
    SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) AS cache_hits,
    ROUND(100.0 * SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS cache_hit_rate_pct,
    ROUND(SUM(CASE WHEN ci.cache_hit THEN ci.estimated_cost ELSE 0 END), 2) AS cost_saved_by_cache,
    o.MONTHLY_COST_LIMIT,
    ROUND(100.0 * SUM(ci.estimated_cost) / NULLIF(o.MONTHLY_COST_LIMIT, 0), 2) AS budget_used_pct,
    o.MONTHLY_COST_LIMIT - SUM(ci.estimated_cost) AS remaining_budget,
    CASE
        WHEN (100.0 * SUM(ci.estimated_cost) / NULLIF(o.MONTHLY_COST_LIMIT, 0)) >= 90 THEN 'CRITICAL'
        WHEN (100.0 * SUM(ci.estimated_cost) / NULLIF(o.MONTHLY_COST_LIMIT, 0)) >= 75 THEN 'WARNING'
        ELSE 'OK'
    END AS budget_status
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
GROUP BY DATE_TRUNC('MONTH', ci.timestamp), ci.org_id, o.org_name, o.MONTHLY_COST_LIMIT
ORDER BY month DESC, total_cost DESC;

GRANT SELECT ON VIEW V_MONTHLY_COST_BY_ORG TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 3: Cache Performance by Organization
-- ============================================================================

CREATE OR REPLACE VIEW V_CACHE_PERFORMANCE AS
SELECT
    DATE(ci.timestamp) AS date,
    ci.org_id,
    o.org_name,
    COUNT(*) AS total_requests,
    SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) AS cache_hits,
    SUM(CASE WHEN NOT ci.cache_hit THEN 1 ELSE 0 END) AS cache_misses,
    ROUND(100.0 * SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS cache_hit_rate_pct,
    ROUND(SUM(CASE WHEN NOT ci.cache_hit THEN ci.estimated_cost ELSE 0 END), 4) AS cost_for_new_requests,
    ROUND(SUM(CASE WHEN ci.cache_hit THEN ci.estimated_cost ELSE 0 END), 4) AS cost_saved,
    ROUND(SUM(ci.estimated_cost), 4) AS total_cost
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
GROUP BY DATE(ci.timestamp), ci.org_id, o.org_name
ORDER BY date DESC, cache_hit_rate_pct DESC;

GRANT SELECT ON VIEW V_CACHE_PERFORMANCE TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 4: Token Usage Trend
-- ============================================================================

CREATE OR REPLACE VIEW V_TOKEN_USAGE_TREND AS
SELECT
    DATE(ci.timestamp) AS date,
    ci.org_id,
    o.org_name,
    ci.query_type,
    ci.model,
    COUNT(*) AS request_count,
    SUM(ci.input_tokens) AS total_input_tokens,
    SUM(ci.output_tokens) AS total_output_tokens,
    SUM(ci.total_tokens) AS total_tokens,
    ROUND(AVG(ci.input_tokens), 0) AS avg_input_tokens,
    ROUND(AVG(ci.output_tokens), 0) AS avg_output_tokens,
    ROUND(SUM(ci.estimated_cost), 4) AS total_cost,
    ROUND(AVG(ci.estimated_cost), 6) AS avg_cost_per_request
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
WHERE ci.success = TRUE
GROUP BY DATE(ci.timestamp), ci.org_id, o.org_name, ci.query_type, ci.model
ORDER BY date DESC, total_cost DESC;

GRANT SELECT ON VIEW V_TOKEN_USAGE_TREND TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 5: Top Expensive Queries
-- ============================================================================

CREATE OR REPLACE VIEW V_TOP_EXPENSIVE_QUERIES AS
SELECT
    DATE(ci.timestamp) AS date,
    ci.org_id,
    o.org_name,
    ci.query_type,
    ci.model,
    LEFT(ci.prompt_text, 200) AS prompt_preview,
    ci.total_tokens,
    ci.estimated_cost,
    ci.cache_hit,
    COUNT(*) AS occurrence_count,
    SUM(ci.estimated_cost) AS total_cost_for_query
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
WHERE ci.timestamp >= DATEADD(day, -30, CURRENT_DATE())
    AND ci.success = TRUE
GROUP BY
    DATE(ci.timestamp),
    ci.org_id,
    o.org_name,
    ci.query_type,
    ci.model,
    LEFT(ci.prompt_text, 200),
    ci.total_tokens,
    ci.estimated_cost,
    ci.cache_hit
ORDER BY total_cost_for_query DESC
LIMIT 100;

GRANT SELECT ON VIEW V_TOP_EXPENSIVE_QUERIES TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 6: Warehouse Utilization
-- ============================================================================

-- NOTE: SNOWFLAKE.ACCOUNT_USAGE requires ACCOUNTADMIN - commented out for SYSADMIN deployment
-- Create manually with ACCOUNTADMIN if needed:
/*
CREATE OR REPLACE VIEW V_WAREHOUSE_UTILIZATION AS
SELECT
    wh.warehouse_name,
    o.org_id,
    o.org_name,
    wh.start_time::DATE AS date,
    SUM(wh.credits_used) AS credits_used,
    AVG(wh.avg_running) AS avg_running_queries,
    AVG(wh.avg_queued_load) AS avg_queued_load,
    AVG(wh.avg_queued_provisioning) AS avg_queued_provisioning,
    MAX(wh.avg_blocked) AS max_blocked_queries
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_LOAD_HISTORY wh
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o
    ON wh.warehouse_name = o.warehouse_name
WHERE wh.start_time >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY wh.warehouse_name, o.org_id, o.org_name, wh.start_time::DATE
ORDER BY date DESC, credits_used DESC;

GRANT SELECT ON VIEW V_WAREHOUSE_UTILIZATION TO ROLE AGENTNEXUS_AUTH_WRITER;
*/

-- ============================================================================
-- View 7: Failed Requests Analysis
-- ============================================================================

CREATE OR REPLACE VIEW V_FAILED_REQUESTS AS
SELECT
    DATE(ci.timestamp) AS date,
    ci.org_id,
    o.org_name,
    ci.query_type,
    ci.model,
    ci.error_message,
    COUNT(*) AS failure_count,
    LEFT(ci.prompt_text, 200) AS sample_prompt
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
WHERE ci.success = FALSE
    AND ci.timestamp >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY
    DATE(ci.timestamp),
    ci.org_id,
    o.org_name,
    ci.query_type,
    ci.model,
    ci.error_message,
    LEFT(ci.prompt_text, 200)
ORDER BY date DESC, failure_count DESC;

GRANT SELECT ON VIEW V_FAILED_REQUESTS TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 8: Budget Alerts Active
-- ============================================================================

CREATE OR REPLACE VIEW V_ACTIVE_BUDGET_ALERTS AS
SELECT
    ba.timestamp,
    ba.org_id,
    o.org_name,
    ba.alert_level,
    ba.budget_used_pct,
    ba.message,
    ba.acknowledged,
    o.MONTHLY_COST_LIMIT,
    ROUND(o.MONTHLY_COST_LIMIT * ba.budget_used_pct / 100, 2) AS estimated_spend
FROM VIDEXA_SHARED.AUDIT_LOGS.BUDGET_ALERTS ba
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ba.org_id = o.org_id
WHERE ba.acknowledged = FALSE
ORDER BY ba.budget_used_pct DESC, ba.timestamp DESC;

GRANT SELECT ON VIEW V_ACTIVE_BUDGET_ALERTS TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 9: User Activity by Organization
-- ============================================================================

CREATE OR REPLACE VIEW V_USER_ACTIVITY AS
SELECT
    DATE(ci.timestamp) AS date,
    ci.org_id,
    o.org_name,
    ci.user_id,
    COUNT(*) AS total_requests,
    SUM(ci.total_tokens) AS total_tokens,
    ROUND(SUM(ci.estimated_cost), 4) AS total_cost,
    ROUND(AVG(ci.latency_ms), 0) AS avg_latency_ms,
    SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) AS cache_hits,
    MIN(ci.timestamp) AS first_request_time,
    MAX(ci.timestamp) AS last_request_time
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
WHERE ci.user_id IS NOT NULL
GROUP BY DATE(ci.timestamp), ci.org_id, o.org_name, ci.user_id
ORDER BY date DESC, total_cost DESC;

GRANT SELECT ON VIEW V_USER_ACTIVITY TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- View 10: Executive Summary (Current Month)
-- ============================================================================

CREATE OR REPLACE VIEW V_EXECUTIVE_SUMMARY AS
SELECT
    DATE_TRUNC('MONTH', CURRENT_DATE()) AS month,
    COUNT(DISTINCT ci.org_id) AS active_organizations,
    COUNT(*) AS total_interactions,
    COUNT(DISTINCT ci.user_id) AS unique_users,
    SUM(ci.total_tokens) AS total_tokens,
    ROUND(SUM(ci.estimated_cost), 2) AS total_cost,
    ROUND(AVG(ci.estimated_cost), 6) AS avg_cost_per_interaction,
    ROUND(100.0 * SUM(CASE WHEN ci.cache_hit THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS overall_cache_hit_rate,
    ROUND(AVG(ci.latency_ms), 0) AS avg_latency_ms,
    SUM(CASE WHEN ci.success THEN 1 ELSE 0 END) AS successful_requests,
    ROUND(100.0 * SUM(CASE WHEN ci.success THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS success_rate_pct,
    SUM(o.MONTHLY_COST_LIMIT) AS total_budget_allocated,
    ROUND(100.0 * SUM(ci.estimated_cost) / NULLIF(SUM(o.MONTHLY_COST_LIMIT), 0), 2) AS overall_budget_used_pct
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS ci
JOIN VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o ON ci.org_id = o.org_id
WHERE DATE_TRUNC('MONTH', ci.timestamp) = DATE_TRUNC('MONTH', CURRENT_DATE());

GRANT SELECT ON VIEW V_EXECUTIVE_SUMMARY TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- Materialized Views for Performance (Optional - for large datasets)
-- ============================================================================

-- Uncomment if daily data volume is very high (>100K interactions/day)
/*
CREATE OR REPLACE DYNAMIC TABLE DT_DAILY_COST_BY_ORG
    TARGET_LAG = '1 hour'
    WAREHOUSE = COMPUTE_WH
AS
SELECT * FROM V_DAILY_COST_BY_ORG;
*/

-- ============================================================================
-- Validation Queries
-- ============================================================================

-- Test all views (excluding V_WAREHOUSE_UTILIZATION which requires ACCOUNTADMIN)
SELECT 'V_DAILY_COST_BY_ORG' AS view_name, COUNT(*) AS row_count FROM V_DAILY_COST_BY_ORG
UNION ALL
SELECT 'V_MONTHLY_COST_BY_ORG', COUNT(*) FROM V_MONTHLY_COST_BY_ORG
UNION ALL
SELECT 'V_CACHE_PERFORMANCE', COUNT(*) FROM V_CACHE_PERFORMANCE
UNION ALL
SELECT 'V_TOKEN_USAGE_TREND', COUNT(*) FROM V_TOKEN_USAGE_TREND
UNION ALL
SELECT 'V_TOP_EXPENSIVE_QUERIES', COUNT(*) FROM V_TOP_EXPENSIVE_QUERIES
UNION ALL
SELECT 'V_FAILED_REQUESTS', COUNT(*) FROM V_FAILED_REQUESTS
UNION ALL
SELECT 'V_ACTIVE_BUDGET_ALERTS', COUNT(*) FROM V_ACTIVE_BUDGET_ALERTS
UNION ALL
SELECT 'V_USER_ACTIVITY', COUNT(*) FROM V_USER_ACTIVITY
UNION ALL
SELECT 'V_EXECUTIVE_SUMMARY', COUNT(*) FROM V_EXECUTIVE_SUMMARY;

-- ============================================================================
-- Power BI Connection String Template
-- ============================================================================

/*
Server: vga30685.east-us-2.azure.snowflakecomputing.com
Warehouse: COMPUTE_WH
Database: VIDEXA_SHARED
Schema: REPORTING
Authentication: Service Account with RSA Key or Username/Password

Tables to import for Power BI:
1. V_DAILY_COST_BY_ORG
2. V_MONTHLY_COST_BY_ORG
3. V_CACHE_PERFORMANCE
4. V_TOKEN_USAGE_TREND
5. V_TOP_EXPENSIVE_QUERIES
6. V_WAREHOUSE_UTILIZATION
7. V_FAILED_REQUESTS
8. V_ACTIVE_BUDGET_ALERTS
9. V_USER_ACTIVITY
10. V_EXECUTIVE_SUMMARY

Recommended Refresh Schedule: Every 1 hour
*/

-- ============================================================================
-- Sample Queries for Testing
-- ============================================================================

-- Current month spend by organization
SELECT * FROM V_MONTHLY_COST_BY_ORG
WHERE month = DATE_TRUNC('MONTH', CURRENT_DATE())
ORDER BY budget_used_pct DESC;

-- Today's cache performance
SELECT * FROM V_CACHE_PERFORMANCE
WHERE date = CURRENT_DATE()
ORDER BY cache_hit_rate_pct DESC;

-- Top 10 most expensive queries this week
SELECT * FROM V_TOP_EXPENSIVE_QUERIES
WHERE date >= DATEADD(day, -7, CURRENT_DATE())
ORDER BY total_cost_for_query DESC
LIMIT 10;

-- Organizations approaching budget limit
SELECT * FROM V_MONTHLY_COST_BY_ORG
WHERE month = DATE_TRUNC('MONTH', CURRENT_DATE())
    AND budget_used_pct >= 75
ORDER BY budget_used_pct DESC;

-- Executive summary
SELECT * FROM V_EXECUTIVE_SUMMARY;
