# NexusChat Use Cases

## Overview
NexusChat is an AI-powered healthcare intelligence platform that enables healthcare systems to analyze claims, policies, contracts, and clinical data using natural language conversations backed by Snowflake Cortex AI.

## What Can I Do in NexusChat?

NexusChat enables you to:
- **Analyze healthcare claims data** with AI-powered insights
- **Review insurance contracts and policies** for compliance and optimization
- **Generate executive summaries and dashboards** from your uploaded data
- **Query multi-tenant healthcare databases** with natural language
- **Track AI usage and costs** across your organization
- **Collaborate on clinical data analysis** with persistent conversation history

---

## UC0000: Test Automation Bypass (Testing Use Case)

**Summary**: Automated testing framework can create test users and authenticate without email verification, enabling end-to-end testing of NexusChat functionality. This bypass is only available in test/development environments.

**Actors**: Automated Test Frameworks (Playwright, MCP), QA Engineers

**Preconditions**:
- AgentNexus backend has `ENABLE_TESTING_ENDPOINTS=true` environment variable
- Snowflake connection configured and accessible
- Test environment (not production)

**Flow**:
1. Test framework calls `POST /api/testing/create-user` with test user credentials
2. Backend creates user directly in Snowflake USER_PROFILES with EMAIL_VERIFIED=TRUE
3. User bypasses Azure Tables and email verification completely
4. User is marked with REGISTRATION_METHOD='testing' for cleanup isolation
5. Test framework calls `POST /api/auth/login` to obtain JWT token
6. Token is used to access NexusChat via SSO
7. After tests complete, framework calls `DELETE /api/testing/delete-user/{email}` for cleanup

**Postconditions**:
- Test user exists in Snowflake with verified email
- JWT token obtained for authenticated API calls
- Test user can access NexusChat without manual verification
- Test user can be cleanly deleted after test execution

**Security**:
- Endpoint returns 404 when `ENABLE_TESTING_ENDPOINTS=false`
- Only users with REGISTRATION_METHOD='testing' can be deleted via API
- Production environments must have testing endpoints disabled

**Related Files**:
- Endpoint: `POST /api/testing/create-user`
- Endpoint: `DELETE /api/testing/delete-user/{email}`
- Endpoint: `GET /api/testing/list-test-users`
- Table: `AGENTNEXUS_DB.AUTH_SCHEMA.USER_PROFILES`

---

## UC0001: File Ingestion for Healthcare Data Analysis

**Summary**: Users can upload healthcare files (claims, policies, EOBs, contracts) to NexusChat for AI-powered analysis and natural language querying. Files are processed and stored in tenant-specific Snowflake databases for compliance and isolation.

**Actors**: Healthcare Analysts, Revenue Cycle Managers, Contract Administrators

**Preconditions**:
- User is authenticated to NexusChat
- User has WRITER or ADMIN role in their organization
- File is in supported format (CSV, PDF, Excel, JSON)

**Flow**:
1. User clicks "Attach File" button in chat interface
2. User selects healthcare data file from local system
3. System validates file type and size (<100MB)
4. System uploads file to organization's Snowflake database (HCS00NN_DB.CORTEX_DATA)
5. File is parsed and loaded into appropriate schema (CLAIMS, POLICIES, etc.)
6. System generates file upload confirmation with record count
7. User can now query the uploaded data via natural language

**Postconditions**:
- File stored in `FILE_UPLOADS` table with metadata
- Data accessible via Snowflake Cortex for AI queries
- Audit log entry created in `ORG_RESOURCE_USAGE`

**Related Files**:
- Table: `NEXUSCHAT.FILE_UPLOADS`
- Schema: `CORTEX_DATA` (staging)
- API: `POST /api/conversations/{id}/upload`

---

## UC0002: Conversation Dashboard and Progress Tracking

**Summary**: Users can view personalized dashboards showing their conversation history, AI usage metrics, cost tracking, and analytical progress over time. Dashboards provide insights into query patterns, token consumption, and business outcomes.

**Actors**: All authenticated users, Administrators, Finance teams

**Preconditions**:
- User has active conversations in NexusChat
- Organization has enabled usage tracking
- CORTEX_USAGE_LOG contains user activity data

**Flow**:
1. User navigates to "My Dashboard" or asks "Can I get a summary dashboard?"
2. System queries user's conversation history from `CONVERSATIONS` table
3. System aggregates usage metrics from `CORTEX_USAGE_LOG`
4. System generates dashboard showing:
   - Total conversations and messages
   - AI tokens consumed (prompt + completion)
   - Estimated costs by conversation
   - Cache hit rate and efficiency
   - Top queries and topics
   - Weekly/monthly trend charts
5. User can filter by date range, conversation type, or cost threshold
6. User can export dashboard to PDF or share with team

**Postconditions**:
- Dashboard view rendered with real-time data
- User engagement logged for analytics
- Dashboard state saved to `USER_PREFERENCES`

**Related Files**:
- View: `V_USER_ACTIVITY`
- View: `V_TOKEN_USAGE_TREND`
- Table: `CORTEX_USAGE_LOG`
- Component: `src/components/Dashboard.tsx`

---

## UC0003: Insurance Carrier Analysis from Claims Data

**Summary**: Users can query claims data to extract insights about specific insurance carriers, including payment patterns, denial rates, reimbursement trends, and contract compliance. AI analyzes historical claims to provide actionable intelligence.

**Actors**: Revenue Cycle Analysts, Billing Managers, CFO/Finance Leadership

**Preconditions**:
- Claims data loaded into `CLAIMS.INSURANCE_CLAIMS` table
- Carrier identifier (Payer ID or name) is known
- User has READ access to CLAIMS schema

**Flow**:
1. User asks: "From the claims that I have supplied, what can you tell me about the insurance carrier XYZ?"
2. System parses query to extract carrier identifier ("XYZ")
3. System queries `CLAIMS.INSURANCE_CLAIMS` filtered by carrier
4. Snowflake Cortex analyzes claims data:
   - Total claims submitted vs. paid
   - Average reimbursement rate
   - Top denial reasons and codes
   - Payment turnaround time (TAT)
   - Out-of-network vs. in-network rates
   - Trend analysis (last 6/12 months)
5. AI generates natural language summary with key findings
6. System provides visualizations (charts embedded in chat)
7. User can drill down into specific denial codes or claim types

**Postconditions**:
- Analysis results displayed in conversation
- Query cached in `PROMPT_CACHE` for reuse
- Usage logged to `CORTEX_USAGE_LOG` with carrier context
- User can export findings to report

**Related Files**:
- Table: `CLAIMS.INSURANCE_CLAIMS`
- View: `V_DAILY_COST_BY_ORG`
- Procedure: `SNOWFLAKE.CORTEX.COMPLETE`

---

## UC0004: Contract Comparison and Problem Identification

**Summary**: Users can upload and compare multiple contracts (carrier contracts, clearinghouse agreements, provider agreements) to identify discrepancies, compliance issues, or root causes of claims processing problems. AI performs semantic analysis to find conflicts.

**Actors**: Contract Administrators, Legal teams, Revenue Cycle Directors

**Preconditions**:
- Contracts uploaded to `POLICIES.PROVIDER_CONTRACTS` table
- Clearinghouse agreement available in system
- User has ADMIN role for contract access

**Flow**:
1. User asks: "Can you review the carrier's contract and that of the clearinghouse so that we can identify the problem?"
2. System identifies relevant contracts from `POLICIES` schema
3. System extracts key contract terms using Snowflake Cortex:
   - Payment terms and timelines
   - Billing codes covered
   - Prior authorization requirements
   - Claim submission formats (837, 835)
   - EDI transaction rules
   - Fee schedules and negotiated rates
4. AI performs semantic comparison between contracts
5. System identifies conflicts:
   - Mismatched billing code definitions
   - Incompatible EDI format requirements
   - Contradictory timely filing deadlines
   - Clearinghouse fee structures not aligned with carrier terms
6. AI generates root cause analysis with recommendations
7. User receives contract comparison report with highlighted issues

**Postconditions**:
- Contract analysis stored in conversation history
- Issues logged to `AUDIT_LOGS.BUDGET_ALERTS` (if cost-related)
- Recommendations exported as action items
- Contract metadata updated with review timestamp

**Related Files**:
- Table: `POLICIES.PROVIDER_CONTRACTS`
- Table: `POLICIES.PAYER_POLICIES`
- Function: `SNOWFLAKE.CORTEX.COMPLETE` (document analysis)
- Embedding: `SNOWFLAKE.CORTEX.EMBED_TEXT_768` (semantic search)

---

## UC0005: Multi-Tenant Collaborative Analysis

**Summary**: Users within the same healthcare organization can collaborate on data analysis by sharing conversations, tagging team members, and building on each other's queries. Enables cross-functional insights while maintaining tenant isolation.

**Actors**: Clinical teams, Analytics teams, Management

**Preconditions**:
- Multiple users belong to same organization (ORG_ID)
- Conversation sharing enabled in organization settings
- Users have appropriate role permissions

**Flow**:
1. User creates analysis conversation on claims data
2. User clicks "Share with Team" and selects colleagues
3. Tagged users receive notification and access to conversation
4. Team members can view conversation history and add follow-up queries
5. All queries execute against same tenant database (HCS00NN_DB)
6. System maintains conversation thread with user attribution
7. Conversation appears in shared dashboard for all participants

**Postconditions**:
- Conversation marked as shared in `CONVERSATIONS` table
- User access logged to `ORG_USERS` table
- Collaborative insights aggregated in team dashboard

**Related Files**:
- Table: `CONVERSATIONS` (SHARED_WITH field)
- Table: `ORG_USERS` (team membership)
- View: `V_USER_ENGAGEMENT`

---

## UC0006: Cost and Budget Monitoring

**Summary**: Administrators can track AI usage costs across their organization, set budget alerts, and optimize token consumption. Real-time dashboards show cost attribution by user, conversation type, and department.

**Actors**: Finance Administrators, IT Administrators, Executive Leadership

**Preconditions**:
- Organization has MONTHLY_COST_LIMIT configured
- CORTEX_USAGE_LOG collecting usage data
- Budget alert thresholds set (default 75%, 90%)

**Flow**:
1. Administrator accesses "Cost Management" dashboard
2. System displays real-time metrics:
   - Current month spend vs. budget
   - Cost by user and department
   - Token usage breakdown (prompt vs. completion)
   - Cache efficiency (% of cached responses)
   - Most expensive queries
3. If budget threshold exceeded, system triggers alert
4. Administrator can adjust budgets or suspend users
5. System generates cost forecast based on usage trends

**Postconditions**:
- Budget alert logged to `BUDGET_ALERTS` table
- Cost report exported for finance review
- User limits updated if necessary

**Related Files**:
- View: `V_MONTHLY_COST_BY_ORG`
- View: `V_ACTIVE_BUDGET_ALERTS`
- Table: `ORGANIZATIONS` (MONTHLY_COST_LIMIT)
- Procedure: `SUSPEND_ORG` (if over budget)

---

## UC0007: Cached Query Performance Optimization

**Summary**: System automatically caches frequently asked queries to reduce Cortex token costs and improve response times. Users receive instant responses for repeat questions, and administrators can monitor cache effectiveness.

**Actors**: System (automated), Administrators (monitoring)

**Preconditions**:
- PROMPT_CACHE table enabled
- Cache TTL set (default 24 hours)
- Similar queries detected via SHA2 hash

**Flow**:
1. User submits query to Snowflake Cortex
2. System generates cache key from prompt + model hash
3. System checks `PROMPT_CACHE` for matching key
4. If cache hit:
   - Return cached response immediately
   - Increment hit count
   - Log zero cost to usage log
5. If cache miss:
   - Execute query via Cortex
   - Store response in cache with TTL
   - Log full cost to usage log
6. Administrator reviews cache hit rate in dashboard

**Postconditions**:
- Response delivered (cached or fresh)
- Cache statistics updated
- Cost savings calculated and displayed

**Related Files**:
- Table: `PROMPT_CACHE`
- View: `V_CACHE_PERFORMANCE`
- Function: `GENERATE_CACHE_KEY`

---

## Additional Use Cases (Brief)

### UC0008: Audit Log and Compliance Reporting
Users can generate HIPAA-compliant audit reports showing all data access, AI queries, and user activities for regulatory compliance.

### UC0009: Archived Conversation Retrieval
Users can search and restore archived conversations older than 90 days for historical analysis or reference.

### UC0010: Role-Based Data Access Control
Administrators can configure granular permissions controlling which users can access specific data schemas (CLAIMS, PATIENTS, POLICIES).

---

**Document Version**: 1.0
**Last Updated**: November 2, 2025
**Total Use Cases**: 10 primary, 3 additional
