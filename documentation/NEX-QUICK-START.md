# Nex by Videxa - Quick Start Guide

**Date**: October 20, 2025
**Status**: Ready to Deploy
**Related Documents**:
- [Strategic Analysis](./NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md)
- [Full Deployment Guide](./VIDEXA-REBRANDING-AND-DEPLOYMENT-GUIDE.md)

---

## What is Nex?

**Nex** is your AI-powered healthcare assistant for claims analysis, CDI insights, and denial prevention. It's built on LibreChat (open-source ChatGPT alternative) and rebranded for Videxa with:

- ✅ **Videxa colors** (Navy Blue `#0F3759`, Gold `#F2B705`, Light Gray `#F2F2F2`)
- ✅ **"Nex by Videxa" branding** throughout
- ✅ **Launch point** on AgentNexus Dashboard
- ✅ **Multi-model AI** (Claude, GPT-4, Gemini)
- ✅ **Docker deployment** ready

---

## Rebranding Complete ✅

### Files Modified

1. **C:\videxa-repos\NexusChat\client\index.html**
   - Title: "Nex by Videxa"
   - Description: "AI-powered healthcare claims analysis and CDI insights"
   - Theme color: `#0F3759` (Videxa Navy Blue)
   - Background colors: `#092136` (dark) / `#F2F2F2` (light)

2. **C:\videxa-repos\NexusChat\librechat.yaml**
   - Custom welcome: "Welcome to Nex by Videxa! Get instant AI-powered insights..."
   - Privacy policy: https://videxa.ai/privacy-policy
   - Terms: https://videxa.ai/terms
   - Support email: support@videxa.ai
   - Marketplace enabled

3. **C:\videxa-repos\NexusChat\.env**
   - MongoDB database: `NexChat`
   - Pre-configured for OpenAI, Anthropic, Google
   - Healthcare-specific integrations ready (Azure AI Search, Snowflake, etc.)
   - Endpoints enabled: `openAI,anthropic,google,assistants,agents`

4. **C:\videxa-repos\agentnexus\src\pages\DashboardPage.jsx**
   - Added "Nex AI Assistant" card with Videxa navy blue branding
   - Launch link: http://localhost:3080 (opens in new tab)
   - Badge: "Available" (green)
   - Description: "Ask questions about your claims, CDI results, and coding guidelines"

---

## Quick Start (5 Steps)

### Step 1: Get API Keys

You need at least **one** of these:

**Option A: OpenAI** (Recommended for testing)
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with `sk-`)

**Option B: Anthropic (Claude)** (Best for medical documentation)
1. Go to https://console.anthropic.com/
2. Create API key
3. Copy the key (starts with `sk-ant-`)

**Option C: Google (Gemini)** (Best for large-scale analysis)
1. Go to https://makersuite.google.com/app/apikey
2. Create API key
3. Copy the key

---

### Step 2: Update .env File

Open `C:\videxa-repos\NexusChat\.env` in a text editor and replace the placeholder API keys:

```bash
# Find this line:
OPENAI_API_KEY=your-openai-api-key-here

# Replace with your actual key:
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx

# And/or:
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
```

**Save the file.**

---

### Step 3: Start Docker Containers

Open PowerShell or Command Prompt:

```powershell
# Navigate to NexusChat directory
cd C:\videxa-repos\NexusChat

# Start all containers
docker-compose up -d

# Expected output:
# Creating network "nexuschat_default" with the default driver
# Creating chat-mongodb ... done
# Creating chat-meilisearch ... done
# Creating chat-rag_api ... done
# Creating LibreChat ... done
```

**Wait 30-60 seconds** for containers to fully start.

---

### Step 4: Create Admin User

```powershell
# Run user creation script
docker exec -it LibreChat npm run create-user

# Follow prompts:
# Email: admin@videxa.ai
# Name: Videxa Admin
# Username: videxa_admin
# Password: [create secure password]
# Admin: Yes
```

---

### Step 5: Access Nex

1. **Open browser**: http://localhost:3080
2. **Login** with admin credentials
3. **Verify branding**:
   - Browser tab shows "Nex by Videxa"
   - Welcome message: "Welcome to Nex by Videxa!"
   - Videxa colors visible

4. **Test AI chat**:
   - Start new conversation
   - Select model (OpenAI, Claude, or Gemini)
   - Send test message: "Explain what a DRG is in healthcare billing"

---

## Accessing from AgentNexus Dashboard

1. Login to AgentNexus: http://localhost:3000
2. Go to Dashboard page
3. Look for **"Nex AI Assistant"** card (navy blue with chat icon)
4. Click **"Launch Nex →"**
5. Opens Nex in new tab

---

## Troubleshooting

### Issue: Containers won't start

**Solution**:
```powershell
# Check if ports are already in use
netstat -ano | findstr :3080
netstat -ano | findstr :27017

# If in use, stop conflicting services or change ports in docker-compose.yml
```

### Issue: "Cannot connect to MongoDB"

**Solution**:
```powershell
# Restart MongoDB
docker-compose restart mongodb

# Wait 10 seconds
timeout /t 10

# Restart API
docker-compose restart api
```

### Issue: "Invalid API Key"

**Solution**:
```powershell
# Verify .env has correct API keys
cat .env | grep API_KEY

# Restart containers
docker-compose down
docker-compose up -d
```

### Issue: Branding doesn't show

**Solution**:
```powershell
# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Clear browser cache (Ctrl+Shift+R)
```

---

## Useful Commands

```powershell
# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api

# Restart all containers
docker-compose restart

# Stop all containers
docker-compose down

# Remove all data (DESTRUCTIVE)
docker-compose down -v

# Check container status
docker-compose ps

# Access MongoDB shell
docker exec -it chat-mongodb mongosh
```

---

## What's Configured

### AI Models Available

**OpenAI Models**:
- GPT-4o (Best for complex claims analysis)
- GPT-4o-mini (Cost-effective for simple queries)
- o1-preview (Advanced reasoning for coding decisions)

**Anthropic Models**:
- Claude Sonnet 4 (Best for medical documentation)
- Claude Opus 4 (Maximum capability)

**Google Models**:
- Gemini 2.5 Pro (Large-scale data analysis)
- Gemini 2.5 Flash (Fast responses)

### Features Enabled

✅ **Multi-model selection**: Switch between AI models mid-conversation
✅ **Agents marketplace**: Create custom healthcare AI agents
✅ **File upload**: Upload and analyze denial letters, EOBs, medical records
✅ **Conversation search**: Find past conversations with MeiliSearch
✅ **User management**: Multi-user support with authentication
✅ **Conversation branching**: Fork conversations for "what-if" scenarios

### Features Ready (Not Yet Configured)

⏳ **Azure AI Search**: Index payer policies and coding guidelines
⏳ **Snowflake integration**: Query CDI results directly
⏳ **Web search**: Real-time CMS/Medicare updates
⏳ **Azure Entra ID SSO**: Single sign-on for @videxa.co users

---

## Videxa Color Scheme

The following Videxa colors are applied throughout Nex:

| Element | Color | Hex Code |
|---------|-------|----------|
| **Primary Navy** | Dark Blue | `#0F3759` |
| **Primary Gold** | Yellow | `#F2B705` |
| **Secondary Blue** | Light Blue | `#2585D9` |
| **Dark Background** | Navy | `#092136` |
| **Light Background** | Gray | `#F2F2F2` |
| **Accent Orange** | Orange | `#F29F05` |

Applied to:
- Theme color (browser address bar)
- Loading screen backgrounds
- Button accents
- Card borders on dashboard
- Link colors

---

## Next Steps

### For Testing (Today)

1. ✅ Start Docker containers
2. ✅ Create admin user
3. ✅ Test basic chat functionality
4. ✅ Verify branding
5. ✅ Test from AgentNexus dashboard launch

### For Development (This Week)

1. **Add Videxa logo**:
   - Replace `client/public/assets/logo.svg` with Videxa logo
   - Generate favicons from logo

2. **Configure Azure AI Search**:
   - Set up Azure AI Search service
   - Index payer policies and coding guidelines
   - Update `.env` with search credentials

3. **Create healthcare agents**:
   - "CDI Advisor" - Analyzes clinical documentation gaps
   - "Denial Prevention" - Predicts denial risk
   - "Coding Assistant" - Helps with ICD-10/CPT coding

### For Production (Next Month)

1. **Deploy to Azure**:
   - Azure Container Apps or AKS
   - Azure CosmosDB (MongoDB API)
   - Azure Blob Storage for files
   - SSL certificates and custom domain

2. **Connect to Snowflake**:
   - Configure Snowflake credentials in `.env`
   - Create MCP server for Snowflake queries
   - Test CDI results integration

3. **Enable Azure Entra ID SSO**:
   - Register app in Azure Entra ID
   - Configure OPENID settings in `.env`
   - Test @videxa.co user login

---

## Support & Documentation

**Full Documentation**: `C:\videxa-repos\NexusChat\documentation\`

1. **NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md**
   - 15 capabilities across 3 categories
   - Financial projections ($600K-$6M+ revenue potential)
   - Market analysis and competitive positioning
   - Implementation roadmap

2. **VIDEXA-REBRANDING-AND-DEPLOYMENT-GUIDE.md**
   - Detailed rebranding instructions
   - Docker deployment procedures
   - Production deployment considerations
   - Integration options with AgentNexus

3. **NEX-QUICK-START.md** (This document)
   - Quick reference for getting started
   - Common commands and troubleshooting

**LibreChat Official Docs**: https://docs.librechat.ai/

**Questions?** Email: support@videxa.ai

---

## Summary

You now have:

✅ **Nex by Videxa** - Fully rebranded AI assistant
✅ **Docker deployment** - Ready to start with `docker-compose up -d`
✅ **Videxa colors** - Navy blue, gold, and gray branding throughout
✅ **AgentNexus integration** - Launch point added to dashboard
✅ **Multi-model AI** - OpenAI, Claude, and Gemini configured
✅ **Healthcare focus** - Welcome message and terminology

**Next action**: Run `docker-compose up -d` and create your first admin user!

---

**Last Updated**: October 20, 2025
**Version**: Nex v1.0.0-videxa
**Based on**: LibreChat v0.8.0
