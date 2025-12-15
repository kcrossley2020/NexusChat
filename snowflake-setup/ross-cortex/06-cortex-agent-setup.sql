/*
 * 06-cortex-agent-setup.sql
 *
 * Creates Snowflake Cortex Agent for an HCS organization
 *
 * Purpose:
 *   - Create CORTEX_AGENT schema in organization database
 *   - Create SEMANTIC_MODELS stage for YAML files
 *   - Create AGENT_INTERACTIONS audit table
 *   - Create the Cortex Agent with claims analytics instructions
 *   - Grant appropriate permissions to organization roles
 *
 * Prerequisites:
 *   - Organization must exist in VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
 *   - Organization database must be created (HCS0001_DB, etc.)
 *   - Run 01-multi-tenant-structure.sql first
 *   - Run 03-bulk-org-creation.sql first (creates org databases)
 *
 * Usage:
 *   1. Set the ORG_ID variable below
 *   2. Run entire script in Snowflake worksheet
 *   3. Upload semantic model YAML to the stage
 *   4. Re-run Step 5 to create the agent after model upload
 *
 * Location: C:\videxa-repos\NexusChat\snowflake-setup\06-cortex-agent-setup.sql
 * Created: December 2025
 * For: NexusChat - Snowflake Cortex Integration
 */

-- ============================================================================
-- CONFIGURATION - MODIFY THIS FOR EACH ORGANIZATION
-- ============================================================================
SET ORG_ID = 'HCS0001';  -- Change to target organization ID

-- ============================================================================
-- DERIVED VARIABLES (Retrieved from tenant management)
-- ============================================================================
SET DB_NAME = (
    SELECT DATABASE_NAME
    FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    WHERE ORG_ID = $ORG_ID
);

SET WH_NAME = (
    SELECT WAREHOUSE_NAME
    FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    WHERE ORG_ID = $ORG_ID
);

SET ROLE_NAME = (
    SELECT ROLE_NAME
    FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    WHERE ORG_ID = $ORG_ID
);

-- RO role follows naming pattern: HCS_00001_CLAIMS_RO
SET RO_ROLE_NAME = CONCAT('HCS_', LPAD(SUBSTR($ORG_ID, 4), 5, '0'), '_CLAIMS_RO');

SET SCHEMA_NAME = 'CORTEX_AGENT';
SET STAGE_NAME = 'SEMANTIC_MODELS';
SET AGENT_NAME = CONCAT($ORG_ID, '_CLAIMS_AGENT');

-- Display configuration for verification
SELECT
    $ORG_ID AS ORG_ID,
    $DB_NAME AS DATABASE_NAME,
    $WH_NAME AS WAREHOUSE_NAME,
    $ROLE_NAME AS ROLE_NAME,
    $RO_ROLE_NAME AS RO_ROLE_NAME,
    $AGENT_NAME AS AGENT_NAME;

-- ============================================================================
-- STEP 1: Verify Organization Exists
-- ============================================================================
SELECT
    ORG_ID,
    ORG_NAME,
    DATABASE_NAME,
    WAREHOUSE_NAME,
    ROLE_NAME,
    STATUS,
    ENABLE_CORTEX
FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
WHERE ORG_ID = $ORG_ID;

-- Fail if org not found or not active
-- (Manual check - if no rows returned, STOP HERE)

-- ============================================================================
-- STEP 2: Create CORTEX_AGENT Schema
-- ============================================================================
USE ROLE SYSADMIN;

CREATE SCHEMA IF NOT EXISTS IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    COMMENT = 'Cortex Agent resources for claims analytics';

-- Grant schema usage to organization roles
GRANT USAGE ON SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    TO ROLE IDENTIFIER($ROLE_NAME);

GRANT USAGE ON SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    TO ROLE IDENTIFIER($RO_ROLE_NAME);

-- ============================================================================
-- STEP 3: Create Semantic Models Stage
-- ============================================================================
USE DATABASE IDENTIFIER($DB_NAME);
USE SCHEMA IDENTIFIER($SCHEMA_NAME);

CREATE STAGE IF NOT EXISTS SEMANTIC_MODELS
    DIRECTORY = (ENABLE = TRUE)
    COMMENT = 'Semantic model YAML files for Cortex Agent';

-- Grant stage permissions
GRANT READ ON STAGE SEMANTIC_MODELS TO ROLE IDENTIFIER($ROLE_NAME);
GRANT READ ON STAGE SEMANTIC_MODELS TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT WRITE ON STAGE SEMANTIC_MODELS TO ROLE IDENTIFIER($ROLE_NAME);

-- ============================================================================
-- STEP 4: Create Agent Interactions Audit Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS AGENT_INTERACTIONS (
    INTERACTION_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    USER_ID VARCHAR(36) NOT NULL,
    TIMESTAMP TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),

    -- Conversation context
    THREAD_ID INTEGER,
    MESSAGE_ID INTEGER,

    -- Query and response
    USER_MESSAGE TEXT NOT NULL,
    AGENT_RESPONSE TEXT,
    SQL_GENERATED TEXT,

    -- Execution details
    SUCCESS BOOLEAN DEFAULT TRUE,
    ERROR_MESSAGE TEXT,
    LATENCY_MS INTEGER,

    -- Token tracking
    TOKENS_USED INTEGER,
    PROMPT_TOKENS INTEGER,
    COMPLETION_TOKENS INTEGER,

    -- Metadata
    MODEL_USED VARCHAR(100),
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
)
COMMENT = 'Audit log of Cortex Agent interactions';

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS IDX_INTERACTIONS_USER
    ON AGENT_INTERACTIONS (USER_ID);
CREATE INDEX IF NOT EXISTS IDX_INTERACTIONS_TIMESTAMP
    ON AGENT_INTERACTIONS (TIMESTAMP);
CREATE INDEX IF NOT EXISTS IDX_INTERACTIONS_THREAD
    ON AGENT_INTERACTIONS (THREAD_ID);

-- Grant table permissions
GRANT SELECT, INSERT ON TABLE AGENT_INTERACTIONS
    TO ROLE IDENTIFIER($ROLE_NAME);
GRANT SELECT ON TABLE AGENT_INTERACTIONS
    TO ROLE IDENTIFIER($RO_ROLE_NAME);

-- ============================================================================
-- STEP 5: Check for Semantic Model Before Creating Agent
-- ============================================================================
-- List files in stage to verify semantic model exists
LIST @SEMANTIC_MODELS;

/*
 * If no semantic model file exists:
 *   1. Upload claims_semantic_model.yaml using:
 *      PUT file://C:/videxa-repos/NexusChat/snowflake-setup/claims_semantic_model.yaml @SEMANTIC_MODELS/ AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
 *   2. Then continue to Step 6
 *
 * If files are listed, proceed to Step 6
 */

-- ============================================================================
-- STEP 6: Create Cortex Agent (ONLY after semantic model is uploaded)
-- ============================================================================

-- Switch to appropriate role and context
USE ROLE IDENTIFIER($ROLE_NAME);
USE WAREHOUSE IDENTIFIER($WH_NAME);
USE DATABASE IDENTIFIER($DB_NAME);
USE SCHEMA IDENTIFIER($SCHEMA_NAME);

-- Create the Cortex Agent
CREATE OR REPLACE CORTEX AGENT IDENTIFIER($AGENT_NAME)
    COMMENT = 'Claims analytics agent for healthcare system organization'
    MODELS = ('orchestration' = 'auto')
    INSTRUCTIONS = (
        'response' = 'You are a healthcare claims analytics assistant. Answer questions about insurance claims, denials, payments, and provider performance. Be concise and professional. When showing data, format numbers clearly (use commas for thousands, show currency as $X,XXX.XX). Always cite the data when providing statistics. If a question cannot be answered with the available data, explain what data would be needed.',
        'orchestration' = 'Use the claims semantic model for questions about: Claims status (approved, denied, pending, paid), Denial reasons and denial rates by category, Billed amounts, approved amounts, and payments, Provider and diagnosis code analysis, Payer performance comparisons, Time-based trends and comparisons. For questions outside this scope, explain what data is available.'
    )
    TOOLS = (
        'analyst' = (
            'semantic_model_file' = '@SEMANTIC_MODELS/claims_semantic_model.yaml'
        )
    );

-- ============================================================================
-- STEP 7: Grant Agent Permissions
-- ============================================================================
USE ROLE SYSADMIN;

-- Grant agent usage to organization role
GRANT USAGE ON CORTEX AGENT IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME || '.' || $AGENT_NAME)
    TO ROLE IDENTIFIER($ROLE_NAME);

-- Grant agent usage to RO role (for queries)
GRANT USAGE ON CORTEX AGENT IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME || '.' || $AGENT_NAME)
    TO ROLE IDENTIFIER($RO_ROLE_NAME);

-- Grant to service account if exists
GRANT USAGE ON CORTEX AGENT IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME || '.' || $AGENT_NAME)
    TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify schema and objects created
SHOW SCHEMAS IN DATABASE IDENTIFIER($DB_NAME) LIKE 'CORTEX_AGENT';
SHOW STAGES IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME);
SHOW TABLES IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME);

-- Verify agent exists
SHOW CORTEX AGENTS IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME);

-- ============================================================================
-- TEST THE AGENT
-- ============================================================================
/*
 * To test the agent, run these commands:
 *
 * USE ROLE <ORG_ROLE>;
 * USE DATABASE <ORG_DB>;
 * USE WAREHOUSE <ORG_WH>;
 * USE SCHEMA CORTEX_AGENT;
 *
 * -- Simple test query
 * SELECT SNOWFLAKE.CORTEX.COMPLETE(
 *     '<AGENT_NAME>',
 *     [{'role': 'user', 'content': 'What is the total billed amount for all claims?'}]
 * );
 *
 * -- Or use the agent chat function
 * CALL SNOWFLAKE.CORTEX.AGENT(
 *     '<AGENT_NAME>',
 *     'How many claims were denied last month?'
 * );
 */

SELECT 'Cortex Agent setup complete for ' || $ORG_ID AS STATUS;
SELECT 'Agent Name: ' || $AGENT_NAME AS AGENT_INFO;
SELECT 'Test with: SELECT SNOWFLAKE.CORTEX.COMPLETE(''' || $AGENT_NAME || ''', [...])' AS TEST_COMMAND;
