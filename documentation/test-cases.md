# NexusChat Test Cases

## Overview
Test cases for validating NexusChat functionality across file ingestion, analytics, contract review, collaboration, and cost management features. Each test case is mapped to its parent use case.

---

## TC-0.1-UC0000: Test User Creation via API (Bypass Email Verification)

**Use Case**: UC0000 - Test Automation Bypass

**Test Objective**: Verify testing endpoint can create test user directly in Snowflake without email verification

**Prerequisites**:
- AgentNexus backend running on `http://localhost:3050`
- Environment variable `ENABLE_TESTING_ENDPOINTS=true`
- Snowflake connection configured and accessible

**Test Steps**:
1. Call `POST http://localhost:3050/api/testing/create-user`
2. Provide test user credentials in request body
3. Verify response contains user_id and success confirmation
4. Verify user exists in Snowflake USER_PROFILES table

**Expected Input**:
```json
{
  "email": "e2e-test-001@videxa.test",
  "password": "TestPass123!",
  "organization_name": "E2E Test Organization",
  "account_type": "trial"
}
```

**Expected Output**:
```json
{
  "success": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "e2e-test-001@videxa.test",
  "password": "TestPass123!",
  "message": "Test user created successfully. Use POST /auth/login to authenticate."
}
```

**Database Verification**:
```sql
SELECT EMAIL, EMAIL_VERIFIED, REGISTRATION_METHOD
FROM AGENTNEXUS_DB.AUTH_SCHEMA.USER_PROFILES
WHERE EMAIL = 'e2e-test-001@videxa.test';

-- Expected Result:
-- EMAIL: e2e-test-001@videxa.test
-- EMAIL_VERIFIED: TRUE
-- REGISTRATION_METHOD: testing
```

**Pass Criteria**:
- ✅ API returns 200 status with user_id
- ✅ User created in Snowflake with EMAIL_VERIFIED=TRUE
- ✅ User marked with REGISTRATION_METHOD='testing'
- ✅ Password properly hashed with bcrypt
- ✅ No email verification step required

---

## TC-0.2-UC0000: Test User Login and JWT Token Retrieval

**Use Case**: UC0000 - Test Automation Bypass

**Test Objective**: Verify test user can login immediately without email verification and obtain JWT token

**Prerequisites**:
- Test user created via TC-0.1 (`e2e-test-001@videxa.test`)
- AgentNexus backend running

**Test Steps**:
1. Call `POST http://localhost:3050/api/auth/login`
2. Provide test user email and password
3. Verify JWT token returned in response
4. Decode JWT and verify payload contains user_id and email_verified=true

**Expected Input**:
```json
{
  "email": "e2e-test-001@videxa.test",
  "password": "TestPass123!"
}
```

**Expected Output**:
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIiwiZW1haWwiOiJlMmUtdGVzdC0wMDFAdmlkZXhhLnRlc3QiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZXhwIjoxNzM1Nzc2MDAwLCJpYXQiOjE3MzU2ODk2MDB9...",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**JWT Token Payload**:
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "e2e-test-001@videxa.test",
  "email_verified": true,
  "exp": 1735776000,
  "iat": 1735689600
}
```

**Pass Criteria**:
- ✅ Login succeeds without email verification prompt
- ✅ JWT token returned with 24-hour expiration
- ✅ Token payload contains `email_verified: true`
- ✅ Token can be decoded and validated
- ✅ User login event logged to USER_LOGIN_EVENTS table

---

## TC-0.3-UC0000: NexusChat Health Check and Server Availability

**Use Case**: UC0000 - Test Automation Bypass

**Test Objective**: Verify NexusChat server is running and accessible before running E2E tests

**Prerequisites**:
- NexusChat backend started (Docker or local)
- NexusChat running on `http://localhost:3080` (or configured port)

**Test Steps**:
1. Send GET request to `http://localhost:3080/health`
2. Verify response indicates server is healthy
3. Optional: Check `/api/health` for API-specific health
4. Verify response time is under 1 second

**Expected Input**:
```
GET http://localhost:3080/health
```

**Expected Output**:
```json
{
  "status": "healthy",
  "environment": "development",
  "services": {
    "database": "connected",
    "snowflake": "connected"
  },
  "timestamp": "2025-11-04T12:00:00Z"
}
```

**Pass Criteria**:
- ✅ HTTP 200 status returned
- ✅ Response indicates `status: "healthy"`
- ✅ Response time under 1 second
- ✅ Server accessible from test machine

---

## TC-0.4-UC0000: Test User Cleanup and Deletion

**Use Case**: UC0000 - Test Automation Bypass

**Test Objective**: Verify test user can be deleted after tests complete to ensure clean state

**Prerequisites**:
- Test user exists from TC-0.1 (`e2e-test-001@videxa.test`)
- User has REGISTRATION_METHOD='testing'

**Test Steps**:
1. Call `DELETE http://localhost:3050/api/testing/delete-user/e2e-test-001@videxa.test`
2. Verify response confirms deletion
3. Verify user no longer exists in Snowflake
4. Verify login events also deleted

**Expected Input**:
```
DELETE /api/testing/delete-user/e2e-test-001@videxa.test
```

**Expected Output**:
```json
{
  "success": true,
  "message": "Test user e2e-test-001@videxa.test deleted successfully",
  "login_events_deleted": 1
}
```

**Database Verification**:
```sql
SELECT COUNT(*) FROM USER_PROFILES WHERE EMAIL = 'e2e-test-001@videxa.test';
-- Expected: 0

SELECT COUNT(*) FROM USER_LOGIN_EVENTS WHERE EMAIL = 'e2e-test-001@videxa.test';
-- Expected: 0
```

**Pass Criteria**:
- ✅ Deletion succeeds with 200 status
- ✅ User removed from USER_PROFILES table
- ✅ Associated login events removed
- ✅ Safety check prevents deletion of non-test users (REGISTRATION_METHOD != 'testing')

---

## TC-1-UC0001: Successful CSV Claims File Upload

**Use Case**: UC0001 - File Ingestion for Healthcare Data Analysis

**Test Objective**: Verify that a valid CSV claims file can be uploaded and parsed into the CLAIMS schema

**Prerequisites**:
- User authenticated as `test-analyst@hcs0001.videxa.ai`
- User has WRITER role in HCS0001 organization
- Test file: `sample_claims_837.csv` (500 rows, 2.3 MB)

**Test Steps**:
1. Open NexusChat conversation at http://localhost:3050
2. Click "Attach File" button (📎 icon)
3. Select file: `C:\test-data\sample_claims_837.csv`
4. Confirm upload dialog
5. Wait for processing completion message

**Expected Input**:
```
File: sample_claims_837.csv
Format: CSV
Size: 2.3 MB
Columns: claim_id, patient_id, payer_id, service_date, billing_code, amount_billed, amount_paid, status
Row Count: 500
```

**Expected Output**:
```
✅ File uploaded successfully!

File: sample_claims_837.csv
Records processed: 500
Loaded to: HCS0001_DB.CLAIMS.INSURANCE_CLAIMS
Processing time: 3.2 seconds

You can now query this data. Try asking:
- "Show me denied claims from this file"
- "What's the average reimbursement rate?"
```

**Database Verification**:
```sql
USE DATABASE HCS0001_DB;
SELECT COUNT(*) FROM CLAIMS.INSURANCE_CLAIMS WHERE UPLOAD_ID = '<generated_uuid>';
-- Expected: 500
```

**Pass Criteria**:
- ✅ Upload completes without errors
- ✅ 500 records inserted into INSURANCE_CLAIMS table
- ✅ File metadata stored in FILE_UPLOADS table
- ✅ Audit entry created in ORG_RESOURCE_USAGE
- ✅ Confirmation message displayed in chat

---

## TC-2-UC0001: Invalid File Type Rejection

**Use Case**: UC0001 - File Ingestion for Healthcare Data Analysis

**Test Objective**: Verify that unsupported file types are rejected with appropriate error message

**Prerequisites**:
- User authenticated to NexusChat
- Test file: `malicious_script.exe` (executable file)

**Test Steps**:
1. Open NexusChat conversation
2. Click "Attach File" button
3. Select file: `malicious_script.exe`
4. Attempt upload

**Expected Input**:
```
File: malicious_script.exe
Format: application/x-msdownload
Size: 45 KB
```

**Expected Output**:
```
❌ Upload failed: Unsupported file type

Supported formats:
- CSV (.csv)
- Excel (.xlsx, .xls)
- PDF (.pdf)
- JSON (.json)
- Text (.txt)

Please convert your file and try again.
```

**Database Verification**:
```sql
-- No records should be created
SELECT COUNT(*) FROM NEXUSCHAT.FILE_UPLOADS WHERE FILENAME = 'malicious_script.exe';
-- Expected: 0
```

**Pass Criteria**:
- ✅ Upload rejected before processing
- ✅ Error message clearly states unsupported format
- ✅ No database records created
- ✅ No security vulnerabilities exposed

---

## TC-3-UC0001: Large File Size Limit Enforcement

**Use Case**: UC0001 - File Ingestion for Healthcare Data Analysis

**Test Objective**: Verify that files exceeding size limit (100MB) are rejected

**Prerequisites**:
- User authenticated to NexusChat
- Test file: `large_claims_dataset.csv` (150 MB)

**Test Steps**:
1. Open NexusChat conversation
2. Attempt to upload `large_claims_dataset.csv`

**Expected Input**:
```
File: large_claims_dataset.csv
Format: CSV
Size: 150 MB (exceeds limit)
```

**Expected Output**:
```
❌ File too large

Your file (150 MB) exceeds the maximum size limit of 100 MB.

Suggestions:
- Split the file into smaller chunks
- Compress the file (ZIP)
- Contact your administrator for bulk upload options

For large datasets, use our FTP upload service.
```

**Pass Criteria**:
- ✅ Upload rejected at client-side validation
- ✅ Clear error message with file size and limit
- ✅ Alternative solutions provided
- ✅ No server resources consumed

---

## TC-4-UC0001: Concurrent File Upload Handling

**Use Case**: UC0001 - File Ingestion for Healthcare Data Analysis

**Test Objective**: Verify that multiple simultaneous file uploads are queued and processed correctly

**Prerequisites**:
- User authenticated to NexusChat
- Three test files ready: `claims_jan.csv`, `claims_feb.csv`, `claims_mar.csv`

**Test Steps**:
1. Open NexusChat conversation
2. Rapidly upload all three files without waiting for completion
3. Monitor processing queue

**Expected Input**:
```
File 1: claims_jan.csv (1.2 MB, 300 rows)
File 2: claims_feb.csv (1.5 MB, 350 rows)
File 3: claims_mar.csv (1.8 MB, 400 rows)
Upload Timing: Submitted within 2 seconds of each other
```

**Expected Output**:
```
📤 Processing uploads (3 in queue)...

✅ claims_jan.csv completed (300 records)
✅ claims_feb.csv completed (350 records)
✅ claims_mar.csv completed (400 records)

All files processed successfully!
Total records: 1,050
Processing time: 8.7 seconds
```

**Pass Criteria**:
- ✅ All three files uploaded successfully
- ✅ Files processed sequentially without data corruption
- ✅ Total record count matches sum of individual files
- ✅ No race conditions or database locking issues

---

## TC-1-UC0002: Dashboard Rendering with Real Data

**Use Case**: UC0002 - Conversation Dashboard and Progress Tracking

**Test Objective**: Verify dashboard displays accurate metrics from user's conversation history

**Prerequisites**:
- User has 15 conversations in database
- CORTEX_USAGE_LOG contains 250 queries
- Date range: Last 30 days

**Test Steps**:
1. Login as `analyst@hcs0002.videxa.ai`
2. Navigate to "My Dashboard" page
3. Verify all dashboard widgets load

**Expected Input**:
```
User: analyst@hcs0002.videxa.ai
Organization: HCS0002
Date Range: Last 30 days
Query Filters: None (default all)
```

**Expected Output**:
```
📊 My NexusChat Dashboard

Total Conversations: 15
Total Messages: 250
AI Tokens Used: 1,245,678
Estimated Cost: $45.23

📈 Usage Trends (Last 30 Days)
Week 1: 215K tokens ($7.89)
Week 2: 298K tokens ($11.45)
Week 3: 402K tokens ($15.67)
Week 4: 330K tokens ($10.22)

🎯 Top Queries
1. "Analyze Q3 denial rates" (35 times)
2. "Show UHC claims summary" (28 times)
3. "Compare carrier reimbursement" (22 times)

⚡ Cache Efficiency
Cache Hit Rate: 58%
Tokens Saved: 320,450 (25%)
Cost Saved: $11.82
```

**Database Verification**:
```sql
SELECT COUNT(*) FROM NEXUSCHAT.CONVERSATIONS WHERE USER_ID = 'analyst@hcs0002.videxa.ai';
-- Expected: 15

SELECT SUM(TOTAL_TOKENS) FROM CORTEX_USAGE_LOG WHERE USER_ID = 'analyst@hcs0002.videxa.ai' AND TIMESTAMP >= DATEADD(day, -30, CURRENT_TIMESTAMP());
-- Expected: ~1,245,678
```

**Pass Criteria**:
- ✅ All metrics display without errors
- ✅ Numbers match database query results
- ✅ Charts render correctly (line, bar, pie)
- ✅ Dashboard loads in <3 seconds

---

## TC-2-UC0002: Dashboard Date Range Filtering

**Use Case**: UC0002 - Conversation Dashboard and Progress Tracking

**Test Objective**: Verify dashboard metrics update correctly when date range filter is applied

**Prerequisites**:
- User has conversation history spanning 6 months
- Dashboard currently showing last 30 days

**Test Steps**:
1. Open dashboard
2. Click date range filter dropdown
3. Select "Last 7 days"
4. Verify metrics update

**Expected Input**:
```
Previous Range: Last 30 days
New Range: Last 7 days
Current Date: November 2, 2025
Filter Start: October 26, 2025
```

**Expected Output**:
```
📊 Dashboard Updated (Last 7 Days)

Total Conversations: 4 (was 15)
Total Messages: 62 (was 250)
AI Tokens Used: 289,445 (was 1,245,678)
Estimated Cost: $10.22 (was $45.23)

Chart Updates:
- Usage trend shows daily breakdown (7 bars)
- Top queries recalculated for recent period
- Cache hit rate: 61% (improved)
```

**Pass Criteria**:
- ✅ Metrics recalculate based on new date range
- ✅ Charts re-render with filtered data
- ✅ Filter selection persists across page refresh
- ✅ Query performance remains under 2 seconds

---

## TC-3-UC0002: Export Dashboard to PDF

**Use Case**: UC0002 - Conversation Dashboard and Progress Tracking

**Test Objective**: Verify dashboard can be exported as formatted PDF report

**Prerequisites**:
- User has dashboard open with data displayed
- Browser supports PDF generation

**Test Steps**:
1. Open dashboard
2. Click "Export to PDF" button
3. Confirm export settings dialog
4. Save PDF to local filesystem

**Expected Input**:
```
Export Settings:
- Include: All charts and metrics
- Date Range: Current filter (Last 30 days)
- Format: PDF (Letter size)
- Branding: HCS0002 logo and colors
```

**Expected Output**:
```
PDF File Generated:
Filename: NexusChat_Dashboard_HCS0002_2025-11-02.pdf
Size: ~450 KB
Pages: 3

Page 1: Summary metrics and key statistics
Page 2: Usage trends and charts
Page 3: Top queries and recommendations

Footer: "Generated by NexusChat - Confidential Healthcare Data"
```

**File Verification**:
- PDF opens in viewer without errors
- All charts render as images (not broken links)
- Text is selectable and readable
- Organization branding present

**Pass Criteria**:
- ✅ PDF generated successfully
- ✅ All dashboard content included
- ✅ Charts render as high-quality images
- ✅ File size under 1 MB

---

## TC-1-UC0003: Carrier Analysis Query Execution

**Use Case**: UC0003 - Insurance Carrier Analysis from Claims Data

**Test Objective**: Verify AI can analyze claims data for specific carrier and provide actionable insights

**Prerequisites**:
- HCS0001_DB.CLAIMS.INSURANCE_CLAIMS contains 5,000 claims
- Claims include carrier "UnitedHealthcare" (Payer ID: UHC001)
- Date range: Last 12 months

**Test Steps**:
1. Open new NexusChat conversation
2. Type query: "From the claims that I have supplied, what can you tell me about the insurance carrier UnitedHealthcare?"
3. Submit query
4. Wait for AI response

**Expected Input**:
```
User Query: "From the claims that I have supplied, what can you tell me about the insurance carrier UnitedHealthcare?"
Carrier Identifier: "UnitedHealthcare" or "UHC001"
Database: HCS0001_DB.CLAIMS.INSURANCE_CLAIMS
```

**Expected Output**:
```
🏥 UnitedHealthcare Claims Analysis

📊 Volume & Performance
- Total Claims: 1,248 (25% of all claims)
- Date Range: Nov 2024 - Nov 2025
- Claims Paid: 1,089 (87.3%)
- Claims Denied: 159 (12.7%)

💰 Financial Summary
- Total Billed: $2,456,890
- Total Paid: $1,987,234 (80.9% reimbursement rate)
- Average Payment: $1,825 per claim

⏱️ Processing Time
- Average Turnaround: 18.5 days
- Within 30 days: 92%
- Over 60 days: 3%

❌ Top Denial Reasons
1. Missing authorization (45 claims, 28%)
2. Non-covered service (38 claims, 24%)
3. Duplicate claim (29 claims, 18%)
4. Coding error (27 claims, 17%)
5. Timely filing limit exceeded (20 claims, 13%)

📈 Trend Analysis
- Denial rate increasing: 10.2% → 12.7% (Q3 to Q4)
- Reimbursement rate declining: 83.1% → 80.9%

💡 Recommendations
1. Focus on prior authorization workflows (28% of denials)
2. Audit coding processes to reduce errors
3. Review timely filing procedures
4. Consider contract renegotiation for better rates
```

**Database Verification**:
```sql
SELECT COUNT(*) FROM CLAIMS.INSURANCE_CLAIMS WHERE PAYER_NAME = 'UnitedHealthcare';
-- Expected: 1,248

SELECT AVG(AMOUNT_PAID/AMOUNT_BILLED) FROM CLAIMS.INSURANCE_CLAIMS WHERE PAYER_NAME = 'UnitedHealthcare' AND STATUS = 'PAID';
-- Expected: ~0.809 (80.9%)
```

**Pass Criteria**:
- ✅ Query executes successfully
- ✅ Analysis includes volume, financial, timing, and denial metrics
- ✅ Trend analysis shows historical comparison
- ✅ Recommendations are specific and actionable
- ✅ Response generated in <10 seconds

---

## TC-2-UC0003: Carrier Comparison Across Multiple Payers

**Use Case**: UC0003 - Insurance Carrier Analysis from Claims Data

**Test Objective**: Verify AI can compare multiple carriers side-by-side

**Prerequisites**:
- Claims data for 3+ carriers in database
- Minimum 200 claims per carrier for statistical significance

**Test Steps**:
1. Open NexusChat conversation
2. Type: "Compare UnitedHealthcare, Aetna, and Blue Cross Blue Shield performance"
3. Submit query

**Expected Input**:
```
User Query: "Compare UnitedHealthcare, Aetna, and Blue Cross Blue Shield performance"
Carriers: ["UnitedHealthcare", "Aetna", "Blue Cross Blue Shield"]
```

**Expected Output**:
```
🏆 Carrier Performance Comparison

| Metric | UnitedHealthcare | Aetna | Blue Cross Blue Shield |
|--------|-----------------|-------|----------------------|
| Claims Volume | 1,248 | 892 | 1,456 |
| Denial Rate | 12.7% 🔴 | 8.2% 🟢 | 10.5% 🟡 |
| Avg Reimbursement | 80.9% | 86.3% 🟢 | 83.1% |
| Turnaround Time | 18.5 days | 14.2 days 🟢 | 22.1 days 🔴 |
| Payment Accuracy | 94.2% | 97.1% 🟢 | 91.8% |

🥇 Best Performer: Aetna
- Lowest denial rate (8.2%)
- Highest reimbursement rate (86.3%)
- Fastest turnaround (14.2 days)
- Best payment accuracy (97.1%)

🔴 Needs Attention: UnitedHealthcare
- Highest denial rate among three carriers
- Consider contract review and process improvements
```

**Pass Criteria**:
- ✅ All three carriers analyzed
- ✅ Comparison table formatted clearly
- ✅ Best/worst performers identified
- ✅ Visual indicators (🟢🟡🔴) for quick scanning

---

## TC-3-UC0003: Historical Trend Analysis for Single Carrier

**Use Case**: UC0003 - Insurance Carrier Analysis from Claims Data

**Test Objective**: Verify AI can identify and visualize trends over time for a carrier

**Prerequisites**:
- Claims data spanning 24 months
- Minimum 100 claims per month for carrier

**Test Steps**:
1. Open NexusChat
2. Ask: "Show me UnitedHealthcare's denial rate trend over the last 24 months"

**Expected Input**:
```
Query: "Show me UnitedHealthcare's denial rate trend over the last 24 months"
Carrier: UnitedHealthcare
Time Period: 24 months (Nov 2023 - Nov 2025)
Metric: Denial rate
```

**Expected Output**:
```
📈 UnitedHealthcare Denial Rate Trend (24 Months)

[Line chart embedded showing denial % by month]

Key Findings:
- Starting point (Nov 2023): 9.2%
- Current (Nov 2025): 12.7%
- Overall trend: ↗️ Increasing (+38%)
- Peak: July 2025 (14.1%)
- Lowest: January 2024 (7.8%)

Significant Changes:
- March 2024: Sharp increase from 8.1% to 11.2% (new policy implementation)
- June 2025: Spike to 14.1% (coding guideline changes)
- August 2025: Improvement to 11.5% (workflow adjustments)

Seasonality:
- Q1 typically lower (avg 8.4%)
- Q3 typically higher (avg 12.9%)

Forecast (next 3 months):
- December 2025: 12.1%
- January 2026: 10.8%
- February 2026: 11.2%
```

**Pass Criteria**:
- ✅ Trend visualization included
- ✅ Statistical analysis covers 24-month period
- ✅ Significant events identified and explained
- ✅ Forecast provided based on historical data

---

## TC-1-UC0004: Contract Discrepancy Detection

**Use Case**: UC0004 - Contract Comparison and Problem Identification

**Test Objective**: Verify AI can identify conflicting terms between carrier contract and clearinghouse agreement

**Prerequisites**:
- Carrier contract uploaded: `UHC_Provider_Agreement_2025.pdf`
- Clearinghouse agreement uploaded: `ChangeHealthcare_Terms_2025.pdf`
- Both documents in `POLICIES.PROVIDER_CONTRACTS` table

**Test Steps**:
1. Open NexusChat
2. Upload both contract PDFs
3. Ask: "Can you review the carrier's contract and that of the clearinghouse so that we can identify the problem?"
4. Wait for AI analysis

**Expected Input**:
```
Documents:
1. UHC_Provider_Agreement_2025.pdf (Healthcare System ID: HCS0001, Carrier: UnitedHealthcare)
2. ChangeHealthcare_Terms_2025.pdf (Clearinghouse Agreement)

Analysis Type: Contract comparison for claims processing issues
```

**Expected Output**:
```
🔍 Contract Comparison Analysis

⚠️ Critical Discrepancies Found (3)

1. EDI Transaction Format Mismatch
   Carrier Contract (Section 5.2):
   - "Claims must be submitted in ANSI X12 837P format version 5010"
   - "Situational data elements are REQUIRED"

   Clearinghouse Agreement (Section 3.4):
   - "Support for 837P version 5010 with optional elements as SITUATIONAL"

   Impact: Clearinghouse may not include required fields, causing claim rejections
   Recommendation: Request clearinghouse to mark all carrier-required fields as mandatory

2. Timely Filing Deadline Conflict
   Carrier Contract (Section 7.1):
   - "Claims must be filed within 90 days of date of service"

   Clearinghouse Agreement (Section 6.2):
   - "Claims held in queue up to 7 business days before submission"
   - "No guarantee of submission timing"

   Impact: Risk of missing 90-day deadline if clearinghouse delays exceed 7 days
   Recommendation: Configure automatic alerts at day 75 for pending claims

3. Billing Code Requirements
   Carrier Contract (Appendix C):
   - "ICD-10 diagnosis codes must be reported to highest specificity (5-7 digits)"

   Clearinghouse Agreement (Section 4.1):
   - "System truncates diagnosis codes to 5 digits for compatibility"

   Impact: UHC requires 7-digit codes for certain conditions; clearinghouse truncates
   Recommendation: Bypass clearinghouse for claims requiring extended diagnosis codes

📊 Additional Observations
- Fee schedule alignment: ✅ Compatible
- Prior authorization workflows: ⚠️ Requires manual coordination
- Claim status inquiry: ✅ Real-time support in both agreements

💡 Root Cause Summary
The primary issue appears to be clearinghouse truncation of ICD-10 codes conflicting with UHC's specificity requirements. This likely explains the 11.2% denial rate you're experiencing for "coding error" reasons.

Next Steps:
1. Contact ChangeHealthcare to disable code truncation
2. Request clearinghouse to flag UHC claims for priority processing
3. Consider direct EDI connection for UHC to bypass clearinghouse
```

**Database Verification**:
```sql
SELECT * FROM POLICIES.PROVIDER_CONTRACTS WHERE CONTRACT_NAME LIKE '%UHC%' OR CONTRACT_NAME LIKE '%ChangeHealthcare%';
-- Expected: 2 records returned
```

**Pass Criteria**:
- ✅ Both contracts analyzed successfully
- ✅ At least 2-3 specific discrepancies identified
- ✅ Contract sections cited with quotes
- ✅ Business impact explained for each issue
- ✅ Actionable recommendations provided

---

## TC-2-UC0004: Contract Clause Semantic Search

**Use Case**: UC0004 - Contract Comparison and Problem Identification

**Test Objective**: Verify AI can find relevant contract clauses using natural language queries

**Prerequisites**:
- Multiple contracts in database (5+ provider agreements)
- Contracts indexed with Snowflake Cortex embeddings

**Test Steps**:
1. Open NexusChat
2. Ask: "Which of my contracts have clauses about appeal timeframes?"

**Expected Input**:
```
Query: "Which of my contracts have clauses about appeal timeframes?"
Search Type: Semantic search across all contracts
Embedding Model: SNOWFLAKE.CORTEX.EMBED_TEXT_768
```

**Expected Output**:
```
📄 Found 3 contracts with appeal timeframe clauses:

1. UnitedHealthcare Provider Agreement (2025)
   Section 8.3 - Claims Appeals Process
   "Provider has sixty (60) calendar days from the date of denial notification to submit a written appeal. Appeals submitted after this timeframe will not be considered."
   Relevance Score: 95%

2. Aetna Network Participation Agreement (2024)
   Section 12.1 - Dispute Resolution
   "Written appeals must be filed within ninety (90) days of the initial adverse determination. First level appeal responses provided within thirty (30) business days."
   Relevance Score: 92%

3. Blue Cross Blue Shield Service Agreement (2025)
   Exhibit B - Appeals and Grievances
   "Providers may file appeals within one hundred eighty (180) days from claim denial. Expedited appeals available for urgent matters with 72-hour response time."
   Relevance Score: 88%

Summary:
- UHC: 60 days to appeal
- Aetna: 90 days to appeal, 30-day response
- BCBS: 180 days to appeal, 72-hour expedited option

Recommendation: BCBS offers the most favorable appeal timeline. Consider this when selecting in-network carriers.
```

**Pass Criteria**:
- ✅ Semantic search returns relevant results
- ✅ Exact clauses quoted from contracts
- ✅ Relevance scores displayed
- ✅ Comparative summary provided

---

## TC-3-UC0004: Multi-Party Contract Workflow Analysis

**Use Case**: UC0004 - Contract Comparison and Problem Identification

**Test Objective**: Verify AI can map end-to-end workflow across carrier, clearinghouse, and provider contracts

**Prerequisites**:
- 3 related contracts: provider agreement, clearinghouse terms, payer policy
- Workflow involves claims submission → clearinghouse processing → payer adjudication

**Test Steps**:
1. Upload all three contracts
2. Ask: "Map the complete claims submission workflow from my perspective through the clearinghouse to UHC, identifying any bottlenecks"

**Expected Input**:
```
Documents:
1. Provider_Internal_Policy.pdf (internal billing procedures)
2. ChangeHealthcare_Terms.pdf (clearinghouse agreement)
3. UHC_Provider_Agreement.pdf (payer contract)

Analysis Type: End-to-end workflow mapping
```

**Expected Output**:
```
🔄 Claims Submission Workflow Analysis

Step 1: Provider Submission
Provider Policy: "Claims submitted within 24 hours of service"
↓ Timeline: 0-24 hours
✅ No issues identified

Step 2: Clearinghouse Intake
Clearinghouse Terms: "Claims received via SFTP batch upload nightly"
↓ Timeline: 24-48 hours (batching delay)
⚠️ Bottleneck #1: Daily batching adds 12-24 hour delay

Step 3: Clearinghouse Validation
Clearinghouse Terms: "Claims validated within 2 business days"
↓ Timeline: 48-96 hours
⚠️ Bottleneck #2: Validation SLA allows up to 48 additional hours

Step 4: Submission to Payer
Clearinghouse Terms: "Electronic submission to payers within 4 hours of validation"
↓ Timeline: 96-100 hours
✅ Fast handoff once validated

Step 5: Payer Adjudication
UHC Contract: "Claims adjudicated within 30 days of receipt"
↓ Timeline: 100 hours - 30 days
✅ Standard industry timeline

Total End-to-End: 4-34 days

⚠️ Critical Issues:
1. Timely Filing Risk: UHC requires filing within 90 days. Current workflow uses 4-5 days before claim reaches UHC, leaving only 85-86 days buffer.

2. Resubmission Penalty: If claim rejected at Step 3, restarting workflow adds another 4-5 days. Multiple rejections risk missing deadline.

3. Batch Processing Inefficiency: Real-time submission would eliminate 24-hour batching delay.

💡 Optimization Recommendations:
1. Switch to real-time SFTP push (eliminate batch wait)
2. Implement pre-submission validation (catch errors before clearinghouse)
3. Set internal deadline at Day 75 to allow resubmission buffer
4. Consider direct EDI connection to UHC for high-value claims (bypass Steps 2-4)

Expected Impact:
- Reduce submission time from 4-5 days to <24 hours
- Increase timely filing safety margin from 85 days to 89 days
- Reduce denial risk by 8-12%
```

**Pass Criteria**:
- ✅ Complete workflow mapped with timelines
- ✅ Bottlenecks identified with supporting contract quotes
- ✅ Risk analysis provided
- ✅ Specific optimization recommendations with expected impact

---

## TC-1-UC0006: Budget Alert Trigger at 75% Threshold

**Use Case**: UC0006 - Cost and Budget Monitoring

**Test Objective**: Verify system triggers warning alert when organization reaches 75% of monthly budget

**Prerequisites**:
- Organization HCS0003 has MONTHLY_COST_LIMIT of $1,000
- Current month spend: $0 initially
- Test queries prepared to reach $750 spend

**Test Steps**:
1. Log usage via API to simulate $750 in Cortex costs
2. Monitor BUDGET_ALERTS table
3. Verify administrator receives notification

**Expected Input**:
```
Organization: HCS0003
Monthly Budget: $1,000.00
Current Spend: $750.00 (75.0%)
Threshold: 75% WARNING
Date: November 15, 2025
```

**Expected Output**:
```
Database Record (AUDIT_LOGS.BUDGET_ALERTS):
{
  "id": "alert-2025-11-15-hcs0003-001",
  "timestamp": "2025-11-15T14:23:45Z",
  "org_id": "HCS0003",
  "alert_level": "WARNING",
  "budget_used_pct": 75.0,
  "message": "Organization HCS0003 has used 75% of monthly budget ($750.00 of $1,000.00). Approaching critical threshold.",
  "acknowledged": false
}

Email Notification (to admin@hcs0003.videxa.ai):
Subject: ⚠️ Budget Alert: 75% of Monthly Limit Reached

Dear Administrator,

Your organization (HCS0003) has reached 75% of the monthly AI usage budget:

Current Spend: $750.00
Monthly Budget: $1,000.00
Remaining: $250.00

Top Cost Drivers:
1. User: analyst1@hcs0003.videxa.ai ($320.50)
2. User: manager@hcs0003.videxa.ai ($285.75)
3. User: billing@hcs0003.videxa.ai ($143.75)

Recommendations:
- Review high-cost queries
- Enable prompt caching (currently 42% hit rate)
- Consider budget increase if needed

View detailed report: https://nexuschat.videxa.ai/admin/cost-management

Best regards,
NexusChat System
```

**Dashboard Display**:
```
🚨 Budget Alert Banner (appears on all user screens in HCS0003):
"⚠️ Your organization has used 75% of this month's AI budget. Please use NexusChat efficiently."
```

**Pass Criteria**:
- ✅ Alert triggered automatically at exactly 75%
- ✅ Record created in BUDGET_ALERTS table
- ✅ Email sent to all administrators in organization
- ✅ Banner displayed on user dashboards
- ✅ Alert visible in V_ACTIVE_BUDGET_ALERTS view

---

## TC-2-UC0006: Budget Suspension at 100% Threshold

**Use Case**: UC0006 - Cost and Budget Monitoring

**Test Objective**: Verify organization is automatically suspended when budget reaches 100%

**Prerequisites**:
- Organization HCS0004 has MONTHLY_COST_LIMIT of $500
- Current spend: $495 (99%)
- Next query will exceed budget

**Test Steps**:
1. Submit query that costs $10 (pushes total to $505)
2. Verify query is rejected
3. Verify organization status changed to 'suspended'

**Expected Input**:
```
Organization: HCS0004
Monthly Budget: $500.00
Current Spend: $495.00
Attempted Query: "Analyze all claims for Q4" (estimated cost: $10.00)
```

**Expected Output**:
```
User Interface Error:
❌ Budget Limit Exceeded

Your organization has reached its monthly AI usage limit ($500.00).

Current month spend: $505.00 (101%)
Query rejected: "Analyze all claims for Q4"

Please contact your administrator to:
- Review current month usage
- Request budget increase
- Enable next month's budget early

Your conversation history remains accessible (read-only).

Administrator Contact: admin@hcs0004.videxa.ai
```

**Database Changes**:
```sql
-- Organization status updated
UPDATE ORGANIZATIONS SET STATUS = 'suspended', UPDATED_AT = CURRENT_TIMESTAMP() WHERE ORG_ID = 'HCS0004';

-- Critical alert logged
INSERT INTO BUDGET_ALERTS (org_id, alert_level, budget_used_pct, message)
VALUES ('HCS0004', 'CRITICAL', 101.0, 'Budget exceeded - organization suspended');

-- Warehouse suspended
ALTER WAREHOUSE HCS0004_WH SUSPEND;
```

**Administrator Notification**:
```
Email: URGENT - Budget Limit Exceeded, Services Suspended
To: admin@hcs0004.videxa.ai

CRITICAL ALERT

Organization HCS0004 has exceeded its monthly budget and been automatically suspended:

Budget: $500.00
Actual Spend: $505.00 (101%)
Status: SUSPENDED

Actions Required:
1. Review usage in cost management dashboard
2. Increase budget or wait for monthly reset (Dec 1)
3. Reactivate organization via admin panel

Impact:
- All users cannot submit new queries
- Read-only access to conversation history maintained
- No Snowflake Cortex calls will be executed

To reactivate: https://nexuschat.videxa.ai/admin/organizations/HCS0004/reactivate
```

**Pass Criteria**:
- ✅ Query rejected before execution
- ✅ Organization STATUS changed to 'suspended'
- ✅ Warehouse suspended automatically
- ✅ Critical alert created in database
- ✅ Immediate notification sent to administrators
- ✅ Users see clear error message with contact info

---

## TC-1-UC0007: Cache Hit on Repeated Query

**Use Case**: UC0007 - Cached Query Performance Optimization

**Test Objective**: Verify identical query returns cached response without calling Cortex

**Prerequisites**:
- PROMPT_CACHE table enabled and empty
- User authenticated to HCS0001

**Test Steps**:
1. Submit query: "What is the average claim amount in my database?"
2. Wait for response (should call Cortex)
3. Submit exact same query again
4. Verify second response is instant (cache hit)

**Expected Input - First Query**:
```
Query: "What is the average claim amount in my database?"
Cache Key: SHA2("What is the average claim amount in my database?" + "claude-sonnet-4")
Cache Status: MISS (key not found)
```

**Expected Output - First Query**:
```
[Response after 2.3 seconds]

The average claim amount in your database is $1,847.23 based on analysis of 5,247 claims.

Breakdown:
- Inpatient claims: $8,245.67 average
- Outpatient claims: $892.34 average
- Emergency visits: $2,134.89 average

Query Performance:
- Tokens used: 2,450 (prompt: 850, completion: 1,600)
- Cost: $0.0319
- Cache: MISS (new query)
```

**Database Record After First Query**:
```sql
SELECT * FROM PROMPT_CACHE WHERE CACHE_KEY = '<computed_sha2_hash>';

Result:
{
  "cache_key": "a7f3c9e2b4d6f8e1a3c5b7d9f1e3a5c7...",
  "prompt_text": "What is the average claim amount in my database?",
  "response_text": "The average claim amount in your database is $1,847.23...",
  "model_name": "claude-sonnet-4",
  "tokens_used": 2450,
  "cost_usd": 0.0319,
  "hit_count": 0,
  "created_at": "2025-11-02T14:30:15Z",
  "expires_at": "2025-11-03T14:30:15Z",
  "last_hit_at": NULL
}
```

**Expected Input - Second Query (Cache Hit)**:
```
Query: "What is the average claim amount in my database?" (identical)
Cache Key: <same SHA2 hash>
Cache Status: HIT (found in cache, not expired)
```

**Expected Output - Second Query**:
```
[Response instantly, <100ms]

The average claim amount in your database is $1,847.23 based on analysis of 5,247 claims.

Breakdown:
- Inpatient claims: $8,245.67 average
- Outpatient claims: $892.34 average
- Emergency visits: $2,134.89 average

Query Performance:
- Tokens used: 0 (cached response)
- Cost: $0.00 💰 SAVED $0.0319
- Cache: HIT ⚡ (99.7% faster)
```

**Database After Second Query**:
```sql
SELECT hit_count, last_hit_at FROM PROMPT_CACHE WHERE CACHE_KEY = '<hash>';

Result:
{
  "hit_count": 1,  -- Incremented
  "last_hit_at": "2025-11-02T14:32:45Z"  -- Updated
}
```

**Pass Criteria**:
- ✅ First query calls Snowflake Cortex (logs token usage)
- ✅ Response stored in PROMPT_CACHE table
- ✅ Second query returns cached response (0 tokens)
- ✅ Response time under 100ms for cache hit
- ✅ hit_count incremented in database
- ✅ Cost savings displayed to user

---

**Document Version**: 1.0
**Last Updated**: November 2, 2025
**Total Test Cases**: 19 across 7 use cases
**Coverage**: File upload (4), Dashboard (3), Carrier analysis (3), Contract review (3), Budget monitoring (2), Caching (1), Additional (3 planned)
