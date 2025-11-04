# Authentication Bypass Strategies for Automated Testing

## Overview
Three approaches to enable Playwright/MCP automated testing without manual user authentication in NexusChat.

---

## Option 1: Use Existing E2E Test User Setup (RECOMMENDED)

**Summary**: Leverage NexusChat's built-in Playwright authentication system that auto-registers and logs in a test user, saving session state for reuse across tests.

**How It Works**:
- Set `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` environment variables
- Global setup script registers user (if not exists) and logs in automatically
- Session stored in `playwright/.auth/user.json`
- All tests reuse saved authentication state

**Pros**:
1. ✅ Already implemented - no code changes required
2. ✅ Mirrors real user authentication flow (catches auth bugs)
3. ✅ Secure - uses actual JWT tokens, no backdoors

**Cons**:
1. ❌ Requires cleanup between test runs (user deletion)
2. ❌ Slower initial setup (~3-5 seconds per test session)
3. ❌ Can fail if registration endpoint has issues

**Implementation**:
```bash
# Add to .env
E2E_USER_EMAIL=playwright-test@videxa.local
E2E_USER_PASSWORD=Test123!@#SecurePassword

# Tests automatically authenticate
npx playwright test
```

---

## Option 2: Bypass Middleware with TEST_MODE Flag

**Summary**: Add environment variable `TEST_MODE=true` that disables JWT authentication middleware, allowing anonymous access to all endpoints during testing.

**How It Works**:
- Modify `requireJwtAuth.js` to skip passport.authenticate() when `TEST_MODE=true`
- Inject mock user object into `req.user` for endpoints expecting authenticated user
- Enable only in test environment, never in production

**Pros**:
1. ✅ Instant access - no login/registration overhead
2. ✅ Tests run 3-5x faster (no auth steps)
3. ✅ Simpler test code - no authentication boilerplate

**Cons**:
1. ❌ Requires code modification to middleware
2. ❌ Doesn't test real authentication flow (misses auth bugs)
3. ❌ Security risk if accidentally enabled in production

**Implementation**:
```javascript
// api/server/middleware/requireJwtAuth.js
const requireJwtAuth = (req, res, next) => {
  if (process.env.TEST_MODE === 'true') {
    req.user = {
      id: 'test-user-id',
      email: 'test@videxa.local',
      role: 'user'
    };
    return next();
  }
  // ... existing passport authentication
};
```

---

## Option 3: Generate Static Test JWT Token

**Summary**: Pre-generate a long-lived JWT token for testing and inject it into Playwright requests, bypassing login while still using real JWT validation.

**How It Works**:
- Create script to generate JWT with 1-year expiration
- Store token in test configuration
- Playwright automatically adds `Authorization: Bearer <token>` to all requests
- Backend validates token normally (no middleware changes)

**Pros**:
1. ✅ No code changes to authentication middleware
2. ✅ Tests use real JWT validation (catches token bugs)
3. ✅ Fast - no login required per test session

**Cons**:
1. ❌ Token expires eventually (must regenerate yearly)
2. ❌ Bypasses login flow testing (won't catch registration/login bugs)
3. ❌ Must ensure test user exists in database

**Implementation**:
```javascript
// scripts/generate-test-token.js
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { id: 'test-user-id', email: 'test@videxa.local' },
  process.env.JWT_SECRET,
  { expiresIn: '365d' }
);
console.log('Test JWT:', token);

// playwright.config.ts
use: {
  extraHTTPHeaders: {
    'Authorization': `Bearer ${process.env.TEST_JWT_TOKEN}`
  }
}
```

---

## Recommendation

**Use Option 1 (Existing E2E Setup)** for the following reasons:

1. **Zero implementation effort** - already built into NexusChat
2. **Production-like testing** - validates entire auth flow
3. **Maintenance-free** - no custom code to maintain
4. **Safe** - no risk of accidentally disabling auth in production

The 3-5 second setup overhead is negligible compared to the confidence gained from testing real authentication flows.

---

## Quick Start (Option 1)

```bash
# 1. Add to .env
echo "E2E_USER_EMAIL=test-analyst@hcs0001.videxa.local" >> .env
echo "E2E_USER_PASSWORD=NexusTest2025!" >> .env

# 2. Run tests (auto-authenticates)
npx playwright test tests/use-cases/
```

**File Locations**:
- Auth setup: `e2e/setup/authenticate.ts`
- Stored state: `playwright/.auth/user.json`
- Test examples: `tests/videxa-baseline/functionality.spec.js`
