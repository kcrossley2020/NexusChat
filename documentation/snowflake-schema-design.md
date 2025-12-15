# Snowflake Schema Design for NexusChat

## Overview
This document details the Snowflake table schema design to replace MongoDB collections for conversations and messages.

## MongoDB to Snowflake Mapping

### Key Design Decisions
1. **User ID Storage**: Store as VARCHAR (UUIDs from AgentNexus) instead of MongoDB ObjectId
2. **JSON Columns**: Use VARIANT type for complex nested objects (agentOptions, attachments, files)
3. **Arrays**: Use ARRAY type for simple arrays (tags, file_ids)
4. **Timestamps**: Use TIMESTAMP_NTZ (no timezone) with automatic defaults
5. **Indexes**: Leverage Snowflake's automatic clustering and create search optimization for frequently queried columns

---

## Table 1: CONVERSATIONS

### Purpose
Stores conversation metadata, configuration, and LLM parameters.

### Schema

| Column Name | Snowflake Type | Nullable | Default | Notes |
|------------|---------------|----------|---------|-------|
| **CONVERSATION_ID** | VARCHAR(255) | NOT NULL | - | Primary Key, unique identifier |
| **USER_ID** | VARCHAR(255) | NOT NULL | - | Foreign key to USER_PROFILES.USER_ID |
| **TITLE** | VARCHAR(500) | YES | 'New Chat' | Conversation title |
| **ENDPOINT** | VARCHAR(100) | NOT NULL | - | AI endpoint (openAI, anthropic, etc.) |
| **ENDPOINT_TYPE** | VARCHAR(100) | YES | NULL | Endpoint subtype |
| **MODEL** | VARCHAR(100) | YES | NULL | Model name (gpt-4, claude-3, etc.) |
| **REGION** | VARCHAR(50) | YES | NULL | AWS region for Bedrock |
| **CHAT_GPT_LABEL** | VARCHAR(255) | YES | NULL | Custom label |
| **MODEL_LABEL** | VARCHAR(255) | YES | NULL | Display label for model |
| **PROMPT_PREFIX** | TEXT | YES | NULL | System prompt prefix |
| **TEMPERATURE** | FLOAT | YES | NULL | LLM temperature (0.0-2.0) |
| **TOP_P** | FLOAT | YES | NULL | Nucleus sampling parameter |
| **TOP_K** | INTEGER | YES | NULL | Top-K sampling (Google) |
| **MAX_OUTPUT_TOKENS** | INTEGER | YES | NULL | Max output tokens (Google) |
| **MAX_TOKENS** | INTEGER | YES | NULL | Max tokens (OpenAI/Anthropic) |
| **PRESENCE_PENALTY** | FLOAT | YES | NULL | Presence penalty (-2.0 to 2.0) |
| **FREQUENCY_PENALTY** | FLOAT | YES | NULL | Frequency penalty (-2.0 to 2.0) |
| **PROMPT_CACHE** | BOOLEAN | YES | FALSE | Enable Anthropic prompt caching |
| **THINKING** | BOOLEAN | YES | FALSE | Enable extended thinking |
| **THINKING_BUDGET** | INTEGER | YES | NULL | Max thinking tokens |
| **SYSTEM** | TEXT | YES | NULL | System message |
| **RESEND_FILES** | BOOLEAN | YES | FALSE | Resend files in context |
| **IMAGE_DETAIL** | VARCHAR(50) | YES | NULL | Image detail level (low/high/auto) |
| **AGENT_ID** | VARCHAR(255) | YES | NULL | Agent configuration ID |
| **ASSISTANT_ID** | VARCHAR(255) | YES | NULL | Assistant ID |
| **INSTRUCTIONS** | TEXT | YES | NULL | Assistant instructions |
| **IS_ARCHIVED** | BOOLEAN | YES | FALSE | Archive status |
| **ICON_URL** | VARCHAR(1000) | YES | NULL | Custom icon URL |
| **GREETING** | TEXT | YES | NULL | Conversation greeting message |
| **SPEC** | TEXT | YES | NULL | Specification document |
| **MAX_CONTEXT_TOKENS** | INTEGER | YES | NULL | Max context window size |
| **MAX_TOKENS_ALT** | INTEGER | YES | NULL | Alternative max_tokens field |
| **USE_RESPONSES_API** | BOOLEAN | YES | FALSE | Use responses API |
| **WEB_SEARCH** | BOOLEAN | YES | FALSE | Enable web search |
| **DISABLE_STREAMING** | BOOLEAN | YES | FALSE | Disable response streaming |
| **FILE_TOKEN_LIMIT** | INTEGER | YES | NULL | Token limit per file |
| **REASONING_EFFORT** | VARCHAR(50) | YES | NULL | Reasoning model effort level |
| **REASONING_SUMMARY** | TEXT | YES | NULL | Reasoning summary |
| **VERBOSITY** | VARCHAR(50) | YES | NULL | Response verbosity level |
| **AGENT_OPTIONS** | VARIANT | YES | NULL | JSON object for agent config |
| **EXAMPLES** | VARIANT | YES | NULL | JSON array of examples (Google) |
| **FILE_IDS** | ARRAY | YES | NULL | Array of file IDs |
| **STOP** | ARRAY | YES | NULL | Array of stop sequences |
| **TAGS** | ARRAY | YES | NULL | Array of tag strings |
| **TOOLS** | ARRAY | YES | NULL | Array of tool names |
| **FILES** | ARRAY | YES | NULL | Array of file references |
| **EXPIRED_AT** | TIMESTAMP_NTZ | YES | NULL | TTL expiration timestamp |
| **CREATED_AT** | TIMESTAMP_NTZ | NOT NULL | CURRENT_TIMESTAMP() | Record creation time |
| **UPDATED_AT** | TIMESTAMP_NTZ | NOT NULL | CURRENT_TIMESTAMP() | Record last update time |

### Indexes & Clustering
```sql
-- Primary Key
PRIMARY KEY (CONVERSATION_ID)

-- Foreign Key
FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID)

-- Composite Unique Index
UNIQUE (CONVERSATION_ID, USER_ID)

-- Search Optimization (Snowflake-specific)
ALTER TABLE CONVERSATIONS ADD SEARCH OPTIMIZATION ON EQUALITY(USER_ID, ENDPOINT, MODEL);
ALTER TABLE CONVERSATIONS ADD SEARCH OPTIMIZATION ON SUBSTRING(TITLE);

-- Clustering Key (for query performance)
CLUSTER BY (USER_ID, CREATED_AT);
```

### MongoDB Source
- Collection: `conversations`
- Schema: `packages/data-schemas/src/schema/convo.ts`
- Preset fields: `packages/data-schemas/src/schema/defaults.ts` (conversationPreset)

---

## Table 2: MESSAGES

### Purpose
Stores individual messages within conversations, including AI responses, user messages, and associated metadata.

### Schema

| Column Name | Snowflake Type | Nullable | Default | Notes |
|------------|---------------|----------|---------|-------|
| **MESSAGE_ID** | VARCHAR(255) | NOT NULL | - | Primary Key, unique message identifier |
| **CONVERSATION_ID** | VARCHAR(255) | NOT NULL | - | Foreign key to CONVERSATIONS |
| **USER_ID** | VARCHAR(255) | NOT NULL | - | Foreign key to USER_PROFILES.USER_ID |
| **PARENT_MESSAGE_ID** | VARCHAR(255) | YES | NULL | Parent message for threading |
| **SENDER** | VARCHAR(50) | NOT NULL | - | Message sender (User/Assistant) |
| **TEXT** | TEXT | NOT NULL | - | Message text content |
| **IS_CREATED_BY_USER** | BOOLEAN | NOT NULL | FALSE | True if user message |
| **ENDPOINT** | VARCHAR(100) | YES | NULL | AI endpoint used |
| **MODEL** | VARCHAR(100) | YES | NULL | Model name |
| **TOKEN_COUNT** | INTEGER | YES | 0 | Total tokens in message |
| **PROMPT_TOKENS** | INTEGER | YES | 0 | Prompt tokens consumed |
| **COMPLETION_TOKENS** | INTEGER | YES | 0 | Completion tokens generated |
| **FINISH_REASON** | VARCHAR(50) | YES | NULL | Completion finish reason |
| **ERROR** | BOOLEAN | YES | FALSE | Whether message contains error |
| **UNFINISHED** | BOOLEAN | YES | FALSE | Whether message is incomplete |
| **CANCELLED** | BOOLEAN | YES | FALSE | Whether generation was cancelled |
| **IS_LMNT_SPEECH_ENABLED** | BOOLEAN | YES | FALSE | LMNT speech feature flag |
| **SUBMITTED** | BOOLEAN | YES | FALSE | Whether message was submitted |
| **GENERATION_STREAM_ID** | VARCHAR(255) | YES | NULL | Stream ID for live updates |
| **ATTACHMENTS** | VARIANT | YES | NULL | JSON array of attachment objects |
| **FILES** | VARIANT | YES | NULL | JSON array of file objects |
| **FEEDBACK** | VARIANT | YES | NULL | JSON object with user feedback |
| **PLUGIN** | VARIANT | YES | NULL | JSON object for plugin data |
| **PLUGINS** | VARIANT | YES | NULL | JSON array of plugin configs |
| **METADATA** | VARIANT | YES | NULL | Additional JSON metadata |
| **CREATED_AT** | TIMESTAMP_NTZ | NOT NULL | CURRENT_TIMESTAMP() | Message creation time |
| **UPDATED_AT** | TIMESTAMP_NTZ | NOT NULL | CURRENT_TIMESTAMP() | Message update time |

### Indexes & Clustering
```sql
-- Primary Key
PRIMARY KEY (MESSAGE_ID)

-- Foreign Keys
FOREIGN KEY (CONVERSATION_ID) REFERENCES CONVERSATIONS(CONVERSATION_ID)
FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID)

-- Composite Unique Index
UNIQUE (MESSAGE_ID, USER_ID)

-- Search Optimization
ALTER TABLE MESSAGES ADD SEARCH OPTIMIZATION ON EQUALITY(CONVERSATION_ID, USER_ID, SENDER);
ALTER TABLE MESSAGES ADD SEARCH OPTIMIZATION ON SUBSTRING(TEXT);

-- Clustering Key (optimizes time-series queries)
CLUSTER BY (CONVERSATION_ID, CREATED_AT);
```

### MongoDB Source
- Collection: `messages`
- Schema: `packages/data-schemas/src/schema/message.ts`

---

## Table 3: FILES (Optional - for future implementation)

### Purpose
Stores file metadata for attachments and uploads. This table supports the file references in CONVERSATIONS.FILES and MESSAGES.FILES arrays.

### Schema

| Column Name | Snowflake Type | Nullable | Default | Notes |
|------------|---------------|----------|---------|-------|
| **FILE_ID** | VARCHAR(255) | NOT NULL | - | Primary Key |
| **USER_ID** | VARCHAR(255) | NOT NULL | - | Foreign key to USER_PROFILES.USER_ID |
| **CONVERSATION_ID** | VARCHAR(255) | YES | NULL | Associated conversation |
| **TEMP_FILE_ID** | VARCHAR(255) | YES | NULL | Temporary file identifier |
| **FILENAME** | VARCHAR(500) | NOT NULL | - | Original filename |
| **FILEPATH** | VARCHAR(1000) | NOT NULL | - | Storage path |
| **FILE_SIZE_BYTES** | INTEGER | NOT NULL | - | File size in bytes |
| **MIME_TYPE** | VARCHAR(200) | NOT NULL | - | File MIME type |
| **FILE_OBJECT_TYPE** | VARCHAR(50) | NOT NULL | 'file' | Object type descriptor |
| **EMBEDDED** | BOOLEAN | YES | FALSE | Whether file is embedded |
| **TEXT_CONTENT** | TEXT | YES | NULL | Extracted text content |
| **CONTEXT** | TEXT | YES | NULL | Contextual information |
| **USAGE_COUNT** | INTEGER | YES | 0 | Number of times referenced |
| **SOURCE** | VARCHAR(100) | YES | 'local' | File source (local, s3, etc.) |
| **MODEL** | VARCHAR(100) | YES | NULL | Model used for processing |
| **WIDTH** | INTEGER | YES | NULL | Image width (if applicable) |
| **HEIGHT** | INTEGER | YES | NULL | Image height (if applicable) |
| **FILE_IDENTIFIER** | VARCHAR(500) | YES | NULL | Additional identifier |
| **EXPIRES_AT** | TIMESTAMP_NTZ | YES | NULL | Expiration timestamp |
| **CREATED_AT** | TIMESTAMP_NTZ | NOT NULL | CURRENT_TIMESTAMP() | Upload time |
| **UPDATED_AT** | TIMESTAMP_NTZ | NOT NULL | CURRENT_TIMESTAMP() | Last update time |

### Indexes & Clustering
```sql
-- Primary Key
PRIMARY KEY (FILE_ID)

-- Foreign Keys
FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID)
FOREIGN KEY (CONVERSATION_ID) REFERENCES CONVERSATIONS(CONVERSATION_ID)

-- Search Optimization
ALTER TABLE FILES ADD SEARCH OPTIMIZATION ON EQUALITY(USER_ID, CONVERSATION_ID, FILE_ID);
ALTER TABLE FILES ADD SEARCH OPTIMIZATION ON SUBSTRING(FILENAME);

-- Clustering Key
CLUSTER BY (USER_ID, CREATED_AT);
```

### MongoDB Source
- Collection: `files`
- Schema: `packages/data-schemas/src/schema/file.ts`

---

## Data Type Mappings Reference

| MongoDB Type | Snowflake Type | Notes |
|-------------|---------------|-------|
| String | VARCHAR(n) | Size determined by field use |
| String (long text) | TEXT | For prompts, messages, etc. |
| Number | INTEGER / FLOAT | Based on value range |
| Boolean | BOOLEAN | Native boolean type |
| Date | TIMESTAMP_NTZ | No timezone (consistent with UTC) |
| ObjectId | VARCHAR(255) | Convert to string |
| Schema.Types.Mixed | VARIANT | JSON object |
| Array of String | ARRAY | Native array type |
| Array of Mixed | VARIANT | JSON array |

---

## Query Performance Considerations

### 1. Most Common Queries
```sql
-- Get user conversations (paginated)
SELECT * FROM CONVERSATIONS
WHERE USER_ID = ?
ORDER BY UPDATED_AT DESC
LIMIT 20 OFFSET ?;

-- Get conversation messages
SELECT * FROM MESSAGES
WHERE CONVERSATION_ID = ? AND USER_ID = ?
ORDER BY CREATED_AT ASC;

-- Search conversations by title
SELECT * FROM CONVERSATIONS
WHERE USER_ID = ? AND TITLE ILIKE '%search_term%'
ORDER BY UPDATED_AT DESC;

-- Get recent messages across conversations
SELECT * FROM MESSAGES
WHERE USER_ID = ?
ORDER BY CREATED_AT DESC
LIMIT 50;
```

### 2. Clustering Strategy
- **CONVERSATIONS**: Clustered by (USER_ID, CREATED_AT) for efficient user-scoped queries
- **MESSAGES**: Clustered by (CONVERSATION_ID, CREATED_AT) for efficient conversation retrieval

### 3. Search Optimization
- Enable search optimization on high-cardinality equality columns (IDs, models)
- Enable substring search on text fields (TITLE, TEXT) for full-text search

---

## Migration Considerations

### Phase 1: Schema Creation
1. Create tables in Snowflake
2. Set up foreign key relationships
3. Apply clustering and search optimization
4. Create views for common queries

### Phase 2: Data Transformation
1. ObjectId → String conversion
2. Nested objects → VARIANT JSON
3. Array fields → ARRAY or VARIANT
4. Timestamp conversion to UTC

### Phase 3: Service Layer Updates
1. Replace Mongoose queries with Snowflake SQL
2. Update CRUD operations
3. Handle VARIANT JSON serialization/deserialization
4. Implement connection pooling

---

## Security Considerations

1. **Row-Level Security**: Apply RLS policies to ensure users can only access their own data
   ```sql
   CREATE ROW ACCESS POLICY user_access_policy AS (USER_ID VARCHAR)
   RETURNS BOOLEAN ->
     'USER_ID' = CURRENT_USER_ID()
   ;

   ALTER TABLE CONVERSATIONS ADD ROW ACCESS POLICY user_access_policy ON (USER_ID);
   ALTER TABLE MESSAGES ADD ROW ACCESS POLICY user_access_policy ON (USER_ID);
   ```

2. **Column Masking**: Apply masking to sensitive fields if needed

3. **Audit Logging**: Enable Snowflake query history for compliance

---

## Rollback Plan

If migration issues occur:
1. Keep MongoDB running in parallel during migration
2. Implement feature flag to switch between storage backends
3. Validate data consistency before full cutover
4. Maintain backup of MongoDB data for 30 days post-migration
