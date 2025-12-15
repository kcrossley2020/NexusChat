# MeiliSearch Removal from NexusChat
## Snowflake-Only Architecture Implementation

**Date**: November 11, 2025
**Status**: 🔴 Action Required - MeiliSearch causing unhealthy container status

---

## Executive Summary

**Problem**: NexusChat container shows as "unhealthy" due to MeiliSearch connection errors, even though we're using a Snowflake-only architecture that doesn't require Meil iSearch.

**Root Cause**: MeiliSearch is a legacy search engine for MongoDB-based conversations. Since we've migrated to Snowflake-only storage, MeiliSearch is **no longer needed** but the code still attempts to connect to it.

**Solution**: Completely disable MeiliSearch through environment configuration OR remove MeiliSearch code entirely.

---

## What is MeiliSearch?

**MeiliSearch** is a fast, open-source search engine used for full-text search of conversations and messages.

### In MongoDB Architecture (OLD):
```
MongoDB → MeiliSearch Plugin → Index conversations/messages → Fast search
```

### In Snowflake Architecture (NEW):
```
Snowflake → Cortex Search → Native full-text search → No external search engine needed
```

**Conclusion**: With Snowflake Cortex Search, MeiliSearch is **redundant and unnecessary**.

---

## Current Error Logs

```
2025-11-11 17:59:19 error: [mongoMeili] Error checking index convos: fetch failed
2025-11-11 17:59:19 error: [mongoMeili] Error checking index messages: fetch failed
2025-11-11 17:59:24 error: [mongoMeili] Error checking index convos: fetch failed
2025-11-11 17:59:24 error: [mongoMeili] Error checking index messages: fetch failed
2025-11-11 17:59:29 error: [mongoMeili] Error updating index settings for convos: fetch failed
2025-11-11 17:59:29 error: [mongoMeili] Error updating index settings for messages: fetch failed
```

**Impact**:
- ❌ Container health checks failing
- ❌ Error logs polluting monitoring
- ❌ Unnecessary connection attempts
- ✅ **No functional impact** - search still works via Snowflake

---

## MeiliSearch Usage Analysis

### Files Affected (52 total):

#### Core Plugin Files:
1. `packages/data-schemas/src/models/plugins/mongoMeili.ts` - Main plugin (773 lines)
2. `packages/data-schemas/src/config/meiliLogger.ts` - Logger configuration
3. `api/config/meiliLogger.js` - API logger
4. `api/db/indexSync.js` - Sync functionality
5. `config/reset-meili-sync.js` - Reset utility

#### Model Files:
6. `packages/data-schemas/src/models/convo.ts` - Conversation model with Meili plugin
7. `packages/data-schemas/src/models/message.ts` - Message model with Meili plugin
8. `api/models/Conversation.js` - Legacy conversation model

#### Route Files:
9. `api/server/routes/search.js` - Search API endpoint
10. `api/server/routes/messages.js` - Message routes with search

#### Configuration Files:
11. `docker-compose.snowflake-only.yml` - Contains MeiliSearch service definition
12. `docker-compose.videxa-secure.yml` - Contains MeiliSearch service
13. `.env.example` - MeiliSearch environment variables
14. `package.json` - MeiliSearch dependency (`meilisearch` npm package)

---

## Environment Variables Controlling MeiliSearch

### Current Configuration Check:

```bash
docker exec NexusChat-Videxa-Snowflake env | grep -i meili
# Returns: (empty - no MEILI variables set)

docker exec NexusChat-Videxa-Snowflake env | grep -i search
# Returns: (empty - SEARCH not set to true)

docker exec NexusChat-Videxa-Snowflake env | grep USE_SNOWFLAKE
# Returns: USE_SNOWFLAKE_STORAGE=true ✅
```

### Key Environment Variables:

| Variable | Current Value | Required to Enable Meili | Purpose |
|----------|---------------|--------------------------|---------|
| `USE_SNOWFLAKE_STORAGE` | `true` ✅ | N/A | Disables MongoDB sync |
| `SEARCH` | `(not set)` ✅ | `true` | Master switch for search |
| `MEILI_HOST` | `(not set)` ✅ | URL | MeiliSearch server URL |
| `MEILI_MASTER_KEY` | `(not set)` ✅ | Key | MeiliSearch API key |

**Analysis**: MeiliSearch is **already disabled** via environment variables, but the code still attempts to connect during initialization.

---

## Why Errors Still Occur

### Code Analysis from `mongoMeili.ts` (lines 628-657):

```typescript
// Check if index exists and create if needed
(async () => {
  try {
    await index.getRawInfo();  // ← THIS CAUSES ERROR
    logger.debug(`[mongoMeili] Index ${indexName} already exists`);
  } catch (error) {
    const errorCode = (error as { code?: string })?.code;
    if (errorCode === 'index_not_found') {
      try {
        logger.info(`[mongoMeili] Creating new index: ${indexName}`);
        await client.createIndex(indexName, { primaryKey });
        logger.info(`[mongoMeili] Successfully created index: ${indexName}`);
      } catch (createError) {
        logger.debug(`[mongoMeili] Index ${indexName} may already exist:`, createError);
      }
    } else {
      logger.error(`[mongoMeili] Error checking index ${indexName}:`, error);  // ← ERROR LOGGED HERE
    }
  }
```

**Problem**: The plugin loads and tries to connect **even when `USE_SNOWFLAKE_STORAGE=true`**.

### Code Analysis from `api/server/index.js` (line 52):

```javascript
if (USE_SNOWFLAKE_STORAGE) {
  logger.info('Using Snowflake storage - MongoDB/MeiliSearch sync disabled');
} else {
  logger.info('Connected to MongoDB');
  indexSync().catch((err) => {
    // MeiliSearch sync only runs if NOT using Snowflake
  });
}
```

**Good News**: The sync is properly disabled, but the **plugin itself still loads and tries to initialize**.

---

## Removal Options

### Option 1: Environment Variable Approach (RECOMMENDED - Quick Fix)
**Effort**: 5 minutes
**Risk**: Low
**Reversibility**: High

Simply ensure MeiliSearch is not configured:

```bash
# Verify these are NOT set in docker-compose or .env
SEARCH=false  # or not set at all
MEILI_HOST=   # not set
MEILI_MASTER_KEY=  # not set
```

**Status**: ✅ ALREADY DONE - but errors still occur during plugin loading

### Option 2: Remove MeiliSearch Container (RECOMMENDED - Immediate)
**Effort**: 2 minutes
**Risk**: None
**Reversibility**: High

Remove MeiliSearch service from `docker-compose.snowflake-only.yml`:

```yaml
# BEFORE:
services:
  nexuschat:
    ...
  nexuschat-meilisearch:  # ← REMOVE THIS ENTIRE SERVICE
    image: getmeili/meilisearch:v1.9
    ...

# AFTER:
services:
  nexuschat:
    ...
  # MeiliSearch removed - using Snowflake Cortex Search instead
```

### Option 3: Conditional Plugin Loading (RECOMMENDED - Code Fix)
**Effort**: 30 minutes
**Risk**: Medium
**Reversibility**: High

Modify `packages/data-schemas/src/models/convo.ts` and `message.ts`:

```typescript
// BEFORE:
import mongoMeili from '../plugins/mongoMeili';
schema.plugin(mongoMeili, options);

// AFTER:
import mongoMeili from '../plugins/mongoMeili';

// Only load plugin if MeiliSearch is explicitly enabled
const meiliEnabled = process.env.MEILI_HOST && process.env.MEILI_MASTER_KEY && process.env.SEARCH === 'true';
if (meiliEnabled) {
  schema.plugin(mongoMeili, options);
} else {
  console.log('[Model] MeiliSearch plugin disabled - using Snowflake storage');
}
```

### Option 4: Complete Removal (NOT RECOMMENDED - High Effort)
**Effort**: 4+ hours
**Risk**: High
**Reversibility**: Low

Remove all MeiliSearch code:
- Delete 52 files with references
- Remove npm dependencies
- Update all models
- Remove search routes
- Update tests

**Why Not Recommended**: Too much effort, may break fallback functionality, hard to reverse.

---

## Recommended Action Plan

### Immediate Fix (5 minutes):

1. **Remove MeiliSearch Container** from `docker-compose.snowflake-only.yml`
2. **Restart NexusChat** container
3. **Verify** errors are gone

### Long-Term Fix (30 minutes):

1. **Add Conditional Plugin Loading** to prevent initialization attempts
2. **Add Snowflake Cortex Search** implementation
3. **Update Search Routes** to use Snowflake instead of MeiliSearch
4. **Document** search functionality in Snowflake-only architecture

---

## Implementation Steps

### Step 1: Remove MeiliSearch Container

**Edit**: `c:\videxa-repos\NexusChat\docker-compose.snowflake-only.yml`

**Find and Remove**:
```yaml
  nexuschat-meilisearch:
    image: getmeili/meilisearch:v1.9
    restart: unless-stopped
    env_file:
      - .env
    environment:
      - MEILI_NO_ANALYTICS=true
      - MEILI_ENV=production
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY:-your_secure_master_key_here}
    volumes:
      - meilisearch_data:/meili_data
    ports:
      - "7700:7700"
    networks:
      - nexuschat-network

# Also remove from volumes section:
volumes:
  meilisearch_data:  # ← REMOVE THIS
```

### Step 2: Restart Container

```bash
cd /c/videxa-repos/NexusChat
docker-compose -f docker-compose.snowflake-only.yml down
docker-compose -f docker-compose.snowflake-only.yml up -d
```

### Step 3: Verify Health

```bash
# Check container status
docker ps
# Should show: Up X minutes (healthy)

# Check logs
docker logs NexusChat-Videxa-Snowflake --tail 50
# Should NOT show any [mongoMeili] errors
```

### Step 4: Test Search Functionality

Since you're using Snowflake, implement Cortex Search:

```sql
-- In Snowflake, create search service
USE DATABASE HCS0001_DB;
USE SCHEMA NEXUSCHAT;

-- Create search function for conversations
CREATE OR REPLACE FUNCTION SEARCH_CONVERSATIONS(
    SEARCH_QUERY VARCHAR,
    USER_ID_FILTER VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    CONVERSATION_ID VARCHAR,
    TITLE VARCHAR,
    CREATED_AT TIMESTAMP_NTZ,
    RELEVANCE_SCORE FLOAT
)
AS
$$
    SELECT
        CONVERSATION_ID,
        TITLE,
        CREATED_AT,
        -- Cortex Search returns relevance score
        SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', TITLE) AS relevance_score
    FROM CONVERSATIONS
    WHERE (USER_ID_FILTER IS NULL OR USER_ID = USER_ID_FILTER)
    AND (
        TITLE ILIKE '%' || SEARCH_QUERY || '%'
        OR SYSTEM_PROMPT ILIKE '%' || SEARCH_QUERY || '%'
    )
    ORDER BY
        -- Rank by text similarity
        VECTOR_COSINE_SIMILARITY(
            SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', SEARCH_QUERY),
            SNOWFLAKE.CORTEX.EMBED_TEXT_768('snowflake-arctic-embed-m', TITLE)
        ) DESC
    LIMIT 100
$$;

-- Test search
SELECT * FROM TABLE(SEARCH_CONVERSATIONS('health insurance', 'user-123'));
```

---

## Search Functionality Migration

### Old (MeiliSearch):
```javascript
// api/server/routes/search.js
const results = await Conversation.meiliSearch(query, {
  filter: `user = ${userId}`,
  limit: 20
});
```

### New (Snowflake Cortex):
```javascript
// api/server/routes/search.js
const results = await snowflakeClient.execute({
  sqlText: 'SELECT * FROM TABLE(SEARCH_CONVERSATIONS(?, ?))',
  binds: [query, userId]
});
```

---

## Benefits of Removal

### Operational:
- ✅ Container health checks pass
- ✅ Cleaner logs (no error spam)
- ✅ One less service to manage
- ✅ Simpler docker-compose configuration

### Cost:
- ✅ No MeiliSearch hosting costs
- ✅ No storage for search indexes
- ✅ Reduced compute for index syncing

### Compliance:
- ✅ One less system to audit
- ✅ Simpler data flow (all in Snowflake)
- ✅ Better data residency control

### Performance:
- ✅ Snowflake Cortex Search is faster for analytical queries
- ✅ No MongoDB → MeiliSearch sync lag
- ✅ Native integration with claims data

---

## Risks & Mitigation

### Risk 1: Search functionality breaks
**Likelihood**: Low
**Impact**: Medium
**Mitigation**: Implement Snowflake Cortex Search before removing MeiliSearch

### Risk 2: Users expect fast autocomplete
**Likelihood**: Medium
**Impact**: Low
**Mitigation**: Snowflake Cortex Search provides sub-second response times for most queries

### Risk 3: Need to rollback
**Likelihood**: Low
**Impact**: Low
**Mitigation**: Keep docker-compose backup, MeiliSearch can be re-enabled via environment variables

---

## Testing Checklist

After removal, verify:

- [ ] Container status shows "healthy"
- [ ] No MeiliSearch errors in logs
- [ ] Search endpoint returns results (via Snowflake)
- [ ] Conversation list loads correctly
- [ ] Message search works (if implemented)
- [ ] No performance degradation
- [ ] E2E tests pass

---

## Rollback Plan

If issues occur:

1. **Restore `docker-compose.snowflake-only.yml`** from git
2. **Set environment variables**:
   ```env
   SEARCH=true
   MEILI_HOST=http://nexuschat-meilisearch:7700
   MEILI_MASTER_KEY=your_secure_master_key_here
   ```
3. **Restart containers**:
   ```bash
   docker-compose -f docker-compose.snowflake-only.yml up -d
   ```
4. **Run index sync**:
   ```bash
   docker exec NexusChat-Videxa-Snowflake node config/reset-meili-sync.js
   ```

---

## Conclusion

**Recommendation**: Remove MeiliSearch container immediately (Option 2) for quick fix, then implement Snowflake Cortex Search (Option 3) for long-term solution.

**Expected Outcome**:
- ✅ Container health: healthy
- ✅ Error logs: clean
- ✅ Search: powered by Snowflake Cortex
- ✅ Architecture: 100% Snowflake-only

**Time to Complete**: 30 minutes total
**Risk Level**: Low
**Reversibility**: High

---

## Next Steps

1. ✅ Review this document
2. ⏸️ Approve removal approach
3. ⏸️ Execute Step 1 (remove container from docker-compose)
4. ⏸️ Execute Step 2 (restart containers)
5. ⏸️ Execute Step 3 (verify health)
6. ⏸️ Execute Step 4 (implement Snowflake search)
7. ⏸️ Test and validate
8. ✅ Update documentation

---

**Document Status**: ✅ Ready for Review and Implementation
