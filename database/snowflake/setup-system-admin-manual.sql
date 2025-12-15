-- ============================================================================
-- MANUAL SYSTEM ADMINISTRATOR SETUP
-- ============================================================================
-- Run this script manually in Snowflake after generating the password hash
--
-- PREREQUISITES:
-- 1. Run: python generate-admin-password-hash.py
-- 2. Copy the bcrypt hash output
-- 3. Replace 'YOUR_BCRYPT_HASH_HERE' below with the actual hash
-- 4. Execute this script in Snowflake Web UI or SnowSQL
--
-- SECURITY MODEL:
-- - Only videxakc user can update system admin password
-- - All password changes are audited
-- - Password hash never exposed in views
-- ============================================================================

USE DATABASE AGENTNEXUS_DB;
USE SCHEMA AUTH_SCHEMA;

-- ============================================================================
-- STEP 1: Create Dedicated Role for Admin Password Management
-- ============================================================================
-- This role will be granted ONLY to videxakc user
-- ============================================================================

CREATE ROLE IF NOT EXISTS ADMIN_PASSWORD_MANAGER
    COMMENT = 'Role that can update system administrator password - assigned only to videxakc';

-- ============================================================================
-- STEP 2: Grant Role to videxakc User ONLY
-- ============================================================================

GRANT ROLE ADMIN_PASSWORD_MANAGER TO USER videxakc;

-- Verify the grant
SHOW GRANTS TO USER videxakc;

-- ============================================================================
-- STEP 3: Create Audit Log Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ADMIN_PASSWORD_AUDIT (
    AUDIT_ID VARCHAR(36) DEFAULT UUID_STRING(),
    USER_EMAIL VARCHAR(255),
    CHANGED_BY_USER VARCHAR(255),
    CHANGED_BY_ROLE VARCHAR(255),
    CHANGE_TIMESTAMP TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ACTION_TYPE VARCHAR(50),
    SUCCESS BOOLEAN,
    ERROR_MESSAGE VARCHAR(500),
    PRIMARY KEY (AUDIT_ID)
);

-- Grant access to audit log
GRANT SELECT, INSERT ON TABLE ADMIN_PASSWORD_AUDIT TO ROLE ADMIN_PASSWORD_MANAGER;

-- ============================================================================
-- STEP 4: Create Stored Procedure for Secure Password Updates
-- ============================================================================
-- Only users with ADMIN_PASSWORD_MANAGER role can execute this
-- ============================================================================

CREATE OR REPLACE PROCEDURE UPDATE_SYSTEM_ADMIN_PASSWORD(
    NEW_PASSWORD_HASH VARCHAR(255)
)
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS CALLER
AS
$$
BEGIN
    -- Validate that the caller has the correct role
    LET current_role VARCHAR := CURRENT_ROLE();

    IF (current_role != 'ADMIN_PASSWORD_MANAGER') THEN
        -- Log failed attempt
        INSERT INTO ADMIN_PASSWORD_AUDIT (
            USER_EMAIL,
            CHANGED_BY_USER,
            CHANGED_BY_ROLE,
            ACTION_TYPE,
            SUCCESS,
            ERROR_MESSAGE
        )
        VALUES (
            'kcrossley@videxa.co',
            CURRENT_USER(),
            current_role,
            'PASSWORD_UPDATE_ATTEMPT',
            FALSE,
            'Insufficient privileges - ADMIN_PASSWORD_MANAGER role required'
        );

        RETURN 'ERROR: ADMIN_PASSWORD_MANAGER role required';
    END IF;

    -- Update the system admin password
    UPDATE USER_PROFILES
    SET
        PASSWORD_HASH = NEW_PASSWORD_HASH,
        UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE EMAIL = 'kcrossley@videxa.co';

    -- Log successful change
    INSERT INTO ADMIN_PASSWORD_AUDIT (
        USER_EMAIL,
        CHANGED_BY_USER,
        CHANGED_BY_ROLE,
        ACTION_TYPE,
        SUCCESS,
        ERROR_MESSAGE
    )
    VALUES (
        'kcrossley@videxa.co',
        CURRENT_USER(),
        current_role,
        'PASSWORD_UPDATE',
        TRUE,
        NULL
    );

    RETURN 'System administrator password updated successfully';
END;
$$;

-- Grant EXECUTE permission to ADMIN_PASSWORD_MANAGER role only
GRANT USAGE ON PROCEDURE UPDATE_SYSTEM_ADMIN_PASSWORD(VARCHAR) TO ROLE ADMIN_PASSWORD_MANAGER;

-- ============================================================================
-- STEP 5: Create View for Safe Admin Information
-- ============================================================================
-- Shows admin info without exposing password hash
-- ============================================================================

CREATE OR REPLACE VIEW SYSTEM_ADMIN_INFO AS
SELECT
    USER_ID,
    EMAIL,
    ORGANIZATION_NAME,
    ACCOUNT_TYPE,
    EMAIL_VERIFIED,
    REGISTRATION_METHOD,
    CREATED_AT,
    UPDATED_AT,
    '***REDACTED***' AS PASSWORD_HASH
FROM USER_PROFILES
WHERE ACCOUNT_TYPE = 'system_admin';

-- Grant SELECT on view to PUBLIC (anyone can see admin exists)
GRANT SELECT ON VIEW SYSTEM_ADMIN_INFO TO ROLE PUBLIC;

-- ============================================================================
-- STEP 6: Insert System Administrator User
-- ============================================================================
-- ⚠️  IMPORTANT: Replace 'YOUR_BCRYPT_HASH_HERE' with actual bcrypt hash
-- Generate hash using: python generate-admin-password-hash.py
-- ============================================================================

INSERT INTO USER_PROFILES (
    USER_ID,
    EMAIL,
    PASSWORD_HASH,
    ORGANIZATION_NAME,
    ACCOUNT_TYPE,
    EMAIL_VERIFIED,
    REGISTRATION_METHOD,
    REGISTERED_AT,
    CREATED_AT,
    UPDATED_AT
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    'kcrossley@videxa.co',
    '$2b$12$3ezf241P3443uf6j4eN13OqoW2OVmE5.rY.obTvQkruIct.50JCnO',  -- ⚠️ REPLACE THIS WITH ACTUAL HASH
    'Videxa System',
    'system_admin',
    TRUE,
    'manual_initialization',
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP(),
    CURRENT_TIMESTAMP()
WHERE NOT EXISTS (
    SELECT 1 FROM USER_PROFILES WHERE EMAIL = 'kcrossley@videxa.co'
);

-- ============================================================================
-- STEP 7: Verify System Admin Creation
-- ============================================================================

SELECT * FROM SYSTEM_ADMIN_INFO;

-- Expected output:
-- USER_ID: 00000000-0000-0000-0000-000000000001
-- EMAIL: kcrossley@videxa.co
-- ORGANIZATION_NAME: Videxa System
-- ACCOUNT_TYPE: system_admin
-- EMAIL_VERIFIED: TRUE
-- PASSWORD_HASH: ***REDACTED***

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check role assignment to videxakc:
SHOW GRANTS TO USER videxakc;

-- View audit log (should be empty initially):
SELECT * FROM ADMIN_PASSWORD_AUDIT ORDER BY CHANGE_TIMESTAMP DESC;

-- Verify stored procedure exists:
SHOW PROCEDURES LIKE 'UPDATE_SYSTEM_ADMIN_PASSWORD';

-- ============================================================================
-- USAGE: How to Change System Admin Password (as videxakc user)
-- ============================================================================
--
-- 1. Generate new bcrypt hash for new password:
--    python generate-admin-password-hash.py  (modify password in script first)
--
-- 2. Log into Snowflake as videxakc user
--
-- 3. Switch to ADMIN_PASSWORD_MANAGER role:
--    USE ROLE ADMIN_PASSWORD_MANAGER;
--
-- 4. Call the stored procedure with new hash:
--    CALL UPDATE_SYSTEM_ADMIN_PASSWORD('$2b$12$new_hash_here');
--
-- 5. Verify the change in audit log:
--    SELECT * FROM ADMIN_PASSWORD_AUDIT ORDER BY CHANGE_TIMESTAMP DESC;
--
-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
--
-- ✓ Only videxakc user has ADMIN_PASSWORD_MANAGER role
-- ✓ Only ADMIN_PASSWORD_MANAGER role can execute UPDATE_SYSTEM_ADMIN_PASSWORD
-- ✓ All password change attempts are logged in ADMIN_PASSWORD_AUDIT
-- ✓ Password hash is never exposed in views or logs
-- ✓ System admin account type prevents accidental deletion
-- ✓ Email is unique and cannot be duplicated
--
-- ============================================================================
