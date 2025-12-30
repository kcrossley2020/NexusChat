# Authentication System Use Cases and Test Cases
**Document Version:** 1.0
**Date:** December 17, 2025
**Status:** Active

---

## Overview

This document defines all authentication and authorization use cases for the AgentNexus/NexusChat system, along with their associated test cases. Each use case is designed to achieve 80% test coverage of core functionality.

---

## Authentication Components Summary

| Component | File | Endpoints |
|-----------|------|-----------|
| User Login | `auth_snowflake.py` | `POST /auth/login` |
| Token Refresh | `auth_snowflake.py` | `POST /auth/refresh` |
| Session Management | `auth_snowflake.py` | `GET/POST /auth/sessions/*` |
| Password Reset | `auth_snowflake.py` | `POST /auth/request-password-reset`, `POST /auth/reset-password` |
| Logout | `auth_snowflake.py` | `POST /auth/logout` |
| API Key Auth | `api_keys.py` | `GET/POST/DELETE /api/apikeys` |
| File Permissions | `file_permissions.py` | `GET/POST/DELETE /api/files/*` |

---

## UC-AUTH-001: User Login

### Description
User authentication via email and password with JWT token issuance.

### Actors
- End User
- System (Snowflake DB)

### Preconditions
1. User has registered and verified email
2. Account is not locked
3. Backend service is running

### Flow
1. User submits email and password
2. System validates credentials against Snowflake
3. System checks account status (locked, email verified)
4. System creates session record
5. System generates access token (15 min) and refresh token (30 days)
6. System logs login event
7. System returns tokens to user

### Postconditions
- User receives valid JWT access token
- User receives refresh token
- Session created in USER_SESSIONS table
- Login event logged to USER_LOGIN_EVENTS table

### Error Scenarios
| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| Invalid email | 401 | "Invalid email or password" |
| Invalid password | 401 | "Invalid email or password" |
| Account locked | 403 | "Account is locked" |
| Email not verified | 403 | "Email not verified" |
| Missing credentials | 422 | Validation error |

### Test Cases

#### TC-AUTH-001-01: Successful Login
**Priority:** High
**Coverage:** Happy path

**Steps:**
1. Create test user via testing endpoint
2. POST `/auth/login` with valid credentials
3. Verify 200 response
4. Verify response contains: success, message, token, refresh_token, user_id, expires_in
5. Verify token is valid JWT format
6. Decode JWT and verify payload contains user_id, email, email_verified, session_id

**Expected Result:** User receives valid access and refresh tokens

#### TC-AUTH-001-02: Login with Invalid Password
**Priority:** High
**Coverage:** Error handling

**Steps:**
1. Create test user
2. POST `/auth/login` with valid email, invalid password
3. Verify 401 response
4. Verify error message: "Invalid email or password"
5. Verify FAILED_LOGIN_ATTEMPTS incremented in USER_PROFILES

**Expected Result:** Login rejected, failed attempts tracked

#### TC-AUTH-001-03: Login with Non-existent User
**Priority:** Medium
**Coverage:** Error handling

**Steps:**
1. POST `/auth/login` with non-existent email
2. Verify 401 response
3. Verify error message: "Invalid email or password"

**Expected Result:** Generic error returned (prevents email enumeration)

---

## UC-AUTH-002: Token Refresh

### Description
Exchange valid refresh token for new access token with token rotation.

### Actors
- Authenticated User
- System

### Preconditions
1. User has valid refresh token
2. Associated session is active
3. Refresh token JTI matches stored value

### Flow
1. User submits refresh token
2. System validates refresh token signature and expiry
3. System validates session is still active
4. System validates JTI hasn't been used (prevents replay)
5. System checks for suspicious activity (IP/UA changes)
6. System generates new access token
7. System generates new refresh token (rotation)
8. System updates session with new JTI
9. System returns new token pair

### Postconditions
- New access token issued
- New refresh token issued (old one invalidated)
- Session activity updated
- Suspicious activity logged if detected

### Error Scenarios
| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| Expired refresh token | 401 | "Refresh token has expired" |
| Invalid token | 401 | "Invalid refresh token" |
| Session revoked | 401 | "Session has been revoked" |
| Token reuse detected | 401 | "Security alert: Token reuse detected" |

### Test Cases

#### TC-AUTH-002-01: Successful Token Refresh
**Priority:** High
**Coverage:** Happy path

**Steps:**
1. Login to get tokens
2. Wait briefly (optional)
3. POST `/auth/refresh` with refresh_token
4. Verify 200 response
5. Verify new access_token different from original
6. Verify new refresh_token different from original
7. Verify old refresh token is invalidated

**Expected Result:** New token pair issued, old refresh token no longer valid

#### TC-AUTH-002-02: Refresh with Expired Token
**Priority:** High
**Coverage:** Error handling

**Steps:**
1. Create expired refresh token (mock or wait)
2. POST `/auth/refresh` with expired token
3. Verify 401 response
4. Verify error message about expiration

**Expected Result:** Request rejected with expiration message

#### TC-AUTH-002-03: Token Reuse Attack Detection
**Priority:** High
**Coverage:** Security

**Steps:**
1. Login to get tokens
2. Refresh token successfully (get new pair)
3. Attempt to reuse OLD refresh token
4. Verify 401 response
5. Verify all sessions revoked for user

**Expected Result:** Attack detected, all sessions invalidated

---

## UC-AUTH-003: Session Management

### Description
User can view and manage their active sessions.

### Actors
- Authenticated User
- System

### Preconditions
1. User is authenticated
2. User has valid access token

### Flow (List Sessions)
1. User requests session list
2. System retrieves all active sessions for user
3. System returns session details (IP, UA, timestamps)

### Flow (Revoke Session)
1. User submits session_id to revoke
2. System validates ownership
3. System marks session as inactive
4. System returns success

### Postconditions
- Session list returned OR session revoked
- Revoked sessions can no longer be used

### Test Cases

#### TC-AUTH-003-01: List Active Sessions
**Priority:** Medium
**Coverage:** Happy path

**Steps:**
1. Login (creates session)
2. GET `/auth/sessions` with valid token
3. Verify 200 response
4. Verify sessions array contains current session
5. Verify session has: session_id, ip_address, user_agent, created_at, expires_at

**Expected Result:** Session list returned with correct details

#### TC-AUTH-003-02: Revoke Specific Session
**Priority:** Medium
**Coverage:** Happy path

**Steps:**
1. Login to create session
2. Get session list
3. POST `/auth/sessions/revoke` with session_id
4. Verify 200 response
5. Verify session no longer in active list
6. Verify token from revoked session no longer works

**Expected Result:** Session successfully revoked

#### TC-AUTH-003-03: Revoke All Sessions Except Current
**Priority:** Medium
**Coverage:** Logout from all devices

**Steps:**
1. Create multiple sessions (login multiple times)
2. POST `/auth/sessions/revoke-all` with keep_current=true
3. Verify 200 response
4. Verify revoked_count equals total sessions - 1
5. Verify current session still works

**Expected Result:** All other sessions revoked, current session preserved

---

## UC-AUTH-004: Password Reset

### Description
User can reset forgotten password via email link.

### Actors
- User (may not be authenticated)
- System

### Preconditions
1. User has registered account
2. User knows their email address

### Flow (Request Reset)
1. User submits email address
2. System generates secure reset token
3. System stores token in PASSWORD_RESET_TOKENS table
4. System sends email with reset link (or returns in dev mode)
5. System returns generic success (prevents enumeration)

### Flow (Complete Reset)
1. User submits reset token and new password
2. System validates token and expiry
3. System validates password strength
4. System updates password hash
5. System invalidates reset token
6. System returns success

### Postconditions
- Password updated
- Reset token invalidated
- User can login with new password

### Test Cases

#### TC-AUTH-004-01: Request Password Reset
**Priority:** High
**Coverage:** Happy path

**Steps:**
1. POST `/auth/request-password-reset` with valid email
2. Verify 200 response
3. Verify response has success: true
4. Verify message doesn't reveal if user exists
5. (Dev mode) Verify reset link returned

**Expected Result:** Reset token generated, link available

#### TC-AUTH-004-02: Complete Password Reset
**Priority:** High
**Coverage:** Happy path

**Steps:**
1. Request password reset
2. Extract reset token from response/link
3. POST `/auth/reset-password` with token and new password
4. Verify 200 response
5. Verify can login with new password
6. Verify can't login with old password

**Expected Result:** Password successfully changed

#### TC-AUTH-004-03: Password Reset with Weak Password
**Priority:** Medium
**Coverage:** Validation

**Steps:**
1. Request password reset
2. POST `/auth/reset-password` with weak password (no uppercase)
3. Verify 400 response
4. Verify error mentions password requirements

**Expected Result:** Reset rejected with validation error

---

## UC-AUTH-005: API Key Authentication

### Description
Service-to-service authentication using API keys with scopes.

### Actors
- Authenticated User (for management)
- Service/Integration (for usage)
- System

### Preconditions
1. User authenticated to manage keys
2. Valid scopes requested

### Flow (Create Key)
1. User requests new API key with name and scopes
2. System generates secure key (vnx_XXXXXXXXX)
3. System stores hashed key
4. System returns full key (only shown once)

### Flow (Use Key)
1. Service includes X-API-Key header
2. System validates key hash
3. System checks expiration
4. System validates required scopes
5. System updates usage tracking
6. Request proceeds

### Postconditions
- API key created and stored
- Key can be used for authenticated requests

### Test Cases

#### TC-AUTH-005-01: Create API Key
**Priority:** High
**Coverage:** Happy path

**Steps:**
1. Login to get user token
2. POST `/api/apikeys` with name, scopes
3. Verify 200 response
4. Verify response contains: api_key, key_id, name, scopes
5. Verify api_key starts with "vnx_"
6. Verify key only shown this once (not in list)

**Expected Result:** API key created and returned

#### TC-AUTH-005-02: Use API Key for Authentication
**Priority:** High
**Coverage:** Happy path

**Steps:**
1. Create API key with "conversations:read" scope
2. Make request to protected endpoint with X-API-Key header
3. Verify request succeeds
4. Verify last_used_at updated

**Expected Result:** Request authenticated via API key

#### TC-AUTH-005-03: API Key Scope Enforcement
**Priority:** High
**Coverage:** Authorization

**Steps:**
1. Create API key with limited scopes (e.g., "conversations:read")
2. Attempt operation requiring different scope
3. Verify 403 response
4. Verify error mentions missing scope

**Expected Result:** Request rejected for insufficient scope

---

## UC-AUTH-006: File Permissions

### Description
File-level access control for shared files.

### Actors
- File Owner
- Shared User
- Organization Members
- System

### Preconditions
1. File exists in FILE_RECORDS
2. User authenticated

### Flow (Share File)
1. Owner requests to share file
2. System validates owner has ADMIN permission
3. System creates FILE_PERMISSIONS record
4. System generates share token (for link shares)
5. System returns share details

### Flow (Access File)
1. User requests file access
2. System checks: ownership, user permission, org permission
3. System returns highest permission level
4. Access granted or denied

### Test Cases

#### TC-AUTH-006-01: Share File with User
**Priority:** Medium
**Coverage:** Happy path

**Steps:**
1. Register file as owner
2. POST `/api/files/{file_id}/share` with user share
3. Verify 200 response
4. Verify share_id returned
5. Have shared user access file
6. Verify shared user has correct permission level

**Expected Result:** File successfully shared with specific user

#### TC-AUTH-006-02: File Access Denied for Unauthorized User
**Priority:** High
**Coverage:** Security

**Steps:**
1. Register file as user A
2. Attempt to access file as user B (no share)
3. Verify 404 response (access denied)

**Expected Result:** Unauthorized access denied

#### TC-AUTH-006-03: Create Shareable Link
**Priority:** Medium
**Coverage:** Link sharing

**Steps:**
1. Register file as owner
2. POST `/api/files/{file_id}/share` with share_type="link"
3. Verify share_link returned
4. Access file via share link
5. Verify access granted with VIEW permission

**Expected Result:** Public link created and works

---

## UC-AUTH-007: Logout

### Description
User terminates their current session.

### Actors
- Authenticated User
- System

### Preconditions
1. User is authenticated
2. User has valid session

### Flow
1. User requests logout
2. System extracts session_id from token
3. System marks session as revoked
4. System returns success

### Postconditions
- Session invalidated
- Token no longer usable

### Test Cases

#### TC-AUTH-007-01: Successful Logout
**Priority:** High
**Coverage:** Happy path

**Steps:**
1. Login to get token
2. POST `/auth/logout` with token
3. Verify 200 response
4. Attempt to use old token
5. Verify 401 response (token invalid)

**Expected Result:** Session invalidated, token no longer works

---

## Test Coverage Matrix

| Use Case | Test Cases | Happy Path | Error Cases | Security |
|----------|------------|------------|-------------|----------|
| UC-AUTH-001 Login | 3 | TC-001-01 | TC-001-02, TC-001-03 | - |
| UC-AUTH-002 Refresh | 3 | TC-002-01 | TC-002-02 | TC-002-03 |
| UC-AUTH-003 Sessions | 3 | TC-003-01, TC-003-02 | - | TC-003-03 |
| UC-AUTH-004 Password Reset | 3 | TC-004-01, TC-004-02 | TC-004-03 | - |
| UC-AUTH-005 API Keys | 3 | TC-005-01, TC-005-02 | - | TC-005-03 |
| UC-AUTH-006 File Perms | 3 | TC-006-01 | - | TC-006-02, TC-006-03 |
| UC-AUTH-007 Logout | 1 | TC-007-01 | - | - |
| **Total** | **19** | | | |

---

## Estimated Coverage

Based on 2-3 test cases per use case covering:
- Happy path scenarios
- Common error scenarios
- Security validations

**Estimated Line Coverage:** 80%+
**Estimated Branch Coverage:** 75%+

---

## Test Automation

All test cases are implemented as Playwright E2E tests in:
- `e2e/specs/auth/` - Authentication tests
- `e2e/specs/api-keys/` - API key tests
- `e2e/specs/file-permissions/` - File permission tests

Run with:
```bash
npx playwright test e2e/specs/auth/
```
