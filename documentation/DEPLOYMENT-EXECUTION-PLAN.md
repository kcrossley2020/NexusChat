# NexusChat + Snowflake Cortex - Immediate Deployment Plan
**Target:** Production-ready in 5-7 days
**Scale:** 15-20 Healthcare Systems (HCS)
**Admin:** Single administrator (you)

---

## Day 1: Snowflake Foundation (4-6 hours)

### Morning: Core Infrastructure Setup

**Step 1.1: Connect to Snowflake** (5 min)
```bash
# Install SnowSQL if not already installed
# Windows:
# Download from: https://developers.snowflake.com/snowsql/

snowsql -a vga30685.east-us-2.azure -u <YOUR_ADMIN_USER>
```

**Step 1.2: Execute Foundation Scripts** (15 min)
```sql
-- In SnowSQL or Snowflake web UI
!source C:\videxa-repos\NexusChat\snowflake-setup\01-multi-tenant-structure.sql
!source C:\videxa-repos\NexusChat\snowflake-setup\02-token-efficient-cortex.sql

-- Verify
USE DATABASE VIDEXA_SHARED;
SELECT * FROM TENANT_MANAGEMENT.ORGANIZATIONS;
-- Should see HCS0001 created
```

**Step 1.3: Configure Service Account** (10 min)
```sql
USE ROLE ACCOUNTADMIN;

-- Generate RSA key pair (run in terminal)
-- Windows PowerShell:
```

**PowerShell:**
```powershell
# Generate private key
openssl genrsa -out snowflake_key.pem 2048

# Generate public key
openssl rsa -in snowflake_key.pem -pubout -out snowflake_key.pub

# Get public key content (remove header/footer, single line)
$pubkey = Get-Content snowflake_key.pub | Where-Object {$_ -notmatch "-----"} | Out-String
$pubkey = $pubkey -replace "`r`n", ""
Write-Output $pubkey
```

**Back to Snowflake:**
```sql
-- Set public key on service account
ALTER USER CLAUDE_AGENTNEXUS_USER
SET RSA_PUBLIC_KEY='<PASTE_PUBLIC_KEY_HERE>';

-- Verify
DESC USER CLAUDE_AGENTNEXUS_USER;
-- Should show RSA_PUBLIC_KEY_FP (fingerprint)
```

**Step 1.4: Test Cortex Access** (10 min)
```sql
-- Test Cortex Complete
SELECT SNOWFLAKE.CORTEX.COMPLETE(
    'claude-sonnet-4',
    'Say hello in exactly 5 words.',
    OBJECT_CONSTRUCT('max_tokens', 20, 'temperature', 0.5)
) AS response;

-- Expected output: "Hello there, how are you?" or similar

-- Test Cortex Embedding
SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768(
    'snowflake-arctic-embed-m',
    'Health insurance claim processing'
) AS embedding;

-- Expected: Array of 768 floats

-- Test cached function
SELECT VIDEXA_SHARED.CORTEX_HELPERS.CACHED_CORTEX_COMPLETE(
    'HCS0001',
    'What is a deductible?',
    'claude-sonnet-4',
    100,
    0.5,
    24
) AS result;

-- Run again - should see cache hit in logs
```

### Afternoon: Bulk Organization Setup

**Step 1.5: Create Bulk Provisioning Script** (30 min)

Execute the bulk organization creation script provided below.

**Step 1.6: Verify All Organizations** (15 min)
```sql
-- Check all orgs created
SELECT
    ORG_ID,
    ORG_NAME,
    DATABASE_NAME,
    WAREHOUSE_NAME,
    STATUS,
    MONTHLY_CREDIT_LIMIT
FROM VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
ORDER BY ORG_ID;

-- Should see 20 organizations (HCS0001 - HCS0020)

-- Test one org's database
USE DATABASE HCS0002_DB;
SHOW SCHEMAS;
-- Should see: CLAIMS, PATIENTS, POLICIES, PROVIDERS, CORTEX_DATA

-- Verify warehouse exists
SHOW WAREHOUSES LIKE 'HCS%';
-- Should see 20 warehouses
```

**Step 1.7: Grant Service Account Access to All Orgs** (10 min)
```sql
-- Already done by bulk script, but verify:
SHOW GRANTS TO USER CLAUDE_AGENTNEXUS_USER;

-- Should see roles: HCS0001_ROLE through HCS0020_ROLE
```

---

## Day 2: AgentNexus Backend Setup (4-5 hours)

### Morning: Azure Key Vault Configuration

**Step 2.1: Store Snowflake Credentials** (30 min)
```powershell
# Login to Azure
az login

# Set variables
$KEYVAULT_NAME = "videxa-keyvault"

# Store Snowflake config
az keyvault secret set --vault-name $KEYVAULT_NAME --name snowflake-account --value "vga30685.east-us-2.azure"
az keyvault secret set --vault-name $KEYVAULT_NAME --name snowflake-user --value "CLAUDE_AGENTNEXUS_USER"
az keyvault secret set --vault-name $KEYVAULT_NAME --name snowflake-database --value "VIDEXA_SHARED"
az keyvault secret set --vault-name $KEYVAULT_NAME --name snowflake-schema --value "TENANT_MANAGEMENT"
az keyvault secret set --vault-name $KEYVAULT_NAME --name snowflake-warehouse --value "COMPUTE_WH"
az keyvault secret set --vault-name $KEYVAULT_NAME --name snowflake-role --value "AGENTNEXUS_AUTH_WRITER"

# Store private key
az keyvault secret set --vault-name $KEYVAULT_NAME --name snowflake-agentnexus-private-key --file snowflake_key.pem

# Verify
az keyvault secret list --vault-name $KEYVAULT_NAME --query "[?starts_with(name, 'snowflake')].name"
```

**Step 2.2: Deploy Updated Backend Code** (1 hour)
```bash
cd C:\videxa-repos\agentnexus-backend

# Backup current code
git stash

# Copy new Cortex service files
# (Assume files have been created as per previous specifications)

# Install dependencies (if new packages added)
pip install snowflake-connector-python azure-identity azure-keyvault-secrets

# Update requirements.txt
pip freeze > requirements.txt

# Set environment variables
$env:AZURE_KEY_VAULT_URL = "https://videxa-keyvault.vault.azure.net/"
$env:JWT_SECRET_KEY = "<generate-random-32-char-string>"
$env:AGENTNEXUS_API_KEY = "<generate-random-32-char-string>"

# Save to .env file
@"
AZURE_KEY_VAULT_URL=https://videxa-keyvault.vault.azure.net/
JWT_SECRET_KEY=$env:JWT_SECRET_KEY
AGENTNEXUS_API_KEY=$env:AGENTNEXUS_API_KEY
"@ | Out-File -FilePath .env -Encoding utf8
```

**Step 2.3: Test Snowflake Connection** (15 min)
```bash
python test_snowflake_connection.py

# Expected output:
# ✅ Snowflake service initialized
# ✅ Snowflake connection established
# ✅ Connected to: VIDEXA_SHARED.TENANT_MANAGEMENT
# ✅ Cortex functions accessible
```

**Step 2.4: Update Main App** (15 min)
```python
# Edit app/main.py - add import and router registration
```

```bash
# Restart backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Afternoon: API Testing

**Step 2.5: Test NexusChat LLM Endpoints** (1 hour)
```bash
# Save this as test-cortex-api.ps1

$API_URL = "http://localhost:8000"
$API_KEY = "$env:AGENTNEXUS_API_KEY"

# Test 1: Chat completion (first call - no cache)
Write-Host "Test 1: Chat completion (uncached)..."
$response1 = Invoke-RestMethod -Uri "$API_URL/api/nexuschat/chat/completions" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $API_KEY"
        "Content-Type" = "application/json"
    } `
    -Body (@{
        messages = @(@{role="user"; content="What is a health insurance copay?"})
        model = "claude-sonnet-4"
        max_tokens = 100
    } | ConvertTo-Json)

Write-Host "Response: $($response1.choices[0].message.content)"
Write-Host "Cached: $($response1.x_cached)"

# Test 2: Same query - should be cached
Start-Sleep -Seconds 1
Write-Host "`nTest 2: Same query (should be cached)..."
$response2 = Invoke-RestMethod -Uri "$API_URL/api/nexuschat/chat/completions" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $API_KEY"
        "Content-Type" = "application/json"
    } `
    -Body (@{
        messages = @(@{role="user"; content="What is a health insurance copay?"})
        model = "claude-sonnet-4"
        max_tokens = 100
    } | ConvertTo-Json)

Write-Host "Cached: $($response2.x_cached)"

# Test 3: Embeddings
Write-Host "`nTest 3: Generate embeddings..."
$response3 = Invoke-RestMethod -Uri "$API_URL/api/nexuschat/embeddings" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $API_KEY"
        "Content-Type" = "application/json"
    } `
    -Body (@{
        input = @("Health insurance claim", "Medical procedure code")
        model = "snowflake-arctic-embed-m"
    } | ConvertTo-Json)

Write-Host "Embeddings generated: $($response3.data.Count)"

# Test 4: Cost summary
Write-Host "`nTest 4: Check cost summary..."
$response4 = Invoke-RestMethod -Uri "$API_URL/api/nexuschat/cost/summary" `
    -Method GET `
    -Headers @{
        "Authorization" = "Bearer $API_KEY"
    }

Write-Host "Total interactions: $($response4.total_interactions)"
Write-Host "Total cost: `$$($response4.total_cost)"
Write-Host "Cache hit rate: $($response4.cache_hit_rate_pct)%"
```

Run tests:
```powershell
.\test-cortex-api.ps1
```

---

## Day 3: NexusChat Deployment (3-4 hours)

### Morning: Configuration

**Step 3.1: Update Environment Variables** (15 min)
```bash
cd C:\videxa-repos\NexusChat

# Create secure .env file
@"
# MongoDB (HIPAA-compliant with auth)
MONGO_ROOT_PASSWORD=$(New-Guid | Select-Object -ExpandProperty Guid)

# Meilisearch
MEILI_MASTER_KEY=$(New-Guid | Select-Object -ExpandProperty Guid)
MEILI_NO_ANALYTICS=true

# PostgreSQL
POSTGRES_PASSWORD=$(New-Guid | Select-Object -ExpandProperty Guid)

# AgentNexus Integration
AGENTNEXUS_API_URL=http://host.docker.internal:8000
AGENTNEXUS_API_KEY=$env:AGENTNEXUS_API_KEY

# Snowflake Cortex
USE_SNOWFLAKE_CORTEX=true
SNOWFLAKE_CORTEX_MODEL=claude-sonnet-4

# DISABLE external RAG (HIPAA compliance)
RAG_API_URL=
RAG_PORT=

# Application
APP_TITLE=Nex by Videxa - Healthcare Claims
DOMAIN_SERVER=http://localhost:3080
"@ | Out-File -FilePath .env -Encoding utf8
```

**Step 3.2: Deploy Containers** (30 min)
```bash
# Use secure docker compose
docker-compose -f docker-compose.videxa-cortex.yml down
docker-compose -f docker-compose.videxa-cortex.yml up -d --build

# Wait for containers to start
Start-Sleep -Seconds 30

# Check status
docker ps

# Expected containers:
# - NexusChat-Videxa (running)
# - nexuschat-mongodb (running, with --auth)
# - nexuschat-meilisearch (running)
# - nexuschat-vectordb (running)
# - NO rag_api container (disabled)

# Check logs
docker logs NexusChat-Videxa --tail 50
```

### Afternoon: End-to-End Testing

**Step 3.3: Create Test Users for Multiple Orgs** (1 hour)
```bash
# Test user registration for each org
# HCS0001
curl -X POST http://localhost:3080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hcs0001.com",
    "password": "TestPass123!",
    "organization_name": "HCS0001",
    "full_name": "HCS0001 Admin"
  }'

# HCS0002
curl -X POST http://localhost:3080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hcs0002.com",
    "password": "TestPass123!",
    "organization_name": "HCS0002",
    "full_name": "HCS0002 Admin"
  }'

# Repeat for HCS0003, HCS0004, HCS0005 (sample set)
```

**Step 3.4: Test Chat Functionality** (30 min)
```bash
# Login as HCS0001 user
$login1 = Invoke-RestMethod -Uri "http://localhost:3080/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body (@{email="admin@hcs0001.com"; password="TestPass123!"} | ConvertTo-Json)

$token1 = $login1.token

# Send chat message
$chat1 = Invoke-RestMethod -Uri "http://localhost:3080/api/chat" `
    -Method POST `
    -Headers @{Authorization="Bearer $token1"} `
    -ContentType "application/json" `
    -Body (@{
        message="What is the status of claim CLM-2025-00001?"
        conversationId="test-conv-1"
    } | ConvertTo-Json)

Write-Host "Response: $($chat1.message)"
```

**Step 3.5: Verify Organization Isolation** (30 min)
```sql
-- In Snowflake, check audit logs
USE DATABASE VIDEXA_SHARED;
USE SCHEMA AUDIT_LOGS;

SELECT
    timestamp,
    org_id,
    user_id,
    query_type,
    total_tokens,
    estimated_cost,
    cache_hit
FROM CORTEX_INTERACTIONS
ORDER BY timestamp DESC
LIMIT 20;

-- Verify each org's requests are logged separately
-- Verify cache hits are working
```

---

## Day 4: Bulk Data Loading (4-6 hours per org)

### Data Loading Templates

**Step 4.1: Create Data Loading Scripts**

You'll provide each HCS with a data loading template. Here's the approach:

**Option A: CSV Upload via Snowflake**
```sql
-- Template for HCS0001 data load
USE DATABASE HCS0001_DB;
USE WAREHOUSE HCS0001_WH;

-- Create stage for file uploads
CREATE STAGE IF NOT EXISTS CLAIMS.DATA_LOAD_STAGE;

-- Upload CSV files
-- Via SnowSQL:
PUT file://C:\HCS0001_data\claims.csv @CLAIMS.DATA_LOAD_STAGE;
PUT file://C:\HCS0001_data\patients.csv @CLAIMS.DATA_LOAD_STAGE;

-- Load claims data
COPY INTO CLAIMS.INSURANCE_CLAIMS
FROM @CLAIMS.DATA_LOAD_STAGE/claims.csv
FILE_FORMAT = (
    TYPE = 'CSV'
    FIELD_DELIMITER = ','
    SKIP_HEADER = 1
    FIELD_OPTIONALLY_ENCLOSED_BY = '"'
    DATE_FORMAT = 'YYYY-MM-DD'
);

-- Verify load
SELECT COUNT(*) FROM CLAIMS.INSURANCE_CLAIMS;

-- Generate embeddings for semantic search
INSERT INTO CORTEX_DATA.CLAIM_EMBEDDINGS (CLAIM_ID, CLAIM_TEXT, EMBEDDING)
SELECT
    CLAIM_ID,
    CONCAT(
        'Patient ', PATIENT_ID, ' ',
        'claim for ', PROCEDURE_CODE, ' ',
        'diagnosis ', DIAGNOSIS_CODE, ' ',
        'status ', CLAIM_STATUS, ' ',
        'amount $', CLAIM_AMOUNT
    ) AS claim_text,
    SNOWFLAKE.CORTEX.EMBED_TEXT_768(
        'snowflake-arctic-embed-m',
        claim_text
    )
FROM CLAIMS.INSURANCE_CLAIMS
WHERE CLAIM_ID NOT IN (SELECT CLAIM_ID FROM CORTEX_DATA.CLAIM_EMBEDDINGS);

-- Verify embeddings
SELECT COUNT(*) FROM CORTEX_DATA.CLAIM_EMBEDDINGS;
```

**Option B: Automated Python Loader Script**

Save as `load-hcs-data.py` - provided in separate file.

**Step 4.2: Execute Data Loads**
```bash
# For each HCS organization
python load-hcs-data.py --org HCS0001 --claims-file "C:\HCS_Data\HCS0001\claims.csv" --patients-file "C:\HCS_Data\HCS0001\patients.csv"

python load-hcs-data.py --org HCS0002 --claims-file "C:\HCS_Data\HCS0002\claims.csv" --patients-file "C:\HCS_Data\HCS0002\patients.csv"

# Continue for all 15-20 orgs
```

---

## Day 5: Monitoring & Validation (3-4 hours)

### Cost Dashboard Setup

**Step 5.1: Create Snowflake Views for Power BI** (30 min)
```sql
-- Execute monitoring setup script (provided separately)
!source C:\videxa-repos\NexusChat\snowflake-setup\03-monitoring-views.sql

-- Test views
SELECT * FROM VIDEXA_SHARED.REPORTING.V_DAILY_COST_BY_ORG
WHERE date >= DATEADD(day, -7, CURRENT_DATE());

SELECT * FROM VIDEXA_SHARED.REPORTING.V_CACHE_PERFORMANCE
WHERE date >= DATEADD(day, -7, CURRENT_DATE());
```

**Step 5.2: Power BI Setup** (1 hour)
```
1. Open Power BI Desktop
2. Get Data → Snowflake
3. Server: vga30685.east-us-2.azure.snowflakecomputing.com
4. Warehouse: COMPUTE_WH
5. Database: VIDEXA_SHARED
6. Schema: REPORTING
7. Import tables:
   - V_DAILY_COST_BY_ORG
   - V_CACHE_PERFORMANCE
   - V_TOKEN_USAGE_TREND
   - V_TOP_EXPENSIVE_QUERIES
8. Create visualizations (templates provided in separate file)
```

**Step 5.3: Budget Alert Configuration** (30 min)
```sql
-- Enable automated budget alerts
ALTER TASK VIDEXA_SHARED.AUDIT_LOGS.DAILY_BUDGET_CHECK RESUME;

-- Test alert manually
EXECUTE TASK VIDEXA_SHARED.AUDIT_LOGS.DAILY_BUDGET_CHECK;

-- Check alerts generated
SELECT * FROM VIDEXA_SHARED.AUDIT_LOGS.BUDGET_ALERTS
ORDER BY timestamp DESC;
```

**Step 5.4: Security Validation** (1 hour)
```bash
# Run security test suite
cd C:\videxa-repos\NexusChat

# Test MongoDB auth
docker exec nexuschat-mongodb mongosh --eval "db.adminCommand('listDatabases')"
# Expected: Authentication error (proves auth is enabled)

# Test no external connections
docker exec NexusChat-Videxa netstat -an | findstr ESTABLISHED | findstr /V "172.28 127.0"
# Expected: Empty output

# Test org isolation
# Login as HCS0001 user, try to query HCS0002 data
# Expected: No results or access denied
```

---

## Day 6-7: Load Testing & Optimization (4-6 hours)

### Performance Testing

**Step 6.1: Load Test Script** (2 hours)

Execute load test (provided in separate file) to:
- Verify cache performance (expect 30-50% hit rate after warmup)
- Test concurrent users (50-100 simultaneous chats)
- Measure response times (target <3s p95)
- Monitor warehouse auto-scaling

**Step 6.2: Cost Optimization Review** (2 hours)
```sql
-- Identify most expensive queries
SELECT
    org_id,
    LEFT(prompt_text, 100) AS prompt_preview,
    total_tokens,
    estimated_cost,
    COUNT(*) AS occurrences
FROM VIDEXA_SHARED.AUDIT_LOGS.CORTEX_INTERACTIONS
WHERE timestamp >= DATEADD(day, -7, CURRENT_DATE())
GROUP BY org_id, LEFT(prompt_text, 100), total_tokens, estimated_cost
ORDER BY estimated_cost DESC
LIMIT 20;

-- Optimize expensive queries by:
-- 1. Adding to prompt templates
-- 2. Increasing cache TTL for common queries
-- 3. Reducing max_tokens for simple answers
```

**Step 6.3: Warehouse Right-Sizing** (1 hour)
```sql
-- Check warehouse utilization
SELECT
    WAREHOUSE_NAME,
    AVG(AVG_RUNNING) AS avg_running_queries,
    AVG(AVG_QUEUED_LOAD) AS avg_queued,
    SUM(CREDITS_USED) AS total_credits
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_LOAD_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_DATE())
    AND WAREHOUSE_NAME LIKE 'HCS%'
GROUP BY WAREHOUSE_NAME
ORDER BY total_credits DESC;

-- If avg_queued > 0.5, upgrade warehouse:
ALTER WAREHOUSE HCS0001_WH SET WAREHOUSE_SIZE = 'SMALL';
```

---

## Production Checklist

### Pre-Go-Live (Complete before enabling for users)

**Snowflake:**
- [ ] All 15-20 organizations created
- [ ] Resource monitors enabled on all warehouses
- [ ] Cortex functions tested for all orgs
- [ ] Audit logging verified
- [ ] Backup task scheduled (daily at 2 AM)

**AgentNexus Backend:**
- [ ] Credentials stored in Azure Key Vault
- [ ] Private key authentication working
- [ ] All API endpoints tested
- [ ] Cost summary endpoint returning data
- [ ] Service running with systemd/PM2 (production)

**NexusChat:**
- [ ] MongoDB authentication enabled
- [ ] All container versions pinned (no :latest)
- [ ] RAG API disabled
- [ ] Security tests passed
- [ ] Test users created for each org

**Monitoring:**
- [ ] Power BI dashboard connected
- [ ] Budget alerts enabled
- [ ] Daily report email configured
- [ ] Slack/Teams webhook for critical alerts

**Documentation:**
- [ ] Admin runbook completed
- [ ] User onboarding guide for each HCS
- [ ] Incident response plan documented
- [ ] Data loading templates provided to each HCS

---

## Post-Deployment (Days 8-30)

### Week 1: Close Monitoring
- **Daily:** Check budget alerts, review top 10 expensive queries
- **Daily:** Verify cache hit rate > 20%
- **Weekly:** Review cost per org, identify optimization opportunities

### Week 2-4: Optimization
- **Add common queries to prompt cache**
- **Right-size warehouses based on usage**
- **Tune max_tokens limits per query type**
- **Add custom prompt templates for frequent questions**

### Monthly: Reporting
- **Generate executive cost report**
- **Review and adjust per-org credit limits**
- **Plan for new organization onboarding**
- **Test DR failover procedure**

---

## Quick Reference Commands

### Daily Admin Tasks

```sql
-- Check today's costs
SELECT * FROM VIDEXA_SHARED.AUDIT_LOGS.V_ORG_COST_SUMMARY
WHERE month = DATE_TRUNC('MONTH', CURRENT_DATE());

-- Check budget alerts
SELECT * FROM VIDEXA_SHARED.AUDIT_LOGS.BUDGET_ALERTS
WHERE acknowledged = FALSE;

-- View cache performance
SELECT org_id, cache_hit_rate_pct
FROM VIDEXA_SHARED.REPORTING.V_CACHE_PERFORMANCE
WHERE date = CURRENT_DATE();
```

### Emergency Commands

```sql
-- Suspend warehouse if runaway costs
ALTER WAREHOUSE HCS0001_WH SUSPEND;

-- Clear cache if needed
DELETE FROM VIDEXA_SHARED.CORTEX_CACHE.PROMPT_CACHE
WHERE org_id = 'HCS0001';

-- Increase credit limit (emergency)
UPDATE VIDEXA_SHARED.TENANT_MANAGEMENT.ORGANIZATIONS
SET MONTHLY_CREDIT_LIMIT = 1000.00
WHERE ORG_ID = 'HCS0001';
```

---

## Success Criteria - 7 Day Mark

✅ **Functionality:**
- All 15-20 orgs can login and chat
- Claims search returns results for each org
- No cross-org data leakage

✅ **Cost:**
- Average cost per interaction < $0.015
- Cache hit rate > 25%
- All orgs under 50% of monthly budget

✅ **Performance:**
- 95th percentile response time < 4s
- Zero external API calls from containers
- Warehouse auto-suspend working

✅ **Security:**
- All HIPAA audit logs populated
- MongoDB authentication verified
- No telemetry to external services

---

## Contact & Escalation

**Your Role (Admin):**
- Snowflake configuration and tuning
- AgentNexus backend deployment
- Cost monitoring and optimization
- Organization provisioning

**Support Escalation:**
- Snowflake Issues → Support Portal or Account Rep
- Azure Issues → Azure Support
- Application Bugs → Internal dev team

**On-Call Protocol:**
- Budget exceeded → Check alerts, increase limit if approved
- Performance degradation → Check warehouse size, query queue
- Data access issues → Verify org role grants
- Service down → Check AgentNexus backend logs, restart if needed

---

**Next Steps:** Proceed to Day 1 execution using the bulk organization creation script provided next.
