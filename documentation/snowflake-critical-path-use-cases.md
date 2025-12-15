# NexusChat Critical Path Use Cases - Snowflake Integration

**Document Version:** 2.0
**Last Updated:** 2025-12-14
**Status:** Active Development

---

## Overview

This document defines the critical path use cases for NexusChat's Snowflake-exclusive storage integration. These use cases cover the essential conversation and message management functionality required for production deployment.

---

## UC-CP-001: Create New Conversation

**ID:** UC-CP-001
**Priority:** Critical
**Status:** Pending Implementation
**Coverage Target:** 80%

### Description
Users must be able to start a new conversation that is immediately persisted to Snowflake, ensuring data durability and cross-session availability.

### Actors
- Authenticated End User
- NexusChat Frontend
- NexusChat Backend API
- Snowflake Database

### Preconditions
1. User is authenticated with valid JWT token
2. User has valid USER_ID in Snowflake USER_PROFILES table
3. NexusChat backend is configured with `USE_SNOWFLAKE_STORAGE=true`
4. Snowflake CONVERSATIONS table exists and is accessible

### Main Flow
1. User clicks "New Chat" button or sends first message
2. Frontend generates UUID for `conversation_id`
3. Frontend sends POST request to `/api/convos` with:
   - `conversationId`: Generated UUID
   - `endpoint`: AI provider (e.g., "openAI", "anthropic")
   - `model`: Selected model (e.g., "gpt-4", "claude-sonnet-4")
4. Backend validates JWT and extracts `user_id`
5. Backend calls `SnowflakeChatService.createConversation()`:
   ```sql
   INSERT INTO CONVERSATIONS (
     CONVERSATION_ID, USER_ID, TITLE, ENDPOINT, MODEL,
     CREATED_AT, UPDATED_AT
   ) VALUES (?, ?, 'New Chat', ?, ?, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
   ```
6. Backend returns created conversation object
7. Frontend displays conversation in sidebar
8. Conversation persists across page refreshes

### Alternate Flows

**AF-1: First Message Creates Conversation**
1. User types message without clicking "New Chat"
2. System auto-generates conversation_id
3. Conversation created with first message title extraction
4. Both conversation and message saved atomically

**AF-2: Authentication Failure**
1. JWT token is invalid or expired
2. Backend returns 401 Unauthorized
3. Frontend redirects to login page

### Postconditions
- Conversation record exists in CONVERSATIONS table
- `CONVERSATION_ID` is unique UUID
- `USER_ID` matches authenticated user
- `CREATED_AT` and `UPDATED_AT` are set to current timestamp
- Conversation appears in user's sidebar list

### Success Criteria
- Conversation creates successfully in Snowflake
- Response time < 500ms
- Data persists after page refresh
- No duplicate conversation_ids possible

### Business Value
- Data durability in enterprise data warehouse
- Audit trail for compliance requirements
- Cross-device conversation access

---

## UC-CP-002: Send and Store Message

**ID:** UC-CP-002
**Priority:** Critical
**Status:** Pending Implementation
**Coverage Target:** 80%

### Description
Users must be able to send messages within a conversation that are immediately persisted to Snowflake, with both user messages and AI responses stored.

### Actors
- Authenticated End User
- NexusChat Frontend
- NexusChat Backend API
- AI Provider (OpenAI, Anthropic, etc.)
- Snowflake Database

### Preconditions
1. User is authenticated with valid JWT token
2. Conversation exists in Snowflake CONVERSATIONS table
3. User owns the conversation (USER_ID matches)
4. AI provider is configured and accessible

### Main Flow
1. User types message in chat input
2. User clicks send or presses Enter
3. Frontend generates UUID for `message_id`
4. Frontend sends message to backend:
   ```json
   {
     "messageId": "uuid",
     "conversationId": "conv-uuid",
     "text": "User message content",
     "sender": "User",
     "isCreatedByUser": true
   }
   ```
5. Backend validates ownership of conversation
6. Backend calls `SnowflakeChatService.saveMessage()` for user message:
   ```sql
   INSERT INTO MESSAGES (
     MESSAGE_ID, CONVERSATION_ID, USER_ID, SENDER, TEXT,
     IS_CREATED_BY_USER, ENDPOINT, MODEL, CREATED_AT, UPDATED_AT
   ) VALUES (?, ?, ?, 'User', ?, TRUE, ?, ?, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
   ```
7. Backend streams request to AI provider
8. AI response streams back to frontend
9. Backend saves AI response message:
   ```sql
   INSERT INTO MESSAGES (
     MESSAGE_ID, CONVERSATION_ID, USER_ID, SENDER, TEXT,
     IS_CREATED_BY_USER, ENDPOINT, MODEL, TOKEN_COUNT,
     FINISH_REASON, CREATED_AT, UPDATED_AT
   ) VALUES (?, ?, ?, 'Assistant', ?, FALSE, ?, ?, ?, ?, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())
   ```
10. Backend updates conversation `UPDATED_AT`:
    ```sql
    UPDATE CONVERSATIONS SET UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE CONVERSATION_ID = ?
    ```
11. Both messages display in chat interface

### Alternate Flows

**AF-1: Message with Attachments**
1. User attaches files to message
2. Files uploaded to storage (S3/Azure Blob)
3. File metadata stored in FILES table
4. Message saved with file references in ATTACHMENTS column

**AF-2: AI Request Failure**
1. AI provider returns error
2. User message already saved
3. Error message displayed to user
4. No AI message saved
5. User can retry sending

**AF-3: Long Message (>4000 chars)**
1. Message exceeds standard length
2. Message stored in TEXT column (handles large text)
3. Token count calculated accurately

### Postconditions
- User message exists in MESSAGES table
- AI response message exists in MESSAGES table
- Both messages linked to same CONVERSATION_ID
- Messages have sequential CREATED_AT timestamps
- Conversation UPDATED_AT is refreshed
- Token usage recorded for billing

### Success Criteria
- User message persisted before AI call
- AI response persisted after completion
- Messages appear in correct chronological order
- Token counts accurately recorded
- Response time < 500ms for message save

### Business Value
- Complete conversation history for compliance
- Usage tracking for billing and analytics
- Data available for training/fine-tuning

---

## UC-CP-003: Retrieve Conversation History

**ID:** UC-CP-003
**Priority:** Critical
**Status:** Pending Implementation
**Coverage Target:** 80%

### Description
Users must be able to view all previous messages when opening a conversation, with messages loaded from Snowflake in correct order.

### Actors
- Authenticated End User
- NexusChat Frontend
- NexusChat Backend API
- Snowflake Database

### Preconditions
1. User is authenticated with valid JWT token
2. Conversation exists in Snowflake
3. User owns the conversation
4. Messages exist for the conversation

### Main Flow
1. User clicks on conversation in sidebar
2. Frontend requests conversation details:
   ```
   GET /api/convos/:conversationId
   ```
3. Backend validates user ownership
4. Backend calls `SnowflakeChatService.getMessages()`:
   ```sql
   SELECT MESSAGE_ID, CONVERSATION_ID, USER_ID, PARENT_MESSAGE_ID,
          SENDER, TEXT, IS_CREATED_BY_USER, ENDPOINT, MODEL,
          TOKEN_COUNT, ERROR, CREATED_AT, UPDATED_AT
   FROM MESSAGES
   WHERE CONVERSATION_ID = ? AND USER_ID = ?
   ORDER BY CREATED_AT ASC
   ```
5. Backend returns messages array to frontend
6. Frontend renders messages in chat interface
7. User can scroll through complete history

### Alternate Flows

**AF-1: Empty Conversation**
1. Conversation has no messages
2. Backend returns empty array
3. Frontend shows empty state with prompt

**AF-2: Large History (100+ messages)**
1. Backend implements pagination
2. Initial load returns most recent 50 messages
3. User scrolls up to load older messages
4. Lazy loading prevents performance issues

### Postconditions
- All messages for conversation retrieved
- Messages in correct chronological order
- Message metadata preserved (sender, tokens, timestamps)
- Performance within acceptable limits

### Success Criteria
- All messages retrieved without data loss
- Correct chronological order (oldest first)
- Load time < 2 seconds for 100 messages
- Metadata intact (role, tokens, model, timestamps)

### Business Value
- Seamless user experience across sessions
- Conversation continuity for multi-session tasks
- Historical data available for review

---

## UC-CP-004: List User Conversations

**ID:** UC-CP-004
**Priority:** Critical
**Status:** Pending Implementation
**Coverage Target:** 80%

### Description
Users must be able to see a list of all their conversations in the sidebar, sorted by most recent activity.

### Actors
- Authenticated End User
- NexusChat Frontend
- NexusChat Backend API
- Snowflake Database

### Preconditions
1. User is authenticated with valid JWT token
2. User has created one or more conversations

### Main Flow
1. User loads NexusChat interface (or refreshes)
2. Frontend requests conversation list:
   ```
   GET /api/convos?limit=25&order=desc
   ```
3. Backend calls `SnowflakeChatService.listConversations()`:
   ```sql
   SELECT CONVERSATION_ID, TITLE, ENDPOINT, MODEL,
          IS_ARCHIVED, CREATED_AT, UPDATED_AT
   FROM CONVERSATIONS
   WHERE USER_ID = ?
     AND (IS_ARCHIVED = FALSE OR IS_ARCHIVED IS NULL)
     AND (EXPIRED_AT IS NULL)
   ORDER BY UPDATED_AT DESC
   LIMIT 26
   ```
4. Backend returns first 25 conversations with next cursor
5. Frontend displays conversations in sidebar
6. User can scroll to load more (pagination)

### Alternate Flows

**AF-1: No Conversations**
1. User has never created a conversation
2. Backend returns empty array
3. Frontend shows empty state
4. "New Chat" button prominently displayed

**AF-2: Archived Conversations**
1. User requests archived conversations
2. Backend filters for IS_ARCHIVED = TRUE
3. Archived conversations displayed separately

**AF-3: Search Conversations**
1. User enters search term
2. Backend searches TITLE column
3. Filtered results returned

### Postconditions
- All user conversations retrievable
- Sorted by most recent activity
- Pagination works correctly
- Archive filter functional

### Success Criteria
- All conversations listed accurately
- Sorted by UPDATED_AT descending
- Pagination working (25 per page)
- Query performance < 1 second

### Business Value
- Easy navigation to previous conversations
- User productivity (quick access to context)
- Organized conversation management

---

## UC-CP-005: Delete Conversation

**ID:** UC-CP-005
**Priority:** High
**Status:** Pending Implementation
**Coverage Target:** 80%

### Description
Users must be able to delete conversations, which removes the conversation and all associated messages from Snowflake.

### Actors
- Authenticated End User
- NexusChat Frontend
- NexusChat Backend API
- Snowflake Database

### Preconditions
1. User is authenticated with valid JWT token
2. Conversation exists and belongs to user
3. User confirms deletion intent

### Main Flow
1. User clicks delete icon on conversation
2. Frontend shows confirmation dialog
3. User confirms deletion
4. Frontend sends DELETE request:
   ```
   DELETE /api/convos
   Body: { arg: { conversationId: "uuid" } }
   ```
5. Backend validates user ownership
6. Backend calls `SnowflakeChatService.deleteConversation()`:
   ```sql
   -- Delete messages first (foreign key constraint)
   DELETE FROM MESSAGES WHERE CONVERSATION_ID = ? AND USER_ID = ?;

   -- Delete conversation
   DELETE FROM CONVERSATIONS WHERE CONVERSATION_ID = ? AND USER_ID = ?;
   ```
7. Backend returns success response
8. Frontend removes conversation from sidebar
9. If active, frontend redirects to new conversation

### Alternate Flows

**AF-1: Delete All Conversations**
1. User selects "Delete All"
2. Confirmation dialog warns of impact
3. All user conversations deleted
4. Frontend redirects to empty state

**AF-2: Unauthorized Deletion Attempt**
1. User attempts to delete another user's conversation
2. Backend validates ownership fails
3. 403 Forbidden returned
4. No data deleted

### Postconditions
- Conversation removed from CONVERSATIONS table
- All messages removed from MESSAGES table
- Files optionally cleaned up
- Deletion is transactional (all or nothing)

### Success Criteria
- Both conversation and messages deleted
- Transactional operation (rollback on failure)
- Deleted conversation no longer appears
- Cannot access by direct URL
- Other users' data unaffected

### Business Value
- User control over their data
- Compliance with data deletion requirements
- Storage management

---

## Technical Requirements Summary

### Snowflake Tables Required
- `AGENTNEXUS_DB.AUTH_SCHEMA.CONVERSATIONS` - Already defined
- `AGENTNEXUS_DB.AUTH_SCHEMA.MESSAGES` - Already defined
- Foreign key relationship via CONVERSATION_ID

### Service Methods Required
| Method | Use Case | Priority |
|--------|----------|----------|
| `createConversation()` | UC-CP-001 | Critical |
| `saveMessage()` | UC-CP-002 | Critical |
| `getMessages()` | UC-CP-003 | Critical |
| `listConversations()` | UC-CP-004 | Critical |
| `deleteConversation()` | UC-CP-005 | High |
| `getConversation()` | UC-CP-003 | Critical |
| `updateConversation()` | UC-CP-001 | High |

### Performance Requirements
| Operation | Target | Max |
|-----------|--------|-----|
| Create Conversation | 200ms | 500ms |
| Save Message | 200ms | 500ms |
| Get Messages (100) | 500ms | 2000ms |
| List Conversations | 300ms | 1000ms |
| Delete Conversation | 300ms | 1000ms |

### Security Requirements
- All operations require valid JWT authentication
- User can only access their own data (USER_ID filtering)
- Parameterized queries to prevent SQL injection
- Audit logging for all write operations

---

**Document prepared for Critical Path Implementation**
