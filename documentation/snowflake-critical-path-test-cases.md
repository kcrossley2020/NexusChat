# NexusChat Critical Path Test Cases - Snowflake Integration

**Document Version:** 2.0
**Last Updated:** 2025-12-14
**Status:** Ready for Implementation
**Total Test Cases:** 12 (2-3 per Use Case, 80%+ coverage)

---

## Test Case Summary

| Use Case | Test Cases | Coverage Target |
|----------|------------|-----------------|
| UC-CP-001: Create Conversation | 3 | 85% |
| UC-CP-002: Send/Store Message | 3 | 85% |
| UC-CP-003: Retrieve History | 2 | 80% |
| UC-CP-004: List Conversations | 2 | 80% |
| UC-CP-005: Delete Conversation | 2 | 80% |

---

## UC-CP-001: Create New Conversation

### TC-CP-001.1: Create Conversation via New Chat Button

**Use Case:** UC-CP-001 - Create New Conversation
**Priority:** Critical
**Automation Status:** Pending

**Test Objective:** Verify that clicking "New Chat" creates a conversation that persists in Snowflake

**Prerequisites:**
- NexusChat running at http://localhost:3080
- AgentNexus backend running at http://localhost:3050
- Test user created and authenticated
- `USE_SNOWFLAKE_STORAGE=true` configured

**Test Steps:**
1. Login as authenticated test user
2. Click "New Chat" button in sidebar
3. Verify new conversation appears in UI
4. Capture conversation_id from URL or response
5. Refresh page (F5)
6. Verify conversation still appears in sidebar

**Expected Input:**
```
Action: Click "New Chat" button
User: Authenticated test user
```

**Expected Output:**
```
- New conversation entry in sidebar
- URL contains conversation_id (e.g., /c/uuid)
- Conversation persists after page refresh
```

**Database Verification:**
```sql
SELECT CONVERSATION_ID, USER_ID, TITLE, ENDPOINT, CREATED_AT
FROM AGENTNEXUS_DB.AUTH_SCHEMA.CONVERSATIONS
WHERE USER_ID = '<test_user_id>'
ORDER BY CREATED_AT DESC
LIMIT 1;

-- Expected:
-- CONVERSATION_ID: Valid UUID
-- USER_ID: Matches test user
-- TITLE: 'New Chat' or similar
-- CREATED_AT: Recent timestamp (within 10 seconds)
```

**Pass Criteria:**
- [ ] New Chat button creates conversation
- [ ] Conversation has valid UUID
- [ ] Conversation persists after refresh
- [ ] Database record exists with correct USER_ID

---

### TC-CP-001.2: Create Conversation with First Message

**Use Case:** UC-CP-001 - Create New Conversation
**Priority:** Critical
**Automation Status:** Pending

**Test Objective:** Verify that sending a message in empty chat creates both conversation and message

**Prerequisites:**
- NexusChat running and accessible
- Test user authenticated
- No existing conversations (or new session)

**Test Steps:**
1. Login as test user
2. In empty chat state, type message: "Hello, this is a test message"
3. Click send button
4. Wait for AI response
5. Verify conversation appears in sidebar
6. Query Snowflake for conversation and messages

**Expected Input:**
```json
{
  "text": "Hello, this is a test message",
  "sender": "User",
  "isCreatedByUser": true
}
```

**Expected Output:**
```
- Conversation created with auto-generated title
- User message displayed in chat
- AI response displayed in chat
- Both messages saved to Snowflake
```

**Database Verification:**
```sql
-- Verify conversation
SELECT CONVERSATION_ID, TITLE, MODEL, ENDPOINT
FROM CONVERSATIONS
WHERE USER_ID = '<test_user_id>'
ORDER BY CREATED_AT DESC
LIMIT 1;

-- Verify messages (should be 2: user + assistant)
SELECT MESSAGE_ID, SENDER, TEXT, IS_CREATED_BY_USER
FROM MESSAGES
WHERE CONVERSATION_ID = '<captured_conv_id>'
ORDER BY CREATED_AT ASC;

-- Expected: 2 rows
-- Row 1: SENDER='User', IS_CREATED_BY_USER=TRUE
-- Row 2: SENDER='Assistant', IS_CREATED_BY_USER=FALSE
```

**Pass Criteria:**
- [ ] Conversation created atomically with first message
- [ ] Title auto-generated from message content
- [ ] Both user and assistant messages saved
- [ ] Message order preserved (user first, then assistant)

---

### TC-CP-001.3: Conversation Persists After Logout/Login

**Use Case:** UC-CP-001 - Create New Conversation
**Priority:** High
**Automation Status:** Pending

**Test Objective:** Verify conversations persist across user sessions

**Prerequisites:**
- Test user created
- NexusChat accessible

**Test Steps:**
1. Login as test user
2. Create new conversation with message
3. Note conversation_id
4. Logout completely (clear session)
5. Login again as same user
6. Verify conversation appears in sidebar
7. Click conversation to load history
8. Verify messages are intact

**Expected Input:**
```
Session 1: Create conversation with message
Session 2: Login and verify persistence
```

**Expected Output:**
```
- Conversation visible in sidebar after re-login
- Clicking conversation loads full message history
- Message content matches original
```

**Pass Criteria:**
- [ ] Conversation appears after re-login
- [ ] conversation_id matches original
- [ ] Message history intact
- [ ] No data loss between sessions

---

## UC-CP-002: Send and Store Message

### TC-CP-002.1: Send User Message and Receive AI Response

**Use Case:** UC-CP-002 - Send and Store Message
**Priority:** Critical
**Automation Status:** Pending

**Test Objective:** Verify message send/receive flow persists both messages to Snowflake

**Prerequisites:**
- Existing conversation created
- User authenticated

**Test Steps:**
1. Open existing conversation
2. Type message: "What is 2+2? Please answer with just the number."
3. Click send
4. Wait for AI response to complete
5. Query Snowflake for both messages

**Expected Input:**
```json
{
  "conversationId": "<existing_conv_id>",
  "text": "What is 2+2? Please answer with just the number.",
  "sender": "User",
  "isCreatedByUser": true
}
```

**Expected Output:**
```
- User message appears immediately in UI
- AI response streams in
- Both messages visible in chat
- Both messages saved to Snowflake
```

**Database Verification:**
```sql
SELECT MESSAGE_ID, SENDER, TEXT, IS_CREATED_BY_USER, TOKEN_COUNT, CREATED_AT
FROM MESSAGES
WHERE CONVERSATION_ID = '<conv_id>'
ORDER BY CREATED_AT DESC
LIMIT 2;

-- Expected:
-- Row 1: Assistant message with token_count > 0
-- Row 2: User message with IS_CREATED_BY_USER = TRUE
```

**API Verification:**
```http
GET /api/messages?conversationId=<conv_id>

Expected Response:
{
  "messages": [
    { "sender": "User", "text": "What is 2+2...", "isCreatedByUser": true },
    { "sender": "Assistant", "text": "4", "isCreatedByUser": false }
  ]
}
```

**Pass Criteria:**
- [ ] User message saved before AI call
- [ ] AI response saved after completion
- [ ] Messages have valid UUIDs
- [ ] Token count recorded for AI message
- [ ] Timestamps are sequential

---

### TC-CP-002.2: Message Order Preservation

**Use Case:** UC-CP-002 - Send and Store Message
**Priority:** High
**Automation Status:** Pending

**Test Objective:** Verify multiple messages maintain correct chronological order

**Prerequisites:**
- New or existing conversation
- User authenticated

**Test Steps:**
1. Open conversation
2. Send message: "Message 1"
3. Wait for AI response
4. Send message: "Message 2"
5. Wait for AI response
6. Send message: "Message 3"
7. Wait for AI response
8. Refresh page
9. Verify all 6 messages in correct order

**Expected Input:**
```
Sequence:
1. User: "Message 1"
2. AI Response
3. User: "Message 2"
4. AI Response
5. User: "Message 3"
6. AI Response
```

**Expected Output:**
```
After refresh:
- 6 messages in chat
- Alternating User/Assistant
- Order: Msg1, AI1, Msg2, AI2, Msg3, AI3
```

**Database Verification:**
```sql
SELECT SENDER, TEXT, CREATED_AT
FROM MESSAGES
WHERE CONVERSATION_ID = '<conv_id>'
ORDER BY CREATED_AT ASC;

-- Expected: 6 rows with strictly increasing CREATED_AT
-- Rows alternate: User, Assistant, User, Assistant...
```

**Pass Criteria:**
- [ ] All 6 messages saved
- [ ] CREATED_AT timestamps strictly ascending
- [ ] Order preserved after refresh
- [ ] Role alternates correctly

---

### TC-CP-002.3: Message with Special Characters

**Use Case:** UC-CP-002 - Send and Store Message
**Priority:** Medium
**Automation Status:** Pending

**Test Objective:** Verify special characters, unicode, and emojis are preserved

**Prerequisites:**
- Existing conversation
- User authenticated

**Test Steps:**
1. Open conversation
2. Send message with special characters:
   `Testing "quotes" & <html> tags and emojis 🎉🚀 and 中文字符`
3. Wait for response
4. Refresh page
5. Verify message content unchanged

**Expected Input:**
```
Text: Testing "quotes" & <html> tags and emojis 🎉🚀 and 中文字符
```

**Expected Output:**
```
- Message displays correctly in UI
- After refresh, content identical
- No SQL injection or encoding issues
- No XSS vulnerabilities
```

**Database Verification:**
```sql
SELECT TEXT FROM MESSAGES
WHERE CONVERSATION_ID = '<conv_id>'
AND IS_CREATED_BY_USER = TRUE
ORDER BY CREATED_AT DESC
LIMIT 1;

-- TEXT should exactly match:
-- 'Testing "quotes" & <html> tags and emojis 🎉🚀 and 中文字符'
```

**Pass Criteria:**
- [ ] Special characters preserved
- [ ] Unicode/emojis intact
- [ ] HTML entities not executed
- [ ] No data corruption

---

## UC-CP-003: Retrieve Conversation History

### TC-CP-003.1: Load Complete Message History

**Use Case:** UC-CP-003 - Retrieve Conversation History
**Priority:** Critical
**Automation Status:** Pending

**Test Objective:** Verify all messages load when opening a conversation

**Prerequisites:**
- Conversation with 10+ messages exists
- User authenticated

**Test Steps:**
1. Create conversation with 10 message exchanges (20 messages total)
2. Navigate away to different page
3. Navigate back to conversation
4. Count visible messages
5. Verify all 20 messages loaded

**Expected Input:**
```
Conversation: 20 messages (10 user + 10 AI)
Action: Navigate to conversation
```

**Expected Output:**
```
- All 20 messages displayed
- Messages in chronological order
- First message at top
- Most recent at bottom
- Load time < 2 seconds
```

**Performance Verification:**
```javascript
// Measure load time
const startTime = performance.now();
await page.goto(`/c/${conversationId}`);
await page.waitForSelector('.message', { count: 20 });
const loadTime = performance.now() - startTime;
expect(loadTime).toBeLessThan(2000);
```

**Pass Criteria:**
- [ ] All 20 messages retrieved
- [ ] Correct chronological order
- [ ] No duplicates or missing messages
- [ ] Load time < 2 seconds

---

### TC-CP-003.2: History After Page Refresh

**Use Case:** UC-CP-003 - Retrieve Conversation History
**Priority:** High
**Automation Status:** Pending

**Test Objective:** Verify message history survives browser refresh

**Prerequisites:**
- Active conversation with messages
- User authenticated

**Test Steps:**
1. Open conversation with existing messages
2. Count current messages
3. Press F5 (refresh page)
4. Wait for conversation to reload
5. Count messages again
6. Compare content of first and last message

**Expected Input:**
```
Pre-refresh: N messages visible
Action: Page refresh (F5)
```

**Expected Output:**
```
Post-refresh:
- Same N messages visible
- Same message content
- Same order
- URL unchanged
```

**Pass Criteria:**
- [ ] Message count unchanged
- [ ] Content unchanged
- [ ] Order preserved
- [ ] No data loss

---

## UC-CP-004: List User Conversations

### TC-CP-004.1: Display All User Conversations

**Use Case:** UC-CP-004 - List User Conversations
**Priority:** Critical
**Automation Status:** Pending

**Test Objective:** Verify sidebar displays all user conversations sorted by recent activity

**Prerequisites:**
- User has 5+ conversations
- User authenticated

**Test Steps:**
1. Create 5 conversations with different messages/times
2. Refresh page
3. Check sidebar shows all 5 conversations
4. Verify most recent at top
5. Verify titles match conversation content

**Expected Input:**
```
User: Has 5 conversations created at different times
Action: Load NexusChat
```

**Expected Output:**
```
Sidebar shows:
1. Most recent conversation (top)
2. Second most recent
3. ...
5. Oldest conversation (bottom)

Each entry shows:
- Conversation title
- Last update time
```

**Database Verification:**
```sql
SELECT CONVERSATION_ID, TITLE, UPDATED_AT
FROM CONVERSATIONS
WHERE USER_ID = '<test_user_id>'
ORDER BY UPDATED_AT DESC;

-- Should match sidebar order
```

**Pass Criteria:**
- [ ] All 5 conversations visible
- [ ] Sorted by UPDATED_AT descending
- [ ] Titles display correctly
- [ ] Count matches database

---

### TC-CP-004.2: Conversation List Updates After New Message

**Use Case:** UC-CP-004 - List User Conversations
**Priority:** High
**Automation Status:** Pending

**Test Objective:** Verify sending message moves conversation to top of list

**Prerequisites:**
- User has 3+ conversations
- User authenticated

**Test Steps:**
1. Note order of conversations in sidebar (A, B, C)
2. Open oldest conversation (C)
3. Send new message
4. Check sidebar order
5. Verify C is now at top

**Expected Input:**
```
Before: Order is A(newest), B, C(oldest)
Action: Send message in C
```

**Expected Output:**
```
After: Order is C(now newest), A, B
C moved to top after message sent
```

**Database Verification:**
```sql
SELECT CONVERSATION_ID, UPDATED_AT
FROM CONVERSATIONS
WHERE USER_ID = '<test_user_id>'
ORDER BY UPDATED_AT DESC
LIMIT 1;

-- CONVERSATION_ID should be C
-- UPDATED_AT should be recent
```

**Pass Criteria:**
- [ ] Conversation C moves to top
- [ ] UPDATED_AT refreshed in database
- [ ] Other conversations unchanged
- [ ] Order: C, A, B

---

## UC-CP-005: Delete Conversation

### TC-CP-005.1: Delete Conversation with Messages

**Use Case:** UC-CP-005 - Delete Conversation
**Priority:** Critical
**Automation Status:** Pending

**Test Objective:** Verify deleting conversation removes it and all messages from Snowflake

**Prerequisites:**
- Conversation with 5 messages exists
- User authenticated

**Test Steps:**
1. Create conversation with 5 messages
2. Note conversation_id
3. Click delete button on conversation
4. Confirm deletion dialog
5. Verify conversation removed from sidebar
6. Query Snowflake to confirm deletion

**Expected Input:**
```
Conversation: <conv_id> with 5 messages
Action: Delete conversation
```

**Expected Output:**
```
- Conversation removed from sidebar
- Redirect to new conversation (if active)
- Database: 0 records for conversation
```

**Database Verification:**
```sql
-- Verify conversation deleted
SELECT COUNT(*) FROM CONVERSATIONS
WHERE CONVERSATION_ID = '<conv_id>';
-- Expected: 0

-- Verify messages deleted
SELECT COUNT(*) FROM MESSAGES
WHERE CONVERSATION_ID = '<conv_id>';
-- Expected: 0
```

**Pass Criteria:**
- [ ] Conversation removed from UI
- [ ] Conversation deleted from CONVERSATIONS table
- [ ] All messages deleted from MESSAGES table
- [ ] Transactional (all-or-nothing)

---

### TC-CP-005.2: Prevent Cross-User Deletion

**Use Case:** UC-CP-005 - Delete Conversation
**Priority:** Critical (Security)
**Automation Status:** Pending

**Test Objective:** Verify users cannot delete other users' conversations

**Prerequisites:**
- Two test users created
- User A has a conversation
- User B authenticated

**Test Steps:**
1. Login as User A
2. Create conversation, note conversation_id
3. Logout
4. Login as User B
5. Attempt to delete User A's conversation via API:
   ```
   DELETE /api/convos
   Body: { arg: { conversationId: "<user_a_conv_id>" } }
   ```
6. Verify deletion fails
7. Query database to confirm conversation exists

**Expected Input:**
```
User B attempting to delete User A's conversation
API call with User B's JWT but User A's conversation_id
```

**Expected Output:**
```
HTTP Status: 403 Forbidden or 404 Not Found
Conversation still exists for User A
```

**API Verification:**
```http
DELETE /api/convos
Authorization: Bearer <user_b_token>
Body: { "arg": { "conversationId": "<user_a_conv_id>" } }

Expected Response:
Status: 403 or 404
Body: { "error": "Unauthorized" or "Conversation not found" }
```

**Database Verification:**
```sql
SELECT COUNT(*) FROM CONVERSATIONS
WHERE CONVERSATION_ID = '<user_a_conv_id>';
-- Expected: 1 (still exists)
```

**Pass Criteria:**
- [ ] Deletion fails with 403/404
- [ ] Conversation still exists
- [ ] User B cannot access User A's data
- [ ] Audit log records attempt (if implemented)

---

## Test Execution Plan

### Phase 1: Critical Path (Day 1)
| Test Case | Priority | Est. Time |
|-----------|----------|-----------|
| TC-CP-001.1 | Critical | 30 min |
| TC-CP-001.2 | Critical | 30 min |
| TC-CP-002.1 | Critical | 30 min |
| TC-CP-003.1 | Critical | 30 min |
| TC-CP-004.1 | Critical | 30 min |
| TC-CP-005.1 | Critical | 30 min |

### Phase 2: Data Integrity (Day 2)
| Test Case | Priority | Est. Time |
|-----------|----------|-----------|
| TC-CP-001.3 | High | 30 min |
| TC-CP-002.2 | High | 30 min |
| TC-CP-003.2 | High | 30 min |
| TC-CP-004.2 | High | 30 min |

### Phase 3: Edge Cases & Security (Day 2)
| Test Case | Priority | Est. Time |
|-----------|----------|-----------|
| TC-CP-002.3 | Medium | 30 min |
| TC-CP-005.2 | Critical | 30 min |

---

## Automation Framework

### Test Structure
```
e2e/
├── specs/
│   └── snowflake-integration/
│       ├── tc-cp-001-create-conversation.spec.ts
│       ├── tc-cp-002-send-message.spec.ts
│       ├── tc-cp-003-retrieve-history.spec.ts
│       ├── tc-cp-004-list-conversations.spec.ts
│       └── tc-cp-005-delete-conversation.spec.ts
├── fixtures/
│   └── snowflake-test-user.ts
└── helpers/
    └── snowflake-verification.ts
```

### Test Data Management
- Create test user before each test suite
- Clean up test conversations after each test
- Use unique identifiers to prevent conflicts
- Database verification queries for assertions

---

**Document prepared for Playwright E2E Test Implementation**
