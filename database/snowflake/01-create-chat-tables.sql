-- ================================================================
-- NexusChat Snowflake Schema Migration
-- Script: 01-create-chat-tables.sql
-- Purpose: Create CONVERSATIONS, MESSAGES, and FILES tables
-- Dependencies: Requires USER_PROFILES table from AgentNexus
-- ================================================================

-- Use the correct database and schema
-- NOTE: Run this script as ACCOUNTADMIN or a role with CREATE TABLE privileges
USE DATABASE AGENTNEXUS_DB;
USE SCHEMA AUTH_SCHEMA;

-- ================================================================
-- Table 1: CONVERSATIONS
-- Purpose: Store conversation metadata and LLM configuration
-- ================================================================

CREATE TABLE IF NOT EXISTS CONVERSATIONS (
    -- Primary identifiers
    CONVERSATION_ID VARCHAR(255) NOT NULL,
    USER_ID VARCHAR(255) NOT NULL,
    TITLE VARCHAR(500) DEFAULT 'New Chat',

    -- Core LLM parameters (required)
    ENDPOINT VARCHAR(100) NOT NULL,
    ENDPOINT_TYPE VARCHAR(100),
    MODEL VARCHAR(100),
    REGION VARCHAR(50),

    -- Display labels
    CHAT_GPT_LABEL VARCHAR(255),
    MODEL_LABEL VARCHAR(255),

    -- Prompt configuration
    PROMPT_PREFIX TEXT,
    SYSTEM TEXT,

    -- Sampling parameters
    TEMPERATURE FLOAT,
    TOP_P FLOAT,
    TOP_K INTEGER,
    PRESENCE_PENALTY FLOAT,
    FREQUENCY_PENALTY FLOAT,

    -- Token limits
    MAX_OUTPUT_TOKENS INTEGER,
    MAX_TOKENS INTEGER,
    MAX_CONTEXT_TOKENS INTEGER,
    MAX_TOKENS_ALT INTEGER,
    FILE_TOKEN_LIMIT INTEGER,

    -- Advanced features
    PROMPT_CACHE BOOLEAN DEFAULT FALSE,
    THINKING BOOLEAN DEFAULT FALSE,
    THINKING_BUDGET INTEGER,

    -- File handling
    RESEND_FILES BOOLEAN DEFAULT FALSE,
    IMAGE_DETAIL VARCHAR(50),

    -- Agent/Assistant configuration
    AGENT_ID VARCHAR(255),
    ASSISTANT_ID VARCHAR(255),
    INSTRUCTIONS TEXT,

    -- UI configuration
    IS_ARCHIVED BOOLEAN DEFAULT FALSE,
    ICON_URL VARCHAR(1000),
    GREETING TEXT,
    SPEC TEXT,

    -- API options
    USE_RESPONSES_API BOOLEAN DEFAULT FALSE,
    WEB_SEARCH BOOLEAN DEFAULT FALSE,
    DISABLE_STREAMING BOOLEAN DEFAULT FALSE,

    -- Reasoning models
    REASONING_EFFORT VARCHAR(50),
    REASONING_SUMMARY TEXT,
    VERBOSITY VARCHAR(50),

    -- Complex JSON fields
    AGENT_OPTIONS VARIANT,
    EXAMPLES VARIANT,

    -- Array fields
    FILE_IDS ARRAY,
    STOP ARRAY,
    TAGS ARRAY,
    TOOLS ARRAY,
    FILES ARRAY,

    -- Expiration
    EXPIRED_AT TIMESTAMP_NTZ,

    -- Timestamps
    CREATED_AT TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),

    -- Constraints
    PRIMARY KEY (CONVERSATION_ID),
    FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID),
    UNIQUE (CONVERSATION_ID, USER_ID)
);

-- Create indexes for CONVERSATIONS
CREATE INDEX IF NOT EXISTS IDX_CONVERSATIONS_USER_ID ON CONVERSATIONS(USER_ID);
CREATE INDEX IF NOT EXISTS IDX_CONVERSATIONS_CREATED_AT ON CONVERSATIONS(CREATED_AT);
CREATE INDEX IF NOT EXISTS IDX_CONVERSATIONS_UPDATED_AT ON CONVERSATIONS(UPDATED_AT);

-- Enable search optimization for CONVERSATIONS
ALTER TABLE CONVERSATIONS ADD SEARCH OPTIMIZATION ON EQUALITY(USER_ID, ENDPOINT, MODEL);
ALTER TABLE CONVERSATIONS ADD SEARCH OPTIMIZATION ON SUBSTRING(TITLE);

-- Cluster CONVERSATIONS by user and creation time
ALTER TABLE CONVERSATIONS CLUSTER BY (USER_ID, CREATED_AT);

COMMENT ON TABLE CONVERSATIONS IS 'Stores conversation metadata, LLM configuration, and parameters for NexusChat';

-- ================================================================
-- Table 2: MESSAGES
-- Purpose: Store individual messages within conversations
-- ================================================================

CREATE TABLE IF NOT EXISTS MESSAGES (
    -- Primary identifiers
    MESSAGE_ID VARCHAR(255) NOT NULL,
    CONVERSATION_ID VARCHAR(255) NOT NULL,
    USER_ID VARCHAR(255) NOT NULL,
    PARENT_MESSAGE_ID VARCHAR(255),

    -- Message content
    SENDER VARCHAR(50) NOT NULL,
    TEXT TEXT NOT NULL,
    IS_CREATED_BY_USER BOOLEAN NOT NULL DEFAULT FALSE,

    -- LLM metadata
    ENDPOINT VARCHAR(100),
    MODEL VARCHAR(100),

    -- Token usage
    TOKEN_COUNT INTEGER DEFAULT 0,
    PROMPT_TOKENS INTEGER DEFAULT 0,
    COMPLETION_TOKENS INTEGER DEFAULT 0,
    FINISH_REASON VARCHAR(50),

    -- Message state
    ERROR BOOLEAN DEFAULT FALSE,
    UNFINISHED BOOLEAN DEFAULT FALSE,
    CANCELLED BOOLEAN DEFAULT FALSE,
    SUBMITTED BOOLEAN DEFAULT FALSE,

    -- Features
    IS_LMNT_SPEECH_ENABLED BOOLEAN DEFAULT FALSE,
    GENERATION_STREAM_ID VARCHAR(255),

    -- Complex JSON fields
    ATTACHMENTS VARIANT,
    FILES VARIANT,
    FEEDBACK VARIANT,
    PLUGIN VARIANT,
    PLUGINS VARIANT,
    METADATA VARIANT,

    -- Timestamps
    CREATED_AT TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),

    -- Constraints
    PRIMARY KEY (MESSAGE_ID),
    FOREIGN KEY (CONVERSATION_ID) REFERENCES CONVERSATIONS(CONVERSATION_ID) ON DELETE CASCADE,
    FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID),
    UNIQUE (MESSAGE_ID, USER_ID)
);

-- Create indexes for MESSAGES
CREATE INDEX IF NOT EXISTS IDX_MESSAGES_CONVERSATION_ID ON MESSAGES(CONVERSATION_ID);
CREATE INDEX IF NOT EXISTS IDX_MESSAGES_USER_ID ON MESSAGES(USER_ID);
CREATE INDEX IF NOT EXISTS IDX_MESSAGES_CREATED_AT ON MESSAGES(CREATED_AT);
CREATE INDEX IF NOT EXISTS IDX_MESSAGES_PARENT_MESSAGE_ID ON MESSAGES(PARENT_MESSAGE_ID);

-- Enable search optimization for MESSAGES
ALTER TABLE MESSAGES ADD SEARCH OPTIMIZATION ON EQUALITY(CONVERSATION_ID, USER_ID, SENDER);
ALTER TABLE MESSAGES ADD SEARCH OPTIMIZATION ON SUBSTRING(TEXT);

-- Cluster MESSAGES by conversation and creation time
ALTER TABLE MESSAGES CLUSTER BY (CONVERSATION_ID, CREATED_AT);

COMMENT ON TABLE MESSAGES IS 'Stores individual messages within conversations, including user input and AI responses';

-- ================================================================
-- Table 3: FILES
-- Purpose: Store file metadata for attachments and uploads
-- ================================================================

CREATE TABLE IF NOT EXISTS FILES (
    -- Primary identifiers
    FILE_ID VARCHAR(255) NOT NULL,
    USER_ID VARCHAR(255) NOT NULL,
    CONVERSATION_ID VARCHAR(255),
    TEMP_FILE_ID VARCHAR(255),

    -- File metadata
    FILENAME VARCHAR(500) NOT NULL,
    FILEPATH VARCHAR(1000) NOT NULL,
    FILE_SIZE_BYTES INTEGER NOT NULL,
    MIME_TYPE VARCHAR(200) NOT NULL,
    FILE_OBJECT_TYPE VARCHAR(50) NOT NULL DEFAULT 'file',

    -- Processing metadata
    EMBEDDED BOOLEAN DEFAULT FALSE,
    TEXT_CONTENT TEXT,
    CONTEXT TEXT,
    USAGE_COUNT INTEGER DEFAULT 0,
    SOURCE VARCHAR(100) DEFAULT 'local',
    MODEL VARCHAR(100),

    -- Image dimensions (if applicable)
    WIDTH INTEGER,
    HEIGHT INTEGER,

    -- Additional identifiers
    FILE_IDENTIFIER VARCHAR(500),

    -- Expiration
    EXPIRES_AT TIMESTAMP_NTZ,

    -- Timestamps
    CREATED_AT TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),

    -- Constraints
    PRIMARY KEY (FILE_ID),
    FOREIGN KEY (USER_ID) REFERENCES USER_PROFILES(USER_ID),
    FOREIGN KEY (CONVERSATION_ID) REFERENCES CONVERSATIONS(CONVERSATION_ID) ON DELETE SET NULL
);

-- Create indexes for FILES
CREATE INDEX IF NOT EXISTS IDX_FILES_USER_ID ON FILES(USER_ID);
CREATE INDEX IF NOT EXISTS IDX_FILES_CONVERSATION_ID ON FILES(CONVERSATION_ID);
CREATE INDEX IF NOT EXISTS IDX_FILES_CREATED_AT ON FILES(CREATED_AT);

-- Enable search optimization for FILES
ALTER TABLE FILES ADD SEARCH OPTIMIZATION ON EQUALITY(USER_ID, CONVERSATION_ID, FILE_ID);
ALTER TABLE FILES ADD SEARCH OPTIMIZATION ON SUBSTRING(FILENAME);

-- Cluster FILES by user and creation time
ALTER TABLE FILES CLUSTER BY (USER_ID, CREATED_AT);

COMMENT ON TABLE FILES IS 'Stores file metadata for conversation attachments and uploads';

-- ================================================================
-- Automatic Update Timestamp Triggers
-- Note: Snowflake doesn't have native triggers, so UPDATED_AT
-- must be managed at application level or via tasks
-- ================================================================

-- Create a stored procedure to update UPDATED_AT timestamp
CREATE OR REPLACE PROCEDURE UPDATE_CONVERSATION_TIMESTAMP(CONV_ID VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
BEGIN
    UPDATE CONVERSATIONS
    SET UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE CONVERSATION_ID = :CONV_ID;
    RETURN 'Updated';
END;
$$;

CREATE OR REPLACE PROCEDURE UPDATE_MESSAGE_TIMESTAMP(MSG_ID VARCHAR)
RETURNS VARCHAR
LANGUAGE SQL
AS
$$
BEGIN
    UPDATE MESSAGES
    SET UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE MESSAGE_ID = :MSG_ID;
    RETURN 'Updated';
END;
$$;

-- ================================================================
-- Common Query Views
-- ================================================================

-- View: User's recent conversations with message count
CREATE OR REPLACE VIEW USER_CONVERSATIONS_SUMMARY AS
SELECT
    c.CONVERSATION_ID,
    c.USER_ID,
    c.TITLE,
    c.ENDPOINT,
    c.MODEL,
    c.IS_ARCHIVED,
    c.CREATED_AT,
    c.UPDATED_AT,
    COUNT(m.MESSAGE_ID) AS MESSAGE_COUNT,
    MAX(m.CREATED_AT) AS LAST_MESSAGE_AT
FROM CONVERSATIONS c
LEFT JOIN MESSAGES m ON c.CONVERSATION_ID = m.CONVERSATION_ID
GROUP BY
    c.CONVERSATION_ID,
    c.USER_ID,
    c.TITLE,
    c.ENDPOINT,
    c.MODEL,
    c.IS_ARCHIVED,
    c.CREATED_AT,
    c.UPDATED_AT;

-- View: Conversation with message thread
CREATE OR REPLACE VIEW CONVERSATION_MESSAGES AS
SELECT
    m.MESSAGE_ID,
    m.CONVERSATION_ID,
    m.USER_ID,
    m.PARENT_MESSAGE_ID,
    m.SENDER,
    m.TEXT,
    m.IS_CREATED_BY_USER,
    m.ENDPOINT,
    m.MODEL,
    m.TOKEN_COUNT,
    m.ERROR,
    m.CREATED_AT,
    m.UPDATED_AT,
    c.TITLE AS CONVERSATION_TITLE,
    c.ENDPOINT AS CONVERSATION_ENDPOINT,
    c.MODEL AS CONVERSATION_MODEL
FROM MESSAGES m
JOIN CONVERSATIONS c ON m.CONVERSATION_ID = c.CONVERSATION_ID;

-- ================================================================
-- Row-Level Security (Optional - uncomment to enable)
-- Ensures users can only access their own data
-- ================================================================

/*
CREATE OR REPLACE ROW ACCESS POLICY USER_ACCESS_POLICY
AS (USER_ID VARCHAR) RETURNS BOOLEAN ->
  USER_ID = CURRENT_USER()
;

ALTER TABLE CONVERSATIONS ADD ROW ACCESS POLICY USER_ACCESS_POLICY ON (USER_ID);
ALTER TABLE MESSAGES ADD ROW ACCESS POLICY USER_ACCESS_POLICY ON (USER_ID);
ALTER TABLE FILES ADD ROW ACCESS POLICY USER_ACCESS_POLICY ON (USER_ID);
*/

-- ================================================================
-- Grant Permissions to Service Role
-- ================================================================

-- Grant table permissions to the AgentNexus service role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE CONVERSATIONS TO ROLE AGENTNEXUS_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE MESSAGES TO ROLE AGENTNEXUS_SERVICE_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE FILES TO ROLE AGENTNEXUS_SERVICE_ROLE;

-- ================================================================
-- Validation Queries
-- ================================================================

-- Verify tables were created
SELECT TABLE_NAME, ROW_COUNT, BYTES
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'PUBLIC'
AND TABLE_NAME IN ('CONVERSATIONS', 'MESSAGES', 'FILES');

-- Verify foreign key relationships
SELECT
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE USING (CONSTRAINT_NAME)
WHERE TABLE_NAME IN ('CONVERSATIONS', 'MESSAGES', 'FILES');

-- ================================================================
-- Sample Data Insertion (for testing)
-- ================================================================

-- Insert sample conversation
/*
INSERT INTO CONVERSATIONS (
    CONVERSATION_ID,
    USER_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    TEMPERATURE,
    MAX_TOKENS
) VALUES (
    'conv_test_001',
    (SELECT USER_ID FROM USER_PROFILES WHERE EMAIL = 'kcrossley@videxa.co' LIMIT 1),
    'Test Conversation',
    'openAI',
    'gpt-4',
    0.7,
    4096
);

-- Insert sample message
INSERT INTO MESSAGES (
    MESSAGE_ID,
    CONVERSATION_ID,
    USER_ID,
    SENDER,
    TEXT,
    IS_CREATED_BY_USER,
    ENDPOINT,
    MODEL
) VALUES (
    'msg_test_001',
    'conv_test_001',
    (SELECT USER_ID FROM USER_PROFILES WHERE EMAIL = 'kcrossley@videxa.co' LIMIT 1),
    'User',
    'Hello, this is a test message',
    TRUE,
    'openAI',
    'gpt-4'
);
*/

-- ================================================================
-- Cleanup Script (for development/rollback)
-- ================================================================

/*
-- Uncomment to drop all tables and views
DROP VIEW IF EXISTS CONVERSATION_MESSAGES;
DROP VIEW IF EXISTS USER_CONVERSATIONS_SUMMARY;
DROP TABLE IF EXISTS MESSAGES;
DROP TABLE IF EXISTS FILES;
DROP TABLE IF EXISTS CONVERSATIONS;
DROP PROCEDURE IF EXISTS UPDATE_CONVERSATION_TIMESTAMP(VARCHAR);
DROP PROCEDURE IF EXISTS UPDATE_MESSAGE_TIMESTAMP(VARCHAR);
*/
