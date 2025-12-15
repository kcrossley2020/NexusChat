# Test Cleanup Tasks

## Overview
This document tracks test users and resources that need manual cleanup due to Snowflake permission limitations during E2E testing.

## Issue Description
The Snowflake service account used by the backend lacks DELETE privileges on:
- `USER_PROFILES` table
- `USER_LOGIN_EVENTS` table

This prevents automated test cleanup, requiring manual intervention.

## Test Users Requiring Cleanup

### Created During TC-0.1 Testing (2025-11-04)
| Email | User ID | Created At | Status |
|-------|---------|------------|--------|
| `e2e-weak-1762266625587@example.com` | `34661e78-fa24-42a7-b8db-fce4e23afb48` | 2025-11-04T14:30:26 | Needs deletion |
| `e2e-test-1762266621881@example.com` | `ccb80dae-126e-4aa1-8a1e-705dc621a9e4` | 2025-11-04T14:30:22 | Needs deletion |
| `test@example.com` | `99838c53-2cb7-4055-b60e-0e88f41fc74f` | 2025-11-04T14:29:19 | Needs deletion |

### Additional Test Users
Test users follow the pattern: `e2e-test-{timestamp}@example.com`

All test users have:
- `REGISTRATION_METHOD = 'testing'`
- `EMAIL_VERIFIED = true`
- `ACCOUNT_TYPE = 'trial'`

## Manual Cleanup SQL

### Query to List All Test Users
```sql
SELECT
    USER_ID,
    EMAIL,
    ORGANIZATION_NAME,
    ACCOUNT_TYPE,
    EMAIL_VERIFIED,
    CREATED_AT,
    REGISTRATION_METHOD
FROM USER_PROFILES
WHERE REGISTRATION_METHOD = 'testing'
ORDER BY CREATED_AT DESC;
```

### Delete Test Users (Run with Admin Privileges)
```sql
-- Delete login events first
DELETE FROM USER_LOGIN_EVENTS
WHERE EMAIL IN (
    SELECT EMAIL FROM USER_PROFILES
    WHERE REGISTRATION_METHOD = 'testing'
);

-- Delete user profiles
DELETE FROM USER_PROFILES
WHERE REGISTRATION_METHOD = 'testing';
```

### Delete Specific Test User
```sql
-- Replace with actual email
DELETE FROM USER_LOGIN_EVENTS WHERE EMAIL = 'e2e-test-1762266621881@example.com';
DELETE FROM USER_PROFILES WHERE EMAIL = 'e2e-test-1762266621881@example.com';
```

## Long-Term Solution

### Option A: Grant DELETE Privileges (Recommended)
Grant DELETE permissions to the backend service account:
```sql
GRANT DELETE ON TABLE USER_PROFILES TO ROLE <backend_role>;
GRANT DELETE ON TABLE USER_LOGIN_EVENTS TO ROLE <backend_role>;
```

**Benefits:**
- Enables automated test cleanup
- Aligns with testing best practices
- Prevents test data accumulation

**Risks:**
- Service account can delete production users (mitigated by `REGISTRATION_METHOD` check in code)

### Option B: Create Dedicated Test Schema
Create separate schema for test data:
```sql
CREATE SCHEMA TESTING;
CREATE TABLE TESTING.USER_PROFILES AS SELECT * FROM USER_PROFILES WHERE 1=0;
CREATE TABLE TESTING.USER_LOGIN_EVENTS AS SELECT * FROM USER_LOGIN_EVENTS WHERE 1=0;

GRANT ALL ON SCHEMA TESTING TO ROLE <backend_role>;
```

**Benefits:**
- Complete isolation of test data
- No risk to production data
- Full control over test tables

**Risks:**
- Requires backend configuration changes
- May not catch schema differences between test/prod

### Option C: Soft Delete Pattern
Add `IS_DELETED` flag instead of physical deletion:
```sql
ALTER TABLE USER_PROFILES ADD COLUMN IS_DELETED BOOLEAN DEFAULT FALSE;
```

**Benefits:**
- No DELETE privilege required
- Audit trail preserved
- Reversible deletions

**Risks:**
- Requires query modifications throughout codebase
- Test users still consume storage

## Cleanup Frequency
- **During Development**: Clean up after each test session
- **In CI/CD**: Clean up before/after each test run
- **Weekly**: Review and purge all test users older than 7 days

## Automation Scripts
Location: `C:\videxa-repos\NexusChat\scripts\cleanup-test-users.sql`

## Notes
- All test users created by E2E tests have `REGISTRATION_METHOD = 'testing'` for easy identification
- Test users do not receive verification emails
- Test users have `EMAIL_VERIFIED = true` by default
- Test user email pattern: `e2e-test-{timestamp}@example.com`

## Last Updated
2025-11-04 by Claude Code

## Related Documentation
- [Session State](./SESSION-STATE-2025-11-04.md)
- [Test Cases](./test-cases.md)
- [E2E Testing Setup](./e2e-testing-setup.md)
