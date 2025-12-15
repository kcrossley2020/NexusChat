# E2E Testing Setup Guide

This document describes how to set up and run end-to-end tests for the NexusChat system.

## Prerequisites

### 1. Backend Testing Endpoints

The AgentNexus backend must have testing endpoints enabled:

1. Verify `C:\videxa-repos\agentnexus-backend\.env` contains:
   ```bash
   ENABLE_TESTING_ENDPOINTS=true
   ```

2. Restart the `agentnexus-backend` Docker container to apply changes:
   - Option A: Via Docker Desktop
     - Open Docker Desktop
     - Find `agentnexus-backend` container
     - Click the restart icon

   - Option B: Via command line
     ```bash
     docker restart agentnexus-backend
     ```

3. Verify testing endpoints are enabled:
   ```bash
   curl http://localhost:3050/api/testing/health
   ```

   Expected response:
   ```json
   {
     "testing_router": "active",
     "ENABLE_TESTING_ENDPOINTS": "true",
     "enabled": true
   }
   ```

### 2. Azure Authentication (for Snowflake via Key Vault)

The backend connects to Snowflake using credentials stored in Azure Key Vault. Ensure you're authenticated:

```bash
az login
az account show  # Verify you're logged into the correct subscription
```

### 3. Running Containers

Ensure these containers are running in Docker Desktop:
- `agentnexus-backend` (port 3050)
- `NexusChat-Videxa-Snowflake` (port 3080)
- `nexuschat-mongodb`
- `nexuschat-meilisearch`

## Running E2E Tests

### Install Dependencies

```bash
cd C:\videxa-repos\NexusChat
npm install
npx playwright install  # Install browser drivers if needed
```

### Run All Tests

```bash
npm run test:e2e
```

### Run Specific Test Suite

```bash
# Run authentication bypass tests only
npx playwright test tc-0.1-test-user-creation.spec.ts

# Run with UI
npx playwright test tc-0.1-test-user-creation.spec.ts --ui

# Run in headed mode (see browser)
npx playwright test tc-0.1-test-user-creation.spec.ts --headed
```

### View Test Report

```bash
npx playwright show-report
```

## Test Organization

Tests are organized by test case ID from [`test-cases.md`](./test-cases.md):

- **TC-0.1**: Test User Creation via API
- **TC-0.2**: Test User Login and JWT Token Retrieval
- **TC-0.3**: NexusChat Health Check
- **TC-0.4**: Test User Cleanup and Deletion
- **TC-1**: File Upload Tests
- **TC-2**: Claims Data Processing Tests

Each test case has a corresponding `.spec.ts` file in `e2e/specs/`.

## Test Data

### Mock 837 Claims Files

Test data files are located in `e2e/test-data/`:
- `sample_claims_837.csv` - Valid claims data
- `invalid_file.txt` - Invalid file type for negative testing

## Troubleshooting

### Testing Endpoints Return 404

**Problem**: `curl http://localhost:3050/api/testing/health` returns 404

**Solution**:
1. Check `.env` file has `ENABLE_TESTING_ENDPOINTS=true`
2. Restart the backend container
3. Verify container picked up the new environment variable:
   ```bash
   docker logs agentnexus-backend | grep "ENABLE_TESTING_ENDPOINTS"
   ```

### Snowflake Connection Errors

**Problem**: Tests fail with "Failed to fetch Snowflake config from Key Vault"

**Solution**:
1. Verify Azure CLI is logged in: `az account show`
2. Check you have access to the Key Vault:
   ```bash
   az keyvault secret list --vault-name kv-agentnexus-prd-cus
   ```
3. Ensure the service principal or your user has "Get" permission on secrets

### Port Already in Use

**Problem**: Backend won't start because port 3050 is in use

**Solution**:
```bash
# Windows
netstat -ano | findstr ":3050"
taskkill /F /PID <PID>

# Or use Docker Desktop to stop conflicting containers
```

## Security Notes

⚠️ **IMPORTANT**: Testing endpoints MUST be disabled in production:

- Set `ENABLE_TESTING_ENDPOINTS=false` in production `.env`
- Testing endpoints return 404 when disabled (not revealing they exist)
- Test users are marked with `REGISTRATION_METHOD='testing'` for isolation
- Delete endpoints verify the user is a test user before allowing deletion

## Test Execution Flow

### Discrete Test Approach

Tests are built incrementally:

1. **Discrete Test**: Test one specific activity (e.g., TC-0.1: Create User)
2. **Validate**: Ensure discrete test passes
3. **Chain**: Create new test combining activities (e.g., TC-0.1 + TC-0.2: Create User → Login)
4. **Repeat**: Continue chaining validated activities

Example progression:
- TC-0.1: Create User ✓
- TC-0.2: Login ✓
- TC-0.1-0.2-Combined: Create User → Login ✓
- TC-0.3: Health Check ✓
- TC-0.1-0.2-0.3-Combined: Create User → Login → Access NexusChat ✓

This approach ensures each component works before building complex flows.
