# NexusChat Snowflake Schema Migration

This directory contains SQL scripts for migrating NexusChat to use Snowflake as the primary data storage backend.

## Prerequisites

- Snowflake account with ACCOUNTADMIN or equivalent privileges
- AgentNexus backend must be deployed with USER_PROFILES table
- AGENTNEXUS_SERVICE_ROLE role must exist

## Migration Scripts

### 01-create-chat-tables.sql
Creates the core tables for NexusChat:
- **CONVERSATIONS**: Stores conversation metadata, LLM configuration, and parameters
- **MESSAGES**: Stores individual messages within conversations
- **FILES**: Stores file metadata for attachments and uploads

The script also creates:
- Foreign key relationships
- Indexes for query performance
- Search optimization (Snowflake-specific)
- Clustering keys
- Stored procedures for timestamp updates
- Views for common queries
- Permission grants to service role

### 02-test-data.sql
Inserts sample test data:
- 4 test conversations with different configurations (OpenAI, Anthropic, archived, with files)
- 9 test messages across conversations
- 2 test files
- Validation and performance test queries

## Running the Migration

### Step 1: Review the Scripts
Review [01-create-chat-tables.sql](./01-create-chat-tables.sql) and understand the schema design.

### Step 2: Run Schema Creation
Connect to Snowflake using Snowflake Web UI, SnowSQL, or any SQL client with ACCOUNTADMIN privileges:

```sql
-- Execute the entire 01-create-chat-tables.sql script
-- Either copy-paste into Snowflake Web UI Worksheet
-- Or run via SnowSQL:
snowsql -a <account> -u <admin_user> -f 01-create-chat-tables.sql
```

The script will:
1. Create tables CONVERSATIONS, MESSAGES, FILES
2. Set up indexes and clustering
3. Create helper views
4. Grant permissions to AGENTNEXUS_SERVICE_ROLE

### Step 3: Verify Tables Created
Run the validation queries at the end of `01-create-chat-tables.sql`:

```sql
-- Verify tables exist
SELECT TABLE_NAME, ROW_COUNT, BYTES
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'AUTH_SCHEMA'
AND TABLE_NAME IN ('CONVERSATIONS', 'MESSAGES', 'FILES');

-- Verify foreign keys
SELECT
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE USING (CONSTRAINT_NAME)
WHERE TABLE_NAME IN ('CONVERSATIONS', 'MESSAGES', 'FILES');
```

Expected output:
```
CONVERSATIONS | 0 rows
MESSAGES      | 0 rows
FILES         | 0 rows
```

### Step 4: Insert Test Data (Optional)
Run `02-test-data.sql` to insert sample data for testing:

```sql
-- Make sure to update the email address in the script to match a test user
-- Then execute the entire script
```

This will create:
- 4 test conversations
- 9 test messages
- 2 test files

### Step 5: Run Validation Queries
The test data script includes validation queries at the end. Verify:

```sql
-- Should return 4 conversations
SELECT COUNT(*) FROM CONVERSATIONS WHERE USER_ID = '<test_user_id>';

-- Should return 9 messages
SELECT COUNT(*) FROM MESSAGES WHERE USER_ID = '<test_user_id>';

-- Should return 2 files
SELECT COUNT(*) FROM FILES WHERE USER_ID = '<test_user_id>';

-- View test: Should show conversations with message counts
SELECT * FROM USER_CONVERSATIONS_SUMMARY
WHERE USER_ID = '<test_user_id>';
```

## Schema Design

See [../documentation/snowflake-schema-design.md](../../documentation/snowflake-schema-design.md) for detailed schema documentation including:
- Field-by-field descriptions
- MongoDB to Snowflake mappings
- Query performance considerations
- Security considerations

## Troubleshooting

### Error: Insufficient privileges
**Solution**: Run the scripts as ACCOUNTADMIN or ensure your role has:
- CREATE TABLE privileges on AUTH_SCHEMA
- GRANT privileges to assign permissions to service role

### Error: Object does not exist (USER_PROFILES)
**Solution**: Ensure AgentNexus backend is deployed first with the USER_PROFILES table.

### Error: Foreign key constraint violated
**Solution**: Ensure parent records exist before inserting child records:
- USER_PROFILES must have user records before CONVERSATIONS
- CONVERSATIONS must exist before MESSAGES
- CONVERSATIONS must exist before FILES (with foreign key)

### Tables created but service can't access them
**Solution**: Verify grants:
```sql
SHOW GRANTS TO ROLE AGENTNEXUS_SERVICE_ROLE;
```

Should show SELECT, INSERT, UPDATE, DELETE on CONVERSATIONS, MESSAGES, FILES.

## Rollback

To drop all tables and objects:

```sql
-- WARNING: This will delete all data!
DROP VIEW IF EXISTS CONVERSATION_MESSAGES;
DROP VIEW IF EXISTS USER_CONVERSATIONS_SUMMARY;
DROP PROCEDURE IF EXISTS UPDATE_CONVERSATION_TIMESTAMP(VARCHAR);
DROP PROCEDURE IF EXISTS UPDATE_MESSAGE_TIMESTAMP(VARCHAR);
DROP TABLE IF EXISTS MESSAGES;
DROP TABLE IF EXISTS FILES;
DROP TABLE IF EXISTS CONVERSATIONS;
```

## Next Steps

After schema creation:
1. Implement SnowflakeChatService in Node.js (Phase 2)
2. Replace MongoDB calls in Message.js and Conversation.js (Phase 3)
3. Run automated test suite (Phase 4)
4. Performance testing and optimization (Phase 5)

See [../documentation/snowflake-migration-progress.md](../../documentation/snowflake-migration-progress.md) for the complete implementation timeline.
