/*
 * 01-multi-tenant-structure.sql
 *
 * Creates the foundational multi-tenant architecture for NexusChat with Snowflake Cortex
 *
 * Purpose:
 *   - Create shared tenant management database (VIDEXA_SHARED)
 *   - Establish tenant metadata tables and organizational structure
 *   - Set up resource monitors for cost control
 *   - Define base roles and permissions hierarchy
 *
 * Requirements:
 *   - Must be run as ACCOUNTADMIN or equivalent
 *   - Account must have sufficient quota for databases and warehouses
 *
 * Created: November 2025
 * For: NexusChat - Snowflake Cortex Integration
 */

-- Set context to ACCOUNTADMIN role
USE ROLE SYSADMIN;

-- ============================================================================
-- SECTION 1: Shared Tenant Management Database
-- ============================================================================

-- Create the shared database for tenant management
CREATE DATABASE IF NOT EXISTS VIDEXA_SHARED
    COMMENT = 'Shared tenant management database for multi-org NexusChat deployment';

-- Create tenant management schema
CREATE SCHEMA IF NOT EXISTS VIDEXA_SHARED.TENANT_MANAGEMENT
    COMMENT = 'Schema for managing tenant organizations, resources, and metadata';

USE SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT;

-- ============================================================================
-- SECTION 2: Tenant Organization Tables
-- ============================================================================

-- Organization registry table
CREATE TABLE IF NOT EXISTS ORGANIZATIONS (
    ORG_ID VARCHAR(20) PRIMARY KEY,
    ORG_NAME VARCHAR(200) NOT NULL,
    DATABASE_NAME VARCHAR(100) NOT NULL UNIQUE,
    WAREHOUSE_NAME VARCHAR(100) NOT NULL,
    ROLE_NAME VARCHAR(100) NOT NULL,
    STATUS VARCHAR(20) DEFAULT 'active',
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),

    -- Resource limits
    DAILY_TOKEN_LIMIT INTEGER DEFAULT 1000000,
    MONTHLY_COST_LIMIT DECIMAL(10,2) DEFAULT 1000.00,

    -- Metadata
    PRIMARY_CONTACT_EMAIL VARCHAR(255),
    TIMEZONE VARCHAR(50) DEFAULT 'America/Chicago',
    DATA_RETENTION_DAYS INTEGER DEFAULT 90,

    -- Configuration flags
    ENABLE_CORTEX BOOLEAN DEFAULT TRUE,
    ENABLE_CACHING BOOLEAN DEFAULT TRUE,
    ENABLE_COMPRESSION BOOLEAN DEFAULT TRUE

    -- Note: CHECK constraint removed (not supported in Snowflake)
    -- Valid STATUS values: 'active', 'suspended', 'archived'
)
COMMENT = 'Registry of all healthcare system organizations';

-- Organization users table
CREATE TABLE IF NOT EXISTS ORG_USERS (
    USER_ID VARCHAR(100),
    ORG_ID VARCHAR(20),
    EMAIL VARCHAR(255) NOT NULL,
    FULL_NAME VARCHAR(200),
    ROLE VARCHAR(50) DEFAULT 'user',
    STATUS VARCHAR(20) DEFAULT 'active',
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    LAST_ACTIVITY_AT TIMESTAMP_NTZ,

    PRIMARY KEY (USER_ID, ORG_ID),
    FOREIGN KEY (ORG_ID) REFERENCES ORGANIZATIONS(ORG_ID)

    -- Note: CHECK constraints removed (not supported in Snowflake)
    -- Valid ROLE values: 'admin', 'user', 'viewer'
    -- Valid STATUS values: 'active', 'inactive', 'locked'
)
COMMENT = 'User membership and roles within organizations';

-- Resource usage tracking table
CREATE TABLE IF NOT EXISTS ORG_RESOURCE_USAGE (
    USAGE_ID VARCHAR(100) DEFAULT UUID_STRING() PRIMARY KEY,
    ORG_ID VARCHAR(20) NOT NULL,
    USAGE_DATE DATE NOT NULL,

    -- Token usage
    TOTAL_TOKENS INTEGER DEFAULT 0,
    PROMPT_TOKENS INTEGER DEFAULT 0,
    COMPLETION_TOKENS INTEGER DEFAULT 0,
    CACHED_TOKENS INTEGER DEFAULT 0,

    -- Cost tracking
    TOTAL_COST DECIMAL(10,6) DEFAULT 0.0,
    COMPUTE_COST DECIMAL(10,6) DEFAULT 0.0,
    CORTEX_COST DECIMAL(10,6) DEFAULT 0.0,

    -- Activity metrics
    TOTAL_CONVERSATIONS INTEGER DEFAULT 0,
    TOTAL_MESSAGES INTEGER DEFAULT 0,
    ACTIVE_USERS INTEGER DEFAULT 0,

    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),

    FOREIGN KEY (ORG_ID) REFERENCES ORGANIZATIONS(ORG_ID),
    UNIQUE (ORG_ID, USAGE_DATE)
)
COMMENT = 'Daily resource usage and cost tracking per organization';

-- ============================================================================
-- SECTION 3: Resource Monitors for Cost Control
-- ============================================================================

-- NOTE: Account-level resource monitors require ACCOUNTADMIN privileges
-- These commands are commented out for SYSADMIN deployment
-- To enable, run manually with ACCOUNTADMIN role:
/*
CREATE RESOURCE MONITOR IF NOT EXISTS VIDEXA_GLOBAL_MONITOR
    WITH
        CREDIT_QUOTA = 5000
        FREQUENCY = MONTHLY
        START_TIMESTAMP = IMMEDIATELY
        TRIGGERS
            ON 80 PERCENT DO NOTIFY
            ON 90 PERCENT DO SUSPEND_IMMEDIATE
    COMMENT = 'Global account-level resource monitor - suspends at 90% of 5000 credits/month';

ALTER ACCOUNT SET RESOURCE_MONITOR = VIDEXA_GLOBAL_MONITOR;
*/

-- Template for per-org warehouse monitors (will be created by bulk org creation script)
-- CREATE RESOURCE MONITOR IF NOT EXISTS <ORG_ID>_MONITOR
--     WITH
--         CREDIT_QUOTA = 100
--         FREQUENCY = MONTHLY
--         START_TIMESTAMP = IMMEDIATELY
--         TRIGGERS
--             ON 90 PERCENT DO NOTIFY;

-- ============================================================================
-- SECTION 4: Role Hierarchy and Permissions
-- ============================================================================

-- NOTE: Role creation requires elevated privileges
-- These commands are commented out for SYSADMIN deployment
-- To enable, run manually with SECURITYADMIN or ACCOUNTADMIN role:
/*
CREATE ROLE IF NOT EXISTS VIDEXA_TENANT_ADMIN
    COMMENT = 'Master role for managing all tenant organizations';

GRANT USAGE ON DATABASE VIDEXA_SHARED TO ROLE VIDEXA_TENANT_ADMIN;
GRANT USAGE ON SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT TO ROLE VIDEXA_TENANT_ADMIN;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT TO ROLE VIDEXA_TENANT_ADMIN;
GRANT ALL PRIVILEGES ON FUTURE TABLES IN SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT TO ROLE VIDEXA_TENANT_ADMIN;

CREATE ROLE IF NOT EXISTS VIDEXA_SERVICE_ROLE
    COMMENT = 'Service role for automated tenant provisioning and management';

GRANT USAGE ON DATABASE VIDEXA_SHARED TO ROLE VIDEXA_SERVICE_ROLE;
GRANT USAGE ON SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT TO ROLE VIDEXA_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT TO ROLE VIDEXA_SERVICE_ROLE;

GRANT ROLE VIDEXA_TENANT_ADMIN TO ROLE ACCOUNTADMIN;
GRANT ROLE VIDEXA_SERVICE_ROLE TO ROLE ACCOUNTADMIN;
*/

-- ============================================================================
-- SECTION 5: Stored Procedures for Tenant Management
-- ============================================================================

-- Procedure to create a new organization environment
CREATE OR REPLACE PROCEDURE CREATE_ORG_ENVIRONMENT(
    P_ORG_ID VARCHAR,
    P_ORG_NAME VARCHAR,
    P_CONTACT_EMAIL VARCHAR
)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
DECLARE
    v_db_name VARCHAR;
    v_warehouse_name VARCHAR;
    v_role_name VARCHAR;
    v_result VARCHAR;
BEGIN
    -- Generate resource names
    v_db_name := P_ORG_ID || '_DB';
    v_warehouse_name := P_ORG_ID || '_WH';
    v_role_name := P_ORG_ID || '_ROLE';

    -- Insert organization record
    INSERT INTO VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
        (ORG_ID, ORG_NAME, DATABASE_NAME, WAREHOUSE_NAME, ROLE_NAME, PRIMARY_CONTACT_EMAIL)
    VALUES
        (:P_ORG_ID, :P_ORG_NAME, :v_db_name, :v_warehouse_name, :v_role_name, :P_CONTACT_EMAIL);

    -- Create database
    EXECUTE IMMEDIATE 'CREATE DATABASE IF NOT EXISTS ' || v_db_name;

    -- Create warehouse with auto-suspend
    EXECUTE IMMEDIATE
        'CREATE WAREHOUSE IF NOT EXISTS ' || v_warehouse_name ||
        ' WITH WAREHOUSE_SIZE = XSMALL ' ||
        ' AUTO_SUSPEND = 60 ' ||
        ' AUTO_RESUME = TRUE ' ||
        ' INITIALLY_SUSPENDED = TRUE ' ||
        ' COMMENT = ''Dedicated warehouse for ' || P_ORG_NAME || '''';

    -- Create role
    EXECUTE IMMEDIATE 'CREATE ROLE IF NOT EXISTS ' || v_role_name;

    -- Grant permissions
    EXECUTE IMMEDIATE 'GRANT USAGE ON DATABASE ' || v_db_name || ' TO ROLE ' || v_role_name;
    EXECUTE IMMEDIATE 'GRANT USAGE ON WAREHOUSE ' || v_warehouse_name || ' TO ROLE ' || v_role_name;

    v_result := 'Successfully created environment for ' || P_ORG_NAME ||
                ' (DB: ' || v_db_name || ', WH: ' || v_warehouse_name || ')';

    RETURN v_result;
END;
$$;

-- Procedure to suspend an organization
CREATE OR REPLACE PROCEDURE SUSPEND_ORG(P_ORG_ID VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
DECLARE
    v_warehouse_name VARCHAR;
BEGIN
    -- Get warehouse name
    SELECT WAREHOUSE_NAME INTO :v_warehouse_name
    FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    WHERE ORG_ID = :P_ORG_ID;

    -- Suspend warehouse
    EXECUTE IMMEDIATE 'ALTER WAREHOUSE ' || v_warehouse_name || ' SUSPEND';

    -- Update organization status
    UPDATE VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    SET STATUS = 'suspended', UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE ORG_ID = :P_ORG_ID;

    RETURN 'Organization ' || P_ORG_ID || ' suspended successfully';
END;
$$;

-- Procedure to reactivate an organization
CREATE OR REPLACE PROCEDURE ACTIVATE_ORG(P_ORG_ID VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
BEGIN
    UPDATE VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    SET STATUS = 'active', UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE ORG_ID = :P_ORG_ID;

    RETURN 'Organization ' || P_ORG_ID || ' activated successfully';
END;
$$;

-- ============================================================================
-- SECTION 6: Verification Views
-- ============================================================================

-- View for organization summary
CREATE OR REPLACE VIEW V_ORG_SUMMARY AS
SELECT
    o.ORG_ID,
    o.ORG_NAME,
    o.STATUS,
    o.DATABASE_NAME,
    o.WAREHOUSE_NAME,
    o.CREATED_AT,
    COUNT(DISTINCT u.USER_ID) as TOTAL_USERS,
    COALESCE(SUM(r.TOTAL_TOKENS), 0) as LIFETIME_TOKENS,
    COALESCE(SUM(r.TOTAL_COST), 0) as LIFETIME_COST
FROM ORGANIZATIONS o
LEFT JOIN ORG_USERS u ON o.ORG_ID = u.ORG_ID AND u.STATUS = 'active'
LEFT JOIN ORG_RESOURCE_USAGE r ON o.ORG_ID = r.ORG_ID
GROUP BY
    o.ORG_ID, o.ORG_NAME, o.STATUS, o.DATABASE_NAME,
    o.WAREHOUSE_NAME, o.CREATED_AT
ORDER BY o.CREATED_AT DESC;

-- ============================================================================
-- SECTION 7: Initial Verification
-- ============================================================================

-- Show created objects
SHOW DATABASES LIKE 'VIDEXA_SHARED';
SHOW SCHEMAS IN DATABASE VIDEXA_SHARED;
SHOW TABLES IN SCHEMA VIDEXA_SHARED.TENANT_MANAGEMENT;
SHOW RESOURCE MONITORS;

-- Display summary
SELECT 'Multi-tenant structure created successfully' as STATUS,
       COUNT(*) as TABLE_COUNT
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'TENANT_MANAGEMENT'
  AND TABLE_CATALOG = 'VIDEXA_SHARED';

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

/*
 * Next Steps:
 *   1. Run 02-token-efficient-cortex.sql to set up Cortex functions
 *   2. Run 03-bulk-org-creation.sql to create 20 HCS organizations
 *   3. Run 04-monitoring-views.sql for Power BI dashboards
 *   4. Run 05-conversation-storage.sql for NexusChat conversation tables
 */
