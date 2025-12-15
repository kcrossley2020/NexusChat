# MeiliSearch Removal Status and Snowflake Replacement

**Last Updated:** 2025-12-15
**Status:** Partially Complete - Code Remains, Container Disabled
**Replacement:** Snowflake Cortex Search (Not Yet Implemented)

---

## Executive Summary

MeiliSearch was the original search engine used for full-text search of conversations and messages in the MongoDB-based architecture. With the migration to Snowflake-only architecture, MeiliSearch is **no longer needed** as Snowflake Cortex provides native search capabilities.

### Current State

| Component | Status | Action Required |
|-----------|--------|-----------------|
| MeiliSearch Container | Disabled (commented out) | None |
| MeiliSearch npm Package | Still installed | Can be removed |
| MeiliSearch Code | Still present in codebase | Conditional loading prevents execution |
| Environment Variables | SEARCH=true but MEILI disabled | Should set SEARCH=false |
| Snowflake Search | Not implemented | Future enhancement |
| meili_data_v1.12 directory | Exists with old data | Can be deleted |

---

## MeiliSearch References Found

### Configuration Files (Active)

| File | Status | Notes |
|------|--------|-------|
| `.env` | MEILI vars present | SEARCH=true, MEILI_HOST/KEY set but container gone |
| `docker-compose.snowflake-only.yml` | Container commented out | Correctly disabled |
| `docker-compose.videxa-secure.yml` | Container active | Old compose file, not used |
| `.devcontainer/docker-compose.yml` | Container active | Dev container config |

### Configuration Files (Archived/Utils)

| File | Status | Notes |
|------|--------|-------|
| `archive/2025-11-07-cleanup/docker-compose/` | Historical | Archived config |
| `utils/docker/test-compose.yml` | Test config | Contains MeiliSearch |
| `helm/librechat/` | Helm charts | Contains MeiliSearch chart dependency |

### Source Code Files (Still Present)

| File | Purpose | Status |
|------|---------|--------|
| `packages/data-schemas/src/models/plugins/mongoMeili.ts` | Main plugin (773 lines) | Conditionally loaded |
| `packages/data-schemas/src/config/meiliLogger.ts` | Logger config | Active but unused |
| `api/config/meiliLogger.js` | API logger | Active but unused |
| `api/db/indexSync.js` | Sync functionality | Disabled via USE_SNOWFLAKE_STORAGE |
| `api/server/routes/search.js` | Search endpoint | Returns false when Meili unavailable |
| `api/models/Conversation.js` | Model with meiliSearch method | Falls back gracefully |
| `config/reset-meili-sync.js` | Reset utility | Not executed |

### Package Dependencies

| File | Dependency | Status |
|------|------------|--------|
| `api/package.json` | `"meilisearch": "^0.38.0"` | Can be removed |
| `packages/data-schemas/package.json` | `"meilisearch": "^0.38.0"` | Can be removed |

### Documentation Files

| File | Content | Recommendation |
|------|---------|----------------|
| `documentation/MEILISEARCH-REMOVAL-PLAN.md` | Removal plan | Keep for reference |
| `documentation/DEPLOYMENT-COMPLETE.md` | References meilisearch | Update |
| `documentation/e2e-testing-setup.md` | References meilisearch | Update |
| `DOCKER-SETUP.md` | MeiliSearch service docs | Update |
| `MEILISEARCH-FIX-COMPLETE.md` | Root directory | Can be archived |

---

## How MeiliSearch is Currently Disabled

### 1. Environment Variable Checks

The `mongoMeili.ts` plugin checks three conditions before enabling:

```typescript
const meiliEnabled =
  process.env.MEILI_HOST != null &&
  process.env.MEILI_MASTER_KEY != null &&
  searchEnabled;  // SEARCH === 'true'
```

### 2. Snowflake Storage Override

From `mongoMeili.ts` line ~388:

```typescript
if (useSnowflakeStorage || !meiliEnabled) {
  // Plugin returns without adding any hooks
  return;
}
```

When `USE_SNOWFLAKE_STORAGE=true`, the MeiliSearch plugin is completely bypassed.

### 3. Container Not Running

The `docker-compose.snowflake-only.yml` has MeiliSearch commented out:

```yaml
# meilisearch: REMOVED - Using Snowflake for search
#   container_name: nexuschat-meilisearch
#   image: getmeili/meilisearch:v1.12.3
```

---

## Snowflake Replacement Architecture

### What MeiliSearch Provided
1. Full-text search for conversation titles
2. Full-text search for message content
3. Fast autocomplete suggestions
4. Relevance ranking

### Snowflake Replacement Options

#### Option 1: Basic SQL ILIKE Search (Currently Available)

```sql
-- Search conversations
SELECT CONVERSATION_ID, TITLE, CREATED_AT
FROM CONVERSATIONS
WHERE USER_ID = :user_id
  AND (TITLE ILIKE '%' || :search_query || '%'
       OR SYSTEM_PROMPT ILIKE '%' || :search_query || '%')
ORDER BY UPDATED_AT DESC
LIMIT 50;

-- Search messages
SELECT MESSAGE_ID, CONVERSATION_ID, CONTENT, CREATED_AT
FROM CHAT_MESSAGES
WHERE USER_ID = :user_id
  AND CONTENT ILIKE '%' || :search_query || '%'
ORDER BY CREATED_AT DESC
LIMIT 100;
```

#### Option 2: Snowflake Cortex Search (Recommended)

```sql
-- Create search service for conversations
CREATE OR REPLACE CORTEX SEARCH SERVICE conversation_search
  ON conversationId, title, systemPrompt
  WAREHOUSE = COMPUTE_WH
  TARGET_LAG = '1 minute'
  AS (
    SELECT
      CONVERSATION_ID as conversationId,
      TITLE as title,
      SYSTEM_PROMPT as systemPrompt,
      USER_ID as userId,
      CREATED_AT as createdAt
    FROM CONVERSATIONS
  );

-- Query search service
SELECT * FROM TABLE(
  SNOWFLAKE.CORTEX.SEARCH(
    'conversation_search',
    :search_query,
    { 'filter': { 'userId': :user_id }, 'limit': 50 }
  )
);
```

#### Option 3: Vector Similarity Search (Advanced)

```sql
-- Create embeddings for semantic search
ALTER TABLE CONVERSATIONS ADD COLUMN IF NOT EXISTS
  TITLE_EMBEDDING VECTOR(FLOAT, 768);

-- Generate embeddings
UPDATE CONVERSATIONS
SET TITLE_EMBEDDING = SNOWFLAKE.CORTEX.EMBED_TEXT_768(
  'snowflake-arctic-embed-m',
  TITLE
);

-- Semantic search
SELECT CONVERSATION_ID, TITLE,
  VECTOR_COSINE_SIMILARITY(
    TITLE_EMBEDDING,
    SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', :query)
  ) as similarity
FROM CONVERSATIONS
WHERE USER_ID = :user_id
ORDER BY similarity DESC
LIMIT 20;
```

---

## Recommended Cleanup Actions

### Priority 1: Environment Variable Cleanup

Update `.env`:
```bash
# BEFORE:
SEARCH=true
MEILI_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=nex-meili-master-key-change-in-production

# AFTER:
SEARCH=false
# MEILI_HOST and MEILI_MASTER_KEY removed or commented out
```

### Priority 2: Remove meili_data Directory

```bash
rm -rf C:/videxa-repos/NexusChat/meili_data_v1.12
```

### Priority 3: Update docker-compose Files

**docker-compose.videxa-secure.yml** - Comment out MeiliSearch service if still in use

### Priority 4: Remove npm Dependencies (Optional)

```bash
# From api directory
npm uninstall meilisearch

# From packages/data-schemas directory
npm uninstall meilisearch
```

### Priority 5: Archive Root-Level MeiliSearch Docs

Move to archive:
- `MEILISEARCH-FIX-COMPLETE.md`
- `MEILISEARCH-REMOVAL-SUMMARY.md`

### Priority 6: Implement Snowflake Search (Future)

1. Create search function in AgentNexus backend
2. Update frontend search component
3. Test with E2E tests

---

## Files That Can Be Safely Removed/Archived

### Directories
- `meili_data_v1.12/` - Old MeiliSearch data

### Root Files
- `MEILISEARCH-FIX-COMPLETE.md` - Archive
- `MEILISEARCH-REMOVAL-SUMMARY.md` - Archive

### Documentation (Update Rather Than Delete)
- Update references in DEPLOYMENT-COMPLETE.md
- Update references in DOCKER-SETUP.md
- Update references in e2e-testing-setup.md

---

## Why Not Remove All MeiliSearch Code?

1. **Upstream Compatibility** - NexusChat is a fork of LibreChat. Removing MeiliSearch code would make upstream merges difficult.

2. **Conditional Loading** - The code already has conditional loading that bypasses MeiliSearch when Snowflake is used.

3. **High Risk** - Removing 52+ files with MeiliSearch references risks breaking other functionality.

4. **Future Flexibility** - If non-Snowflake deployments are needed, MeiliSearch remains an option.

---

## Search Feature Status

| Feature | MeiliSearch (Old) | Snowflake (Current) | Status |
|---------|-------------------|---------------------|--------|
| Conversation title search | Supported | Basic ILIKE | Degraded |
| Message content search | Supported | Basic ILIKE | Degraded |
| Autocomplete | Supported | Not implemented | Missing |
| Relevance ranking | Supported | Not implemented | Missing |
| Fuzzy matching | Supported | Not implemented | Missing |
| Semantic search | Not supported | Cortex available | Upgrade opportunity |

---

## Conclusion

MeiliSearch has been **operationally disabled** through:
1. Container removal from docker-compose.snowflake-only.yml
2. USE_SNOWFLAKE_STORAGE=true bypasses the plugin
3. Environment variables point to non-existent service

**However**, the following remain and should be cleaned up:
1. npm dependencies (meilisearch package)
2. Source code files (conditionally loaded but present)
3. meili_data directory
4. Documentation references
5. .env variables

**Recommended Action**: Perform Priority 1-3 cleanup immediately, defer Priority 4-6 for future sprint.

---

**Document Version:** 1.0
**Prepared By:** Claude (AI Assistant)
**Review Cycle:** After search feature implementation
