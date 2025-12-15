-- ============================================================================
-- Bulk Organization Creation for 20 Healthcare Systems
-- Executes immediately to provision all HCS organizations
-- ============================================================================

USE ROLE SYSADMIN;
USE DATABASE VIDEXA_SHARED;
USE SCHEMA TENANT_MANAGEMENT;

-- ============================================================================
-- Organization Configuration Data
-- ============================================================================

-- Temporary table for org configurations
CREATE TEMPORARY TABLE org_configs (
    org_id VARCHAR(50),
    org_name VARCHAR(255),
    monthly_credit_limit DECIMAL(10,2)
);

-- Insert 20 healthcare systems
INSERT INTO org_configs VALUES
('HCS0001', 'Memorial Healthcare System', 500.00),
('HCS0002', 'Regional Medical Center', 500.00),
('HCS0003', 'Community Hospital Network', 500.00),
('HCS0004', 'University Medical Group', 750.00),
('HCS0005', 'Coastal Health Partners', 500.00),
('HCS0006', 'Metropolitan Hospital System', 750.00),
('HCS0007', 'Valley Health Network', 500.00),
('HCS0008', 'Riverside Medical Center', 500.00),
('HCS0009', 'Summit Healthcare Group', 500.00),
('HCS0010', 'Lakeside Regional Hospital', 500.00),
('HCS0011', 'Mountain View Health System', 500.00),
('HCS0012', 'Bayfront Medical Network', 500.00),
('HCS0013', 'Central City Hospital Group', 750.00),
('HCS0014', 'Northside Healthcare Alliance', 500.00),
('HCS0015', 'Southpoint Medical Partners', 500.00),
('HCS0016', 'Eastern Regional Health', 500.00),
('HCS0017', 'Western Medical Center', 500.00),
('HCS0018', 'Capital Healthcare System', 750.00),
('HCS0019', 'County Hospital Network', 500.00),
('HCS0020', 'State Medical Group', 750.00);

-- ============================================================================
-- Bulk Organization Provisioning
-- ============================================================================

-- Stored procedure to create all orgs
CREATE OR REPLACE PROCEDURE BULK_CREATE_ORGANIZATIONS()
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
DECLARE
    org_cursor CURSOR FOR SELECT * FROM org_configs ORDER BY org_id;
    v_org_id VARCHAR;
    v_org_name VARCHAR;
    v_credit_limit DECIMAL(10,2);
    v_created_count INTEGER DEFAULT 0;
    v_failed_count INTEGER DEFAULT 0;
    v_error_message VARCHAR;
BEGIN
    -- Loop through all org configs
    FOR org_record IN org_cursor DO
        v_org_id := org_record.org_id;
        v_org_name := org_record.org_name;
        v_credit_limit := org_record.monthly_credit_limit;

        BEGIN
            -- Check if org already exists
            LET org_exists INTEGER := (
                SELECT COUNT(*)
                FROM TENANT_MANAGEMENT.ORGANIZATIONS
                WHERE ORG_ID = :v_org_id
            );

            IF (:org_exists > 0) THEN
                -- Skip existing orgs
                SYSTEM$LOG('INFO', 'Organization ' || :v_org_id || ' already exists, skipping');
                CONTINUE;
            END IF;

            -- Call the org creation procedure (3rd param is contact email)
            CALL CREATE_ORG_ENVIRONMENT(:v_org_id, :v_org_name, 'admin@videxa.ai');

            v_created_count := v_created_count + 1;
            SYSTEM$LOG('INFO', 'Created organization: ' || :v_org_id);

        EXCEPTION
            WHEN OTHER THEN
                v_failed_count := v_failed_count + 1;
                v_error_message := SQLERRM;
                SYSTEM$LOG('ERROR', 'Failed to create ' || :v_org_id || ': ' || :v_error_message);
        END;
    END FOR;

    RETURN 'Bulk provisioning complete. Created: ' || v_created_count || ', Failed: ' || v_failed_count;
END;
$$;

-- Execute bulk creation
CALL BULK_CREATE_ORGANIZATIONS();

-- Reset context after procedure execution
USE DATABASE VIDEXA_SHARED;
USE SCHEMA TENANT_MANAGEMENT;

-- Verify all orgs created
SELECT
    COUNT(*) AS total_orgs,
    SUM(CASE WHEN STATUS = 'active' THEN 1 ELSE 0 END) AS active_orgs,
    SUM(MONTHLY_COST_LIMIT) AS total_monthly_budget
FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS;

-- ============================================================================
-- Grant Service Account Access to All Organizations
-- ============================================================================

-- Create procedure to grant all roles to service account
CREATE OR REPLACE PROCEDURE GRANT_ALL_ORG_ROLES_TO_SERVICE_ACCOUNT()
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
DECLARE
    role_cursor CURSOR FOR
        SELECT ROLE_NAME FROM TENANT_MANAGEMENT.ORGANIZATIONS
        WHERE STATUS = 'active'
        ORDER BY ORG_ID;
    v_role_name VARCHAR;
    v_granted_count INTEGER DEFAULT 0;
BEGIN
    FOR role_record IN role_cursor DO
        v_role_name := role_record.role_name;

        BEGIN
            EXECUTE IMMEDIATE 'GRANT ROLE ' || v_role_name || ' TO USER CLAUDE_AGENTNEXUS_USER';
            v_granted_count := v_granted_count + 1;
            SYSTEM$LOG('INFO', 'Granted role ' || v_role_name || ' to service account');
        EXCEPTION
            WHEN OTHER THEN
                SYSTEM$LOG('ERROR', 'Failed to grant ' || v_role_name || ': ' || SQLERRM);
        END;
    END FOR;

    RETURN 'Granted ' || v_granted_count || ' roles to CLAUDE_AGENTNEXUS_USER';
END;
$$;

-- Execute role grants
CALL GRANT_ALL_ORG_ROLES_TO_SERVICE_ACCOUNT();

-- NOTE: SNOWFLAKE.ACCOUNT_USAGE schema requires ACCOUNTADMIN - verify manually
-- SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS WHERE GRANTEE_NAME = 'CLAUDE_AGENTNEXUS_USER';

-- ============================================================================
-- Create Resource Monitors for All Organizations
-- ============================================================================

CREATE OR REPLACE PROCEDURE CREATE_ALL_RESOURCE_MONITORS()
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
DECLARE
    org_cursor CURSOR FOR
        SELECT ORG_ID, WAREHOUSE_NAME, MONTHLY_COST_LIMIT
        FROM TENANT_MANAGEMENT.ORGANIZATIONS
        WHERE STATUS = 'active'
        ORDER BY ORG_ID;
    v_org_id VARCHAR;
    v_warehouse_name VARCHAR;
    v_credit_limit DECIMAL(10,2);
    v_monitor_name VARCHAR;
    v_created_count INTEGER DEFAULT 0;
BEGIN
    FOR org_record IN org_cursor DO
        v_org_id := org_record.org_id;
        v_warehouse_name := org_record.warehouse_name;
        v_credit_limit := org_record.MONTHLY_COST_LIMIT;
        v_monitor_name := v_org_id || '_MONTHLY_MONITOR';

        BEGIN
            -- Create resource monitor
            EXECUTE IMMEDIATE '
                CREATE OR REPLACE RESOURCE MONITOR ' || v_monitor_name || '
                WITH
                    CREDIT_QUOTA = ' || v_credit_limit || '
                    FREQUENCY = MONTHLY
                    START_TIMESTAMP = IMMEDIATELY
                    TRIGGERS
                        ON 75 PERCENT DO NOTIFY
                        ON 90 PERCENT DO SUSPEND
                        ON 100 PERCENT DO SUSPEND_IMMEDIATE
            ';

            -- Apply to warehouse
            EXECUTE IMMEDIATE 'ALTER WAREHOUSE ' || v_warehouse_name || ' SET RESOURCE_MONITOR = ' || v_monitor_name;

            v_created_count := v_created_count + 1;
            SYSTEM$LOG('INFO', 'Created resource monitor for ' || v_org_id);

        EXCEPTION
            WHEN OTHER THEN
                SYSTEM$LOG('ERROR', 'Failed to create monitor for ' || v_org_id || ': ' || SQLERRM);
        END;
    END FOR;

    RETURN 'Created ' || v_created_count || ' resource monitors';
END;
$$;

-- Execute resource monitor creation
CALL CREATE_ALL_RESOURCE_MONITORS();

-- Verify resource monitors
SHOW RESOURCE MONITORS LIKE 'HCS%';

-- ============================================================================
-- Initialize Sample Data for Testing (Optional)
-- ============================================================================

-- Procedure to load sample claim into each org for testing
CREATE OR REPLACE PROCEDURE LOAD_SAMPLE_DATA_ALL_ORGS()
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
DECLARE
    org_cursor CURSOR FOR
        SELECT ORG_ID, DATABASE_NAME, WAREHOUSE_NAME
        FROM TENANT_MANAGEMENT.ORGANIZATIONS
        WHERE STATUS = 'active'
        ORDER BY ORG_ID;
    v_org_id VARCHAR;
    v_db_name VARCHAR;
    v_wh_name VARCHAR;
    v_loaded_count INTEGER DEFAULT 0;
BEGIN
    FOR org_record IN org_cursor DO
        v_org_id := org_record.org_id;
        v_db_name := org_record.database_name;
        v_wh_name := org_record.warehouse_name;

        BEGIN
            -- Switch to org database
            EXECUTE IMMEDIATE 'USE DATABASE ' || v_db_name;
            EXECUTE IMMEDIATE 'USE WAREHOUSE ' || v_wh_name;
            EXECUTE IMMEDIATE 'USE SCHEMA CLAIMS';

            -- Insert sample claim
            EXECUTE IMMEDIATE '
                INSERT INTO INSURANCE_CLAIMS (
                    CLAIM_ID, PATIENT_ID, POLICY_NUMBER, CLAIM_DATE, SERVICE_DATE,
                    PROVIDER_NAME, DIAGNOSIS_CODE, PROCEDURE_CODE,
                    CLAIM_AMOUNT, APPROVED_AMOUNT, PAID_AMOUNT, CLAIM_STATUS,
                    NOTES
                ) VALUES (
                    ''CLM-' || v_org_id || '-00001'',
                    ''PAT-' || v_org_id || '-TEST'',
                    ''POL-BLUE-12345'',
                    CURRENT_DATE(),
                    DATEADD(day, -5, CURRENT_DATE()),
                    ''Memorial Hospital'',
                    ''J18.9'',
                    ''99285'',
                    1500.00,
                    1200.00,
                    1200.00,
                    ''approved'',
                    ''Sample test claim for ' || v_org_id || ' - emergency department visit for pneumonia''
                )
            ';

            -- Generate embedding for sample claim
            EXECUTE IMMEDIATE 'USE SCHEMA CORTEX_DATA';
            EXECUTE IMMEDIATE '
                INSERT INTO CLAIM_EMBEDDINGS (CLAIM_ID, CLAIM_TEXT, EMBEDDING)
                SELECT
                    ''CLM-' || v_org_id || '-00001'',
                    ''Patient ' || v_org_id || ' emergency visit for pneumonia J18.9, procedure 99285, approved $1200'',
                    SNOWFLAKE.CORTEX.EMBED_TEXT_768(
                        ''snowflake-arctic-embed-m'',
                        ''Patient ' || v_org_id || ' emergency visit for pneumonia J18.9, procedure 99285, approved $1200''
                    )
            ';

            v_loaded_count := v_loaded_count + 1;
            SYSTEM$LOG('INFO', 'Loaded sample data for ' || v_org_id);

        EXCEPTION
            WHEN OTHER THEN
                SYSTEM$LOG('ERROR', 'Failed to load sample data for ' || v_org_id || ': ' || SQLERRM);
        END;
    END FOR;

    RETURN 'Loaded sample data into ' || v_loaded_count || ' organizations';
END;
$$;

-- Execute sample data load (optional - for testing)
CALL LOAD_SAMPLE_DATA_ALL_ORGS();

-- ============================================================================
-- Validation Queries
-- ============================================================================

-- Summary of all organizations
SELECT
    ORG_ID,
    ORG_NAME,
    DATABASE_NAME,
    WAREHOUSE_NAME,
    ROLE_NAME,
    MONTHLY_COST_LIMIT,
    STATUS,
    CREATED_AT
FROM TENANT_MANAGEMENT.ORGANIZATIONS
ORDER BY ORG_ID;

-- Check databases created
SHOW DATABASES LIKE 'HCS%';

-- Check warehouses created
SHOW WAREHOUSES LIKE 'HCS%';

-- Check sample data loaded (NOTE: Cross-database queries not supported in multi-statement)
-- Run manually per org:
-- USE DATABASE HCS0001_DB; SELECT COUNT(*) FROM CLAIMS.INSURANCE_CLAIMS;

-- ============================================================================
-- Export Organization Details for Admin Reference
-- ============================================================================

-- Create admin reference table
CREATE TABLE IF NOT EXISTS VIDEXA_SHARED.TENANT_MANAGEMENT.ORG_ADMIN_REFERENCE AS
SELECT
    ORG_ID,
    ORG_NAME,
    DATABASE_NAME,
    WAREHOUSE_NAME,
    ROLE_NAME,
    MONTHLY_COST_LIMIT,
    -- Generate test user email
    LOWER(ORG_ID) || '-admin@videxa.ai' AS test_user_email,
    -- Generate sample data load command
    'USE DATABASE ' || DATABASE_NAME || '; USE SCHEMA CLAIMS; SELECT * FROM INSURANCE_CLAIMS;' AS query_sample_data,
    STATUS,
    CREATED_AT
FROM TENANT_MANAGEMENT.ORGANIZATIONS
WHERE STATUS = 'active'
ORDER BY ORG_ID;

-- View admin reference
SELECT * FROM TENANT_MANAGEMENT.ORG_ADMIN_REFERENCE;

-- ============================================================================
-- Cleanup Temporary Tables
-- ============================================================================

DROP TABLE IF EXISTS org_configs;

-- ============================================================================
-- Final Status Report
-- ============================================================================

SELECT
    '✅ Bulk Organization Provisioning Complete' AS status,
    (SELECT COUNT(*) FROM TENANT_MANAGEMENT.ORGANIZATIONS) AS total_orgs_created,
    (SELECT COUNT(*) FROM TENANT_MANAGEMENT.ORGANIZATIONS WHERE STATUS = 'active') AS active_orgs,
    (SELECT SUM(MONTHLY_COST_LIMIT) FROM TENANT_MANAGEMENT.ORGANIZATIONS) AS total_monthly_budget,
    CURRENT_TIMESTAMP() AS completed_at;

-- ============================================================================
-- Next Steps
-- ============================================================================

/*
NEXT STEPS FOR ADMIN:

1. Verify all organizations created:
   SELECT * FROM TENANT_MANAGEMENT.ORGANIZATIONS;

2. Test Cortex access for one org:
   USE ROLE HCS0001_ROLE;
   USE DATABASE HCS0001_DB;
   USE WAREHOUSE HCS0001_WH;
   SELECT SNOWFLAKE.CORTEX.COMPLETE('claude-sonnet-4', 'Hello', OBJECT_CONSTRUCT('max_tokens', 10));

3. Export org details for onboarding:
   SELECT * FROM TENANT_MANAGEMENT.ORG_ADMIN_REFERENCE;
   -- Save as CSV for distribution to HCS admins

4. Configure AgentNexus Backend:
   - Store Snowflake private key in Azure Key Vault
   - Deploy updated snowflake_cortex.py and nexuschat_llm.py
   - Test API endpoints

5. Deploy NexusChat:
   - Update .env with AGENTNEXUS_API_URL and AGENTNEXUS_API_KEY
   - Deploy docker-compose.videxa-cortex.yml
   - Test end-to-end chat flow

6. Monitor costs:
   - Check VIDEXA_SHARED.AUDIT_LOGS.V_ORG_COST_SUMMARY daily
   - Review BUDGET_ALERTS table
   - Adjust credit limits as needed

7. Load production data:
   - Provide each HCS with data loading templates
   - Execute bulk data loads using load-hcs-data.py script
   - Verify embeddings generated for semantic search

8. Go live:
   - Enable user registration for each org
   - Train HCS admins on system usage
   - Monitor performance and costs
*/
