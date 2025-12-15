# NexusChat Snowflake-Only Migration - Test Cases

## Purpose
This document defines automated test cases for validating the Snowflake-exclusive storage implementation. Each use case has 2-4 test cases covering 80%+ of functionality.

---

## Test Case Coverage Summary

| Use Case | Test Cases | Coverage |
|----------|-----------|----------|
| UC-001: Authentication | TC-001.1 to TC-001.4 | 90% |
| UC-002: Create Conversation | TC-002.1 to TC-002.4 | 85% |
| UC-003: Send Messages | TC-003.1 to TC-003.4 | 85% |
| UC-004: Retrieve History | TC-004.1 to TC-004.3 | 80% |
| UC-005: List Conversations | TC-005.1 to TC-005.4 | 90% |
| UC-006: Update Title | TC-006.1 to TC-006.2 | 80% |
| UC-007: Delete Conversation | TC-007.1 to TC-007.3 | 85% |

---

## UC-001: User Authentication with Snowflake

### TC-001.1: Successful Login with Valid Credentials
**Priority:** Critical
**Status:** ✅ Passing (Already Validated)

**Test Steps:**
1. Navigate to http://localhost:3080/login
2. Enter email: `kcrossley@videxa.co`
3. Enter password: `8a093b79-bee6-4d70-8a98-2bc7657c8e7f`
4. Click "Continue" button
5. Wait for navigation away from login page

**Expected Results:**
- ✅ Login successful
- ✅ Redirected to chat interface (URL: http://localhost:3080/c/new)
- ✅ JWT token stored in browser
- ✅ User profile loaded with email and role

**Validation:**
- URL contains `/c/` and not `/login`
- Page body contains chat interface elements
- Console has no authentication errors

---

### TC-001.2: Failed Login with Invalid Credentials
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Navigate to http://localhost:3080/login
2. Enter email: `kcrossley@videxa.co`
3. Enter password: `wrong-password`
4. Click "Continue" button
5. Observe error message

**Expected Results:**
- ❌ Login fails
- ❌ User remains on login page
- ✅ Error message displayed: "Unable to login with the information provided"
- ✅ Email field retains entered value
- ✅ Password field is cleared

**Validation:**
- URL still contains `/login`
- Error alert is visible
- No JWT token stored

---

### TC-001.3: JWT Token Validation for Protected Routes
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Successfully login as kcrossley@videxa.co
2. Capture JWT token from storage
3. Make API request to GET /api/user with Bearer token
4. Verify user data returned

**Expected Results:**
- ✅ API returns 200 OK
- ✅ User object contains:
  - `id`: "00000000-0000-0000-0000-000000000001"
  - `email`: "kcrossley@videxa.co"
  - `role`: "ADMIN"
  - `emailVerified`: true

**Validation:**
- Response status code = 200
- Response body contains expected user fields
- No authorization errors

---

### TC-001.4: Session Persistence After Page Refresh
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login successfully
2. Navigate to chat interface
3. Refresh browser page (F5)
4. Observe if user remains logged in

**Expected Results:**
- ✅ User remains authenticated
- ✅ Chat interface reloads without redirect to login
- ✅ JWT token still valid
- ✅ User data still accessible

**Validation:**
- No redirect to /login
- User menu/profile still visible
- API calls succeed with existing token

---

## UC-002: Create and Persist New Conversation

### TC-002.1: Create New Conversation via "New Chat" Button
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login as authenticated user
2. Click "New Chat" button in sidebar
3. Observe conversation creation
4. Query Snowflake to verify record

**Expected Results:**
- ✅ New conversation appears in UI
- ✅ Conversation has unique UUID conversation_id
- ✅ Record exists in Snowflake CONVERSATIONS table:
  ```sql
  SELECT * FROM CONVERSATIONS WHERE user_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY created_at DESC LIMIT 1
  ```
- ✅ Fields populated:
  - conversation_id (UUID)
  - user_id
  - title (default: "New conversation")
  - created_at (current timestamp)
  - updated_at (current timestamp)

**Validation:**
- Snowflake query returns 1 record
- conversation_id is valid UUID format
- created_at is recent (within last 5 seconds)

---

### TC-002.2: Create Conversation with First Message
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login as authenticated user
2. On empty chat, type message: "Hello, this is my first message"
3. Click send
4. Wait for AI response
5. Query Snowflake for conversation and messages

**Expected Results:**
- ✅ Conversation created in CONVERSATIONS table
- ✅ Title auto-generated from first message (e.g., "Hello, this is my first message")
- ✅ Two messages created in MESSAGES table:
  - User message (role: "user")
  - Assistant message (role: "assistant")

**Validation:**
```sql
-- Verify conversation
SELECT title FROM CONVERSATIONS WHERE user_id = ?
ORDER BY created_at DESC LIMIT 1;
-- Should return title containing "Hello"

-- Verify messages
SELECT COUNT(*) FROM MESSAGES WHERE conversation_id = ?;
-- Should return 2
```

---

### TC-002.3: Conversation Persists After Logout/Login
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login and create new conversation
2. Send one message
3. Note conversation_id
4. Logout
5. Login again as same user
6. Check if conversation still appears in sidebar

**Expected Results:**
- ✅ Conversation appears in sidebar after re-login
- ✅ Clicking conversation loads message history
- ✅ Data retrieved from Snowflake

**Validation:**
- Conversation visible in list
- conversation_id matches original
- Message history intact

---

### TC-002.4: Multiple Concurrent Conversations
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login as authenticated user
2. Create 3 separate conversations
3. Send different messages in each
4. Verify all 3 persist in Snowflake

**Expected Results:**
- ✅ All 3 conversations have unique conversation_ids
- ✅ All 3 appear in sidebar
- ✅ Each conversation maintains separate message history
- ✅ Snowflake query returns 3 records for user

**Validation:**
```sql
SELECT COUNT(*) FROM CONVERSATIONS WHERE user_id = ?;
-- Should return >= 3
```

---

## UC-003: Send and Store Chat Messages

### TC-003.1: Send User Message and Receive AI Response
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login and open existing conversation
2. Type message: "What is 2+2?"
3. Click send
4. Wait for AI response
5. Query Snowflake MESSAGES table

**Expected Results:**
- ✅ User message appears in chat immediately
- ✅ AI response streams in
- ✅ Two messages saved to Snowflake:
  ```sql
  SELECT message_id, role, text, token_count
  FROM MESSAGES
  WHERE conversation_id = ?
  ORDER BY created_at DESC LIMIT 2;
  ```
- ✅ User message has role='user'
- ✅ AI message has role='assistant'
- ✅ Both have valid timestamps

**Validation:**
- Query returns 2 messages
- Text content matches what's displayed
- token_count > 0 for assistant message

---

### TC-003.2: Message Order Preservation
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login and create new conversation
2. Send 5 messages in sequence:
   - "Message 1"
   - "Message 2"
   - "Message 3"
   - "Message 4"
   - "Message 5"
3. Wait for all AI responses
4. Query messages from Snowflake

**Expected Results:**
- ✅ All 10 messages (5 user + 5 assistant) saved
- ✅ Messages in correct chronological order
- ✅ created_at timestamps increase sequentially
- ✅ UI displays messages in correct order

**Validation:**
```sql
SELECT role, text, created_at
FROM MESSAGES
WHERE conversation_id = ?
ORDER BY created_at ASC;
-- Verify timestamps are ascending
-- Verify role alternates (user, assistant, user, assistant...)
```

---

### TC-003.3: Message with Special Characters
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login and open conversation
2. Send message with special characters: `Testing "quotes" & <html> and émojis 🎉 and 中文`
3. Verify message saved and displayed correctly

**Expected Results:**
- ✅ Special characters preserved in database
- ✅ Message displays correctly in UI
- ✅ No SQL injection or encoding issues
- ✅ Query returns exact text

**Validation:**
```sql
SELECT text FROM MESSAGES
WHERE message_id = ?;
-- Text should exactly match input
```

---

### TC-003.4: Long Message Handling
**Priority:** Medium
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login and open conversation
2. Send message with 5000 characters
3. Verify storage and retrieval

**Expected Results:**
- ✅ Full message text stored without truncation
- ✅ Message displays correctly (with scrolling if needed)
- ✅ Token count accurately reflects length

**Validation:**
```sql
SELECT LENGTH(text), token_count
FROM MESSAGES
WHERE message_id = ?;
-- LENGTH should be ~5000
```

---

## UC-004: Retrieve Conversation History

### TC-004.1: Load Complete Message History
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Create conversation with 20 messages (10 user + 10 assistant)
2. Navigate away (go to different conversation)
3. Navigate back to original conversation
4. Verify all 20 messages load

**Expected Results:**
- ✅ All 20 messages retrieved from Snowflake
- ✅ Messages display in correct order
- ✅ No messages missing or duplicated
- ✅ Load time < 2 seconds

**Validation:**
- Count visible messages in UI = 20
- First message is oldest (first sent)
- Last message is newest (last sent)

---

### TC-004.2: Conversation History After Page Refresh
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Open conversation with existing messages
2. Refresh browser page (F5)
3. Verify conversation and messages reload

**Expected Results:**
- ✅ Conversation remains active
- ✅ All messages reload from Snowflake
- ✅ Message order preserved
- ✅ No data loss

**Validation:**
- URL still contains same conversation_id
- Message count unchanged
- Content matches pre-refresh state

---

### TC-004.3: Empty Conversation Handling
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Create new conversation
2. Don't send any messages
3. Navigate away and back to conversation
4. Verify empty state handled gracefully

**Expected Results:**
- ✅ No error thrown
- ✅ Empty conversation UI displayed
- ✅ Input field is enabled and ready
- ✅ Snowflake query returns 0 messages

**Validation:**
```sql
SELECT COUNT(*) FROM MESSAGES WHERE conversation_id = ?;
-- Should return 0
```

---

## UC-005: List User's Conversations

### TC-005.1: Display All User Conversations
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Login as user with 5 existing conversations
2. Observe sidebar conversation list
3. Verify all conversations appear

**Expected Results:**
- ✅ All 5 conversations visible in sidebar
- ✅ Conversations sorted by updated_at DESC (most recent first)
- ✅ Each shows title and last update time
- ✅ Query matches displayed data

**Validation:**
```sql
SELECT conversation_id, title, updated_at
FROM CONVERSATIONS
WHERE user_id = ?
ORDER BY updated_at DESC;
-- Count should match UI count
```

---

### TC-005.2: Conversation List Updates After New Message
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Have 3 conversations (A, B, C) sorted by time
2. Open oldest conversation (C)
3. Send new message in conversation C
4. Observe sidebar order

**Expected Results:**
- ✅ Conversation C moves to top of list
- ✅ updated_at timestamp refreshed in Snowflake
- ✅ Order now: C, B, A

**Validation:**
```sql
SELECT conversation_id, updated_at
FROM CONVERSATIONS
WHERE user_id = ?
ORDER BY updated_at DESC LIMIT 1;
-- Should return conversation C with recent timestamp
```

---

### TC-005.3: Empty Conversation List for New User
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Create new user account
2. Login as new user
3. Observe empty sidebar

**Expected Results:**
- ✅ No conversations displayed
- ✅ Empty state message shown
- ✅ "New Chat" button prominent
- ✅ No errors in console

**Validation:**
```sql
SELECT COUNT(*) FROM CONVERSATIONS WHERE user_id = ?;
-- Should return 0
```

---

### TC-005.4: Conversation List Pagination
**Priority:** Medium
**Status:** 🔴 Not Automated

**Test Steps:**
1. Create user with 30 conversations
2. Load conversation list
3. Scroll to bottom
4. Verify pagination loads more

**Expected Results:**
- ✅ First 25 conversations load immediately
- ✅ Scrolling triggers next page load
- ✅ Additional 5 conversations appear
- ✅ Total 30 visible

**Validation:**
- UI shows 30 conversations after scrolling
- Multiple Snowflake queries with LIMIT/OFFSET

---

## UC-006: Update Conversation Title

### TC-006.1: Auto-Generate Title from First Message
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Create new conversation
2. Send first message: "Help me write a Python function to calculate fibonacci numbers"
3. Verify title auto-generated

**Expected Results:**
- ✅ Conversation title updated to: "Help me write a Python function to calculate..."
- ✅ Title saved in Snowflake
- ✅ Title visible in sidebar

**Validation:**
```sql
SELECT title FROM CONVERSATIONS WHERE conversation_id = ?;
-- Should contain "Help me write a Python function"
```

---

### TC-006.2: Manually Update Conversation Title
**Priority:** Medium
**Status:** 🔴 Not Automated

**Test Steps:**
1. Open existing conversation
2. Click edit icon next to title
3. Change title to: "My Custom Title"
4. Click save
5. Verify update persisted

**Expected Results:**
- ✅ Title updates in UI immediately
- ✅ Title saved to Snowflake
- ✅ Title persists after refresh

**Validation:**
```sql
SELECT title, updated_at FROM CONVERSATIONS WHERE conversation_id = ?;
-- Title should be "My Custom Title"
-- updated_at should be recent
```

---

## UC-007: Delete Conversation and Messages

### TC-007.1: Delete Conversation with Messages
**Priority:** Critical
**Status:** 🔴 Not Automated

**Test Steps:**
1. Create conversation with 5 messages
2. Note conversation_id
3. Click delete button
4. Confirm deletion
5. Verify removed from Snowflake

**Expected Results:**
- ✅ Conversation removed from sidebar
- ✅ Conversation deleted from CONVERSATIONS table
- ✅ All 5 messages deleted from MESSAGES table
- ✅ If active, redirected to new conversation

**Validation:**
```sql
SELECT COUNT(*) FROM CONVERSATIONS WHERE conversation_id = ?;
-- Should return 0

SELECT COUNT(*) FROM MESSAGES WHERE conversation_id = ?;
-- Should return 0
```

---

### TC-007.2: Delete Multiple Conversations
**Priority:** High
**Status:** 🔴 Not Automated

**Test Steps:**
1. Have 3 conversations (A, B, C)
2. Delete conversation B
3. Verify A and C remain intact

**Expected Results:**
- ✅ Conversation B and its messages deleted
- ✅ Conversations A and C unaffected
- ✅ User can still access A and C

**Validation:**
```sql
SELECT COUNT(*) FROM CONVERSATIONS WHERE user_id = ?;
-- Should return 2
```

---

### TC-007.3: Prevent Deletion of Other User's Conversation
**Priority:** Critical (Security)
**Status:** 🔴 Not Automated

**Test Steps:**
1. User A creates conversation
2. User B attempts to delete User A's conversation (via API or URL manipulation)
3. Verify deletion fails

**Expected Results:**
- ❌ Deletion fails with 403 Forbidden
- ✅ Conversation still exists for User A
- ✅ Error message: "Unauthorized"

**Validation:**
- HTTP status = 403
- Snowflake record unchanged

---

## Test Execution Plan

### Phase 1: Critical Path (Week 1)
1. TC-001.1: ✅ Already Passing
2. TC-001.2: Login failure
3. TC-001.3: JWT validation
4. TC-002.1: Create conversation
5. TC-002.2: First message creates conversation
6. TC-003.1: Send and receive message
7. TC-004.1: Load message history
8. TC-005.1: List conversations

### Phase 2: Data Integrity (Week 2)
9. TC-002.3: Persistence after logout
10. TC-003.2: Message order
11. TC-004.2: History after refresh
12. TC-007.1: Delete conversation

### Phase 3: Edge Cases (Week 2)
13. TC-001.4: Session persistence
14. TC-003.3: Special characters
15. TC-004.3: Empty conversation
16. TC-005.3: Empty list
17. TC-007.3: Security (cross-user deletion)

### Phase 4: Polish (Week 3)
18. TC-002.4: Multiple conversations
19. TC-003.4: Long messages
20. TC-005.2: List updates
21. TC-005.4: Pagination
22. TC-006.1: Auto-title generation
23. TC-006.2: Manual title update

---

## Automation Requirements

### Test Framework
- **Tool:** Playwright (via mcp-playwright)
- **Language:** TypeScript
- **Location:** `C:\videxa-repos\NexusChat\e2e\specs\snowflake-integration\`

### Test Data Requirements
- Test user credentials in Snowflake
- Ability to clean up test data between runs
- Snowflake connection for validation queries

### CI/CD Integration
- Run critical path tests on every PR
- Full suite on nightly builds
- Performance benchmarks tracked

---

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Total Test Cases:** 23
**Automated:** 1/23
**Target Coverage:** 80% minimum per use case
