# NexusChat Snowflake-Only Migration - Use Cases

## Purpose
This document outlines the use cases for migrating NexusChat from MongoDB to Snowflake-exclusive storage, ensuring complete data persistence and retrieval functionality using Snowflake as the single source of truth.

---

## Use Case 1: User Authentication with Snowflake
**ID:** UC-001
**Priority:** Critical
**Status:** ✅ Completed

### Description
Users must be able to authenticate using credentials stored in Snowflake, with JWT token validation for subsequent requests.

### Actors
- End User (System Administrator, Standard User)
- AgentNexus API (Authentication Service)
- NexusChat Backend

### Preconditions
- User account exists in Snowflake USER_PROFILES table
- AgentNexus API is running and accessible
- NexusChat is configured with USE_SNOWFLAKE_STORAGE=true

### Main Flow
1. User navigates to NexusChat login page
2. User enters email and password
3. NexusChat forwards credentials to AgentNexus API
4. AgentNexus validates credentials against Snowflake
5. AgentNexus returns JWT token with user details
6. NexusChat stores token and redirects to chat interface
7. Subsequent requests use JWT for authentication

### Success Criteria
- ✅ User successfully logs in with valid credentials
- ✅ Invalid credentials are rejected with appropriate error message
- ✅ JWT token is valid and contains user_id, email, account_type
- ✅ User can access protected routes with valid token

### Business Value
- Centralized user management in Snowflake
- Eliminates dependency on MongoDB for authentication
- Enables enterprise identity governance

---

## Use Case 2: Create and Persist New Conversation
**ID:** UC-002
**Priority:** Critical
**Status:** 🔴 In Progress

### Description
Users must be able to start a new conversation that persists in Snowflake, allowing them to return to the conversation later.

### Actors
- End User
- NexusChat Backend
- Snowflake Database

### Preconditions
- User is authenticated
- User has valid JWT token
- Snowflake CONVERSATIONS table exists

### Main Flow
1. User clicks "New Chat" or sends first message
2. NexusChat generates unique conversation_id (UUID)
3. NexusChat creates conversation record in Snowflake with:
   - conversation_id
   - user_id (from JWT)
   - title (generated from first message or default)
   - model (selected AI model)
   - created_at timestamp
4. Conversation appears in user's conversation list
5. User can navigate away and return to conversation

### Success Criteria
- ✅ Conversation is saved to Snowflake CONVERSATIONS table
- ✅ Conversation_id is unique and valid UUID
- ✅ User can see conversation in sidebar
- ✅ Conversation persists after page refresh
- ✅ Conversation can be retrieved by conversation_id

### Business Value
- Chat history preserved in enterprise data warehouse
- Conversation data available for analytics
- Audit trail for compliance

---

## Use Case 3: Send and Store Chat Messages
**ID:** UC-003
**Priority:** Critical
**Status:** 🔴 In Progress

### Description
Users must be able to send messages within a conversation that are stored in Snowflake and remain accessible across sessions.

### Actors
- End User
- NexusChat Backend
- AI Model Provider (Claude, GPT, etc.)
- Snowflake Database

### Preconditions
- User is authenticated
- Conversation exists in Snowflake
- User has valid JWT token

### Main Flow
1. User types message in chat input
2. User clicks send or presses Enter
3. NexusChat creates user message record:
   - message_id (UUID)
   - conversation_id
   - user_id
   - text (message content)
   - role: "user"
   - created_at timestamp
4. NexusChat saves user message to Snowflake MESSAGES table
5. NexusChat sends message to AI model provider
6. AI model streams response back
7. NexusChat creates assistant message record:
   - message_id (UUID)
   - conversation_id
   - text (AI response)
   - role: "assistant"
   - model name
   - token_count
   - created_at timestamp
8. NexusChat saves assistant message to Snowflake MESSAGES table
9. Both messages display in chat interface

### Success Criteria
- ✅ User message is saved to Snowflake before AI call
- ✅ Assistant response is saved to Snowflake after completion
- ✅ Messages appear in correct chronological order
- ✅ Messages persist after page refresh
- ✅ Token counts are accurately recorded

### Business Value
- Complete conversation history for compliance
- Usage tracking for billing and analytics
- Data available for training/fine-tuning

---

## Use Case 4: Retrieve Conversation History
**ID:** UC-004
**Priority:** Critical
**Status:** 🔴 In Progress

### Description
Users must be able to view all previous messages when reopening a conversation, with messages loaded from Snowflake.

### Actors
- End User
- NexusChat Backend
- Snowflake Database

### Preconditions
- User is authenticated
- Conversation exists in Snowflake
- Messages exist for the conversation

### Main Flow
1. User clicks on conversation in sidebar
2. NexusChat requests conversation details from Snowflake by conversation_id
3. NexusChat queries MESSAGES table for all messages where conversation_id matches
4. Messages are sorted by created_at ascending
5. NexusChat returns messages to frontend
6. Frontend displays messages in chat interface

### Success Criteria
- ✅ All messages for conversation are retrieved
- ✅ Messages are in correct chronological order
- ✅ Message metadata is preserved (role, tokens, model, timestamps)
- ✅ Performance is acceptable (<2 seconds for 100 messages)
- ✅ No data loss or corruption

### Business Value
- Seamless user experience across sessions
- Conversation continuity for multi-session tasks
- Historical data available for review

---

## Use Case 5: List User's Conversations
**ID:** UC-005
**Priority:** High
**Status:** 🔴 In Progress

### Description
Users must be able to see a list of all their conversations in the sidebar, sorted by most recent activity.

### Actors
- End User
- NexusChat Backend
- Snowflake Database

### Preconditions
- User is authenticated
- User has created one or more conversations

### Main Flow
1. User loads NexusChat interface
2. NexusChat queries Snowflake CONVERSATIONS table for user_id
3. Conversations are sorted by updated_at descending (most recent first)
4. Query includes pagination (limit 25 per page)
5. NexusChat returns conversation list with:
   - conversation_id
   - title
   - updated_at
   - message preview (first message snippet)
6. Frontend displays conversations in sidebar

### Success Criteria
- ✅ All user's conversations are retrievable
- ✅ Conversations sorted by most recent activity
- ✅ Pagination works correctly
- ✅ Performance is acceptable (<1 second for query)
- ✅ Empty state handled gracefully (no conversations)

### Business Value
- Easy navigation to previous conversations
- User productivity (quick access to context)
- Organized conversation management

---

## Use Case 6: Update Conversation Title
**ID:** UC-006
**Priority:** Medium
**Status:** 🔴 In Progress

### Description
System automatically generates conversation title from first message, and users can manually update titles.

### Actors
- End User
- NexusChat Backend (title generation)
- Snowflake Database

### Preconditions
- Conversation exists in Snowflake
- User is authenticated and owns the conversation

### Main Flow (Auto-generation)
1. User sends first message in new conversation
2. NexusChat extracts summary/title from message (first 50 chars or AI-generated)
3. NexusChat updates CONVERSATIONS table: `SET title = ? WHERE conversation_id = ?`

### Alternate Flow (Manual Update)
1. User clicks edit icon next to conversation title
2. User enters new title
3. User clicks save
4. NexusChat updates CONVERSATIONS table
5. New title appears in sidebar immediately

### Success Criteria
- ✅ Auto-generated titles are meaningful
- ✅ Title updates persist in Snowflake
- ✅ Title changes reflect immediately in UI
- ✅ Title length is validated (max 100 characters)

### Business Value
- Better conversation organization
- Easier retrieval of specific conversations
- Improved user experience

---

## Use Case 7: Delete Conversation and Messages
**ID:** UC-007
**Priority:** Medium
**Status:** 🔴 In Progress

### Description
Users must be able to delete conversations, which removes the conversation and all associated messages from Snowflake.

### Actors
- End User
- NexusChat Backend
- Snowflake Database

### Preconditions
- User is authenticated
- Conversation exists and belongs to user
- User has delete permissions

### Main Flow
1. User clicks delete icon on conversation
2. System shows confirmation dialog: "Delete this conversation? This cannot be undone."
3. User confirms deletion
4. NexusChat deletes all messages: `DELETE FROM MESSAGES WHERE conversation_id = ?`
5. NexusChat deletes conversation: `DELETE FROM CONVERSATIONS WHERE conversation_id = ?`
6. Conversation removed from sidebar
7. If conversation was active, redirect to new conversation

### Success Criteria
- ✅ Both conversation and messages are deleted from Snowflake
- ✅ Deletion is transactional (all-or-nothing)
- ✅ Deleted conversation no longer appears in list
- ✅ User cannot access deleted conversation by URL
- ✅ Other user's conversations are unaffected

### Business Value
- User control over their data
- Compliance with data deletion requirements
- Storage management

---

## Use Case 8: Search Conversations and Messages
**ID:** UC-008
**Priority:** Low
**Status:** 🔴 Not Started

### Description
Users should be able to search across all their conversations and messages to find specific content.

### Actors
- End User
- NexusChat Backend
- Snowflake Database

### Preconditions
- User is authenticated
- User has conversations with messages

### Main Flow
1. User enters search query in search box
2. NexusChat queries Snowflake:
   ```sql
   SELECT DISTINCT c.conversation_id, c.title, m.text
   FROM CONVERSATIONS c
   JOIN MESSAGES m ON c.conversation_id = m.conversation_id
   WHERE c.user_id = ?
   AND (c.title ILIKE ? OR m.text ILIKE ?)
   LIMIT 50
   ```
3. Results returned with highlighted matches
4. User clicks result to open conversation

### Success Criteria
- ✅ Search finds matches in conversation titles
- ✅ Search finds matches in message content
- ✅ Results are relevant and ranked
- ✅ Performance is acceptable (<2 seconds)

### Business Value
- Quick access to historical information
- Improved productivity for long-term users
- Better knowledge management

---

## Summary

### Critical Path Use Cases (Must Have)
1. ✅ UC-001: User Authentication (Complete)
2. 🔴 UC-002: Create Conversation (In Progress)
3. 🔴 UC-003: Send/Store Messages (In Progress)
4. 🔴 UC-004: Retrieve History (In Progress)
5. 🔴 UC-005: List Conversations (In Progress)

### Secondary Use Cases (Should Have)
6. 🔴 UC-006: Update Title (In Progress)
7. 🔴 UC-007: Delete Conversation (In Progress)

### Future Enhancement Use Cases (Nice to Have)
8. 🔴 UC-008: Search (Not Started)

---

## Technical Requirements

### Snowflake Schema Requirements
- CONVERSATIONS table with proper indexes
- MESSAGES table with proper indexes
- Foreign key relationship between tables
- Proper user isolation (user_id filtering)

### Performance Requirements
- Conversation list: <1 second
- Message retrieval: <2 seconds for 100 messages
- Message save: <500ms
- Concurrent users: Support 100+ simultaneous users

### Data Integrity Requirements
- Transactional operations where needed
- UUID validation for all IDs
- Proper timestamp handling
- User authorization checks on all operations

---

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Status:** Initial Documentation for Snowflake Migration
