# Videxa References in NexusChat

**Last Updated:** 2025-12-15
**Purpose:** Catalog all references to "Videxa" branding throughout the codebase

---

## Summary

This document catalogs all files and locations that contain references to "Videxa" branding. This is important for:
- Brand consistency audits
- Localization/white-labeling
- Compliance documentation
- Future rebranding efforts

---

## Files Containing "Videxa" References

### Root Directory Files

| File | Type | Purpose |
|------|------|---------|
| `VIDEXA_CUSTOMIZATIONS.md` | Documentation | Complete customization tracker |
| `VIDEXA-SETUP-COMPLETE.md` | Documentation | Setup completion checklist |
| `DOCKER-SETUP.md` | Documentation | Docker deployment with Videxa branding |
| `LOGIN-RESOLUTION-SUMMARY.md` | Documentation | Login troubleshooting |
| `MEILISEARCH-FIX-COMPLETE.md` | Documentation | MeiliSearch configuration |
| `README.md` | Documentation | Project overview |
| `docker-compose.videxa-secure.yml` | Config | Secure Docker deployment |

### Documentation Directory

| File | Description |
|------|-------------|
| `2025-12-14_E2E-Test-Fixes-Session.md` | E2E test fix session notes |
| `authentication-bypass-testing.md` | Auth testing documentation |
| `AZURE-DOCUMENTATION-DEPLOYMENT.md` | Azure deployment guide |
| `CLEANUP-REPORT-2025-11-07.md` | Codebase cleanup report |
| `CODEBASE-CLEANUP-ANALYSIS.md` | Cleanup analysis |
| `DEPLOYMENT-COMPLETE.md` | Deployment summary |
| `e2e-testing-setup.md` | E2E test infrastructure |
| `EPICS-FEATURES-WORKITEMS.md` | Project tracking |
| `MEILISEARCH-REMOVAL-PLAN.md` | MeiliSearch removal |
| `NEX-QUICK-START.md` | Quick start guide |
| `PRODUCTION-KEYVAULT-CONFIG.md` | Key Vault configuration |
| `rag-test-results.md` | RAG testing results |
| `README.md` | Documentation index |
| `SECURITY-AUDIT.md` | Security assessment |
| `SESSION-STATE-2025-11-04.md` | Session state tracking |
| `snowflake-migration-progress.md` | Migration tracking |
| `snowflake-migration-test-cases.md` | Migration test cases |
| `SNOWFLAKE-ONLY-ARCHITECTURE.md` | Architecture documentation |
| `SYSTEM-ADMIN-PASSWORD-MANAGEMENT.md` | Admin password management |
| `test-cases.md` | Test specifications |
| `test-cleanup-tasks.md` | Test cleanup workflow |

### Archive Directory

| File | Description |
|------|-------------|
| `archive/2025-11-07-cleanup/README.md` | Archive index |
| `archive/2025-11-07-cleanup/documentation/DEPLOYMENT-VALIDATION-RESULTS.md` | Archived validation |
| `archive/2025-11-07-cleanup/documentation/MONGODB-ELIMINATED-SUMMARY.md` | Archived MongoDB elimination |
| `archive/2025-11-07-cleanup/documentation/NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md` | Archived analysis |
| `archive/2025-11-07-cleanup/documentation/VIDEXA-REBRANDING-AND-DEPLOYMENT-GUIDE.md` | Archived rebranding guide |
| `archive/2025-11-07-cleanup/temp-files/temp-logos/LOGO_ASSETS_SUMMARY.md` | Logo assets summary |

### Test Files

| File | Description |
|------|-------------|
| `tests/videxa-baseline/README.md` | Baseline test documentation |
| `tests/videxa-baseline/TEST-RESULTS-2025-10-22.md` | Test results |
| `tests/videxa-baseline/playwright-report/...` | Test reports |
| `test-results/.../error-context.md` | Test error contexts (multiple) |

### Configuration Files

| File | Description |
|------|-------------|
| `.claude/settings.local.json` | Claude Code settings |
| `videxa-patches/README.md` | Patch application guide |

### Additional Directories

| Directory | Description |
|-----------|-------------|
| `NexusChat-Docs/Windows-11-Docker-Deployment-Guide.md` | Windows deployment guide |

---

## Types of Videxa References

### 1. Brand Names
- "Videxa" - Company name
- "Nex by Videxa" - Product name
- "Videxa AgentNexus" - Backend product name

### 2. URLs and Domains
- `videxa.ai` - Main domain
- `chat.videxa.ai` - Chat application subdomain
- `support@videxa.ai` - Support email
- `https://videxa.ai/privacy-policy` - Privacy policy
- `https://videxa.ai/terms` - Terms of service
- `https://videxa.ai/faq` - FAQ page

### 3. Repository References
- `https://github.com/kcrossley2020/NexusChat` - GitHub fork
- `C:\videxa-repos\` - Local development path

### 4. Email Addresses
- `kcrossley@videxa.co` - Maintainer email
- `@videxa.co` - Company email domain

### 5. Color Branding
- `#0F3759` - Videxa Navy (Primary)
- `#F2B705` - Videxa Gold (Accent)
- `#092136` - Dark theme background
- `#F2F2F2` - Light theme background

### 6. Asset Names
- `nexuschat:videxa-latest` - Docker image name
- `videxa-v1.0.0` - Git tag
- `videxa-patches/` - Patch directory

---

## File Counts by Category

| Category | Count |
|----------|-------|
| Documentation (documentation/) | 21 |
| Archive (archive/) | 5 |
| Test Files (tests/, test-results/) | 10+ |
| Root Directory | 7 |
| Configuration | 2 |
| **Total Files** | **45+** |

---

## Key Branding Files

### Primary Branding Configuration

**`VIDEXA_CUSTOMIZATIONS.md`** (Root)
- Master reference for all customizations
- Color definitions
- Logo asset tracking
- Fork maintenance policy

**`librechat.yaml`** (Configuration)
- Welcome message branding
- Privacy policy URL
- Terms of service URL
- Support email

**`client/index.html`** (Frontend)
- Page title: "Nex by Videxa"
- Meta description
- Theme colors

**`client/public/assets/`** (Assets)
- logo.svg
- favicon-16x16.png
- favicon-32x32.png
- apple-touch-icon-180x180.png
- icon-192x192.png
- maskable-icon.png

---

## Branding Removal Checklist

If rebranding is required, the following files must be updated:

### High Priority (User-Facing)
- [ ] `client/index.html` - Title and meta tags
- [ ] `librechat.yaml` - Welcome message and URLs
- [ ] `client/public/assets/*` - All logo files
- [ ] `.env` - Application title variable

### Medium Priority (Documentation)
- [ ] `VIDEXA_CUSTOMIZATIONS.md` - Rename or archive
- [ ] `VIDEXA-SETUP-COMPLETE.md` - Rename or archive
- [ ] `documentation/*.md` - Update references
- [ ] `README.md` - Update branding

### Low Priority (Internal/Dev)
- [ ] `docker-compose.videxa-secure.yml` - Rename
- [ ] `videxa-patches/` - Rename directory
- [ ] `tests/videxa-baseline/` - Rename directory
- [ ] Git tags (`videxa-v*`) - Create new tag scheme

---

## Notes

1. **Archive Directory**: Contains historical Videxa documentation that has been superseded. These can be deleted if archive cleanup is needed.

2. **Test Results**: The `test-results/` directory contains auto-generated error context files that mention Videxa. These are generated during test runs and don't need manual updates.

3. **Configuration Files**: The `.claude/settings.local.json` file contains the path `C:\videxa-repos` which is a local development path reference.

4. **Fork Maintenance**: Per `VIDEXA_CUSTOMIZATIONS.md`, this is a ONE-WAY fork from LibreChat. All Videxa customizations are intentionally maintained separately and never pushed upstream.

---

**Document Version:** 1.0
**Prepared By:** Claude (AI Assistant)
**Review Cycle:** As needed for rebranding or audit purposes
