# System Administrator Password Management Guide

**Document Version**: 1.0
**Last Updated**: 2025-11-04
**Status**: ✅ Implemented and Tested

---

## Overview

This document describes the secure password management system for the NexusChat system administrator account. The system implements role-based access control (RBAC) where only the `videxakc` Snowflake user can update the system administrator password.

---

## System Administrator Account

### Account Details

| Property | Value |
|----------|-------|
| **Email** | kcrossley@videxa.co |
| **User ID** | 00000000-0000-0000-0000-000000000001 |
| **Account Type** | system_admin |
| **Initial Password** | 8a093b79-bee6-4d70-8a98-2bc7657c8e7f (GUID) |
| **Password Hash Algorithm** | bcrypt (12 rounds) |
| **Email Verified** | true (bypassed for system account) |
| **Registration Method** | manual_initialization |

### Authentication

The system administrator authenticates via the standard login endpoint:

```bash
POST http://localhost:3050/auth/login
Content-Type: application/json

{
  "email": "kcrossley@videxa.co",
  "password": "8a093b79-bee6-4d70-8a98-2bc7657c8e7f"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": "00000000-0000-0000-0000-000000000001",
  "expires_in": 86400
}
```

**JWT Token Payload:**
```json
{
  "user_id": "00000000-0000-0000-0000-000000000001",
  "email": "kcrossley@videxa.co",
  "email_verified": true,
  "account_type": "system_admin",
  "exp": 1730832017,
  "iat": 1730745617
}
```

---

## Security Architecture

### Role-Based Access Control

The password management system uses Snowflake RBAC to restrict password updates:

```
┌─────────────────────────────────────────────────────────────┐
│                    Snowflake RBAC Model                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐                                            │
│  │   videxakc   │  ← ONLY user with password update rights  │
│  │     User     │                                            │
│  └──────┬───────┘                                            │
│         │                                                     │
│         │ GRANT ROLE                                         │
│         ▼                                                     │
│  ┌──────────────────────────┐                                │
│  │ ADMIN_PASSWORD_MANAGER   │                                │
│  │         Role             │                                │
│  └──────────┬───────────────┘                                │
│             │                                                 │
│             │ EXECUTE PERMISSION                             │
│             ▼                                                 │
│  ┌──────────────────────────────────────┐                    │
│  │ UPDATE_SYSTEM_ADMIN_PASSWORD()       │                    │
│  │      Stored Procedure                │                    │
│  │                                      │                    │
│  │  - Validates caller role             │                    │
│  │  - Updates PASSWORD_HASH             │                    │
│  │  - Logs to ADMIN_PASSWORD_AUDIT      │                    │
│  └──────────────────────────────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Database Objects

#### 1. ADMIN_PASSWORD_MANAGER Role

**Purpose**: Dedicated role for system admin password management
**Granted To**: videxakc user ONLY
**Permissions**:
- EXECUTE on UPDATE_SYSTEM_ADMIN_PASSWORD stored procedure
- INSERT, SELECT on ADMIN_PASSWORD_AUDIT table

#### 2. UPDATE_SYSTEM_ADMIN_PASSWORD Stored Procedure

**Purpose**: Securely update system administrator password
**Signature**: `UPDATE_SYSTEM_ADMIN_PASSWORD(NEW_PASSWORD_HASH VARCHAR(255))`
**Returns**: VARCHAR (success/error message)
**Security**:
- EXECUTE AS CALLER (requires ADMIN_PASSWORD_MANAGER role)
- Validates current role before execution
- Logs all attempts (success and failure)

#### 3. ADMIN_PASSWORD_AUDIT Table

**Purpose**: Immutable audit log of all password change attempts
**Schema**:
```sql
CREATE TABLE ADMIN_PASSWORD_AUDIT (
    AUDIT_ID VARCHAR(36) DEFAULT UUID_STRING(),
    USER_EMAIL VARCHAR(255),
    CHANGED_BY_USER VARCHAR(255),
    CHANGED_BY_ROLE VARCHAR(255),
    CHANGE_TIMESTAMP TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ACTION_TYPE VARCHAR(50),          -- PASSWORD_UPDATE, PASSWORD_UPDATE_ATTEMPT
    SUCCESS BOOLEAN,
    ERROR_MESSAGE VARCHAR(500),
    PRIMARY KEY (AUDIT_ID)
);
```

#### 4. SYSTEM_ADMIN_INFO View

**Purpose**: Safe view of system admin information without password exposure
**Permissions**: SELECT granted to PUBLIC
**Security**: PASSWORD_HASH always returns '***REDACTED***'

---

## Password Change Procedures

### Prerequisites

1. Access to Snowflake as `videxakc` user
2. ADMIN_PASSWORD_MANAGER role granted
3. New password (or GUID generator)
4. bcrypt hash generation capability

### Step-by-Step Guide

#### Step 1: Generate New Password

Generate a new GUID for the password:

```bash
# On Windows (PowerShell)
[guid]::NewGuid().ToString()

# On Linux/Mac
uuidgen | tr '[:upper:]' '[:lower:]'

# Using Python
python -c "import uuid; print(str(uuid.uuid4()))"
```

**Example Output**: `7b4e9f12-a3c5-4d8e-9f21-3c8a7b4e9f12`

#### Step 2: Generate bcrypt Hash

Use the provided Python script:

```bash
cd /c/videxa-repos/NexusChat/database/snowflake
python generate-admin-password-hash.py
```

Or manually generate:

```python
import bcrypt

password = "7b4e9f12-a3c5-4d8e-9f21-3c8a7b4e9f12"
salt = bcrypt.gensalt(rounds=12)
hash = bcrypt.hashpw(password.encode(), salt).decode()
print(hash)
```

**Example Output**: `$2b$12$xyz123...`

#### Step 3: Connect to Snowflake as videxakc

```sql
-- Snowflake Web UI or SnowSQL
USE DATABASE AGENTNEXUS_DB;
USE SCHEMA AUTH_SCHEMA;
USE ROLE ADMIN_PASSWORD_MANAGER;
```

#### Step 4: Execute Password Update

```sql
CALL UPDATE_SYSTEM_ADMIN_PASSWORD('$2b$12$new_hash_here');
```

**Expected Response**: `System administrator password updated successfully`

#### Step 5: Verify Update

```sql
-- Check audit log
SELECT * FROM ADMIN_PASSWORD_AUDIT
ORDER BY CHANGE_TIMESTAMP DESC
LIMIT 1;
```

**Expected Output**:
| AUDIT_ID | USER_EMAIL | CHANGED_BY_USER | CHANGED_BY_ROLE | ACTION_TYPE | SUCCESS |
|----------|------------|-----------------|-----------------|-------------|---------|
| uuid-... | kcrossley@videxa.co | videxakc | ADMIN_PASSWORD_MANAGER | PASSWORD_UPDATE | TRUE |

#### Step 6: Test New Password

```bash
curl -X POST http://localhost:3050/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kcrossley@videxa.co",
    "password": "7b4e9f12-a3c5-4d8e-9f21-3c8a7b4e9f12"
  }'
```

**Expected**: HTTP 200 with JWT token

---

## Security Validations

### Automated E2E Tests

The TC-0.4 test suite validates:

✅ System admin can login with GUID password
✅ JWT token contains `account_type: system_admin`
✅ Invalid credentials are rejected
✅ Email verification bypassed for system account
✅ System admin email protected from duplicate creation
✅ Account type verification
✅ Persistent user ID across logins

**Run Tests:**
```bash
cd /c/videxa-repos/NexusChat
npx playwright test e2e/specs/tc-0.4-system-admin-login.spec.ts
```

### Manual Security Checks

#### 1. Verify Role Assignment

```sql
SHOW GRANTS TO USER videxakc;
```

**Expected**: ADMIN_PASSWORD_MANAGER role listed

#### 2. Test Unauthorized Access

```sql
-- As different user/role
USE ROLE PUBLIC;
CALL UPDATE_SYSTEM_ADMIN_PASSWORD('$2b$12$test');
```

**Expected**: Error or logged failure in ADMIN_PASSWORD_AUDIT

#### 3. Verify Password Hash Protection

```sql
SELECT * FROM SYSTEM_ADMIN_INFO;
```

**Expected**: PASSWORD_HASH column shows `***REDACTED***`

#### 4. View Audit Trail

```sql
SELECT
    CHANGE_TIMESTAMP,
    CHANGED_BY_USER,
    CHANGED_BY_ROLE,
    ACTION_TYPE,
    SUCCESS,
    ERROR_MESSAGE
FROM ADMIN_PASSWORD_AUDIT
ORDER BY CHANGE_TIMESTAMP DESC;
```

---

## Troubleshooting

### Issue: "Insufficient privileges" Error

**Symptom**: Error when calling UPDATE_SYSTEM_ADMIN_PASSWORD

**Solution**:
```sql
-- Verify current role
SELECT CURRENT_ROLE();

-- Switch to correct role
USE ROLE ADMIN_PASSWORD_MANAGER;

-- Retry procedure call
CALL UPDATE_SYSTEM_ADMIN_PASSWORD('...');
```

### Issue: bcrypt Hash Rejected

**Symptom**: Invalid password hash format error

**Solution**:
- Ensure hash starts with `$2b$12$`
- Verify hash length (60 characters)
- Check for special character escaping issues
- Regenerate hash using bcrypt with 12 rounds

### Issue: Login Fails After Password Change

**Symptom**: 401 Unauthorized after password update

**Checklist**:
1. Verify stored procedure returned success
2. Check ADMIN_PASSWORD_AUDIT for SUCCESS = TRUE
3. Ensure using correct new password (not old one)
4. Test hash verification:

```python
import bcrypt
stored_hash = "$2b$12$..."  # From Snowflake
test_password = "new-guid-here"
print(bcrypt.checkpw(test_password.encode(), stored_hash.encode()))
```

### Issue: Procedure Not Found

**Symptom**: `Procedure UPDATE_SYSTEM_ADMIN_PASSWORD does not exist`

**Solution**:
```sql
-- Verify database/schema context
SELECT CURRENT_DATABASE(), CURRENT_SCHEMA();

-- Should be AGENTNEXUS_DB.AUTH_SCHEMA
USE DATABASE AGENTNEXUS_DB;
USE SCHEMA AUTH_SCHEMA;

-- Check procedure exists
SHOW PROCEDURES LIKE 'UPDATE_SYSTEM_ADMIN_PASSWORD';
```

---

## File Locations

### SQL Scripts

| File | Purpose | Location |
|------|---------|----------|
| setup-system-admin-manual.sql | Initial setup (one-time) | C:\videxa-repos\NexusChat\database\snowflake\ |
| generate-admin-password-hash.py | Generate bcrypt hashes | C:\videxa-repos\NexusChat\database\snowflake\ |

### Backend Code

| File | Purpose | Location |
|------|---------|----------|
| auth_snowflake.py | Login endpoint with JWT | C:\videxa-repos\agentnexus-backend\app\routers\ |

### Test Files

| File | Purpose | Location |
|------|---------|----------|
| tc-0.4-system-admin-login.spec.ts | E2E authentication tests | C:\videxa-repos\NexusChat\e2e\specs\ |

---

## Compliance & Audit

### Password Policy

- **Algorithm**: bcrypt
- **Cost Factor**: 12 rounds
- **Format**: GUID (UUID v4)
- **Length**: 36 characters
- **Rotation**: As needed (logged in ADMIN_PASSWORD_AUDIT)

### Audit Requirements

All password management operations are logged:
- User who performed the action
- Role used for the action
- Timestamp (UTC)
- Action type (UPDATE vs ATTEMPT)
- Success/failure status
- Error messages (if failed)

### Access Control

- **WHO**: Only `videxakc` Snowflake user
- **WHAT**: Can update system admin password
- **WHEN**: Anytime (all attempts logged)
- **WHERE**: Via UPDATE_SYSTEM_ADMIN_PASSWORD stored procedure only
- **WHY**: Logged in ADMIN_PASSWORD_AUDIT.ERROR_MESSAGE if failed

---

## Emergency Procedures

### Lost System Admin Password

**Scenario**: System admin password forgotten or compromised

**Recovery Steps**:

1. **Authenticate as videxakc** to Snowflake
2. **Generate new GUID** password
3. **Generate bcrypt hash** (12 rounds)
4. **Execute UPDATE_SYSTEM_ADMIN_PASSWORD** with new hash
5. **Verify in audit log** that update succeeded
6. **Test login** with new password
7. **Document incident** (date, reason, new password location)

### Compromised Password

**Scenario**: System admin password potentially exposed

**Immediate Actions**:

1. **Rotate password immediately** (follow password change procedure)
2. **Review audit logs** for unauthorized access:
   ```sql
   SELECT * FROM USER_LOGIN_EVENTS
   WHERE EMAIL = 'kcrossley@videxa.co'
   ORDER BY CREATED_AT DESC;
   ```
3. **Check for suspicious activity** in application logs
4. **Notify security team**
5. **Review recent password changes**:
   ```sql
   SELECT * FROM ADMIN_PASSWORD_AUDIT
   ORDER BY CHANGE_TIMESTAMP DESC;
   ```

### videxakc Account Unavailable

**Scenario**: Cannot access videxakc Snowflake user

**Recovery**:

1. **Contact Snowflake ACCOUNTADMIN** user
2. **Request one of**:
   - Grant ADMIN_PASSWORD_MANAGER role to another user
   - Reset videxakc user credentials
   - Direct database UPDATE (emergency only)

3. **Document access override** in audit system

---

## Best Practices

### Password Management

✅ **DO**:
- Store password securely (password manager, Azure Key Vault)
- Use GUID format for passwords
- Rotate password periodically (quarterly recommended)
- Test new password before disconnecting from old session
- Document password changes in change management system

❌ **DON'T**:
- Share system admin credentials
- Store password in plain text
- Use predictable passwords
- Skip audit log verification
- Update password hash directly in database

### Operational Security

✅ **DO**:
- Review ADMIN_PASSWORD_AUDIT monthly
- Monitor USER_LOGIN_EVENTS for system admin activity
- Use ADMIN_PASSWORD_MANAGER role only when needed
- Verify role before executing password updates
- Test TC-0.4 suite after password changes

❌ **DON'T**:
- Leave ADMIN_PASSWORD_MANAGER role active continuously
- Grant ADMIN_PASSWORD_MANAGER to multiple users
- Modify audit tables manually
- Bypass stored procedure for password updates
- Disable audit logging

---

## References

### Related Documentation

- [Session State 2025-11-04](./SESSION-STATE-2025-11-04.md) - E2E testing context
- [Test Cleanup Tasks](./test-cleanup-tasks.md) - Manual cleanup procedures
- [Snowflake-Only Architecture](./SNOWFLAKE-ONLY-ARCHITECTURE.md) - System architecture

### External Resources

- [bcrypt Documentation](https://pypi.org/project/bcrypt/)
- [Snowflake RBAC Guide](https://docs.snowflake.com/en/user-guide/security-access-control)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-11-04 | 1.0 | Initial documentation - System administrator setup complete | Claude |

---

## Contact

For questions or issues with system administrator password management:

1. Check ADMIN_PASSWORD_AUDIT table for error details
2. Review this documentation
3. Run TC-0.4 E2E tests to validate system state
4. Escalate to platform team if unresolved

---

**Document Status**: ✅ Approved for Production Use
