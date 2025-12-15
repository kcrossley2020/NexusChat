/*
 * 07-external-stages-azure.sql
 *
 * Creates Snowflake External Stages connected to Azure Blob Storage
 *
 * Purpose:
 *   - Create Azure Storage Integration (account-level, run once)
 *   - Create external stages for each data type (claims, remittances, etc.)
 *   - Create file formats for EDI and JSON data
 *   - Create ingestion tables for staged data
 *   - Create Snowpipes for automatic ingestion
 *
 * Prerequisites:
 *   - Azure Storage Account created (e.g., videxahcsdata)
 *   - Azure containers created: hcs-00001, hcs-00002, etc.
 *   - Each container has directories: claims/, remittances/, encounters/, patients/, medications/
 *   - Organization exists in VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
 *
 * Azure Setup Required:
 *   1. After creating storage integration, run DESCRIBE INTEGRATION
 *   2. Navigate to AZURE_CONSENT_URL and grant admin consent
 *   3. In Azure Portal > Storage Account > Access Control (IAM)
 *   4. Add role assignment: "Storage Blob Data Reader" to Snowflake app
 *
 * Location: C:\videxa-repos\NexusChat\snowflake-setup\07-external-stages-azure.sql
 * Created: December 2025
 * For: NexusChat - Azure Storage Integration
 */

-- ============================================================================
-- PART A: STORAGE INTEGRATION (RUN ONCE PER SNOWFLAKE ACCOUNT)
-- ============================================================================
-- Requires ACCOUNTADMIN role

USE ROLE ACCOUNTADMIN;

-- Set Azure configuration (MODIFY THESE)
SET AZURE_STORAGE_ACCOUNT = 'videxahcsdata';  -- Your Azure storage account name
SET AZURE_TENANT_ID = '<YOUR_AZURE_TENANT_ID>';  -- From Azure Portal > Azure AD

-- Create storage integration for all HCS containers
CREATE STORAGE INTEGRATION IF NOT EXISTS AZURE_HCS_STORAGE_INTEGRATION
    TYPE = EXTERNAL_STAGE
    STORAGE_PROVIDER = 'AZURE'
    ENABLED = TRUE
    AZURE_TENANT_ID = $AZURE_TENANT_ID
    STORAGE_ALLOWED_LOCATIONS = (
        'azure://videxahcsdata.blob.core.windows.net/hcs-00001/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00002/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00003/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00004/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00005/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00006/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00007/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00008/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00009/',
        'azure://videxahcsdata.blob.core.windows.net/hcs-00010/'
    )
    COMMENT = 'Storage integration for HCS organization Azure containers';

-- Get consent URL (IMPORTANT - navigate to this URL)
DESCRIBE INTEGRATION AZURE_HCS_STORAGE_INTEGRATION;

/*
 * AFTER RUNNING DESCRIBE:
 * 1. Find AZURE_CONSENT_URL in results
 * 2. Open URL in browser and grant admin consent
 * 3. Find AZURE_MULTI_TENANT_APP_NAME in results
 * 4. In Azure Portal > Storage Account > Access Control (IAM):
 *    - Add role assignment
 *    - Role: "Storage Blob Data Reader"
 *    - Assign to: The Snowflake application name from step 3
 */

-- Grant usage to SYSADMIN for creating stages
GRANT USAGE ON INTEGRATION AZURE_HCS_STORAGE_INTEGRATION TO ROLE SYSADMIN;

-- Verify integration
SHOW INTEGRATIONS LIKE 'AZURE_HCS%';

-- ============================================================================
-- PART B: EXTERNAL STAGES PER ORGANIZATION
-- ============================================================================

-- CONFIGURATION - MODIFY FOR EACH ORGANIZATION
SET ORG_ID = 'HCS0001';
SET CONTAINER_NAME = 'hcs-00001';  -- Maps to: hcs-{ORG_ID padded}
SET STORAGE_ACCOUNT = 'videxahcsdata';

-- Get org configuration
SET DB_NAME = (
    SELECT DATABASE_NAME
    FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    WHERE ORG_ID = $ORG_ID
);

SET ROLE_NAME = (
    SELECT ROLE_NAME
    FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
    WHERE ORG_ID = $ORG_ID
);

SET RO_ROLE_NAME = CONCAT('HCS_', LPAD(SUBSTR($ORG_ID, 4), 5, '0'), '_CLAIMS_RO');
SET SCHEMA_NAME = 'EXTERNAL_STAGES';
SET BASE_URL = CONCAT('azure://', $STORAGE_ACCOUNT, '.blob.core.windows.net/', $CONTAINER_NAME, '/');

-- Display configuration
SELECT
    $ORG_ID AS ORG_ID,
    $DB_NAME AS DATABASE_NAME,
    $CONTAINER_NAME AS AZURE_CONTAINER,
    $BASE_URL AS BASE_URL;

-- ============================================================================
-- STEP 1: Create Schema
-- ============================================================================
USE ROLE SYSADMIN;

CREATE SCHEMA IF NOT EXISTS IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    COMMENT = 'External stages for Azure Storage integration';

GRANT USAGE ON SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    TO ROLE IDENTIFIER($ROLE_NAME);

GRANT USAGE ON SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    TO ROLE IDENTIFIER($RO_ROLE_NAME);

USE DATABASE IDENTIFIER($DB_NAME);
USE SCHEMA IDENTIFIER($SCHEMA_NAME);

-- ============================================================================
-- STEP 2: Create File Formats
-- ============================================================================

-- EDI format for X12 files (837, 835, 997, 270, 271)
CREATE FILE FORMAT IF NOT EXISTS EDI_FORMAT
    TYPE = 'CSV'
    RECORD_DELIMITER = '~'
    FIELD_DELIMITER = '*'
    SKIP_HEADER = 0
    FIELD_OPTIONALLY_ENCLOSED_BY = NONE
    TRIM_SPACE = FALSE
    ERROR_ON_COLUMN_COUNT_MISMATCH = FALSE
    ESCAPE = NONE
    ESCAPE_UNENCLOSED_FIELD = NONE
    COMMENT = 'Format for ANSI X12 EDI files (837, 835, 997, etc.)';

-- JSON format for FHIR resources
CREATE FILE FORMAT IF NOT EXISTS JSON_FORMAT
    TYPE = 'JSON'
    STRIP_OUTER_ARRAY = TRUE
    STRIP_NULL_VALUES = FALSE
    IGNORE_UTF8_ERRORS = FALSE
    COMMENT = 'Format for FHIR R4 JSON resources';

-- CSV format for tabular data
CREATE FILE FORMAT IF NOT EXISTS CSV_FORMAT
    TYPE = 'CSV'
    FIELD_DELIMITER = ','
    SKIP_HEADER = 1
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    TRIM_SPACE = TRUE
    NULL_IF = ('', 'NULL', 'null')
    COMMENT = 'Format for CSV data files';

-- Grant format usage
GRANT USAGE ON ALL FILE FORMATS IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    TO ROLE IDENTIFIER($ROLE_NAME);

GRANT USAGE ON ALL FILE FORMATS IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME)
    TO ROLE IDENTIFIER($RO_ROLE_NAME);

-- ============================================================================
-- STEP 3: Create External Stages
-- ============================================================================

-- Claims Stage (837 EDI files)
CREATE STAGE IF NOT EXISTS CLAIMS_STAGE
    STORAGE_INTEGRATION = AZURE_HCS_STORAGE_INTEGRATION
    URL = 'azure://videxahcsdata.blob.core.windows.net/hcs-00001/claims/'
    FILE_FORMAT = EDI_FORMAT
    DIRECTORY = (ENABLE = TRUE AUTO_REFRESH = TRUE)
    COMMENT = '837 Professional/Institutional claim files';

-- Remittances Stage (835 EDI files)
CREATE STAGE IF NOT EXISTS REMITTANCES_STAGE
    STORAGE_INTEGRATION = AZURE_HCS_STORAGE_INTEGRATION
    URL = 'azure://videxahcsdata.blob.core.windows.net/hcs-00001/remittances/'
    FILE_FORMAT = EDI_FORMAT
    DIRECTORY = (ENABLE = TRUE AUTO_REFRESH = TRUE)
    COMMENT = '835 Remittance/payment advice files';

-- Eligibility Stage (270/271 EDI files)
CREATE STAGE IF NOT EXISTS ELIGIBILITY_STAGE
    STORAGE_INTEGRATION = AZURE_HCS_STORAGE_INTEGRATION
    URL = 'azure://videxahcsdata.blob.core.windows.net/hcs-00001/eligibility/'
    FILE_FORMAT = EDI_FORMAT
    DIRECTORY = (ENABLE = TRUE AUTO_REFRESH = TRUE)
    COMMENT = '270/271 Eligibility inquiry/response files';

-- Acknowledgments Stage (997/999 EDI files)
CREATE STAGE IF NOT EXISTS ACKNOWLEDGMENTS_STAGE
    STORAGE_INTEGRATION = AZURE_HCS_STORAGE_INTEGRATION
    URL = 'azure://videxahcsdata.blob.core.windows.net/hcs-00001/acknowledgments/'
    FILE_FORMAT = EDI_FORMAT
    DIRECTORY = (ENABLE = TRUE AUTO_REFRESH = TRUE)
    COMMENT = '997/999 Functional acknowledgment files';

-- Patients Stage (FHIR Patient resources)
CREATE STAGE IF NOT EXISTS PATIENTS_STAGE
    STORAGE_INTEGRATION = AZURE_HCS_STORAGE_INTEGRATION
    URL = 'azure://videxahcsdata.blob.core.windows.net/hcs-00001/patients/'
    FILE_FORMAT = JSON_FORMAT
    DIRECTORY = (ENABLE = TRUE AUTO_REFRESH = TRUE)
    COMMENT = 'FHIR Patient resources (JSON)';

-- Encounters Stage (FHIR Encounter resources)
CREATE STAGE IF NOT EXISTS ENCOUNTERS_STAGE
    STORAGE_INTEGRATION = AZURE_HCS_STORAGE_INTEGRATION
    URL = 'azure://videxahcsdata.blob.core.windows.net/hcs-00001/encounters/'
    FILE_FORMAT = JSON_FORMAT
    DIRECTORY = (ENABLE = TRUE AUTO_REFRESH = TRUE)
    COMMENT = 'FHIR Encounter resources (JSON)';

-- Medications Stage (FHIR MedicationRequest resources)
CREATE STAGE IF NOT EXISTS MEDICATIONS_STAGE
    STORAGE_INTEGRATION = AZURE_HCS_STORAGE_INTEGRATION
    URL = 'azure://videxahcsdata.blob.core.windows.net/hcs-00001/medications/'
    FILE_FORMAT = JSON_FORMAT
    DIRECTORY = (ENABLE = TRUE AUTO_REFRESH = TRUE)
    COMMENT = 'FHIR MedicationRequest resources (JSON)';

-- ============================================================================
-- STEP 4: Grant Stage Permissions
-- ============================================================================

-- RO Role: READ only
GRANT READ ON STAGE CLAIMS_STAGE TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT READ ON STAGE REMITTANCES_STAGE TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT READ ON STAGE ELIGIBILITY_STAGE TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT READ ON STAGE ACKNOWLEDGMENTS_STAGE TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT READ ON STAGE PATIENTS_STAGE TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT READ ON STAGE ENCOUNTERS_STAGE TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT READ ON STAGE MEDICATIONS_STAGE TO ROLE IDENTIFIER($RO_ROLE_NAME);

-- Main Role: READ + WRITE
GRANT READ, WRITE ON STAGE CLAIMS_STAGE TO ROLE IDENTIFIER($ROLE_NAME);
GRANT READ, WRITE ON STAGE REMITTANCES_STAGE TO ROLE IDENTIFIER($ROLE_NAME);
GRANT READ, WRITE ON STAGE ELIGIBILITY_STAGE TO ROLE IDENTIFIER($ROLE_NAME);
GRANT READ, WRITE ON STAGE ACKNOWLEDGMENTS_STAGE TO ROLE IDENTIFIER($ROLE_NAME);
GRANT READ, WRITE ON STAGE PATIENTS_STAGE TO ROLE IDENTIFIER($ROLE_NAME);
GRANT READ, WRITE ON STAGE ENCOUNTERS_STAGE TO ROLE IDENTIFIER($ROLE_NAME);
GRANT READ, WRITE ON STAGE MEDICATIONS_STAGE TO ROLE IDENTIFIER($ROLE_NAME);

-- ============================================================================
-- STEP 5: Create Ingestion Tables
-- ============================================================================

-- Raw EDI files staging table
CREATE TABLE IF NOT EXISTS RAW_EDI_FILES (
    FILE_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    FILE_NAME VARCHAR(500) NOT NULL,
    FILE_PATH VARCHAR(1000),
    FILE_TYPE VARCHAR(10) COMMENT '837, 835, 997, 270, 271, 999',
    RAW_CONTENT VARIANT,
    FILE_SIZE INTEGER,
    LOADED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PROCESSED_AT TIMESTAMP_NTZ,
    STATUS VARCHAR(20) DEFAULT 'PENDING',
    ERROR_MESSAGE TEXT,
    METADATA VARIANT
) COMMENT = 'Staging table for raw EDI files from Azure';

-- Parsed Claims (from 837)
CREATE TABLE IF NOT EXISTS PARSED_CLAIMS (
    CLAIM_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    SOURCE_FILE_ID VARCHAR(36),
    CLAIM_NUMBER VARCHAR(50) NOT NULL,
    CLAIM_FREQUENCY_CODE VARCHAR(2),

    -- Patient
    PATIENT_FIRST_NAME VARCHAR(100),
    PATIENT_LAST_NAME VARCHAR(100),
    PATIENT_DOB DATE,
    PATIENT_MEMBER_ID VARCHAR(50),

    -- Provider
    BILLING_PROVIDER_NPI VARCHAR(10),
    BILLING_PROVIDER_NAME VARCHAR(200),
    RENDERING_PROVIDER_NPI VARCHAR(10),

    -- Payer
    PAYER_ID VARCHAR(20),
    PAYER_NAME VARCHAR(200),

    -- Clinical
    SERVICE_DATE DATE,
    PRINCIPAL_DIAGNOSIS VARCHAR(20),
    DIAGNOSIS_CODES ARRAY,
    PROCEDURE_CODES ARRAY,

    -- Financial
    BILLED_AMOUNT DECIMAL(12,2),
    CLAIM_STATUS VARCHAR(20),

    -- Metadata
    SERVICE_LINES VARIANT,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    RAW_SEGMENTS VARIANT
) COMMENT = 'Parsed claim data from 837 EDI files';

-- Parsed Remittances (from 835)
CREATE TABLE IF NOT EXISTS PARSED_REMITTANCES (
    REMITTANCE_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    SOURCE_FILE_ID VARCHAR(36),
    CLAIM_NUMBER VARCHAR(50),

    -- Payment
    PAYMENT_DATE DATE,
    PAYMENT_METHOD VARCHAR(20),
    PAYMENT_AMOUNT DECIMAL(12,2),
    CHECK_NUMBER VARCHAR(50),

    -- Amounts
    BILLED_AMOUNT DECIMAL(12,2),
    PAID_AMOUNT DECIMAL(12,2),
    ALLOWED_AMOUNT DECIMAL(12,2),
    PATIENT_RESPONSIBILITY DECIMAL(12,2),

    -- Payer/Provider
    PAYER_ID VARCHAR(20),
    PAYER_NAME VARCHAR(200),
    PAYEE_NPI VARCHAR(10),

    -- Details
    ADJUSTMENTS VARIANT,
    SERVICE_LINES VARIANT,

    -- Metadata
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    RAW_SEGMENTS VARIANT
) COMMENT = 'Parsed remittance data from 835 EDI files';

-- FHIR Resources
CREATE TABLE IF NOT EXISTS FHIR_RESOURCES (
    RESOURCE_ID VARCHAR(100),
    RESOURCE_TYPE VARCHAR(50) NOT NULL,
    VERSION_ID INTEGER DEFAULT 1,
    RESOURCE VARIANT NOT NULL,
    IDENTIFIER VARCHAR(200),
    STATUS VARCHAR(50),
    SUBJECT_REFERENCE VARCHAR(200),
    SOURCE_FILE VARCHAR(500),
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (RESOURCE_ID, RESOURCE_TYPE)
) COMMENT = 'FHIR R4 resources (Patient, Encounter, Claim, Coverage, etc.)';

-- EDI Acknowledgments
CREATE TABLE IF NOT EXISTS EDI_ACKNOWLEDGMENTS (
    ACK_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    SOURCE_FILE_ID VARCHAR(36),
    ORIGINAL_CONTROL_NUMBER VARCHAR(20),
    ORIGINAL_FILE_TYPE VARCHAR(10),
    ACK_TYPE VARCHAR(10),
    ACK_STATUS VARCHAR(20),
    ERROR_CODES ARRAY,
    RAW_CONTENT VARIANT,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
) COMMENT = 'EDI acknowledgment tracking (997/999)';

-- Ingestion Log
CREATE TABLE IF NOT EXISTS INGESTION_LOG (
    LOG_ID VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
    STAGE_NAME VARCHAR(100),
    FILE_NAME VARCHAR(500),
    FILE_TYPE VARCHAR(10),
    OPERATION VARCHAR(50),
    RECORDS_LOADED INTEGER DEFAULT 0,
    RECORDS_PARSED INTEGER DEFAULT 0,
    RECORDS_FAILED INTEGER DEFAULT 0,
    START_TIME TIMESTAMP_NTZ,
    END_TIME TIMESTAMP_NTZ,
    DURATION_MS INTEGER,
    STATUS VARCHAR(20),
    ERROR_MESSAGE TEXT,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
) COMMENT = 'Audit log of data ingestion operations';

-- ============================================================================
-- STEP 6: Grant Table Permissions
-- ============================================================================

-- RO Role: SELECT only
GRANT SELECT ON TABLE RAW_EDI_FILES TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT SELECT ON TABLE PARSED_CLAIMS TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT SELECT ON TABLE PARSED_REMITTANCES TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT SELECT ON TABLE FHIR_RESOURCES TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT SELECT ON TABLE EDI_ACKNOWLEDGMENTS TO ROLE IDENTIFIER($RO_ROLE_NAME);
GRANT SELECT ON TABLE INGESTION_LOG TO ROLE IDENTIFIER($RO_ROLE_NAME);

-- Main Role: Full DML
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE RAW_EDI_FILES TO ROLE IDENTIFIER($ROLE_NAME);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE PARSED_CLAIMS TO ROLE IDENTIFIER($ROLE_NAME);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE PARSED_REMITTANCES TO ROLE IDENTIFIER($ROLE_NAME);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE FHIR_RESOURCES TO ROLE IDENTIFIER($ROLE_NAME);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE EDI_ACKNOWLEDGMENTS TO ROLE IDENTIFIER($ROLE_NAME);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE INGESTION_LOG TO ROLE IDENTIFIER($ROLE_NAME);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SHOW STAGES IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME);
SHOW TABLES IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME);
SHOW FILE FORMATS IN SCHEMA IDENTIFIER($DB_NAME || '.' || $SCHEMA_NAME);

-- Test listing files (empty initially)
-- LIST @CLAIMS_STAGE;

SELECT 'External stages setup complete for ' || $ORG_ID AS STATUS;
