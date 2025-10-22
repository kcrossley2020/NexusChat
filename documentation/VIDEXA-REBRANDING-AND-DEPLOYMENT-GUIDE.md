# NexusChat Rebranding for Videxa.ai - Implementation Guide

**Date**: October 20, 2025
**Purpose**: Step-by-step guide to rebrand NexusChat as "Videxa AI Assistant" and deploy via Docker
**Related Document**: [NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md](./NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md)

---

## Overview

This guide outlines the complete process to:
1. Rebrand LibreChat/NexusChat with Videxa.ai branding
2. Configure for healthcare use cases
3. Deploy via Docker for testing
4. Integrate with existing Videxa infrastructure

**Estimated Time**: 4-6 hours for initial rebrand + Docker deployment

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Branding Changes Required](#branding-changes-required)
3. [Configuration Changes](#configuration-changes)
4. [Docker Deployment](#docker-deployment)
5. [Testing and Validation](#testing-and-validation)
6. [Integration with AgentNexus](#integration-with-agentnexus)

---

## Prerequisites

### Required Software
- **Docker Desktop** (Windows 11)
- **Node.js** v18+ (for development/testing)
- **Git** (for version control)
- **Code Editor** (VS Code recommended)

### Required Access/Keys
- OpenAI API Key (or Azure OpenAI)
- Anthropic API Key (for Claude)
- Google AI API Key (for Gemini) - optional
- MongoDB connection string (or use Docker MongoDB)
- Redis connection string (or use Docker Redis)

### Optional (for advanced features)
- Azure AI Search endpoint and key
- Snowflake connection credentials
- Azure Key Vault access

---

## Branding Changes Required

### Phase 1: Visual Branding (30-45 minutes)

#### 1.1 Logo and Icon Replacement

**Files to Replace**:
```
C:\videxa-repos\NexusChat\client\public\assets\
├── logo.svg                              [Main logo - SVG format]
├── favicon-16x16.png                     [Browser tab icon - 16x16]
├── favicon-32x32.png                     [Browser tab icon - 32x32]
├── icon-192x192.png                      [PWA icon - 192x192]
├── maskable-icon.png                     [PWA maskable icon - 512x512]
└── apple-touch-icon-180x180.png          [iOS home screen icon - 180x180]
```

**Action Items**:
1. **Obtain Videxa logos** from design team or AgentNexus project:
   ```bash
   # Check if Videxa logos exist in AgentNexus
   ls C:\videxa-repos\agentnexus\public\assets\
   ls C:\videxa-repos\agentnexus\src\assets\
   ```

2. **Generate required sizes** (if only one logo provided):
   - Use online tool: https://realfavicongenerator.net/
   - Or use ImageMagick:
     ```bash
     # Install ImageMagick (if not already installed)
     # Convert logo to required sizes
     magick videxa-logo.svg -resize 16x16 favicon-16x16.png
     magick videxa-logo.svg -resize 32x32 favicon-32x32.png
     magick videxa-logo.svg -resize 192x192 icon-192x192.png
     magick videxa-logo.svg -resize 512x512 maskable-icon.png
     magick videxa-logo.svg -resize 180x180 apple-touch-icon-180x180.png
     ```

3. **Copy logos to NexusChat**:
   ```bash
   # Backup original LibreChat logos
   cd /c/videxa-repos/NexusChat/client/public/assets
   mkdir _original_logos
   mv logo.svg favicon-*.png icon-*.png maskable-icon.png apple-touch-icon-*.png _original_logos/

   # Copy Videxa logos (adjust paths as needed)
   cp /path/to/videxa-logo.svg ./logo.svg
   cp /path/to/videxa-favicon-16x16.png ./favicon-16x16.png
   # ... repeat for all icon sizes
   ```

**Videxa Color Scheme** (based on AgentNexus):
- Primary Blue: `#2563eb` (Tailwind blue-600)
- Dark Background: `#0f172a` (Tailwind slate-900)
- Light Background: `#f8fafc` (Tailwind slate-50)
- Accent: `#3b82f6` (Tailwind blue-500)

---

#### 1.2 Update HTML Meta Tags and Title

**File**: `C:\videxa-repos\NexusChat\client\index.html`

**Current Content** (Lines 10-11):
```html
<meta name="description" content="LibreChat - An open source chat application with support for multiple AI models" />
<title>LibreChat</title>
```

**Updated Content**:
```html
<meta name="description" content="Videxa AI Assistant - Healthcare Claims Analysis and CDI Insights powered by AI" />
<title>Videxa AI Assistant</title>
```

**Full Changes Required**:
```html
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <base href="/" />
    <meta name="theme-color" content="#2563eb" />  <!-- Changed to Videxa blue -->
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="description" content="Videxa AI Assistant - Healthcare Claims Analysis and CDI Insights powered by AI" />
    <title>Videxa AI Assistant</title>
    <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="assets/favicon-16x16.png" />
    <link rel="apple-touch-icon" href="assets/apple-touch-icon-180x180.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content" />
    <!-- Rest of the file remains the same -->
  </head>
  <!-- ... -->
</html>
```

---

#### 1.3 Update Application Name in Configuration

**File**: `C:\videxa-repos\NexusChat\librechat.yaml` (create from `librechat.example.yaml`)

```bash
# Copy example config
cd /c/videxa-repos/NexusChat
cp librechat.example.yaml librechat.yaml
```

**Edit** `librechat.yaml`:

```yaml
# Configuration version (required)
version: 1.2.1

# Cache settings
cache: true

# Custom interface configuration
interface:
  customWelcome: 'Welcome to Videxa AI Assistant! Get instant insights into your healthcare claims and CDI opportunities.'

  # Privacy policy settings
  privacyPolicy:
    externalUrl: 'https://videxa.ai/privacy-policy'
    openNewTab: true

  # Terms of service
  termsOfService:
    externalUrl: 'https://videxa.ai/terms'
    openNewTab: true
    modalAcceptance: true
    modalTitle: 'Terms of Service for Videxa AI Assistant'
    modalContent: |
      # Terms and Conditions for Videxa AI Assistant

      *Effective Date: October 20, 2025*

      Welcome to Videxa AI Assistant, the AI-powered healthcare claims analysis platform.

      ## 1. Acceptance of Terms
      By using Videxa AI Assistant, you agree to these Terms of Service and our Privacy Policy.

      ## 2. HIPAA Compliance
      Videxa AI Assistant is designed to be HIPAA-compliant when deployed in accordance with our
      deployment guidelines. Your organization is responsible for ensuring compliance with all
      applicable healthcare regulations.

      ## 3. Use of AI Models
      Videxa AI Assistant uses third-party AI models (OpenAI, Anthropic, Google). When using
      cloud-based models, data may be transmitted to these providers. For maximum data privacy,
      use our self-hosted model options.

      ## 4. Medical Advice Disclaimer
      Videxa AI Assistant provides informational analysis only and does not constitute medical,
      legal, or financial advice. All clinical and coding decisions should be reviewed by
      qualified healthcare professionals.

      ## 5. Contact Information
      For questions about these Terms, please contact us at support@videxa.ai.

  endpointsMenu: true
  modelSelect: true
  parameters: true
  sidePanel: true
  presets: true
  prompts: true
  bookmarks: true
  multiConvo: true
  agents: true
  peoplePicker:
    users: true
    groups: true
    roles: true
  marketplace:
      use: true  # Enable agent marketplace
  fileCitations: true
```

---

#### 1.4 Update Package.json Metadata

**File**: `C:\videxa-repos\NexusChat\package.json`

**Changes**:
```json
{
  "name": "VidexaAIAssistant",
  "version": "v1.0.0-videxa",
  "description": "Healthcare AI Assistant for Claims Analysis and CDI",
  "homepage": "https://videxa.ai/",
  "author": "Videxa",
  "license": "ISC",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/videxa/NexusChat.git"
  },
  "bugs": {
    "url": "https://github.com/videxa/NexusChat/issues"
  },
  // ... rest of package.json remains the same
}
```

---

### Phase 2: Functional Configuration (45-60 minutes)

#### 2.1 Environment Variables Setup

**File**: `C:\videxa-repos\NexusChat\.env`

```bash
# Copy example file
cd /c/videxa-repos/NexusChat
cp .env.example .env
```

**Edit** `.env` with Videxa-specific settings:

```bash
#=====================================================================#
#                    Videxa AI Assistant Configuration                #
#=====================================================================#

#==================================================#
#               Server Configuration               #
#==================================================#

HOST=localhost
PORT=3080

# MongoDB - Using Docker container
MONGO_URI=mongodb://mongodb:27017/VidexaChat

# Domain configuration
DOMAIN_CLIENT=http://localhost:3080
DOMAIN_SERVER=http://localhost:3080

NO_INDEX=true
TRUST_PROXY=1

#===============#
# Debug Logging #
#===============#

DEBUG_LOGGING=true
DEBUG_CONSOLE=true
CONSOLE_JSON=false

#===============#
# Configuration #
#===============#

CONFIG_PATH="/app/librechat.yaml"

#===================================================#
#                  AI Model Endpoints               #
#===================================================#

# Enable endpoints - Add or remove as needed
ENDPOINTS=openAI,anthropic,google,assistants

#===================#
# OpenAI / Azure OpenAI #
#===================#

# Option 1: Standard OpenAI
OPENAI_API_KEY=sk-your-openai-api-key-here

# Option 2: Azure OpenAI (recommended for HIPAA compliance)
# AZURE_OPENAI_API_KEY=your-azure-openai-key
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
# AZURE_OPENAI_DEFAULT_MODEL=gpt-4o
# AZURE_OPENAI_MODELS=gpt-4o,gpt-4o-mini,o1-preview

#===================#
# Anthropic (Claude) #
#===================#

ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
# ANTHROPIC_MODELS=claude-sonnet-4-20250514,claude-opus-4-20250514

#===================#
# Google (Gemini) #
#===================#

GOOGLE_KEY=your-google-ai-key-here
# GOOGLE_MODELS=gemini-2.5-pro-002,gemini-2.5-flash-002

#===================================================#
#              Healthcare-Specific Tools            #
#===================================================#

#===================#
# Azure AI Search (for knowledge base search)
#===================#

# AZURE_AI_SEARCH_SERVICE_ENDPOINT=https://your-search-service.search.windows.net
# AZURE_AI_SEARCH_INDEX_NAME=videxa-healthcare-kb
# AZURE_AI_SEARCH_API_KEY=your-search-api-key

#===================#
# Web Search Tools
#===================#

# Google Search (requires Google Custom Search API)
# GOOGLE_SEARCH_API_KEY=your-google-search-key
# GOOGLE_CSE_ID=your-custom-search-engine-id

# Tavily Search (AI-optimized search)
# TAVILY_API_KEY=your-tavily-key

#===================#
# Database Connections
#===================#

# Snowflake (for CDI data queries)
# SNOWFLAKE_ACCOUNT=your-account.snowflakecomputing.com
# SNOWFLAKE_USER=VIDEXA_AI_SVC
# SNOWFLAKE_PRIVATE_KEY_PATH=/app/keys/snowflake_private_key.pem
# SNOWFLAKE_DATABASE=AGENTNEXUS_DB
# SNOWFLAKE_SCHEMA=CDI_RESULTS
# SNOWFLAKE_WAREHOUSE=ANALYTICS_WH
# SNOWFLAKE_ROLE=AI_ASSISTANT_ROLE

#===================================================#
#              Security & Authentication            #
#===================================================#

# Session secret (generate with: openssl rand -base64 32)
SESSION_EXPIRY=1000 * 60 * 15  # 15 minutes
REFRESH_TOKEN_EXPIRY=(1000 * 60 * 60 * 24) * 7  # 7 days

# JWT secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-generated-jwt-secret-here
JWT_REFRESH_SECRET=your-generated-jwt-refresh-secret-here

#===================#
# Email Service (for user invites, password resets)
#===================#

# Email server (SMTP)
# EMAIL_SERVICE=smtp
# EMAIL_HOST=smtp.office365.com
# EMAIL_PORT=587
# EMAIL_USERNAME=noreply@videxa.ai
# EMAIL_PASSWORD=your-email-password
# EMAIL_FROM=Videxa AI Assistant <noreply@videxa.ai>
# EMAIL_FROM_NAME=Videxa AI Assistant

#===================#
# Social Login (Optional)
#===================#

# Azure Entra ID (Microsoft SSO) - for @videxa.co internal users
# OPENID_ISSUER=https://login.microsoftonline.com/your-tenant-id/v2.0
# OPENID_CLIENT_ID=your-entra-app-client-id
# OPENID_CLIENT_SECRET=your-entra-app-client-secret
# OPENID_SCOPE=openid profile email
# OPENID_CALLBACK_URL=/oauth/openid/callback
# DOMAIN_CLIENT=https://chat.videxa.ai
# DOMAIN_SERVER=https://chat.videxa.ai

#===================================================#
#              File Storage Configuration           #
#===================================================#

# Option 1: Local file storage (for testing)
FILE_STRATEGY=local

# Option 2: Azure Blob Storage (for production)
# FILE_STRATEGY=azure
# AZURE_STORAGE_ACCOUNT_NAME=videxaaichat
# AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
# AZURE_STORAGE_CONTAINER_NAME=chat-uploads

#===================================================#
#              Rate Limiting & Moderation           #
#===================================================#

# Rate limits
LIMIT_CONCURRENT_MESSAGES=true
CONCURRENT_MESSAGE_MAX=1

# File upload limits
FILE_UPLOAD_IP_MAX=100
FILE_UPLOAD_IP_WINDOW_MINUTES=60
FILE_UPLOAD_USER_MAX=50
FILE_UPLOAD_USER_WINDOW_MINUTES=60

# Message rate limits (per user)
MESSAGE_IP_MAX=100
MESSAGE_IP_WINDOW_MINUTES=60
MESSAGE_USER_MAX=50
MESSAGE_USER_WINDOW_MINUTES=60

#===================================================#
#              Optional Features                    #
#===================================================#

# Enable user registration
ALLOW_REGISTRATION=true

# Allow social login
ALLOW_SOCIAL_LOGIN=true
ALLOW_SOCIAL_REGISTRATION=true

# Enable email login
ALLOW_EMAIL_LOGIN=true

# Search (for conversation history)
SEARCH=true
MEILI_HOST=http://meilisearch:7700
MEILI_MASTER_KEY=your-meili-master-key

# Disable moderation (for internal use only)
# OPENAI_MODERATION=false
```

---

#### 2.2 Create Custom Healthcare Prompts

**File**: `C:\videxa-repos\NexusChat\api\app\clients\prompts\videxa-healthcare-system-prompt.js`

Create a new file for healthcare-specific system prompts:

```javascript
/**
 * Videxa AI Assistant - Healthcare System Prompts
 *
 * These prompts configure AI behavior for healthcare claims analysis
 */

const healthcareSystemPrompt = `You are the Videxa AI Assistant, a specialized healthcare AI focused on:

1. **Claims Analysis**: Analyzing healthcare claims data for denial patterns, coding accuracy, and reimbursement optimization
2. **CDI (Clinical Documentation Improvement)**: Identifying documentation gaps that impact DRG assignment and reimbursement
3. **Denial Prevention**: Predicting denial risk and suggesting preventive actions
4. **Coding Assistance**: Helping with ICD-10, CPT, and HCPCS code selection and validation
5. **Payer Policy Guidance**: Interpreting payer-specific coverage policies and medical necessity criteria

## Key Principles:

- **Accuracy First**: Always cite sources (policy documents, coding guidelines, claim data)
- **HIPAA Awareness**: Never request or display PHI in an insecure manner
- **Evidence-Based**: Support recommendations with data, coding guidelines, or payer policies
- **Educational**: Explain medical coding and billing concepts clearly
- **Actionable**: Provide specific, actionable recommendations

## Limitations:

- You do NOT provide medical advice or clinical decision-making
- You do NOT make final coding decisions (human coder approval required)
- You do NOT guarantee claim payment (payers make final determinations)
- You analyze data and provide insights; humans make final decisions

## Data Sources:

When answering questions, you may have access to:
- Snowflake database with claims and CDI results
- Azure AI Search with payer policies and coding guidelines
- Web search for current CMS regulations and updates

Always indicate which data source you used for your answer.`;

const cdiAnalysisPrompt = `You are analyzing CDI (Clinical Documentation Improvement) results from a healthcare provider.

Your goal is to help identify:
1. Documentation gaps that may lead to inaccurate DRG assignment
2. Opportunities to improve specificity in diagnosis coding
3. Potential for DRG optimization through better documentation
4. Query opportunities for physician clarification

Present findings in a clear, prioritized format with:
- Financial impact (estimated reimbursement difference)
- Clinical justification for recommended changes
- Specific documentation elements needed
- Query questions for physician review`;

const denialAnalysisPrompt = `You are analyzing claim denial patterns for a healthcare provider.

Your goal is to:
1. Categorize denials by root cause (coding errors, medical necessity, authorization, eligibility, etc.)
2. Identify trends and patterns across denials
3. Suggest corrective actions to prevent future denials
4. Provide appeal strategies for denied claims

Focus on actionable insights that revenue cycle teams can implement.`;

const codingAssistancePrompt = `You are assisting with medical coding (ICD-10, CPT, HCPCS).

Your role is to:
1. Explain code meanings and when they should be used
2. Identify required modifiers and code pairings
3. Check for coding edits (NCCI, MUE)
4. Suggest more specific codes when appropriate
5. Reference official coding guidelines (ICD-10-CM, CPT, CMS)

Always remind users that final coding decisions require human coder review.`;

module.exports = {
  healthcareSystemPrompt,
  cdiAnalysisPrompt,
  denialAnalysisPrompt,
  codingAssistancePrompt,
};
```

---

### Phase 3: Docker Deployment Configuration (30 minutes)

#### 3.1 Review and Customize Docker Compose

**File**: `C:\videxa-repos\NexusChat\docker-compose.yml`

**Review Current Configuration**:
```yaml
services:
  api:
    container_name: LibreChat
    ports:
      - 3080:3080
    depends_on:
      - mongodb
      - rag_api
    image: ghcr.io/danny-avila/librechat-dev:latest
    restart: always
    extra_hosts:
      - "host.docker.internal:host-gateway"
    env_file:
      - .env
    environment:
      - HOST=0.0.0.0
      - MONGO_URI=mongodb://mongodb:27017/LibreChat
      - MEILI_HOST=http://meilisearch:7700
      - RAG_PORT=${RAG_PORT:-8000}
      - RAG_API_URL=http://rag_api:${RAG_PORT:-8000}
    volumes:
      - type: bind
        source: ./librechat.yaml
        target: /app/librechat.yaml
      - ./images:/app/client/public/images
      - ./logs:/app/api/logs

  mongodb:
    container_name: chat-mongodb
    ports:
      - 27018:27017
    image: mongo
    restart: always
    volumes:
      - ./data-node:/data/db
    command: mongod --noauth

  meilisearch:
    container_name: chat-meilisearch
    image: getmeili/meilisearch:v1.11.3
    restart: always
    ports:
      - 7700:7700
    env_file:
      - .env
    environment:
      - MEILI_HOST=http://meilisearch:7700
      - MEILI_NO_ANALYTICS=true
    volumes:
      - ./meili_data:/meili_data

  rag_api:
    container_name: chat-rag_api
    ports:
      - "8000:8000"
    image: ghcr.io/danny-avila/librechat-rag-api-dev-lite:latest
    restart: always
    env_file:
      - .env
    environment:
      - RAG_PORT=${RAG_PORT:-8000}
      - COLLECTION_NAME=${COLLECTION_NAME:-testcollection}
      - EMBEDDINGS_PROVIDER=${EMBEDDINGS_PROVIDER:-openai}
      - EMBEDDINGS_MODEL=${EMBEDDINGS_MODEL:-text-embedding-3-small}
    volumes:
      - type: bind
        source: ./rag_api.yaml
        target: /app/rag_api.yaml
```

**No changes needed** - this configuration is production-ready. Just ensure your `.env` file is properly configured.

---

#### 3.2 Create Videxa-Specific Docker Compose Override (Optional)

**File**: `C:\videxa-repos\NexusChat\docker-compose.videxa.yml`

Create an override file for Videxa-specific customizations:

```yaml
# Videxa AI Assistant - Docker Compose Override
# Usage: docker-compose -f docker-compose.yml -f docker-compose.videxa.yml up -d

services:
  api:
    container_name: VidexaAIAssistant
    environment:
      - APP_TITLE=Videxa AI Assistant
      - HELP_AND_FAQ_URL=https://videxa.ai/support
    volumes:
      # Mount Videxa-specific config
      - ./librechat.yaml:/app/librechat.yaml
      # Mount custom healthcare prompts
      - ./api/app/clients/prompts/videxa-healthcare-system-prompt.js:/app/api/app/clients/prompts/videxa-healthcare-system-prompt.js
      # Mount Videxa logos
      - ./client/public/assets:/app/client/public/assets

  mongodb:
    container_name: videxa-mongodb
    volumes:
      - ./data-videxa:/data/db

  meilisearch:
    container_name: videxa-meilisearch
    volumes:
      - ./meili_data_videxa:/meili_data

  rag_api:
    container_name: videxa-rag-api
    # No changes needed
```

---

## Docker Deployment Steps

### Step 1: Pre-Deployment Checklist

```bash
# 1. Navigate to NexusChat directory
cd /c/videxa-repos/NexusChat

# 2. Verify all required files exist
ls -la .env
ls -la librechat.yaml
ls -la docker-compose.yml

# 3. Verify Docker is running
docker --version
docker-compose --version

# 4. Check available disk space (need at least 5GB free)
df -h
```

---

### Step 2: Initial Deployment

```bash
# 1. Pull latest images
docker-compose pull

# 2. Build and start containers
docker-compose up -d

# Expected output:
# Creating network "nexuschat_default" with the default driver
# Creating chat-mongodb ... done
# Creating chat-meilisearch ... done
# Creating chat-rag_api ... done
# Creating LibreChat ... done

# 3. Verify containers are running
docker-compose ps

# Expected output:
# NAME                  IMAGE                                                    STATUS
# LibreChat             ghcr.io/danny-avila/librechat-dev:latest                 Up 30 seconds
# chat-mongodb          mongo                                                    Up 31 seconds
# chat-meilisearch      getmeili/meilisearch:v1.11.3                            Up 31 seconds
# chat-rag_api          ghcr.io/danny-avila/librechat-rag-api-dev-lite:latest  Up 30 seconds
```

---

### Step 3: Monitor Logs

```bash
# Watch logs in real-time
docker-compose logs -f

# Or watch specific service
docker-compose logs -f api

# Look for successful startup message:
# "Server listening on all interfaces at port 3080."
# "Connected to MongoDB"
```

---

### Step 4: Create First Admin User

```bash
# Access the running container
docker exec -it LibreChat npm run create-user

# Follow prompts:
# Enter email: admin@videxa.ai
# Enter name: Videxa Admin
# Enter username: videxa_admin
# Enter password: [create strong password]

# Confirm admin privileges: Yes
```

---

### Step 5: Access Application

1. Open browser: http://localhost:3080
2. Login with admin credentials
3. Verify branding appears correctly:
   - Videxa logo in top-left
   - "Videxa AI Assistant" in browser tab
   - Custom welcome message
   - Videxa colors

---

## Testing and Validation

### Test 1: Basic Chat Functionality

1. Start a new conversation
2. Select AI model (OpenAI, Claude, or Gemini)
3. Send a test message:
   ```
   Hello! Can you explain what a DRG is in healthcare billing?
   ```
4. Verify AI responds correctly
5. Test follow-up questions

---

### Test 2: Model Switching

1. Start conversation with GPT-4o
2. Mid-conversation, switch to Claude Sonnet 4
3. Continue conversation
4. Verify model switch works seamlessly

---

### Test 3: File Upload (if enabled)

1. Click file upload icon
2. Upload a sample denial letter (PDF)
3. Ask: "Analyze this denial letter and suggest appeal strategy"
4. Verify AI can read and analyze the document

---

### Test 4: Conversation Management

1. Create multiple conversations
2. Test renaming conversations
3. Test archiving/deleting conversations
4. Test search functionality (if MeiliSearch is running)

---

## Troubleshooting

### Issue 1: Containers Won't Start

```bash
# Check for port conflicts
netstat -ano | findstr :3080
netstat -ano | findstr :27017

# If ports are in use, stop conflicting services or change ports in docker-compose.yml
```

### Issue 2: "Cannot Connect to MongoDB"

```bash
# Check MongoDB container status
docker logs chat-mongodb

# Restart MongoDB
docker-compose restart mongodb

# Wait 10 seconds, then restart API
docker-compose restart api
```

### Issue 3: "Invalid API Key" Errors

```bash
# Verify API keys in .env
cat .env | grep API_KEY

# Restart containers after changing .env
docker-compose down
docker-compose up -d
```

### Issue 4: Branding Not Appearing

```bash
# Rebuild containers with no cache
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Clear browser cache and hard reload (Ctrl+Shift+R)
```

---

## Production Deployment Considerations

When moving beyond local testing to production:

### 1. **HTTPS/SSL Configuration**
- Use reverse proxy (nginx or Azure Application Gateway)
- Configure SSL certificates (Let's Encrypt or Azure-managed certs)
- Update `DOMAIN_CLIENT` and `DOMAIN_SERVER` in `.env`

### 2. **Database Security**
- Enable MongoDB authentication:
  ```yaml
  mongodb:
    command: mongod --auth
    environment:
      - MONGO_INITDB_ROOT_USERNAME=videxa_admin
      - MONGO_INITDB_ROOT_PASSWORD=strong-password-here
  ```
- Use Azure CosmosDB (MongoDB API) for managed database

### 3. **File Storage**
- Switch from local storage to Azure Blob Storage:
  ```bash
  FILE_STRATEGY=azure
  AZURE_STORAGE_ACCOUNT_NAME=videxaaichat
  AZURE_STORAGE_ACCOUNT_KEY=your-key
  ```

### 4. **Monitoring and Logging**
- Configure Azure Application Insights
- Set up log aggregation (Azure Monitor or ELK stack)
- Enable health check endpoints

### 5. **Backup and Recovery**
- Automated MongoDB backups to Azure Blob Storage
- Conversation export/import functionality
- Disaster recovery plan

---

## Integration with AgentNexus

### Option 1: Iframe Embedding

Embed NexusChat in AgentNexus Step 3 results page:

```jsx
// In AgentNexus: src/pages/cdi-steps/Step3Results.jsx

<iframe
  src="https://chat.videxa.ai"
  width="100%"
  height="600px"
  title="Videxa AI Assistant"
  style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
/>
```

### Option 2: React Component Integration

Use NexusChat's client package as a React component:

```jsx
import { ChatInterface } from '@librechat/client';

function CDIResultsWithChat() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        {/* CDI Results Table */}
      </div>
      <div>
        <ChatInterface
          apiEndpoint="https://chat.videxa.ai/api"
          authToken={userAuthToken}
          initialMessage="I'm analyzing your CDI results. What would you like to know?"
        />
      </div>
    </div>
  );
}
```

### Option 3: SSO Integration

Enable Azure Entra ID SSO so AgentNexus users automatically log into NexusChat:

**In `.env`**:
```bash
OPENID_ISSUER=https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0
OPENID_CLIENT_ID=YOUR_APP_CLIENT_ID
OPENID_CLIENT_SECRET=YOUR_APP_CLIENT_SECRET
OPENID_SCOPE=openid profile email
DOMAIN_CLIENT=https://www.videxa.ai
DOMAIN_SERVER=https://chat.videxa.ai
```

---

## Quick Reference Commands

```bash
# Start all containers
docker-compose up -d

# Stop all containers
docker-compose down

# View logs
docker-compose logs -f

# Restart specific service
docker-compose restart api

# Rebuild after code changes
docker-compose up -d --build

# Create admin user
docker exec -it LibreChat npm run create-user

# Access MongoDB shell
docker exec -it chat-mongodb mongosh

# Check container resource usage
docker stats

# Remove all containers and volumes (DESTRUCTIVE)
docker-compose down -v
```

---

## Next Steps

After successful deployment and testing:

1. **Review** [NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md](./NEXUSCHAT-VIDEXA-POTENTIAL-ANALYSIS.md) for feature roadmap
2. **Configure** Azure AI Search for knowledge base integration
3. **Connect** to Snowflake for CDI data queries
4. **Create** custom healthcare agents
5. **Train** team on using the AI assistant
6. **Gather** feedback from pilot users
7. **Plan** production deployment to Azure

---

**Document Location**: `C:\videxa-repos\NexusChat\documentation\VIDEXA-REBRANDING-AND-DEPLOYMENT-GUIDE.md`

**Last Updated**: October 20, 2025
**Next Review**: After initial deployment testing
