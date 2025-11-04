# Snowflake-Only Architecture - MongoDB Eliminated

**Status:** ✅ PRODUCTION READY
**Date:** January 2025
**Architecture:** 100% Snowflake (No MongoDB, No PostgreSQL, No RAG API)

---

## Executive Summary

**MongoDB has been eliminated** from the NexusChat architecture. All data now resides in **Snowflake**, providing:

✅ **Single Source of Truth** - All conversations, messages, claims, and user data in one system
✅ **Lower Costs** - Save $100-200/month by eliminating MongoDB hosting
✅ **Better HIPAA Compliance** - One system to audit instead of three
✅ **Simpler Operations** - 2 containers instead of 5
✅ **Better Analytics** - Query conversations alongside healthcare claims in SQL

---

## Architecture Comparison

### OLD (MongoDB-based)
```
┌─────────────┐
│  NexusChat  │
└──────┬──────┘
       │
       ├──► MongoDB (conversations)
       ├──► PostgreSQL (vectors)
       ├──► RAG API → OpenAI (❌ HIPAA violation)
       └──► Snowflake (claims data)
```

**Problems:**
- ❌ 3 separate databases to manage
- ❌ RAG API sends PHI to OpenAI
- ❌ MongoDB needs separate HIPAA audit
- ❌ Complex backup strategy
- ❌ Can't join conversations with claims data

### NEW (Snowflake-only)
```
┌─────────────┐
│  NexusChat  │
└──────┬──────┘
       │
       └──► Snowflake (everything)
             ├── NEXUSCHAT schema (conversations, messages)
             ├── CLAIMS schema (health insurance data)
             ├── PATIENTS schema (demographics)
             └── CORTEX (LLM + embeddings)
```

**Benefits:**
- ✅ 1 database for everything
- ✅ No external API calls
- ✅ Single HIPAA audit surface
- ✅ Snowflake Time Travel backups
- ✅ SQL joins across all data

---

## Data Model in Snowflake

### Per-Organization Database Structure

Each HCS organization (HCS0001 - HCS0020) has:

```
HCS0001_DB/
├── CLAIMS/
│   ├── INSURANCE_CLAIMS
│   └── CLAIM_HISTORY
├── PATIENTS/
│   └── PATIENT_RECORDS
├── CORTEX_DATA/
│   └── CLAIM_EMBEDDINGS
└── NEXUSCHAT/                  ← NEW: Replaces MongoDB
    ├── CONVERSATIONS
    ├── CHAT_MESSAGES
    ├── USER_SESSIONS
    ├── USER_PREFERENCES
    └── FILE_UPLOADS
```

### Conversation Tables

**CONVERSATIONS** (replaces MongoDB `conversations` collection)
```sql
CREATE TABLE CONVERSATIONS (
    CONVERSATION_ID VARCHAR(100) PRIMARY KEY,
    USER_ID VARCHAR(100) NOT NULL,
    TITLE VARCHAR(500),
    MODEL VARCHAR(100) DEFAULT 'claude-sonnet-4',
    SYSTEM_PROMPT TEXT,
    CREATED_AT TIMESTAMP_NTZ,
    UPDATED_AT TIMESTAMP_NTZ,
    LAST_MESSAGE_AT TIMESTAMP_NTZ,
    MESSAGE_COUNT INTEGER DEFAULT 0,
    TOTAL_TOKENS INTEGER DEFAULT 0,
    TOTAL_COST DECIMAL(10,6) DEFAULT 0.0,
    ARCHIVED BOOLEAN DEFAULT FALSE,
    METADATA VARIANT  -- JSON for flexible data
);
```

**CHAT_MESSAGES** (replaces MongoDB `messages` collection)
```sql
CREATE TABLE CHAT_MESSAGES (
    MESSAGE_ID VARCHAR(100) PRIMARY KEY,
    CONVERSATION_ID VARCHAR(100) NOT NULL,
    USER_ID VARCHAR(100),
    ROLE VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'system'
    CONTENT TEXT NOT NULL,
    PARENT_MESSAGE_ID VARCHAR(100),
    TOKENS_USED INTEGER,
    INPUT_TOKENS INTEGER,
    OUTPUT_TOKENS INTEGER,
    COST_ESTIMATE DECIMAL(10,6),
    CACHED BOOLEAN DEFAULT FALSE,
    LATENCY_MS INTEGER,
    MODEL VARCHAR(100),
    CREATED_AT TIMESTAMP_NTZ,
    METADATA VARIANT,
    FOREIGN KEY (CONVERSATION_ID) REFERENCES CONVERSATIONS(CONVERSATION_ID)
);
```

**USER_PREFERENCES** (replaces MongoDB user settings)
```sql
CREATE TABLE USER_PREFERENCES (
    USER_ID VARCHAR(100) PRIMARY KEY,
    THEME VARCHAR(20) DEFAULT 'light',
    LANGUAGE VARCHAR(10) DEFAULT 'en',
    DEFAULT_MODEL VARCHAR(100) DEFAULT 'claude-sonnet-4',
    TEMPERATURE FLOAT DEFAULT 0.7,
    MAX_TOKENS INTEGER DEFAULT 4096,
    ENABLE_CACHING BOOLEAN DEFAULT TRUE,
    PREFERENCES VARIANT,
    UPDATED_AT TIMESTAMP_NTZ
);
```

---

## API Endpoints (AgentNexus Backend)

### Conversation Management

**Create Conversation**
```bash
POST /api/conversations
Authorization: Bearer <JWT>

{
  "title": "Health Insurance Questions",
  "model": "claude-sonnet-4",
  "system_prompt": "You are a helpful assistant..."
}

Response:
{
  "success": true,
  "conversation_id": "conv-uuid-123",
  "title": "Health Insurance Questions",
  "created_at": "2025-01-15T10:30:00Z"
}
```

**List Conversations**
```bash
GET /api/conversations?limit=50&offset=0
Authorization: Bearer <JWT>

Response:
{
  "success": true,
  "conversations": [
    {
      "conversation_id": "conv-uuid-123",
      "title": "Health Insurance Questions",
      "message_count": 12,
      "total_tokens": 4500,
      "total_cost": 0.045,
      "last_message_at": "2025-01-15T14:22:00Z"
    }
  ],
  "total": 15,
  "limit": 50,
  "offset": 0
}
```

**Add Message**
```bash
POST /api/conversations/{conversation_id}/messages
Authorization: Bearer <JWT>

{
  "role": "user",
  "content": "What is a copay?"
}

Response:
{
  "success": true,
  "message_id": "msg-uuid-456",
  "conversation_id": "conv-uuid-123",
  "created_at": "2025-01-15T14:22:00Z"
}
```

**Get Messages**
```bash
GET /api/conversations/{conversation_id}/messages?limit=100
Authorization: Bearer <JWT>

Response:
{
  "success": true,
  "messages": [
    {
      "message_id": "msg-uuid-456",
      "role": "user",
      "content": "What is a copay?",
      "tokens_used": 10,
      "created_at": "2025-01-15T14:22:00Z"
    },
    {
      "message_id": "msg-uuid-457",
      "role": "assistant",
      "content": "A copay is...",
      "tokens_used": 150,
      "cached": false,
      "cost_estimate": 0.0015,
      "created_at": "2025-01-15T14:22:05Z"
    }
  ],
  "count": 2
}
```

**User Preferences**
```bash
GET /api/conversations/preferences/me
Authorization: Bearer <JWT>

Response:
{
  "success": true,
  "preferences": {
    "user_id": "user-123",
    "theme": "dark",
    "language": "en",
    "default_model": "claude-sonnet-4",
    "temperature": 0.7,
    "max_tokens": 4096,
    "enable_caching": true
  }
}

PUT /api/conversations/preferences/me
{
  "theme": "dark",
  "default_model": "claude-sonnet-4",
  "temperature": 0.5
}
```

---

## Deployment

### Step 1: Execute Snowflake Setup

```bash
snowsql -a vga30685.east-us-2.azure -u <ADMIN_USER>

# Execute conversation storage setup
!source C:\videxa-repos\NexusChat\snowflake-setup\05-conversation-storage.sql
```

**Verification:**
```sql
-- Check all orgs have conversation schema
SELECT
    ORG_ID,
    DATABASE_NAME,
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = 'NEXUSCHAT' AND TABLE_CATALOG = o.DATABASE_NAME) AS nexuschat_tables
FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o
WHERE STATUS = 'active';

-- Should show 5 tables per org (CONVERSATIONS, CHAT_MESSAGES, USER_SESSIONS, USER_PREFERENCES, FILE_UPLOADS)
```

### Step 2: Deploy AgentNexus Backend

```bash
cd C:\videxa-repos\agentnexus-backend

# Add new files to app/main.py
```

**Edit `app/main.py`:**
```python
from app.routers import conversations  # Add import

app.include_router(conversations.router)  # Register router
```

**Restart backend:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 3: Deploy NexusChat (Snowflake-Only)

```bash
cd C:\videxa-repos\NexusChat

# Use Snowflake-only docker-compose
docker-compose -f docker-compose.snowflake-only.yml down
docker-compose -f docker-compose.snowflake-only.yml up -d

# Verify only 2 containers running
docker ps

# Expected:
# - NexusChat-Videxa-Snowflake
# - nexuschat-meilisearch
# (NO mongodb, NO vectordb, NO rag_api)
```

### Step 4: Test End-to-End

```bash
# Create conversation
$conv = Invoke-RestMethod -Uri "http://localhost:8000/api/conversations" `
    -Method POST `
    -Headers @{Authorization="Bearer $env:AGENTNEXUS_API_KEY"; "Content-Type"="application/json"} `
    -Body (@{title="Test Conversation"; model="claude-sonnet-4"} | ConvertTo-Json)

$conv_id = $conv.conversation_id

# Add user message
$msg1 = Invoke-RestMethod -Uri "http://localhost:8000/api/conversations/$conv_id/messages" `
    -Method POST `
    -Headers @{Authorization="Bearer $env:AGENTNEXUS_API_KEY"; "Content-Type"="application/json"} `
    -Body (@{role="user"; content="What is a deductible?"} | ConvertTo-Json)

# Get chat completion
$completion = Invoke-RestMethod -Uri "http://localhost:8000/api/nexuschat/chat/completions" `
    -Method POST `
    -Headers @{Authorization="Bearer $env:AGENTNEXUS_API_KEY"; "Content-Type"="application/json"} `
    -Body (@{
        messages=@(@{role="user"; content="What is a deductible?"})
        model="claude-sonnet-4"
    } | ConvertTo-Json)

# Add assistant response to conversation
$msg2 = Invoke-RestMethod -Uri "http://localhost:8000/api/conversations/$conv_id/messages" `
    -Method POST `
    -Headers @{Authorization="Bearer $env:AGENTNEXUS_API_KEY"; "Content-Type"="application/json"} `
    -Body (@{role="assistant"; content=$completion.choices[0].message.content} | ConvertTo-Json)

# Get conversation history
$history = Invoke-RestMethod -Uri "http://localhost:8000/api/conversations/$conv_id/messages" `
    -Method GET `
    -Headers @{Authorization="Bearer $env:AGENTNEXUS_API_KEY"}

Write-Host "Conversation has $($history.count) messages"
```

---

## Cost Comparison

| Component | MongoDB Architecture | Snowflake-Only | Savings |
|-----------|---------------------|----------------|---------|
| MongoDB hosting | $50-200/month | $0 | **$50-200** |
| PostgreSQL hosting | $30-100/month | $0 | **$30-100** |
| Snowflake storage | $40/TB/month | $40/TB/month | $0 |
| Snowflake compute | ~$2/credit | ~$2/credit | $0 |
| **Total Monthly** | **$120-340** | **~$50** | **$70-290** |

**Annual Savings: $840 - $3,480**

*Note: Snowflake costs are variable based on usage, but conversation storage is minimal compared to claims data*

---

## Analytics Capabilities (Now Possible!)

### Query Conversations Alongside Claims

```sql
-- Find conversations about denied claims
SELECT
    c.CONVERSATION_ID,
    c.TITLE,
    c.CREATED_AT,
    m.CONTENT AS user_question,
    cl.CLAIM_ID,
    cl.DENIAL_REASON
FROM HCS0001_DB.NEXUSCHAT.CONVERSATIONS c
JOIN HCS0001_DB.NEXUSCHAT.CHAT_MESSAGES m
    ON c.CONVERSATION_ID = m.CONVERSATION_ID
JOIN HCS0001_DB.CLAIMS.INSURANCE_CLAIMS cl
    ON m.CONTENT ILIKE '%' || cl.CLAIM_ID || '%'
WHERE cl.CLAIM_STATUS = 'denied'
    AND m.ROLE = 'user'
ORDER BY c.CREATED_AT DESC;
```

### User Engagement by Claim Type

```sql
-- Users asking about specific diagnosis codes
SELECT
    m.USER_ID,
    COUNT(DISTINCT c.CONVERSATION_ID) AS conversations,
    ARRAY_AGG(DISTINCT cl.DIAGNOSIS_CODE) AS diagnosis_codes_discussed
FROM HCS0001_DB.NEXUSCHAT.CHAT_MESSAGES m
JOIN HCS0001_DB.NEXUSCHAT.CONVERSATIONS c
    ON m.CONVERSATION_ID = c.CONVERSATION_ID
LEFT JOIN HCS0001_DB.CLAIMS.INSURANCE_CLAIMS cl
    ON m.CONTENT ILIKE '%' || cl.DIAGNOSIS_CODE || '%'
WHERE cl.DIAGNOSIS_CODE IS NOT NULL
GROUP BY m.USER_ID
ORDER BY conversations DESC;
```

### Cost Analysis by Conversation Topic

```sql
-- LLM costs by conversation topic
SELECT
    CASE
        WHEN c.TITLE ILIKE '%claim%' THEN 'Claims Questions'
        WHEN c.TITLE ILIKE '%policy%' THEN 'Policy Questions'
        WHEN c.TITLE ILIKE '%coverage%' THEN 'Coverage Questions'
        ELSE 'Other'
    END AS topic,
    COUNT(*) AS conversation_count,
    SUM(c.MESSAGE_COUNT) AS total_messages,
    SUM(c.TOTAL_TOKENS) AS total_tokens,
    ROUND(SUM(c.TOTAL_COST), 2) AS total_cost,
    ROUND(AVG(c.TOTAL_COST), 4) AS avg_cost_per_conversation
FROM HCS0001_DB.NEXUSCHAT.CONVERSATIONS c
WHERE c.CREATED_AT >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY topic
ORDER BY total_cost DESC;
```

---

## Migration from MongoDB (If Needed)

If you have existing MongoDB data to migrate:

```python
# migration-script.py
import pymongo
import snowflake.connector

# Connect to MongoDB
mongo_client = pymongo.MongoClient("mongodb://...")
mongo_db = mongo_client["NexChat"]

# Connect to Snowflake
snow_conn = snowflake.connector.connect(...)

# Migrate conversations
for conv in mongo_db.conversations.find():
    snow_conn.cursor().execute("""
        INSERT INTO CONVERSATIONS (
            CONVERSATION_ID, USER_ID, TITLE, MODEL, CREATED_AT
        ) VALUES (%s, %s, %s, %s, %s)
    """, (
        conv['_id'],
        conv['userId'],
        conv.get('title'),
        conv.get('model', 'claude-sonnet-4'),
        conv['createdAt']
    ))

# Migrate messages
for msg in mongo_db.messages.find():
    snow_conn.cursor().execute("""
        INSERT INTO CHAT_MESSAGES (
            MESSAGE_ID, CONVERSATION_ID, USER_ID, ROLE, CONTENT, CREATED_AT
        ) VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        msg['_id'],
        msg['conversationId'],
        msg.get('userId'),
        msg['role'],
        msg['content'],
        msg['createdAt']
    ))

snow_conn.commit()
```

---

## Monitoring

### Conversation Activity Dashboard

```sql
-- Daily conversation metrics
SELECT * FROM VIDEXA_SHARED.REPORTING.V_DAILY_CONVERSATION_ACTIVITY
WHERE date >= DATEADD(day, -30, CURRENT_DATE())
ORDER BY date DESC, new_conversations DESC;

-- User engagement
SELECT * FROM VIDEXA_SHARED.REPORTING.V_USER_ENGAGEMENT
WHERE total_cost > 0.10  -- Users spending > $0.10
ORDER BY total_cost DESC;
```

### Storage Monitoring

```sql
-- Conversation storage by org
SELECT
    o.ORG_ID,
    (SELECT COUNT(*) FROM IDENTIFIER(o.DATABASE_NAME || '.NEXUSCHAT.CONVERSATIONS')) AS conversation_count,
    (SELECT COUNT(*) FROM IDENTIFIER(o.DATABASE_NAME || '.NEXUSCHAT.CHAT_MESSAGES')) AS message_count,
    (SELECT SUM(TOTAL_COST) FROM IDENTIFIER(o.DATABASE_NAME || '.NEXUSCHAT.CONVERSATIONS')) AS total_llm_cost
FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS o
WHERE o.STATUS = 'active'
ORDER BY message_count DESC;
```

---

## Troubleshooting

### Issue: "Failed to create conversation"

**Check org database exists:**
```sql
SHOW DATABASES LIKE 'HCS%';

-- Check NEXUSCHAT schema exists
USE DATABASE HCS0001_DB;
SHOW SCHEMAS;
```

**If NEXUSCHAT schema missing:**
```sql
CALL VIDEXA_SHARED.TENANT_MANAGEMENT.ADD_CONVERSATION_STORAGE_TO_EXISTING_ORGS();
```

### Issue: "Conversation not found"

**Verify user owns conversation:**
```sql
USE DATABASE HCS0001_DB;
USE SCHEMA NEXUSCHAT;

SELECT * FROM CONVERSATIONS
WHERE CONVERSATION_ID = '<conversation-id>';

-- Check USER_ID matches authenticated user
```

### Issue: "NexusChat can't connect to backend"

**Verify AgentNexus is running:**
```bash
curl http://localhost:8000/api/conversations
# Should return 401 (auth required) not connection refused
```

**Check environment variables:**
```bash
docker exec NexusChat-Videxa-Snowflake env | grep AGENTNEXUS
# Should show AGENTNEXUS_API_URL and AGENTNEXUS_API_KEY
```

---

## Benefits Summary

### For You (Admin)
✅ **Simpler operations** - 1 database instead of 3
✅ **Lower costs** - Save $70-290/month
✅ **Single backup strategy** - Snowflake Time Travel
✅ **Easier monitoring** - All metrics in one place

### For Compliance
✅ **Single HIPAA audit** - Only Snowflake needs BAA
✅ **No external APIs** - No data leaves tenant
✅ **Complete audit trail** - All operations logged
✅ **Data residency** - Everything in US region

### For Users
✅ **Faster queries** - No network hops between databases
✅ **Better search** - Snowflake Cortex Search
✅ **Conversation history** - Persistent across devices
✅ **Personalized experience** - Preferences saved

### For Developers
✅ **Single API** - AgentNexus handles everything
✅ **SQL queries** - No MongoDB query language
✅ **Better analytics** - Join conversations with claims
✅ **TypeScript types** - Generated from Snowflake schema

---

## Next Steps

1. ✅ Execute `05-conversation-storage.sql` in Snowflake
2. ✅ Deploy updated AgentNexus backend
3. ✅ Deploy NexusChat with `docker-compose.snowflake-only.yml`
4. ✅ Test conversation creation and retrieval
5. ✅ Monitor costs and performance
6. ✅ Celebrate eliminating MongoDB! 🎉

---

**MongoDB is dead. Long live Snowflake!** ❄️
