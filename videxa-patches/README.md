# Videxa Patch Files

This directory contains patch files that can be applied to reapply Videxa customizations after upstream merges.

## Patch Files

1. **001-branding.patch** - HTML title, meta tags, theme colors (client/index.html)
2. **002-logos.sh** - Script to restore logo assets
3. **003-config.sh** - Script to restore librechat.yaml configuration
4. **004-docker.sh** - Script to update docker-compose.yml

## Usage

After merging from upstream, apply patches in order:

```bash
# 1. Apply HTML branding changes
git apply videxa-patches/001-branding.patch

# 2. Restore logo assets
bash videxa-patches/002-logos.sh

# 3. Restore configuration
bash videxa-patches/003-config.sh

# 4. Update Docker configuration
bash videxa-patches/004-docker.sh

# 5. Verify changes
git status
git diff

# 6. Test
npm run test:mcp-playwright
```

## Note

Some customizations (like librechat.yaml and .env) are not tracked in upstream,
so we use shell scripts instead of git patches to restore them.
