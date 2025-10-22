# Videxa Baseline Tests for NexusChat

**Purpose**: Verify Videxa customizations remain intact and core functionality works correctly.

These tests serve as a "gate" to ensure that any upstream merges or code changes don't break Videxa branding or critical functionality.

---

## Test Suites

### 1. Branding Tests (`branding.spec.js`)
**Tests**: 15
**Purpose**: Verify Videxa visual identity and branding

**What's Tested**:
- ✅ Page title: "Nex by Videxa"
- ✅ Meta description mentions Videxa and healthcare
- ✅ Theme color is Videxa navy blue (#0F3759)
- ✅ All favicon sizes load correctly (16x16, 32x32)
- ✅ Apple touch icon loads
- ✅ Logo SVG loads and is valid SVG
- ✅ PWA icons load (192x192, 512x512)
- ✅ Custom welcome message contains "Videxa"
- ✅ No "LibreChat" branding visible
- ✅ Background colors match Videxa palette
- ✅ Privacy policy links to videxa.ai
- ✅ Terms of service links to videxa.ai
- ✅ Upstream LibreChat logo not accessible

### 2. Functionality Tests (`functionality.spec.js`)
**Tests**: 13
**Purpose**: Verify core application functionality

**What's Tested**:
- ✅ Homepage loads successfully (HTTP 200)
- ✅ Main application container present
- ✅ Registration/login UI accessible
- ✅ No critical JavaScript errors
- ✅ Navigation elements present
- ✅ Chat interface elements exist
- ✅ JavaScript enabled and running
- ✅ React app mounted correctly
- ✅ Responsive design (mobile viewport)
- ✅ CSS styles applied
- ✅ API health check responds
- ✅ Page load time reasonable (< 10s)
- ✅ First Contentful Paint fast (< 3s)

---

## Running Tests

### Prerequisites
1. **Docker containers must be running**:
   ```bash
   docker-compose -f docker-compose.videxa.yml up -d
   ```

2. **Verify containers are up**:
   ```bash
   docker ps
   # Should show: NexusChat-Videxa, nexuschat-mongodb, etc.
   ```

3. **Application must be accessible**:
   ```bash
   curl http://localhost:3080
   # Should return HTML
   ```

---

## Test Commands

### Run All Tests
```bash
cd C:\videxa-repos\NexusChat

# All baseline tests (branding + functionality)
npm run test:videxa

# Or use the MCP alias
npm run test:mcp-playwright
```

### Run Specific Test Suites
```bash
# Branding tests only
npm run test:videxa:branding

# Functionality tests only
npm run test:videxa:functionality
```

### Run with Browser Visible (Debugging)
```bash
npm run test:videxa:headed
```

### View Test Report
```bash
npm run test:videxa:report
```

---

## Expected Results

### All Passing (28/28)
```
✓ 15 passing (branding.spec.js)
✓ 13 passing (functionality.spec.js)

Total: 28 passing
```

### Example Output
```
Running 28 tests using 1 worker

  ✓  [chromium] › branding.spec.js:VB001: Page title should be "Nex by Videxa" (285ms)
  ✓  [chromium] › branding.spec.js:VB002: Meta description should mention healthcare (198ms)
  ✓  [chromium] › branding.spec.js:VB003: Theme color should be Videxa navy blue (156ms)
  ...
  ✓  [chromium] › functionality.spec.js:VF001: Homepage should load successfully (421ms)
  ✓  [chromium] › functionality.spec.js:VF002: Page should have main application container (234ms)
  ...

  28 passed (1.2m)
```

---

## Troubleshooting

### Tests Fail with "Page not found"
**Problem**: Application not running
**Solution**:
```bash
# Check if containers are running
docker ps

# If not, start them
docker-compose -f docker-compose.videxa.yml up -d

# Wait 30 seconds for startup
sleep 30

# Verify app responds
curl http://localhost:3080
```

### Branding Tests Fail
**Problem**: Upstream merge overwrote Videxa customizations
**Solution**:
```bash
# Reapply patches
git apply videxa-patches/001-branding.patch
bash videxa-patches/002-logos.sh

# Rebuild Docker image
docker-compose -f docker-compose.videxa.yml build
docker-compose -f docker-compose.videxa.yml up -d

# Re-run tests
npm run test:videxa:branding
```

### Functionality Tests Fail
**Problem**: Core application broken (possibly after upstream merge)
**Solution**:
1. Check Docker logs: `docker logs NexusChat-Videxa`
2. Look for errors in console
3. Verify MongoDB is running: `docker logs nexuschat-mongodb`
4. Check API keys in `.env`

### Tests Timeout
**Problem**: Application loading slowly or hanging
**Solution**:
```bash
# Increase timeout in playwright.config.js
# Change navigationTimeout from 30000 to 60000

# Or check system resources
docker stats
```

---

## When to Run These Tests

### Required (Must Pass)
1. ✅ **After upstream merge** - Verify Videxa customizations preserved
2. ✅ **Before git commit** - Ensure changes don't break branding
3. ✅ **After logo updates** - Verify all assets load correctly
4. ✅ **After Docker rebuild** - Ensure image contains all customizations
5. ✅ **Before production deployment** - Final verification

### Recommended
6. After modifying `client/index.html`
7. After updating `librechat.yaml`
8. After changing CSS/styling
9. Weekly during active development
10. After Node package updates

---

## Test Configuration

**Config File**: `playwright.config.js`

**Base URL**: `http://localhost:3080` (override with `BASE_URL` env var)

**Browser**: Chromium (can uncomment Firefox/WebKit in config)

**Timeout**:
- Action: 15 seconds
- Navigation: 30 seconds

**On Failure**:
- Screenshot captured
- Video recorded
- Trace collected (on retry)

---

## Continuous Integration

### GitHub Actions (Future)
```yaml
name: Videxa Baseline Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: docker-compose -f docker-compose.videxa.yml up -d
      - run: sleep 30
      - run: npm run test:videxa
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: playwright-report/
```

---

## Extending Tests

### Adding New Test Cases

1. **For branding**, add to `branding.spec.js`:
   ```javascript
   test('VB016: New branding element', async ({ page }) => {
     await page.goto(BASE_URL);
     // Your test code
   });
   ```

2. **For functionality**, add to `functionality.spec.js`:
   ```javascript
   test('VF014: New functionality', async ({ page }) => {
     await page.goto(BASE_URL);
     // Your test code
   });
   ```

3. **Update test count** in this README

### Creating New Test Suites

For authenticated tests or healthcare-specific features:

```bash
# Create new test file
touch tests/videxa-baseline/healthcare.spec.js

# Add to package.json scripts:
"test:videxa:healthcare": "playwright test tests/videxa-baseline/healthcare.spec.js --config=tests/videxa-baseline/playwright.config.js"
```

---

## Test Coverage

### Current Coverage
- ✅ Visual branding (logos, colors, text)
- ✅ Metadata (title, description, theme)
- ✅ Asset loading (favicons, icons, SVG)
- ✅ Core page loading
- ✅ React app mounting
- ✅ Basic UI elements
- ✅ Performance baselines

### NOT Covered (Future Tests)
- ❌ Authentication flow (requires user setup)
- ❌ AI model selection and chat (requires API keys + auth)
- ❌ File upload functionality
- ❌ Agent marketplace interaction
- ❌ Healthcare-specific features
- ❌ Multi-user scenarios
- ❌ Mobile app (PWA) installation

---

## Performance Benchmarks

Current baseline expectations:
- **Page load time**: < 10 seconds
- **First Contentful Paint**: < 3 seconds
- **Total bundle size**: ~2-3 MB
- **Time to Interactive**: < 5 seconds

If tests consistently fail these benchmarks, investigate:
1. Docker resource allocation
2. Network latency
3. Large asset sizes
4. Inefficient rendering

---

## Playwright Resources

- **Documentation**: https://playwright.dev/
- **Best Practices**: https://playwright.dev/docs/best-practices
- **Debugging**: https://playwright.dev/docs/debug
- **CI/CD**: https://playwright.dev/docs/ci

---

## Contact

**Maintainer**: Kelly Crossley (kcrossley@videxa.co)
**Last Updated**: October 22, 2025
**Test Version**: 1.0
**Total Tests**: 28 (15 branding + 13 functionality)
