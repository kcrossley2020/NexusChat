# NexusChat External Data Links and Exports

This document catalogs all external API endpoints, services, and data exports in the NexusChat (LibreChat v0.8.0) codebase, beyond standard AI model API requests.

**Document Purpose**: Identify all external services that receive data from this application for security, compliance, and privacy auditing.

---

## Table of Contents

1. [Analytics Services](#1-analytics-services)
2. [Email Services](#2-email-services)
3. [File Storage Services](#3-file-storage-services)
4. [Social OAuth Authentication](#4-social-oauth-authentication)
5. [Search API Endpoints](#5-search-api-endpoints)
6. [Third-Party Tool Integrations](#6-third-party-tool-integrations)
7. [Image Generation Services](#7-image-generation-services)
8. [Web Scraping and Reranking](#8-web-scraping-and-reranking)
9. [Microsoft Graph API Integration](#9-microsoft-graph-api-integration)
10. [Weather API](#10-weather-api)
11. [Search Index Service](#11-search-index-service)
12. [Code Execution Services](#12-code-execution-services)
13. [CAPTCHA Service](#13-captcha-service)
14. [LDAP/Directory Services](#14-ldapdirectory-services)
15. [Translation Services](#15-translation-services)
16. [Model Context Protocol (MCP)](#16-model-context-protocol-mcp)
17. [Reverse Proxy Endpoints](#17-reverse-proxy-endpoints)
18. [RAG and Embeddings](#18-rag-and-embeddings)
19. [Content Moderation](#19-content-moderation)
20. [Services NOT Found](#20-services-not-found)
21. [Privacy Summary](#21-privacy-summary)

---

## 1. Analytics Services

### Google Tag Manager (GTM)

**Status**: Optional

**What is sent**:
- User analytics events
- Page views
- User interactions
- Custom events defined in GTM container

**Purpose**: Web analytics and user behavior tracking for site optimization

**Configuration**:
- Environment Variable: `ANALYTICS_GTM_ID`
- Config File: `.env` (line 654)
- Implementation: `client/src/hooks/Config/useAppStartup.ts` (lines 120-127)
- Uses NPM package: `react-gtm-module`

**API Endpoints**:
- `https://www.googletagmanager.com/gtm.js`
- Tag triggers may send data to Google Analytics, ads platforms, or other configured services

**Data Export Details**:
- User session data
- Navigation patterns
- Custom event tracking
- May include user identifiers depending on GTM configuration

**Privacy Notes**:
- Disabled by default (must be explicitly configured)
- Complies with user's GTM container configuration
- May require cookie consent depending on jurisdiction

**Disable Method**: Leave `ANALYTICS_GTM_ID` unset in `.env`

---

## 2. Email Services

### 2.1 Mailgun API

**Status**: Optional (alternative to SMTP)

**What is sent**:
- Email messages (password resets, verification emails)
- Recipient email addresses
- Sender information
- Email subject and body

**Purpose**: Transactional email delivery service

**Configuration**:
- Environment Variables:
  - `MAILGUN_API_KEY` - API authentication key
  - `MAILGUN_DOMAIN` - Your Mailgun domain (e.g., mg.yourdomain.com)
  - `MAILGUN_HOST` - API endpoint (default: https://api.mailgun.net, EU: https://api.eu.mailgun.net)
  - `EMAIL_FROM_NAME` - Sender display name
  - `EMAIL_FROM` - Sender email address
- Config File: `.env` (lines 580-590)
- Implementation: `api/server/utils/sendEmail.js` (lines 21-49)

**API Endpoints**:
- US Region: `https://api.mailgun.net/v3/{domain}/messages`
- EU Region: `https://api.eu.mailgun.net/v3/{domain}/messages`

**Data Export Details**:
- User email addresses
- Email content (password reset links, verification codes)
- Mailgun tracks email delivery, opens, clicks (if configured)

**Disable Method**: Use SMTP instead or disable email features (`ALLOW_PASSWORD_RESET=false`)

---

### 2.2 Generic SMTP (Nodemailer)

**Status**: Optional

**What is sent**:
- Email messages
- Recipient addresses
- Email content

**Purpose**: Standard email delivery via SMTP protocol

**Configuration**:
- Environment Variables:
  - `EMAIL_SERVICE` - Service name (e.g., Gmail, Outlook)
  - `EMAIL_HOST` - SMTP server hostname
  - `EMAIL_PORT` - SMTP port (25, 465, 587)
  - `EMAIL_ENCRYPTION` - TLS or STARTTLS
  - `EMAIL_USERNAME` - SMTP auth username
  - `EMAIL_PASSWORD` - SMTP auth password
  - `EMAIL_FROM` - Sender address
  - `EMAIL_FROM_NAME` - Sender name
- Config File: `.env` (lines 568-577)
- Implementation: `api/server/utils/sendEmail.js` (lines 61-64, 117-160)

**API Endpoints**:
- Configured SMTP server endpoint

**Data Export Details**:
- Same as Mailgun but sent to your configured SMTP provider

**Disable Method**: Don't configure email settings; disable password reset

---

## 3. File Storage Services

All file storage services are **mutually exclusive** - configure only one.

### 3.1 Firebase Cloud Storage

**Status**: Optional

**What is sent**:
- User avatar images
- Uploaded files (images, documents, PDFs)
- File metadata (filename, size, content type)

**Purpose**: Cloud-based file storage and CDN

**Configuration**:
- Environment Variables:
  - `FIREBASE_API_KEY`
  - `FIREBASE_AUTH_DOMAIN`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_STORAGE_BUCKET`
  - `FIREBASE_MESSAGING_SENDER_ID`
  - `FIREBASE_APP_ID`
- Config File: `.env` (lines 595-600)
- Implementation: `packages/api/src/cdn/firebase.ts`
- Config Reference: `librechat.example.yaml` (lines 11-26)

**API Endpoints**:
- `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}`
- Firebase Authentication endpoints

**Data Export Details**:
- All user-uploaded content
- File access logs (Firebase side)
- File metadata

**Alternative**: Use AWS S3, Azure Blob, or local storage

---

### 3.2 AWS S3 (or S3-Compatible Services)

**Status**: Optional

**What is sent**:
- User avatar images
- Uploaded files
- File metadata

**Purpose**: Cloud object storage

**Configuration**:
- Environment Variables:
  - `AWS_ENDPOINT_URL` - S3 endpoint (optional for custom S3-compatible services)
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` - AWS region (e.g., us-east-1)
  - `AWS_BUCKET_NAME` - S3 bucket name
- Config File: `.env` (lines 606-610)
- Implementation: `packages/api/src/cdn/s3.ts`
- Config Reference: `librechat.example.yaml` (lines 11-26)

**API Endpoints**:
- AWS S3: `https://s3.{region}.amazonaws.com/{bucket}/{key}`
- Custom S3: `{AWS_ENDPOINT_URL}/{bucket}/{key}`

**Data Export Details**:
- All uploaded files
- S3 access logs (if enabled)
- CloudTrail logs (AWS side)

**Compatible Services**: AWS S3, MinIO, DigitalOcean Spaces, Backblaze B2, Wasabi, Cloudflare R2

---

### 3.3 Azure Blob Storage

**Status**: Optional

**What is sent**:
- User avatars
- Uploaded files
- File metadata

**Purpose**: Microsoft Azure cloud blob storage

**Configuration**:
- Environment Variables:
  - `AZURE_STORAGE_CONNECTION_STRING` - Azure storage account connection string
  - `AZURE_STORAGE_PUBLIC_ACCESS` - Allow public access (true/false)
  - `AZURE_CONTAINER_NAME` - Container name (default: files)
- Config File: `.env` (lines 616-618)
- Implementation: `packages/api/src/cdn/azure.ts`
- Config Reference: `librechat.example.yaml` (lines 11-26)

**API Endpoints**:
- `https://{account}.blob.core.windows.net/{container}/{blob}`

**Data Export Details**:
- All uploaded content
- Azure storage analytics (if enabled)

---

## 4. Social OAuth Authentication

All OAuth providers are **optional** and can be selectively enabled.

### 4.1 Google OAuth 2.0

**Status**: Optional

**What is sent**:
- Authorization requests
- User consent acknowledgment
- OAuth tokens (encrypted in database)

**What is received**:
- User profile (email, name, profile picture)
- OAuth access and refresh tokens

**Purpose**: Social login via Google account

**Configuration**:
- Environment Variables:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL` (default: /oauth/google/callback)
- Config File: `.env` (lines 441-443)
- Implementation: `api/strategies/googleStrategy.js`

**API Endpoints**:
- `https://accounts.google.com/o/oauth2/v2/auth` (authorization)
- `https://oauth2.googleapis.com/token` (token exchange)
- `https://www.googleapis.com/oauth2/v3/userinfo` (user profile)

**OAuth Scopes**:
- `openid` - OpenID authentication
- `profile` - Basic profile information
- `email` - Email address

**Data Stored Locally**:
- User email
- User name
- Profile picture URL
- OAuth tokens (encrypted with `CREDS_KEY`)

---

### 4.2 GitHub OAuth

**Status**: Optional

**What is sent/received**: Same pattern as Google OAuth

**Configuration**:
- Environment Variables:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_CALLBACK_URL` (default: /oauth/github/callback)
  - `GITHUB_ENTERPRISE_BASE_URL` (optional, for GitHub Enterprise)
  - `GITHUB_ENTERPRISE_USER_AGENT` (optional)
- Config File: `.env` (lines 433-438)
- Implementation: `api/strategies/githubStrategy.js`

**API Endpoints**:
- Public GitHub: `https://github.com/login/oauth/*`
- Enterprise: `{GITHUB_ENTERPRISE_BASE_URL}/login/oauth/*`

**OAuth Scopes**:
- `user:email`
- `read:user`

---

### 4.3 Discord OAuth 2.0

**Status**: Optional

**Configuration**:
- Environment Variables:
  - `DISCORD_CLIENT_ID`
  - `DISCORD_CLIENT_SECRET`
  - `DISCORD_CALLBACK_URL`
- Config File: `.env` (lines 422-425)
- Implementation: `api/strategies/discordStrategy.js`

**API Endpoints**:
- `https://discord.com/api/oauth2/authorize`
- `https://discord.com/api/oauth2/token`
- `https://discord.com/api/users/@me`

**OAuth Scopes**:
- `identify` - User identity
- `email` - User email

---

### 4.4 Facebook OAuth

**Status**: Optional

**Configuration**:
- Environment Variables:
  - `FACEBOOK_CLIENT_ID`
  - `FACEBOOK_CLIENT_SECRET`
  - `FACEBOOK_CALLBACK_URL`
- Config File: `.env` (lines 428-430)
- Implementation: `api/strategies/facebookStrategy.js`

**API Endpoints**:
- `https://www.facebook.com/v12.0/dialog/oauth`
- `https://graph.facebook.com/v12.0/oauth/access_token`
- `https://graph.facebook.com/v12.0/me`

**OAuth Scopes**: `public_profile`

**Profile Fields**: `id`, `email`, `name`

---

### 4.5 Apple Sign In

**Status**: Optional

**Configuration**:
- Environment Variables:
  - `APPLE_CLIENT_ID` (Service ID)
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY_PATH` - Path to .p8 private key file
  - `APPLE_CALLBACK_URL`
- Config File: `.env` (lines 446-450)
- Implementation: `api/strategies/appleStrategy.js`

**API Endpoints**:
- `https://appleid.apple.com/auth/authorize`
- `https://appleid.apple.com/auth/token`

---

### 4.6 OpenID Connect (OIDC)

**Status**: Optional

**What is sent/received**: OAuth/OIDC flows with configurable identity provider

**Configuration**:
- Environment Variables: (`.env` lines 452-490)
  - `OPENID_CLIENT_ID`
  - `OPENID_CLIENT_SECRET`
  - `OPENID_ISSUER` - OIDC issuer URL
  - `OPENID_SCOPE` (default: "openid profile email")
  - `OPENID_CALLBACK_URL`
  - `OPENID_REUSE_TOKENS` - Reuse OIDC tokens vs. local session
  - `OPENID_USE_PKCE` - Enable PKCE flow
  - `OPENID_AUTO_REDIRECT` - Bypass login form
  - Many more configuration options
- Implementation: `api/strategies/openidStrategy.js`

**API Endpoints**: Configured OIDC provider endpoints (discovered via `{issuer}/.well-known/openid-configuration`)

**Use Cases**:
- Entra ID (Azure AD)
- Keycloak
- Okta
- Auth0
- Custom OIDC providers

---

### 4.7 SAML 2.0

**Status**: Optional (disabled if OpenID is enabled)

**Configuration**:
- Environment Variables:
  - `SAML_ENTRY_POINT` - IdP SSO URL
  - `SAML_ISSUER` - SP entity ID
  - `SAML_CERT` - IdP certificate
  - `SAML_CALLBACK_URL`
  - `SAML_SESSION_SECRET`
  - Attribute mapping variables
- Config File: `.env` (lines 508-531)
- Implementation: `api/strategies/samlStrategy.js`

**API Endpoints**: Configured SAML IdP endpoints

---

## 5. Search API Endpoints

### 5.1 Google Custom Search Engine

**Status**: Optional plugin

**What is sent**:
- Search queries
- Search parameters (number of results, filters)
- API key (in request header)

**Purpose**: Web search tool for AI agents

**Configuration**:
- Environment Variables:
  - `GOOGLE_SEARCH_API_KEY`
  - `GOOGLE_CSE_ID` - Custom Search Engine ID
- Config File: `.env` (lines 290-291)
- Implementation: `api/app/clients/tools/manifest.json` (lines 16-31)

**API Endpoints**:
- `https://www.googleapis.com/customsearch/v1`

**Data Export**:
- Search queries only
- No user content

**Disable Method**: Don't configure Google Search plugin

---

### 5.2 SerpAPI

**Status**: Optional plugin

**What is sent**:
- Search queries
- Search engine selection (Google, Bing, etc.)
- Location and language parameters

**Purpose**: Real-time search engine results API

**Configuration**:
- Environment Variable: `SERPAPI_API_KEY`
- Config File: `.env` (line 299)
- Implementation: `api/app/clients/tools/manifest.json` (lines 88-98)

**API Endpoints**:
- `https://serpapi.com/search`

**Data Export**: Search queries

---

### 5.3 Serper

**Status**: Optional (Web Search feature)

**What is sent**: Search queries

**Purpose**: Google Search API alternative for web search feature

**Configuration**:
- Environment Variable: `SERPER_API_KEY`
- Config File: `.env` (line 754)
- Config Reference: `librechat.example.yaml` (line 415)

**API Endpoints**:
- `https://google.serper.dev/search`

---

### 5.4 SearXNG

**Status**: Optional (Web Search feature)

**What is sent**: Search queries

**Purpose**: Privacy-focused metasearch engine (can be self-hosted)

**Configuration**:
- Environment Variables:
  - `SEARXNG_INSTANCE_URL` - SearXNG instance URL
  - `SEARXNG_API_KEY` (if required by instance)
- Config Reference: `librechat.example.yaml` (lines 416-417)

**API Endpoints**:
- `{SEARXNG_INSTANCE_URL}/search`

**Privacy Note**: Can be self-hosted for complete privacy

---

## 6. Third-Party Tool Integrations

### 6.1 Tavily Search API

**Status**: Optional plugin

**What is sent**:
- Search queries
- Search depth parameters
- Topic filters

**Purpose**: LLM-optimized search API with source citations

**Configuration**:
- Environment Variable: `TAVILY_API_KEY`
- Config File: `.env` (line 307)
- Implementation: `api/app/clients/tools/structured/TavilySearch.js`

**API Endpoints**:
- `https://api.tavily.com/search`

**Data Export**: Search queries

---

### 6.2 Traversaal Search

**Status**: Optional plugin

**What is sent**: Search queries

**Purpose**: AI-powered search API

**Configuration**:
- Environment Variable: `TRAVERSAAL_API_KEY`
- Config File: `.env` (line 311)
- Implementation: `api/app/clients/tools/structured/TraversaalSearch.js`

**API Endpoints**:
- `https://api.traversaal.ai/search`

---

### 6.3 WolframAlpha

**Status**: Optional plugin

**What is sent**:
- Natural language queries
- Mathematical expressions
- Data queries

**Purpose**: Computational intelligence and knowledge engine

**Configuration**:
- Environment Variable: `WOLFRAM_APP_ID`
- Config File: `.env` (line 315)
- Implementation: `api/app/clients/tools/structured/Wolfram.js`

**API Endpoints**:
- `https://www.wolframalpha.com/api/v1/llm-api`

**Data Export**:
- User queries only
- No personal data

---

### 6.4 Zapier NLA (Natural Language Actions)

**Status**: Optional plugin

**What is sent**:
- Action requests in natural language
- User data required for Zapier actions
- OAuth tokens for connected services

**Purpose**: Connect to 5,000+ apps via natural language

**Configuration**:
- Environment Variable: `ZAPIER_NLA_API_KEY`
- Config File: `.env` (line 319)

**API Endpoints**:
- `https://nla.zapier.com/api/v1/`

**Data Export**:
- Depends on configured Zapier actions
- May include any user data sent to connected services

**Privacy Warning**: High risk - Zapier can access and modify data in connected third-party services

---

### 6.5 YouTube Data API v3

**Status**: Optional plugin toolkit

**What is sent**:
- Video IDs or search queries
- Channel IDs
- Comment retrieval requests

**Purpose**: Get video information, transcripts, comments

**Configuration**:
- Environment Variable: `YOUTUBE_API_KEY`
- Config File: `.env` (line 295)
- Implementation: `packages/api/src/tools/toolkits/yt.ts`

**API Endpoints**:
- `https://www.googleapis.com/youtube/v3/*`

**Data Export**: Search queries, video IDs requested

---

### 6.6 Azure AI Search

**Status**: Optional plugin

**What is sent**:
- Search queries
- Document indexing data (if configured)
- Search filters and parameters

**Purpose**: Enterprise search and RAG capabilities

**Configuration**:
- Environment Variables:
  - `AZURE_AI_SEARCH_SERVICE_ENDPOINT`
  - `AZURE_AI_SEARCH_INDEX_NAME`
  - `AZURE_AI_SEARCH_API_KEY`
  - `AZURE_AI_SEARCH_API_VERSION`
  - `AZURE_AI_SEARCH_SEARCH_OPTION_QUERY_TYPE`
  - `AZURE_AI_SEARCH_SEARCH_OPTION_TOP`
  - `AZURE_AI_SEARCH_SEARCH_OPTION_SELECT`
- Config File: `.env` (lines 244-253)
- Implementation: `api/app/clients/tools/manifest.json` (lines 147-167)

**API Endpoints**:
- `{AZURE_AI_SEARCH_SERVICE_ENDPOINT}/indexes/{index}/docs/search`

**Data Export**:
- Search queries
- Potentially indexed documents (depends on configuration)

---

## 7. Image Generation Services

### 7.1 DALL-E (OpenAI)

**Status**: Optional plugin

**What is sent**:
- Image generation prompts
- Image sizes and quality parameters
- For DALL-E 2 edits: original image + mask

**Purpose**: AI image generation and editing

**Configuration**:
- Environment Variables:
  - `DALLE_API_KEY` - Shared key
  - `DALLE3_API_KEY` - DALL-E 3 specific
  - `DALLE2_API_KEY` - DALL-E 2 specific
  - `DALLE_REVERSE_PROXY` - Custom proxy
  - `DALLE3_BASEURL` - Custom base URL for DALL-E 3
  - `DALLE2_BASEURL` - Custom base URL for DALL-E 2
  - `DALLE3_SYSTEM_PROMPT` - Custom system prompt
  - `DALLE2_SYSTEM_PROMPT` - Custom system prompt
  - `DALLE3_AZURE_API_VERSION` - For Azure OpenAI
  - `DALLE2_AZURE_API_VERSION` - For Azure OpenAI
- Config File: `.env` (lines 265-278)
- Implementation: `api/app/clients/tools/structured/DALLE3.js`

**API Endpoints**:
- OpenAI: `https://api.openai.com/v1/images/generations`
- Azure: `{DALLE3_BASEURL}/openai/deployments/{deployment}/images/generations`

**Data Export**:
- Image prompts
- Generated images are temporarily stored by OpenAI
- Images may be used for model improvement (check OpenAI policy)

---

### 7.2 Stable Diffusion WebUI

**Status**: Optional plugin

**What is sent**:
- Image prompts
- Negative prompts
- Generation parameters (steps, CFG scale, sampler, etc.)

**Purpose**: Local/self-hosted AI image generation

**Configuration**:
- Environment Variable: `SD_WEBUI_URL` (default: http://host.docker.internal:7860)
- Config File: `.env` (line 303)
- Implementation: `api/app/clients/tools/structured/StableDiffusion.js`

**API Endpoints**:
- `{SD_WEBUI_URL}/sdapi/v1/txt2img`
- `{SD_WEBUI_URL}/sdapi/v1/img2img`

**Data Export**:
- If self-hosted: No external data export
- If using cloud instance: Data sent to your instance

**Privacy Note**: Recommended for privacy-conscious deployments

---

### 7.3 Flux API (Black Forest Labs)

**Status**: Optional plugin

**What is sent**:
- Image generation prompts
- Model selection (flux-pro-1.1-ultra, flux-pro, flux-dev, etc.)
- Generation parameters (aspect ratio, safety tolerance, etc.)

**Purpose**: State-of-the-art AI image generation

**Configuration**:
- Environment Variables:
  - `FLUX_API_KEY`
  - `FLUX_API_BASE_URL` (default: https://api.us1.bfl.ai)
- Config File: `.env` (lines 282-286)
- Implementation: `api/app/clients/tools/structured/FluxAPI.js`

**API Endpoints**:
- `https://api.us1.bfl.ai/v1/flux-pro-1.1-ultra`
- `https://api.us1.bfl.ai/v1/flux-pro-1.1`
- `https://api.us1.bfl.ai/v1/flux-pro`
- `https://api.us1.bfl.ai/v1/flux-dev`

**Data Export**:
- Image prompts
- Generated images

---

## 8. Web Scraping and Reranking

### 8.1 Firecrawl API

**Status**: Optional (Web Search feature)

**What is sent**:
- URLs to scrape
- Scraping options (formats, limits)

**Purpose**: Web page content extraction for search results

**Configuration**:
- Environment Variables:
  - `FIRECRAWL_API_KEY`
  - `FIRECRAWL_API_URL` (optional custom instance)
- Config File: `.env` (lines 757-759)
- Config Reference: `librechat.example.yaml` (lines 420-421)

**API Endpoints**:
- Default: `https://api.firecrawl.dev/v0/scrape`
- Custom: `{FIRECRAWL_API_URL}/scrape`

**Data Export**:
- URLs user wants to scrape
- May include search queries indirectly

---

### 8.2 Jina AI Reranker

**Status**: Optional (Web Search feature)

**What is sent**:
- Search query
- List of search result snippets/documents
- Reranking parameters

**Purpose**: Rerank search results for better relevance

**Configuration**:
- Environment Variables:
  - `JINA_API_KEY`
  - `JINA_API_URL` (optional, default: https://api.jina.ai/v1/rerank)
- Config File: `.env` (line 762)
- Config Reference: `librechat.example.yaml` (lines 408-409)

**API Endpoints**:
- `https://api.jina.ai/v1/rerank`
- Or custom: `{JINA_API_URL}`

**Data Export**:
- Search queries
- Search result text snippets

---

### 8.3 Cohere Reranker

**Status**: Optional (Web Search feature)

**What is sent**:
- Search query
- Documents to rerank

**Purpose**: Alternative reranker for search results

**Configuration**:
- Environment Variable: `COHERE_API_KEY`
- Config File: `.env` (line 764)
- Config Reference: `librechat.example.yaml` (line 412)

**API Endpoints**:
- `https://api.cohere.ai/v1/rerank`

**Data Export**: Search queries and result snippets

---

## 9. Microsoft Graph API Integration

### Entra ID People Search

**Status**: Optional

**What is sent**:
- Search queries for users/groups
- Graph API authentication tokens
- User/group filter parameters

**Purpose**: Search Entra ID users and groups for permissions/sharing

**Configuration**:
- Environment Variables:
  - `USE_ENTRA_ID_FOR_PEOPLE_SEARCH=true`
  - `ENTRA_ID_INCLUDE_OWNERS_AS_MEMBERS`
  - `OPENID_GRAPH_SCOPES` (default: User.Read,People.Read,GroupMember.Read.All)
- Config File: `.env` (lines 538-547)
- Implementation: `api/server/services/GraphApiService.js`

**API Endpoints**:
- `https://graph.microsoft.com/v1.0/me`
- `https://graph.microsoft.com/v1.0/me/people`
- `https://graph.microsoft.com/v1.0/users`
- `https://graph.microsoft.com/v1.0/groups`

**Data Export**:
- User search queries
- Access tokens (temporary, expires)

---

### SharePoint File Picker

**Status**: Optional

**What is sent**:
- SharePoint authentication tokens
- File download requests
- SharePoint site/library access

**Purpose**: Upload files from SharePoint to chat

**Configuration**:
- Environment Variables:
  - `ENABLE_SHAREPOINT_FILEPICKER=true`
  - `SHAREPOINT_BASE_URL` (e.g., https://yourtenant.sharepoint.com)
  - `SHAREPOINT_PICKER_GRAPH_SCOPE` (default: Files.Read.All)
  - `SHAREPOINT_PICKER_SHAREPOINT_SCOPE` (e.g., https://yourtenant.sharepoint.com/AllSites.Read)
- Config File: `.env` (lines 493-506)
- Implementation: `client/src/data-provider/Files/sharepoint.ts`

**API Endpoints**:
- `https://graph.microsoft.com/v1.0/drives/{driveId}/items/{itemId}/content`
- `https://graph.microsoft.com/v1.0/sites/{siteId}/drives`

**Data Export**:
- File metadata
- File download requests
- SharePoint access patterns

---

## 10. Weather API

### OpenWeather API

**Status**: Optional plugin

**What is sent**:
- Location queries (city name, coordinates, zip code)
- API key

**Purpose**: Current weather, forecasts, historical weather data

**Configuration**:
- Environment Variable: `OPENWEATHER_API_KEY`
- Config File: `.env` (line 734)
- Implementation: `api/app/clients/tools/manifest.json` (lines 170-180)

**API Endpoints**:
- `https://api.openweathermap.org/data/2.5/weather` (current)
- `https://api.openweathermap.org/data/2.5/forecast` (forecast)

**Data Export**:
- Location queries only
- No personal data

---

## 11. Search Index Service

### MeiliSearch

**Status**: Optional but recommended

**What is sent**:
- Conversation messages (indexed locally)
- Search queries
- Document updates

**Purpose**: Fast, typo-tolerant conversation search

**Configuration**:
- Environment Variables:
  - `MEILI_HOST` (default: http://meilisearch:7700)
  - `MEILI_MASTER_KEY`
  - `MEILI_NO_ANALYTICS=true` (analytics disabled by default)
  - `MEILI_NO_SYNC` (disable indexing in multi-node setup)
- Config File: `.env` (lines 325-332)
- Implementation: `packages/data-schemas/src/models/plugins/mongoMeili.ts`

**API Endpoints**:
- Internal Docker network: `http://meilisearch:7700`
- If exposed: `http://localhost:7700`

**Data Export**:
- **Privacy Note**: MeiliSearch runs locally in Docker container
- No external data export unless `MEILI_HOST` points to external instance
- Analytics disabled by default (`MEILI_NO_ANALYTICS=true`)

**Self-Hosted**: Yes (recommended)

---

## 12. Code Execution Services

### 12.1 LibreChat Code Interpreter API

**Status**: Optional

**What is sent**:
- Code to execute (Python, JavaScript, etc.)
- Execution parameters
- Input files (if any)

**Purpose**: Server-side code execution for AI agents

**Configuration**:
- Environment Variable: `LIBRECHAT_CODE_API_KEY`
- Config File: `.env` (line 741)
- Implementation: `api/server/routes/config.js` (lines 111-112)

**API Endpoints**:
- Default: `https://code.librechat.ai`
- Or custom self-hosted instance

**Data Export**:
- User-generated code
- Execution inputs
- File uploads for code execution

**Self-Hosted Option**: Yes (GitHub: librechat-code-api)

---

### 12.2 Sandpack Bundler

**Status**: Optional (for Code Artifacts feature)

**What is sent**:
- JavaScript/TypeScript code
- React components
- Bundling requests

**Purpose**: Client-side code bundling for live preview artifacts

**Configuration**:
- Environment Variables:
  - `SANDPACK_BUNDLER_URL`
  - `SANDPACK_STATIC_BUNDLER_URL`
- Implementation: `api/server/routes/config.js` (lines 111-112)

**API Endpoints**:
- CodeSandbox Sandpack bundler service
- Or custom instance

---

## 13. CAPTCHA Service

### Cloudflare Turnstile

**Status**: Optional

**What is sent**:
- User challenge responses
- User interactions with CAPTCHA widget
- Browser fingerprinting data (Cloudflare side)

**Purpose**: Bot protection and CAPTCHA verification

**Configuration**:
- Config File: `librechat.yaml` (not in .env)
- Config Example: `librechat.example.yaml` (lines 103-107)
- Implementation: `packages/data-schemas/src/app/turnstile.ts`

**Configuration Format**:
```yaml
turnstile:
  siteKey: "your-site-key-here"
  options:
    language: "auto"
    size: "normal"
```

**API Endpoints**:
- `https://challenges.cloudflare.com/turnstile/v0/api.js`
- `https://challenges.cloudflare.com/cdn-cgi/challenge-platform/*`

**Data Export**:
- Challenge responses
- User agent and browser data
- IP addresses (Cloudflare side)

---

## 14. LDAP/Directory Services

### LDAP/Active Directory

**Status**: Optional

**What is sent**:
- User credentials (for authentication)
- LDAP search queries
- User DN (Distinguished Name) lookups

**Purpose**: Enterprise directory authentication

**Configuration**:
- Environment Variables:
  - `LDAP_URL` - LDAP server URL (e.g., ldaps://ldap.example.com:636)
  - `LDAP_BIND_DN` - Bind DN for search
  - `LDAP_BIND_CREDENTIALS` - Bind password
  - `LDAP_USER_SEARCH_BASE` - Search base (e.g., ou=users,dc=example,dc=com)
  - `LDAP_SEARCH_FILTER` - Search filter (e.g., mail=)
  - `LDAP_CA_CERT_PATH` - CA certificate for TLS
  - `LDAP_TLS_REJECT_UNAUTHORIZED`
  - `LDAP_STARTTLS`
  - `LDAP_LOGIN_USES_USERNAME`
  - Attribute mappings (LDAP_ID, LDAP_USERNAME, LDAP_EMAIL, LDAP_FULL_NAME)
- Config File: `.env` (lines 549-562)

**Protocol**: LDAP/LDAPS (port 389/636)

**Data Export**:
- User credentials (sent over TLS)
- LDAP queries

**Self-Hosted**: Typically yes (internal Active Directory)

---

## 15. Translation Services

### Locize

**Status**: Development/CI only (not runtime)

**What is sent**:
- Translation keys
- Locale data
- Translation updates

**Purpose**: Translation management platform for i18n

**Configuration**:
- GitHub Actions: `.github/workflows/locize-i18n-sync.yml`
- Implementation: `packages/client/src/locales/i18n.ts`

**API Endpoints**:
- `https://api.locize.app/*`

**Data Export**:
- Translation strings
- Language data

**Runtime Impact**: None (translations bundled at build time)

**Privacy Note**: Only used during development and CI builds, not by end users

---

## 16. Model Context Protocol (MCP)

### MCP Servers (Various)

**Status**: Optional, highly extensible

**What is sent**:
- Tool invocation requests
- Resource requests
- Prompt requests
- Authentication data (OAuth if required)

**Purpose**: Extensible tool integration framework for AI agents

**Configuration**:
- Config File: `librechat.yaml` (not .env)
- Config Example: `librechat.example.yaml` (lines 167-192)
- Implementation: `packages/api/src/mcp/*`

**Example MCP Servers**:
- **Puppeteer MCP**: Browser automation (may send URLs to scrape)
- **Filesystem MCP**: Local file access (no external export)
- **Obsidian MCP**: Obsidian vault access (local)
- **Custom OAuth MCP**: May connect to any OAuth-enabled service

**API Endpoints**:
- Varies by MCP server
- Can be local (stdio) or remote (HTTP/SSE)

**Data Export**:
- Depends on specific MCP server
- May range from no export (local tools) to extensive export (cloud integrations)

**Configuration Example**:
```yaml
mcpServers:
  puppeteer:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-puppeteer"]
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
```

**Privacy Warning**: MCP servers can be extremely powerful. Audit each server before enabling.

---

## 17. Reverse Proxy Endpoints

### Generic Reverse Proxies

**Status**: Optional

**What is sent**: Varies - proxies AI API requests

**Purpose**: Route API requests through custom proxies (cost optimization, caching, monitoring)

**Configuration**:
- Environment Variables:
  - `PROXY` - Global proxy for all services
  - `OPENAI_REVERSE_PROXY` - Proxy for OpenAI requests
  - `ANTHROPIC_REVERSE_PROXY` - Proxy for Anthropic requests
  - `GOOGLE_REVERSE_PROXY` - Proxy for Google requests
  - `DALLE_REVERSE_PROXY` - Proxy for DALL-E requests
  - `OPENAI_MODERATION_REVERSE_PROXY` - Proxy for moderation requests
- Config File: `.env` (various lines)

**Data Export**:
- All AI API requests routed through configured proxy
- Proxy operator has full access to request/response data

**Privacy Warning**: Only use trusted reverse proxies. Malicious proxies can log all AI conversations.

---

## 18. RAG and Embeddings

### RAG API & Embeddings

**Status**: Optional

**What is sent**:
- Documents for indexing
- Embedding generation requests
- Semantic search queries
- Vector data

**Purpose**: Retrieval Augmented Generation (file chat, document Q&A)

**Configuration**:
- Environment Variables:
  - `RAG_OPENAI_BASEURL` - Custom RAG API endpoint
  - `RAG_OPENAI_API_KEY` - API key for RAG service
  - `RAG_USE_FULL_CONTEXT` - Send full context
  - `EMBEDDINGS_PROVIDER` - Embedding provider (openai, etc.)
  - `EMBEDDINGS_MODEL` - Model for embeddings (e.g., text-embedding-3-small)
- Config File: `.env` (lines 346-350)
- Docker Service: `rag_api` container (self-hosted by default)

**API Endpoints**:
- Default: `http://rag_api:8000` (internal Docker network)
- Or external RAG API service

**Data Export**:
- Document content
- Generated embeddings
- Search queries

**Self-Hosted Option**: Yes (default in docker-compose.yml)

---

## 19. Content Moderation

### OpenAI Moderation API

**Status**: Optional (disabled by default)

**What is sent**:
- User messages (for content analysis)
- Message text

**Purpose**: Content filtering for harmful/inappropriate content

**Configuration**:
- Environment Variables:
  - `OPENAI_MODERATION=false` (default)
  - `OPENAI_MODERATION_API_KEY`
  - `OPENAI_MODERATION_REVERSE_PROXY`
- Config File: `.env` (lines 360-362)

**API Endpoints**:
- `https://api.openai.com/v1/moderations`

**Data Export**:
- All user messages sent to OpenAI
- OpenAI's data usage policy applies

**Privacy Warning**: Disabled by default. When enabled, all messages are sent to OpenAI for analysis.

---

## 20. Services NOT Found

The following common services were **NOT found** in the codebase:

### Error Tracking / Monitoring
- ❌ Sentry
- ❌ Bugsnag
- ❌ Rollbar
- ❌ LogRocket
- ❌ New Relic

### Payment / Billing
- ❌ Stripe
- ❌ PayPal
- ❌ Braintree
- ❌ Square

### Webhooks / Notifications
- ❌ Slack webhooks
- ❌ Discord webhooks
- ❌ Telegram bots
- ❌ Push notification services

### Advertising / Marketing
- ❌ Google Ads
- ❌ Facebook Pixel
- ❌ Advertising networks

**Note**: All tracking and monitoring is done locally via internal logger.

---

## 21. Privacy Summary

### Data Export Categories

1. **Always Exported** (if configured):
   - AI provider API keys and model requests (OpenAI, Anthropic, Google, etc.)
   - OAuth provider authentication (if social login enabled)
   - Email service (if email features enabled)
   - File storage (if cloud storage configured)

2. **Optionally Exported**:
   - Analytics (GTM) - optional
   - Search queries (Google, SerpAPI, etc.) - optional plugins
   - Image generation prompts - optional
   - Tool/plugin data - optional per tool

3. **Never Exported** (self-hosted only):
   - MongoDB data (stays in local Docker container)
   - Redis cache (if used, local only)
   - MeiliSearch index (local only)
   - Local file storage (if not using cloud CDN)
   - Application logs (local files only)

### Privacy Levels

**Maximum Privacy Configuration**:
- ✅ Use local file storage (no cloud CDN)
- ✅ Disable Google Tag Manager
- ✅ Disable all social OAuth providers
- ✅ Use email verification off or local SMTP
- ✅ Disable all search plugins
- ✅ Disable all third-party tools
- ✅ Use Stable Diffusion locally (no cloud image gen)
- ✅ Self-host RAG API
- ✅ Use local MeiliSearch
- ✅ Disable OpenAI moderation
- ✅ No reverse proxies

**Moderate Privacy Configuration**:
- ⚠️ Use cloud file storage with encryption
- ⚠️ Enable OAuth but only trusted providers
- ⚠️ Selective tool/plugin enablement
- ⚠️ Self-host what you can

**Low Privacy Configuration**:
- ❌ All features enabled
- ❌ All cloud services
- ❌ Analytics enabled
- ❌ All plugins active

### Data Residency

**Data Stored Locally** (in Docker volumes):
- User accounts and profiles
- Conversation history
- Message content
- User preferences
- Session data
- File uploads (if local storage)

**Data Sent to Third Parties**:
- See sections 1-19 above for specific services

### Compliance Considerations

**GDPR Compliance**:
- User data exports: Implement via MongoDB export
- Right to deletion: Delete user via `npm run delete-user`
- Consent management: May need custom implementation for analytics/cookies
- Data processing agreements: Required for all third-party services

**HIPAA Compliance**:
- ⚠️ Default configuration is **NOT HIPAA compliant**
- Requires: BAAs with all third-party services, encryption at rest/transit, audit logs
- Recommendation: Consult legal counsel before using for protected health information

**FERPA (Education)**:
- Avoid sending student data to third-party analytics
- Review all AI provider DPAs
- Minimize third-party integrations

---

## 22. Recommendations

### Security Audit Checklist

- [ ] Review and minimize enabled OAuth providers
- [ ] Audit all enabled plugins and tools
- [ ] Review AI provider data usage policies
- [ ] Configure appropriate file storage (consider data sensitivity)
- [ ] Disable analytics if not needed
- [ ] Review MCP server permissions
- [ ] Implement monitoring for unusual API usage
- [ ] Regular backups of local data
- [ ] Keep all services updated
- [ ] Review reverse proxy trust (if used)

### For Maximum Data Privacy

1. **Self-host everything possible**:
   - File storage: Local volumes
   - RAG API: Use included Docker container
   - Search: MeiliSearch (included)
   - Image generation: Stable Diffusion (self-hosted)

2. **Minimize external services**:
   - Disable analytics
   - Disable unnecessary plugins
   - Use only required OAuth providers
   - Avoid third-party tools

3. **Use privacy-focused alternatives**:
   - Email: Self-hosted mail server
   - Search: SearXNG (self-hosted)
   - Analytics: Matomo (self-hosted) or disable

4. **Audit data exports**:
   - Review AI provider data policies
   - Monitor outbound network traffic
   - Implement logging for all external API calls

---

## Document Metadata

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Project Version**: NexusChat v0.8.0 (LibreChat)
**Review Status**: Initial comprehensive audit
**Next Review Date**: Upon major version update or new feature addition

---

## Appendix: Quick Reference Table

| Service | Type | Status | Data Sent | Privacy Risk |
|---------|------|--------|-----------|--------------|
| Google Tag Manager | Analytics | Optional | Page views, events | Medium |
| Mailgun/SMTP | Email | Optional | Email content | Low-Medium |
| Firebase/S3/Azure | File Storage | Optional | Uploaded files | Medium-High |
| OAuth Providers | Authentication | Optional | Profile data | Low-Medium |
| Google Search, SerpAPI | Search | Optional | Queries | Low |
| Tavily, Traversaal | Search | Optional | Queries | Low |
| WolframAlpha | Tool | Optional | Queries | Low |
| Zapier NLA | Tool | Optional | Action data | **HIGH** |
| DALL-E, Flux | Image Gen | Optional | Prompts | Medium |
| Stable Diffusion | Image Gen | Optional | Prompts (local) | Low if self-hosted |
| Firecrawl | Scraper | Optional | URLs | Low |
| Jina/Cohere | Reranker | Optional | Search results | Low |
| Microsoft Graph | Enterprise | Optional | Queries, tokens | Medium |
| OpenWeather | Weather | Optional | Location queries | Low |
| MeiliSearch | Search Index | Optional | Messages (local) | Low if self-hosted |
| Code Interpreter | Code Exec | Optional | Code | Medium-High |
| Cloudflare Turnstile | CAPTCHA | Optional | Browser data | Medium |
| LDAP/AD | Auth | Optional | Credentials | Low if internal |
| Locize | Translation | Dev only | Translation data | N/A (build-time) |
| MCP Servers | Tools | Optional | Varies widely | **Varies** |
| OpenAI Moderation | Moderation | Optional (off) | All messages | **HIGH** |

**Privacy Risk Levels**:
- **Low**: Minimal personal data, query data only
- **Medium**: May include user content or files
- **High**: Full access to messages, files, or third-party accounts

---

**End of Document**
