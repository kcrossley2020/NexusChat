# Videxa Customizations for NexusChat

**Project**: Nex by Videxa
**Base**: LibreChat (forked from https://github.com/danny-avila/LibreChat)
**Fork**: https://github.com/kcrossley2020/NexusChat
**Version**: v1.0.0-videxa
**Last Updated**: October 22, 2025

---

## ⚠️ IMPORTANT: Fork Maintenance Policy

- **This is a ONE-WAY fork**: We NEVER push Videxa customizations to upstream LibreChat
- **Upstream updates**: Only pull from upstream for critical security patches (separate project conversation required)
- **All files are protected**: No automatic overwrites from upstream - every merge is manual and intentional
- **Git Remotes**:
  - `origin` → https://github.com/kcrossley2020/NexusChat (Videxa fork)
  - `upstream` → https://github.com/danny-avila/LibreChat (original, read-only for us)

---

## 🎨 Videxa Brand Identity

### Colors
- **Primary (Navy Blue)**: `#0F3759` - Main brand color
- **Accent (Gold)**: `#F2B705` - Highlights and CTAs
- **Background Light**: `#F2F2F2` - Light theme background
- **Background Dark**: `#092136` - Dark theme background

### Logo Assets
All logos use the circular "A" Videxa mark, rotated 180 degrees from source material.

---

## 📁 Modified Files (Videxa Customizations)

### 1. Client HTML - Core Branding
**File**: `client/index.html`
**Lines**: 6, 10-11, 30, 32, 34, 36, 38
**Changes**:
- Title: "LibreChat" → "Nex by Videxa"
- Description: Added healthcare-specific messaging
- Theme color: `#171717` → `#0F3759` (Videxa Navy)
- Dark mode background: `#0d0d0d` → `#092136`
- Light mode background: `#ffffff` → `#F2F2F2`

**Git Command to View Changes**:
```bash
git diff upstream/main client/index.html
```

---

### 2. Configuration - Application Settings
**File**: `librechat.yaml`
**Lines**: 5-50+
**Changes**:
- Cache enabled: `cache: true`
- Custom welcome message: "Welcome to Nex by Videxa! Get instant AI-powered insights..."
- Privacy policy URL: `https://videxa.ai/privacy-policy`
- Terms of service URL: `https://videxa.ai/terms`
- Support email: `support@videxa.ai`
- Help/FAQ URL: `https://videxa.ai/faq`
- Enabled endpoints: `openAI,anthropic,google,assistants,agents`
- Marketplace: Enabled for Videxa agents

**Git Command to View Changes**:
```bash
git diff upstream/main librechat.yaml
```

---

### 3. Environment Configuration
**File**: `.env`
**Lines**: 1-237 (entire file customized)
**Changes**:
- Header comments: Added "Nex by Videxa" branding
- MongoDB database: `LibreChat` → `NexChat`
- Port: `3080` (standard)
- Domain: Configured for localhost (production will use videxa.ai domain)
- Debug logging: Enabled for development
- API endpoints: Configured for OpenAI, Anthropic, Google
- Healthcare integrations: Azure AI Search, Snowflake (placeholders ready)

**⚠️ SECURITY NOTE**: This file contains API keys and secrets. Never commit to Git.

**Git Command**:
```bash
# .env is in .gitignore - should never be tracked
git check-ignore .env
```

---

### 4. Logo Assets - Visual Identity
**Directory**: `client/public/assets/`
**Files Modified**:
- `logo.svg` - Main scalable logo (Videxa circular "A")
- `favicon-16x16.png` - Browser tab icon (16×16)
- `favicon-32x32.png` - Browser tab icon (32×32)
- `apple-touch-icon-180x180.png` - iOS home screen icon (180×180)
- `icon-192x192.png` - PWA icon (192×192)
- `maskable-icon.png` - PWA maskable icon (512×512)

**Backup Location**: `client/public/assets/_original_librechat_logos/`

**Source Files**: `temp-logos/` (working directory with source images and generation scripts)

**Git Commands**:
```bash
git diff upstream/main client/public/assets/logo.svg
git diff upstream/main client/public/assets/favicon-16x16.png
# etc.
```

---

### 5. AgentNexus Integration
**File**: `C:\videxa-repos\agentnexus\src\pages\DashboardPage.jsx`
**Location**: External to NexusChat repo
**Changes**:
- Added "Nex AI Assistant" card to AgentNexus dashboard
- Link: `http://localhost:3080` (opens in new tab)
- Badge: "Available" (green)
- Icon: MessageSquare
- Description: "Ask questions about your claims, CDI results, and coding guidelines"

**Note**: This is in a separate repository and not tracked in NexusChat git.

---

## 🔧 Custom Scripts & Tools

### Logo Generation Script
**File**: `temp-logos/create_videxa_logos.py`
**Purpose**: Generate all logo sizes from source image (rotated 180°)
**Dependencies**: Python 3.11+, Pillow 11.3+
**Usage**:
```bash
cd temp-logos
python create_videxa_logos.py
```

---

## 🐳 Docker Customizations

### Custom Docker Image
**Image Name**: `nexuschat:videxa-latest`
**Base Image**: `ghcr.io/danny-avila/librechat-dev:latest`
**Customizations**: Videxa branding, logos, configuration baked in

### Docker Compose Modifications
**File**: `docker-compose.yml` (to be modified)
**Change**: Replace upstream image with custom Videxa build
**Original**: `image: ghcr.io/danny-avila/librechat-dev:latest`
**Modified**: `image: nexuschat:videxa-latest`

---

## 📋 Protected Files (Never Auto-Merge from Upstream)

All files in this repository are protected from automatic upstream merges. Any upstream updates require:
1. Separate project conversation
2. Manual review of changes
3. Testing with MCP Playwright baseline tests
4. Explicit approval before merge

### Critical Protected Files:
1. ✅ `client/index.html` - Core branding
2. ✅ `librechat.yaml` - Application configuration
3. ✅ `.env` - Environment secrets (not in git)
4. ✅ `client/public/assets/*` - All logo/brand assets
5. ✅ `package.json` - Dependencies (verify before updating)
6. ✅ `docker-compose.yml` - Container orchestration
7. ✅ Custom theme files (if/when created)
8. ✅ Custom components (if/when created)

---

## 🏷️ Version Tagging

**Current Version**: `videxa-v1.0.0`
**Tagging Convention**: `videxa-vMAJOR.MINOR.PATCH`

### Version History:
- `videxa-v1.0.0` (2025-10-22) - Initial Videxa rebrand
  - Custom branding in HTML, YAML, logos
  - Healthcare-specific configuration
  - Docker setup prepared
  - MCP Playwright baseline tests

### Creating New Tags:
```bash
# Tag current state
git tag -a videxa-v1.0.0 -m "Initial Videxa rebrand - Oct 22, 2025"
git push origin videxa-v1.0.0

# List all Videxa tags
git tag -l "videxa-v*"
```

---

## 🔄 Upstream Merge Workflow (When Required)

**⚠️ ONLY perform when explicitly required for critical security patches**

### Step 1: Fetch Upstream Changes
```bash
cd /c/videxa-repos/NexusChat
git fetch upstream
git fetch upstream --tags
```

### Step 2: Create Merge Branch
```bash
# Never merge directly to main
git checkout -b upstream-merge-YYYY-MM-DD
git merge upstream/main --no-commit --no-ff
```

### Step 3: Review Conflicts
```bash
git status
git diff --name-only --diff-filter=U
```

### Step 4: Manually Resolve
- Review each conflicted file
- Keep Videxa customizations
- Selectively apply upstream security fixes
- Test thoroughly

### Step 5: Run Baseline Tests
```bash
npm run test:mcp-playwright
```

### Step 6: Commit & Tag
```bash
git commit -m "Merge upstream security patch YYYY-MM-DD - Videxa customizations preserved"
git tag -a videxa-vX.Y.Z -m "Merged upstream patch, tested and verified"
```

### Step 7: Push to Origin (Never Upstream!)
```bash
git push origin main
git push origin videxa-vX.Y.Z
```

---

## 🧪 Testing & Validation

### MCP Playwright Baseline Tests
**Location**: `tests/videxa-baseline/`
**Purpose**: Verify Videxa customizations remain intact after any changes

**Key Test Scenarios**:
1. ✅ Branding verification (title, logos, colors)
2. ✅ Login/authentication flow
3. ✅ AI model selection (OpenAI, Claude, Gemini)
4. ✅ Chat functionality
5. ✅ File upload (healthcare documents)
6. ✅ Agent marketplace access
7. ✅ User profile/settings
8. ✅ Mobile responsiveness

**Run Tests**:
```bash
# Run all baseline tests
npm run test:mcp-playwright

# Run specific test suite
npx playwright test tests/videxa-baseline/branding.spec.js
```

---

## 📦 Patch Files (Reapplication Scripts)

**Directory**: `videxa-patches/`

### Available Patches:
1. `001-branding.patch` - HTML title, meta tags, theme colors
2. `002-logos.patch` - Asset file replacements
3. `003-config.patch` - librechat.yaml customizations
4. `004-docker.patch` - docker-compose.yml modifications

### Applying Patches After Upstream Merge:
```bash
cd /c/videxa-repos/NexusChat

# Apply all patches in order
git apply videxa-patches/001-branding.patch
git apply videxa-patches/002-logos.patch
git apply videxa-patches/003-config.patch
git apply videxa-patches/004-docker.patch

# Verify
git diff
npm run test:mcp-playwright
```

---

## 🤝 Integration Points

### AgentNexus Dashboard
**Repository**: `C:\videxa-repos\agentnexus`
**Integration File**: `src/pages/DashboardPage.jsx`
**Launch URL**: `http://localhost:3080` (dev) / `https://chat.videxa.ai` (prod)
**Description**: NexusChat accessible via "Nex AI Assistant" card

### Data Sources (Future)
- Azure AI Search: Payer policies, coding guidelines
- Snowflake: CDI results, claims data
- Azure Blob Storage: Document uploads
- Azure Entra ID: SSO for @videxa.co users

---

## 📞 Support & Maintenance

**Primary Maintainer**: Kelly Crossley
**Email**: kcrossley@videxa.co
**Last Review**: October 22, 2025
**Next Review**: On-demand (security patches only)

---

## 📚 Related Documentation

- [Quick Start Guide](documentation/NEX-QUICK-START.md)
- [Full Deployment Guide](documentation/VIDEXA-REBRANDING-AND-DEPLOYMENT-GUIDE.md)
- [Strategic Analysis](documentation/NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md)
- [Logo Assets Summary](temp-logos/LOGO_ASSETS_SUMMARY.md)
- [Upstream LibreChat Docs](https://docs.librechat.ai/)

---

## 🔐 Security Notes

1. **API Keys**: Never commit `.env` file or expose API keys
2. **Secrets**: Use Azure Key Vault for production secrets
3. **Authentication**: Consider Azure Entra ID for production SSO
4. **HTTPS**: Always use HTTPS in production (Let's Encrypt or Azure App Gateway)
5. **Updates**: Only apply security patches after thorough review and testing

---

**Last Updated**: October 22, 2025
**Document Version**: 1.0
**Status**: ✅ Active - Do Not Auto-Merge Upstream
