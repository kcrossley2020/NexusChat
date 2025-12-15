-- ============================================================================
-- MIGRATE SYSTEM ADMINISTRATOR EMAIL
-- ============================================================================
-- Changes system admin email from system.admin@videxa.com to kcrossley@videxa.co
-- Run this script manually in Snowflake
-- ============================================================================

USE DATABASE AGENTNEXUS_DB;
USE SCHEMA AUTH_SCHEMA;

-- ============================================================================
-- STEP 1: Verify Current System Admin
-- ============================================================================

SELECT * FROM USER_PROFILES
WHERE EMAIL = 'system.admin@videxa.com' OR ACCOUNT_TYPE = 'system_admin';

-- Expected: Should see system.admin@videxa.com

-- ============================================================================
-- STEP 2: Delete Old System Admin
-- ============================================================================

DELETE FROM USER_PROFILES
WHERE EMAIL = 'system.admin@videxa.com' AND ACCOUNT_TYPE = 'system_admin';

-- Verify deletion
SELECT * FROM USER_PROFILES WHERE EMAIL = 'system.admin@videxa.com';
-- Expected: No rows

-- ============================================================================
-- STEP 3: Create New System Admin with kcrossley@videxa.co
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
    '$2b$12$3ezf241P3443uf6j4eN13OqoW2OVmE5.rY.obTvQkruIct.50JCnO',
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
-- STEP 4: Verify New System Admin
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
-- STEP 5: Verify Login Events
-- ============================================================================

-- Check if any old login events exist
SELECT COUNT(*) FROM USER_LOGIN_EVENTS
WHERE EMAIL = 'system.admin@videxa.com';

-- Optional: Update login events to new email (preserves audit trail)
-- UPDATE USER_LOGIN_EVENTS
-- SET EMAIL = 'kcrossley@videxa.co'
-- WHERE EMAIL = 'system.admin@videxa.com';

-- ============================================================================
-- COMPLETE
-- ============================================================================

-- System admin email has been migrated
-- Old email: system.admin@videxa.com (deleted)
-- New email: kcrossley@videxa.co (active)
-- Password remains: 8a093b79-bee6-4d70-8a98-2bc7657c8e7f
