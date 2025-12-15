-- ================================================================
-- NexusChat Snowflake Test Data
-- Script: 02-test-data.sql
-- Purpose: Insert test data to validate schema and service layer
-- Dependencies: 01-create-chat-tables.sql must be run first
-- ================================================================

USE DATABASE AGENTNEXUS_DB;
USE SCHEMA AUTH_SCHEMA;

-- ================================================================
-- Get Test User ID
-- ================================================================

SET TEST_USER_ID = (
    SELECT USER_ID
    FROM USER_PROFILES
    WHERE EMAIL = 'kcrossley@videxa.co'
    LIMIT 1
);

-- Verify user exists
SELECT $TEST_USER_ID AS TEST_USER_ID;

-- ================================================================
-- Test Conversation 1: OpenAI GPT-4
-- ================================================================

INSERT INTO CONVERSATIONS (
    CONVERSATION_ID,
    USER_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    TEMPERATURE,
    MAX_TOKENS,
    TOP_P,
    PRESENCE_PENALTY,
    FREQUENCY_PENALTY,
    TAGS,
    IS_ARCHIVED
) VALUES (
    'test_conv_001',
    $TEST_USER_ID,
    'OpenAI GPT-4 Test Conversation',
    'openAI',
    'gpt-4-turbo',
    0.7,
    4096,
    1.0,
    0.0,
    0.0,
    ARRAY_CONSTRUCT('test', 'openai', 'gpt4'),
    FALSE
);

-- Messages for Test Conversation 1
INSERT INTO MESSAGES (
    MESSAGE_ID,
    CONVERSATION_ID,
    USER_ID,
    SENDER,
    TEXT,
    IS_CREATED_BY_USER,
    ENDPOINT,
    MODEL,
    TOKEN_COUNT,
    PROMPT_TOKENS,
    COMPLETION_TOKENS,
    FINISH_REASON
) VALUES
    -- User message 1
    (
        'test_msg_001',
        'test_conv_001',
        $TEST_USER_ID,
        'User',
        'Hello! Can you explain what NexusChat is?',
        TRUE,
        'openAI',
        'gpt-4-turbo',
        12,
        12,
        0,
        NULL
    ),
    -- Assistant response 1
    (
        'test_msg_002',
        'test_conv_001',
        $TEST_USER_ID,
        'Assistant',
        'NexusChat is a conversational AI platform that integrates with multiple LLM providers including OpenAI, Anthropic, and Google. It provides a unified interface for managing conversations, file attachments, and AI interactions.',
        FALSE,
        'openAI',
        'gpt-4-turbo',
        156,
        25,
        131,
        'stop'
    ),
    -- User message 2
    (
        'test_msg_003',
        'test_conv_001',
        $TEST_USER_ID,
        'User',
        'What data storage does it use?',
        TRUE,
        'openAI',
        'gpt-4-turbo',
        8,
        8,
        0,
        NULL
    ),
    -- Assistant response 2
    (
        'test_msg_004',
        'test_conv_001',
        $TEST_USER_ID,
        'Assistant',
        'NexusChat has been migrated to use Snowflake as its primary data storage backend, replacing MongoDB. This provides better scalability, security, and integration with enterprise data infrastructure.',
        FALSE,
        'openAI',
        'gpt-4-turbo',
        142,
        22,
        120,
        'stop'
    );

-- ================================================================
-- Test Conversation 2: Anthropic Claude with Advanced Features
-- ================================================================

INSERT INTO CONVERSATIONS (
    CONVERSATION_ID,
    USER_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    TEMPERATURE,
    MAX_TOKENS,
    PROMPT_CACHE,
    THINKING,
    THINKING_BUDGET,
    SYSTEM,
    TAGS,
    IS_ARCHIVED
) VALUES (
    'test_conv_002',
    $TEST_USER_ID,
    'Anthropic Claude with Prompt Caching',
    'anthropic',
    'claude-3-5-sonnet-20250112',
    0.5,
    8192,
    TRUE,
    TRUE,
    4096,
    'You are a helpful AI assistant specializing in data architecture and Snowflake.',
    ARRAY_CONSTRUCT('test', 'anthropic', 'claude', 'advanced'),
    FALSE
);

-- Messages for Test Conversation 2
INSERT INTO MESSAGES (
    MESSAGE_ID,
    CONVERSATION_ID,
    USER_ID,
    SENDER,
    TEXT,
    IS_CREATED_BY_USER,
    ENDPOINT,
    MODEL,
    TOKEN_COUNT,
    FINISH_REASON,
    METADATA
) VALUES
    (
        'test_msg_005',
        'test_conv_002',
        $TEST_USER_ID,
        'User',
        'Explain Snowflake clustering keys',
        TRUE,
        'anthropic',
        'claude-3-5-sonnet-20250112',
        8,
        NULL,
        PARSE_JSON('{"source": "web", "device": "desktop"}')
    ),
    (
        'test_msg_006',
        'test_conv_002',
        $TEST_USER_ID,
        'Assistant',
        'Snowflake clustering keys are used to optimize query performance by co-locating similar data in micro-partitions. When you define a clustering key, Snowflake organizes data based on those columns, reducing the number of partitions scanned during queries.',
        FALSE,
        'anthropic',
        'claude-3-5-sonnet-20250112',
        245,
        'end_turn',
        PARSE_JSON('{"cached": true, "cache_creation_input_tokens": 2051, "cache_read_input_tokens": 1950}')
    );

-- ================================================================
-- Test Conversation 3: Archived Conversation
-- ================================================================

INSERT INTO CONVERSATIONS (
    CONVERSATION_ID,
    USER_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    IS_ARCHIVED,
    TAGS
) VALUES (
    'test_conv_003',
    $TEST_USER_ID,
    'Old Archived Conversation',
    'openAI',
    'gpt-3.5-turbo',
    TRUE,
    ARRAY_CONSTRUCT('test', 'archived')
);

INSERT INTO MESSAGES (
    MESSAGE_ID,
    CONVERSATION_ID,
    USER_ID,
    SENDER,
    TEXT,
    IS_CREATED_BY_USER,
    ENDPOINT,
    MODEL
) VALUES
    (
        'test_msg_007',
        'test_conv_003',
        $TEST_USER_ID,
        'User',
        'This is an old conversation',
        TRUE,
        'openAI',
        'gpt-3.5-turbo'
    );

-- ================================================================
-- Test Conversation 4: With File Attachments (JSON examples)
-- ================================================================

INSERT INTO CONVERSATIONS (
    CONVERSATION_ID,
    USER_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    FILES,
    FILE_IDS,
    RESEND_FILES,
    TAGS
) VALUES (
    'test_conv_004',
    $TEST_USER_ID,
    'Conversation with File Attachments',
    'openAI',
    'gpt-4-vision-preview',
    ARRAY_CONSTRUCT('file_001', 'file_002'),
    ARRAY_CONSTRUCT('file_001', 'file_002'),
    TRUE,
    ARRAY_CONSTRUCT('test', 'files', 'images')
);

INSERT INTO MESSAGES (
    MESSAGE_ID,
    CONVERSATION_ID,
    USER_ID,
    SENDER,
    TEXT,
    IS_CREATED_BY_USER,
    ENDPOINT,
    MODEL,
    FILES,
    ATTACHMENTS
) VALUES
    (
        'test_msg_008',
        'test_conv_004',
        $TEST_USER_ID,
        'User',
        'What do you see in this image?',
        TRUE,
        'openAI',
        'gpt-4-vision-preview',
        PARSE_JSON('[
            {
                "file_id": "file_001",
                "filename": "architecture_diagram.png",
                "type": "image/png",
                "size": 245678
            }
        ]'),
        PARSE_JSON('[
            {
                "file_id": "file_001",
                "type": "image_file",
                "url": "https://storage.example.com/files/file_001.png"
            }
        ]')
    ),
    (
        'test_msg_009',
        'test_conv_004',
        $TEST_USER_ID,
        'Assistant',
        'I can see an architecture diagram showing the NexusChat system with Snowflake as the backend database, connected to AgentNexus API for authentication.',
        FALSE,
        'openAI',
        'gpt-4-vision-preview',
        NULL,
        NULL
    );

-- ================================================================
-- Test FILES Table
-- ================================================================

INSERT INTO FILES (
    FILE_ID,
    USER_ID,
    CONVERSATION_ID,
    FILENAME,
    FILEPATH,
    FILE_SIZE_BYTES,
    MIME_TYPE,
    SOURCE,
    EMBEDDED,
    USAGE_COUNT
) VALUES
    (
        'file_001',
        $TEST_USER_ID,
        'test_conv_004',
        'architecture_diagram.png',
        '/uploads/2025/01/architecture_diagram.png',
        245678,
        'image/png',
        'local',
        FALSE,
        1
    ),
    (
        'file_002',
        $TEST_USER_ID,
        'test_conv_004',
        'requirements.txt',
        '/uploads/2025/01/requirements.txt',
        1234,
        'text/plain',
        'local',
        TRUE,
        1
    );

-- ================================================================
-- Validation Queries
-- ================================================================

-- Verify conversations were inserted
SELECT
    CONVERSATION_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    IS_ARCHIVED,
    ARRAY_SIZE(TAGS) AS TAG_COUNT,
    CREATED_AT
FROM CONVERSATIONS
WHERE USER_ID = $TEST_USER_ID
ORDER BY CREATED_AT DESC;

-- Verify messages were inserted
SELECT
    MESSAGE_ID,
    CONVERSATION_ID,
    SENDER,
    SUBSTRING(TEXT, 1, 50) AS TEXT_PREVIEW,
    TOKEN_COUNT,
    CREATED_AT
FROM MESSAGES
WHERE USER_ID = $TEST_USER_ID
ORDER BY CREATED_AT ASC;

-- Verify files were inserted
SELECT
    FILE_ID,
    FILENAME,
    FILE_SIZE_BYTES,
    MIME_TYPE,
    USAGE_COUNT
FROM FILES
WHERE USER_ID = $TEST_USER_ID;

-- Test view: User conversations summary
SELECT *
FROM USER_CONVERSATIONS_SUMMARY
WHERE USER_ID = $TEST_USER_ID
ORDER BY UPDATED_AT DESC;

-- Test view: Conversation messages
SELECT
    MESSAGE_ID,
    CONVERSATION_TITLE,
    SENDER,
    SUBSTRING(TEXT, 1, 50) AS TEXT_PREVIEW,
    CREATED_AT
FROM CONVERSATION_MESSAGES
WHERE USER_ID = $TEST_USER_ID
    AND CONVERSATION_ID = 'test_conv_001'
ORDER BY CREATED_AT ASC;

-- ================================================================
-- Query Performance Tests
-- ================================================================

-- Test 1: Get user's active conversations (paginated)
SELECT
    CONVERSATION_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    UPDATED_AT,
    (SELECT COUNT(*) FROM MESSAGES m WHERE m.CONVERSATION_ID = c.CONVERSATION_ID) AS MESSAGE_COUNT
FROM CONVERSATIONS c
WHERE USER_ID = $TEST_USER_ID
    AND IS_ARCHIVED = FALSE
ORDER BY UPDATED_AT DESC
LIMIT 20;

-- Test 2: Get messages for specific conversation
SELECT
    MESSAGE_ID,
    SENDER,
    TEXT,
    TOKEN_COUNT,
    CREATED_AT
FROM MESSAGES
WHERE CONVERSATION_ID = 'test_conv_001'
    AND USER_ID = $TEST_USER_ID
ORDER BY CREATED_AT ASC;

-- Test 3: Search conversations by title
SELECT
    CONVERSATION_ID,
    TITLE,
    ENDPOINT,
    MODEL,
    CREATED_AT
FROM CONVERSATIONS
WHERE USER_ID = $TEST_USER_ID
    AND TITLE ILIKE '%snowflake%'
ORDER BY UPDATED_AT DESC;

-- Test 4: Get conversation with all messages (JOIN test)
SELECT
    c.CONVERSATION_ID,
    c.TITLE,
    c.ENDPOINT,
    c.MODEL,
    m.MESSAGE_ID,
    m.SENDER,
    m.TEXT,
    m.CREATED_AT AS MESSAGE_CREATED_AT
FROM CONVERSATIONS c
LEFT JOIN MESSAGES m ON c.CONVERSATION_ID = m.CONVERSATION_ID
WHERE c.USER_ID = $TEST_USER_ID
    AND c.CONVERSATION_ID = 'test_conv_001'
ORDER BY m.CREATED_AT ASC;

-- Test 5: Token usage summary per conversation
SELECT
    CONVERSATION_ID,
    COUNT(*) AS MESSAGE_COUNT,
    SUM(TOKEN_COUNT) AS TOTAL_TOKENS,
    SUM(PROMPT_TOKENS) AS TOTAL_PROMPT_TOKENS,
    SUM(COMPLETION_TOKENS) AS TOTAL_COMPLETION_TOKENS
FROM MESSAGES
WHERE USER_ID = $TEST_USER_ID
GROUP BY CONVERSATION_ID
ORDER BY TOTAL_TOKENS DESC;

-- ================================================================
-- Cleanup Test Data (for re-running tests)
-- ================================================================

/*
DELETE FROM MESSAGES WHERE USER_ID = $TEST_USER_ID AND MESSAGE_ID LIKE 'test_msg_%';
DELETE FROM FILES WHERE USER_ID = $TEST_USER_ID AND FILE_ID LIKE 'file_%';
DELETE FROM CONVERSATIONS WHERE USER_ID = $TEST_USER_ID AND CONVERSATION_ID LIKE 'test_conv_%';
*/
