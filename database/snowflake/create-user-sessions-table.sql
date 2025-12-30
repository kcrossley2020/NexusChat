-- ============================================================================
-- USER_SESSIONS Table Creation
-- ============================================================================
-- This script creates the USER_SESSIONS table for session management
-- including session tracking, revocation, and concurrent session limiting
-- ============================================================================
-- Created: 2025-12-16
-- Purpose: Authentication & Authorization improvements
-- ============================================================================

USE DATABASE AGENTNEXUS_DB;
USE SCHEMA AUTH_SCHEMA;

-- ============================================================================
-- Create USER_SESSIONS table
-- ============================================================================

CREATE TABLE IF NOT EXISTS USER_SESSIONS (
    SESSION_ID VARCHAR(36) PRIMARY KEY,
    USER_ID VARCHAR(36) NOT NULL,
    EMAIL VARCHAR(255) NOT NULL,
    IP_ADDRESS VARCHAR(45),  -- Supports IPv6 addresses
    USER_AGENT VARCHAR(500),
    DEVICE_FINGERPRINT VARCHAR(255),
    REFRESH_TOKEN_JTI VARCHAR(36),  -- Current refresh token ID for rotation
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    EXPIRES_AT TIMESTAMP_NTZ NOT NULL,
    LAST_ACTIVITY TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    IS_ACTIVE BOOLEAN DEFAULT TRUE,
    REVOKED_AT TIMESTAMP_NTZ,
    REVOKED_REASON VARCHAR(255),

    -- Foreign key to USER_PROFILES
    CONSTRAINT fk_user_sessions_user_id
        FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID)
);

-- ============================================================================
-- Create SECURITY_AUDIT_LOG table for suspicious activity tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS SECURITY_AUDIT_LOG (
    AUDIT_ID VARCHAR(36) PRIMARY KEY,
    USER_ID VARCHAR(36),
    SESSION_ID VARCHAR(36),
    ACTIVITY_TYPE VARCHAR(100) NOT NULL,
    DETAILS VARCHAR(2000),
    IP_ADDRESS VARCHAR(45),
    USER_AGENT VARCHAR(500),
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    SEVERITY VARCHAR(20) DEFAULT 'INFO',  -- INFO, WARNING, CRITICAL

    -- Foreign key to USER_PROFILES (optional - may be null for anonymous activity)
    CONSTRAINT fk_security_audit_user_id
        FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID)
);

-- Index for security audit queries
CREATE INDEX IF NOT EXISTS idx_security_audit_user_id
    ON SECURITY_AUDIT_LOG (USER_ID);

CREATE INDEX IF NOT EXISTS idx_security_audit_activity_type
    ON SECURITY_AUDIT_LOG (ACTIVITY_TYPE, CREATED_AT);

CREATE INDEX IF NOT EXISTS idx_security_audit_severity
    ON SECURITY_AUDIT_LOG (SEVERITY, CREATED_AT);

-- ============================================================================
-- Create API_KEYS table for service-to-service authentication
-- ============================================================================

CREATE TABLE IF NOT EXISTS API_KEYS (
    KEY_ID VARCHAR(36) PRIMARY KEY,
    USER_ID VARCHAR(36) NOT NULL,
    NAME VARCHAR(100) NOT NULL,
    DESCRIPTION VARCHAR(500),
    KEY_HASH VARCHAR(64) NOT NULL,  -- SHA-256 hash of the key
    KEY_PREFIX VARCHAR(20),  -- First chars for identification (e.g., "vnx_abc123")
    SCOPES VARCHAR(2000),  -- Comma-separated list of scopes
    EXPIRES_AT TIMESTAMP_NTZ,  -- NULL = never expires
    LAST_USED_AT TIMESTAMP_NTZ,
    USE_COUNT INTEGER DEFAULT 0,
    IS_ACTIVE BOOLEAN DEFAULT TRUE,
    REVOKED_AT TIMESTAMP_NTZ,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),

    -- Foreign key to USER_PROFILES
    CONSTRAINT fk_api_keys_user_id
        FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID)
);

-- Index for API key validation (lookup by hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash
    ON API_KEYS (KEY_HASH);

-- Index for user's keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id
    ON API_KEYS (USER_ID, IS_ACTIVE);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON API_KEYS TO ROLE AGENTNEXUS_AUTH_WRITER;
GRANT SELECT ON API_KEYS TO ROLE AGENTNEXUS_AUTH_READER;

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

-- Index for looking up sessions by user
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON USER_SESSIONS (USER_ID);

-- Index for looking up active sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_active
    ON USER_SESSIONS (USER_ID, IS_ACTIVE, EXPIRES_AT);

-- Index for session validation
CREATE INDEX IF NOT EXISTS idx_user_sessions_validation
    ON USER_SESSIONS (SESSION_ID, IS_ACTIVE, EXPIRES_AT);

-- ============================================================================
-- Grant permissions to application role
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON USER_SESSIONS TO ROLE AGENTNEXUS_AUTH_WRITER;
GRANT SELECT ON USER_SESSIONS TO ROLE AGENTNEXUS_AUTH_READER;

-- ============================================================================
-- Create stored procedure for cleaning expired sessions
-- ============================================================================

CREATE OR REPLACE PROCEDURE CLEANUP_EXPIRED_SESSIONS()
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
BEGIN
    -- Mark expired sessions as inactive
    UPDATE USER_SESSIONS
    SET
        IS_ACTIVE = FALSE,
        REVOKED_AT = CURRENT_TIMESTAMP(),
        REVOKED_REASON = 'Session expired'
    WHERE
        IS_ACTIVE = TRUE
        AND EXPIRES_AT < CURRENT_TIMESTAMP();

    -- Delete sessions older than 90 days (retention policy)
    DELETE FROM USER_SESSIONS
    WHERE CREATED_AT < DATEADD(day, -90, CURRENT_TIMESTAMP());

    RETURN 'Session cleanup completed successfully';
END;
$$;

-- Grant execute permission
GRANT USAGE ON PROCEDURE CLEANUP_EXPIRED_SESSIONS() TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- Create task for automatic session cleanup (runs daily)
-- ============================================================================

CREATE OR REPLACE TASK DAILY_SESSION_CLEANUP
    WAREHOUSE = COMPUTE_WH
    SCHEDULE = 'USING CRON 0 2 * * * UTC'  -- Run at 2 AM UTC daily
AS
    CALL CLEANUP_EXPIRED_SESSIONS();

-- Note: Task needs to be resumed manually after creation:
-- ALTER TASK DAILY_SESSION_CLEANUP RESUME;

-- ============================================================================
-- FILE_RECORDS Table for file metadata storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS FILE_RECORDS (
    FILE_ID VARCHAR(36) PRIMARY KEY,
    OWNER_ID VARCHAR(36) NOT NULL,
    ORGANIZATION_ID VARCHAR(36),
    FILENAME VARCHAR(500) NOT NULL,
    CONTENT_TYPE VARCHAR(100),
    SIZE_BYTES BIGINT,
    BLOB_PATH VARCHAR(1000) NOT NULL,  -- Path in Azure Blob Storage
    DESCRIPTION VARCHAR(2000),
    TAGS VARCHAR(1000),  -- Comma-separated tags for search
    IS_DELETED BOOLEAN DEFAULT FALSE,  -- Soft delete flag
    DELETED_AT TIMESTAMP_NTZ,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),

    -- Foreign key to USER_PROFILES
    CONSTRAINT fk_file_records_owner_id
        FOREIGN KEY (OWNER_ID) REFERENCES USER_PROFILES(USER_ID)
);

-- Indexes for FILE_RECORDS
CREATE INDEX IF NOT EXISTS idx_file_records_owner
    ON FILE_RECORDS (OWNER_ID, IS_DELETED);

CREATE INDEX IF NOT EXISTS idx_file_records_org
    ON FILE_RECORDS (ORGANIZATION_ID, IS_DELETED);

CREATE INDEX IF NOT EXISTS idx_file_records_created
    ON FILE_RECORDS (CREATED_AT DESC);

-- ============================================================================
-- FILE_PERMISSIONS Table for file sharing and access control
-- ============================================================================

CREATE TABLE IF NOT EXISTS FILE_PERMISSIONS (
    PERMISSION_ID VARCHAR(36) PRIMARY KEY,
    FILE_ID VARCHAR(36) NOT NULL,
    SHARE_TYPE VARCHAR(20) NOT NULL,  -- 'user', 'org', 'link'
    TARGET_ID VARCHAR(36),  -- User ID or Org ID (null for link shares)
    PERMISSION_LEVEL VARCHAR(20) NOT NULL,  -- 'view', 'edit', 'admin'
    CREATED_BY VARCHAR(36) NOT NULL,
    EXPIRES_AT TIMESTAMP_NTZ,  -- NULL = never expires
    SHARE_TOKEN VARCHAR(32),  -- For link shares only
    PASSWORD_HASH VARCHAR(64),  -- For password-protected link shares
    ACCESS_COUNT INTEGER DEFAULT 0,  -- Track how many times accessed
    LAST_ACCESSED_AT TIMESTAMP_NTZ,
    IS_ACTIVE BOOLEAN DEFAULT TRUE,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),

    -- Foreign key to FILE_RECORDS
    CONSTRAINT fk_file_permissions_file_id
        FOREIGN KEY (FILE_ID) REFERENCES FILE_RECORDS(FILE_ID),

    -- Foreign key to USER_PROFILES (creator)
    CONSTRAINT fk_file_permissions_created_by
        FOREIGN KEY (CREATED_BY) REFERENCES USER_PROFILES(USER_ID)
);

-- Indexes for FILE_PERMISSIONS
CREATE INDEX IF NOT EXISTS idx_file_permissions_file
    ON FILE_PERMISSIONS (FILE_ID, IS_ACTIVE);

CREATE INDEX IF NOT EXISTS idx_file_permissions_user
    ON FILE_PERMISSIONS (TARGET_ID, SHARE_TYPE, IS_ACTIVE)
    WHERE SHARE_TYPE = 'user';

CREATE INDEX IF NOT EXISTS idx_file_permissions_org
    ON FILE_PERMISSIONS (TARGET_ID, SHARE_TYPE, IS_ACTIVE)
    WHERE SHARE_TYPE = 'org';

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_permissions_share_token
    ON FILE_PERMISSIONS (SHARE_TOKEN)
    WHERE SHARE_TOKEN IS NOT NULL;

-- Grant permissions for FILE tables
GRANT SELECT, INSERT, UPDATE, DELETE ON FILE_RECORDS TO ROLE AGENTNEXUS_AUTH_WRITER;
GRANT SELECT ON FILE_RECORDS TO ROLE AGENTNEXUS_AUTH_READER;

GRANT SELECT, INSERT, UPDATE, DELETE ON FILE_PERMISSIONS TO ROLE AGENTNEXUS_AUTH_WRITER;
GRANT SELECT ON FILE_PERMISSIONS TO ROLE AGENTNEXUS_AUTH_READER;

-- ============================================================================
-- Stored procedure for cleaning expired file permissions
-- ============================================================================

CREATE OR REPLACE PROCEDURE CLEANUP_EXPIRED_FILE_PERMISSIONS()
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
BEGIN
    -- Deactivate expired permissions
    UPDATE FILE_PERMISSIONS
    SET
        IS_ACTIVE = FALSE,
        UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE
        IS_ACTIVE = TRUE
        AND EXPIRES_AT IS NOT NULL
        AND EXPIRES_AT < CURRENT_TIMESTAMP();

    RETURN 'File permission cleanup completed successfully';
END;
$$;

GRANT USAGE ON PROCEDURE CLEANUP_EXPIRED_FILE_PERMISSIONS() TO ROLE AGENTNEXUS_AUTH_WRITER;

-- ============================================================================
-- Verification queries
-- ============================================================================

-- Verify table was created:
-- DESCRIBE TABLE USER_SESSIONS;

-- Verify indexes:
-- SHOW INDEXES ON USER_SESSIONS;

-- Check active sessions for a user:
-- SELECT * FROM USER_SESSIONS
-- WHERE USER_ID = 'user-id-here' AND IS_ACTIVE = TRUE AND EXPIRES_AT > CURRENT_TIMESTAMP();

-- Count active sessions per user:
-- SELECT USER_ID, EMAIL, COUNT(*) as active_session_count
-- FROM USER_SESSIONS
-- WHERE IS_ACTIVE = TRUE AND EXPIRES_AT > CURRENT_TIMESTAMP()
-- GROUP BY USER_ID, EMAIL;
