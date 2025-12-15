# Azure Documentation Deployment Guide

**Date:** 2025-11-07
**Purpose:** Deploy NexusChat documentation using Azure Storage Static Websites + Azure Front Door
**Approach:** Leverage existing Azure infrastructure with Docker containerization option

---

## Executive Summary

This guide provides **two deployment approaches** for hosting docs.videxa.co on Azure:

1. **Approach A: Azure Storage Static Website** (Recommended for docs)
   - Simple, cost-effective ($1-5/month)
   - Built-in CDN via Azure Front Door
   - Perfect for documentation sites

2. **Approach B: Dockerized Frontend + Azure Container Apps/App Service**
   - Full control, dynamic capabilities
   - More expensive ($10-50/month)
   - Better for complex web apps

**Recommendation:** Use **Approach A for documentation** (static) and **Approach B for main web apps** (dynamic).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         docs.videxa.co                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Azure Front Door    │ ← Global CDN, SSL, WAF
                   │  (Premium/Standard)  │
                   └──────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
         ┌──────────▼─────────┐   ┌────▼──────────────┐
         │  Azure Storage     │   │ Azure Container   │
         │  Static Website    │   │ Apps (Optional)   │
         │  $web container    │   │ Docker Frontend   │
         └────────────────────┘   └───────────────────┘
              (Approach A)            (Approach B)
```

---

## Approach A: Azure Storage Static Website (Recommended for Docs)

### ✅ **Advantages**
- **Cost-effective:** $1-5/month for docs site
- **Scalable:** Handles millions of requests
- **Fast:** Global CDN via Azure Front Door
- **Simple:** No servers to manage
- **Secure:** Built-in DDoS protection
- **CI/CD Ready:** Easy GitHub Actions integration

### 📋 **Prerequisites**
- Azure subscription (you already have)
- Azure Storage Account (you already have or can create)
- Custom domain: docs.videxa.co
- Azure Front Door (optional but recommended)

---

## Step-by-Step: Deploy Docusaurus Docs to Azure Storage

### **Step 1: Create Azure Storage Account for Static Website**

#### Option 1A: Using Azure Portal
```
1. Go to Azure Portal → Storage Accounts
2. Click "Create"
3. Settings:
   - Subscription: sub-nex-prd
   - Resource Group: rg-videxa-docs (or existing)
   - Storage Account Name: stvidexadocs (must be globally unique)
   - Region: Central US (or your region)
   - Performance: Standard
   - Redundancy: LRS (locally-redundant, cheapest for docs)
4. Click "Review + Create"
```

#### Option 1B: Using Azure CLI
```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="rg-videxa-docs"
STORAGE_ACCOUNT="stvidexadocs"
LOCATION="centralus"

# Create resource group (if needed)
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Enable static website hosting
az storage blob service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --static-website \
  --404-document 404.html \
  --index-document index.html

# Get the static website URL
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "primaryEndpoints.web" \
  --output tsv
```

**Output:** `https://stvidexadocs.z19.web.core.windows.net/`

---

### **Step 2: Build Your Documentation Site**

#### Build Docusaurus Site
```bash
# Navigate to your Docusaurus project
cd C:\videxa-repos\NexusChat\docs.videxa.co

# Install dependencies (if not already done)
npm install

# Build for production
npm run build

# Output will be in: build/
```

**Build Output:** Static HTML/CSS/JS files in `build/` directory

---

### **Step 3: Deploy to Azure Storage**

#### Option 3A: Using Azure CLI (Recommended)
```bash
# Set variables
STORAGE_ACCOUNT="stvidexadocs"
BUILD_DIR="build"

# Upload all files to $web container
az storage blob upload-batch \
  --account-name $STORAGE_ACCOUNT \
  --source $BUILD_DIR \
  --destination '$web' \
  --auth-mode login \
  --overwrite

# Done! Your site is live at the static website URL
```

#### Option 3B: Using Azure Storage Explorer (GUI)
```
1. Download Azure Storage Explorer: https://azure.microsoft.com/features/storage-explorer/
2. Connect to your Azure account
3. Navigate to: stvidexadocs → Blob Containers → $web
4. Upload all files from build/ directory
5. Done!
```

#### Option 3C: Using AzCopy (Fastest for large sites)
```bash
# Download AzCopy: https://aka.ms/downloadazcopy-v10

# Set variables
STORAGE_ACCOUNT="stvidexadocs"
BUILD_DIR="build"

# Get SAS token (or use --auth-mode login)
azcopy copy "$BUILD_DIR/*" \
  "https://$STORAGE_ACCOUNT.blob.core.windows.net/\$web/" \
  --recursive=true
```

---

### **Step 4: Configure Custom Domain (docs.videxa.co)**

#### 4A: Add Custom Domain to Storage Account
```bash
# Add custom domain
az storage account update \
  --name stvidexadocs \
  --resource-group rg-videxa-docs \
  --custom-domain docs.videxa.co
```

#### 4B: Configure DNS (at your domain registrar)
```
DNS Records to Add:

Type: CNAME
Name: docs
Value: stvidexadocs.z19.web.core.windows.net
TTL: 3600
```

⚠️ **Important:** Azure Storage doesn't support HTTPS on custom domains directly. You need Azure Front Door for SSL.

---

### **Step 5: Add Azure Front Door for SSL + CDN**

#### Why Azure Front Door?
- ✅ **SSL/HTTPS** - Free managed certificates
- ✅ **Global CDN** - 100+ edge locations
- ✅ **WAF** - Web Application Firewall
- ✅ **Fast** - Caching at edge
- ✅ **DDoS Protection** - Built-in

#### Create Azure Front Door
```bash
# Set variables
FRONTDOOR_NAME="fd-videxa-docs"
RESOURCE_GROUP="rg-videxa-docs"
BACKEND_HOST="stvidexadocs.z19.web.core.windows.net"

# Create Front Door profile (Standard tier)
az afd profile create \
  --profile-name $FRONTDOOR_NAME \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_AzureFrontDoor

# Create endpoint
az afd endpoint create \
  --endpoint-name "docs-videxa" \
  --profile-name $FRONTDOOR_NAME \
  --resource-group $RESOURCE_GROUP \
  --enabled-state Enabled

# Create origin group
az afd origin-group create \
  --origin-group-name "storage-origin-group" \
  --profile-name $FRONTDOOR_NAME \
  --resource-group $RESOURCE_GROUP \
  --probe-request-type GET \
  --probe-protocol Http \
  --probe-interval-in-seconds 120 \
  --probe-path "/" \
  --sample-size 4 \
  --successful-samples-required 3 \
  --additional-latency-in-milliseconds 50

# Add origin (your storage account)
az afd origin create \
  --origin-name "storage-origin" \
  --origin-group-name "storage-origin-group" \
  --profile-name $FRONTDOOR_NAME \
  --resource-group $RESOURCE_GROUP \
  --host-name $BACKEND_HOST \
  --origin-host-header $BACKEND_HOST \
  --priority 1 \
  --weight 1000 \
  --enabled-state Enabled \
  --http-port 80 \
  --https-port 443

# Create route
az afd route create \
  --route-name "default-route" \
  --endpoint-name "docs-videxa" \
  --profile-name $FRONTDOOR_NAME \
  --resource-group $RESOURCE_GROUP \
  --origin-group "storage-origin-group" \
  --supported-protocols Http Https \
  --https-redirect Enabled \
  --forwarding-protocol HttpsOnly \
  --link-to-default-domain Enabled

# Add custom domain
az afd custom-domain create \
  --custom-domain-name "docs-videxa-co" \
  --profile-name $FRONTDOOR_NAME \
  --resource-group $RESOURCE_GROUP \
  --host-name "docs.videxa.co" \
  --minimum-tls-version TLS12

# Enable HTTPS (managed certificate)
az afd custom-domain update \
  --custom-domain-name "docs-videxa-co" \
  --profile-name $FRONTDOOR_NAME \
  --resource-group $RESOURCE_GROUP \
  --certificate-type ManagedCertificate
```

#### Update DNS to Point to Front Door
```
DNS Records:

Type: CNAME
Name: docs
Value: fd-videxa-docs-<random>.z01.azurefd.net
TTL: 3600
```

**Wait 5-10 minutes for DNS propagation and SSL provisioning.**

---

## Approach B: Dockerized Frontend + Azure Container Apps

For **dynamic web applications** or when you need more control.

### **Architecture**
```
docs.videxa.co
      ↓
Azure Front Door (CDN + SSL)
      ↓
Azure Container Apps (Docker)
      ↓
Nginx serving static files
```

### **Step 1: Create Dockerfile for Docusaurus**

```dockerfile
# File: Dockerfile
# Multi-stage build for production

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Build static site
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx config (optional)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### **Step 2: Create Nginx Configuration**

```nginx
# File: nginx.conf
server {
    listen 80;
    server_name docs.videxa.co;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data:;" always;

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback (for client-side routing)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### **Step 3: Build and Test Docker Image Locally**

```bash
# Build Docker image
docker build -t videxa-docs:latest .

# Test locally
docker run -p 8080:80 videxa-docs:latest

# Open browser: http://localhost:8080
# Verify site works

# Stop container
docker stop $(docker ps -q --filter ancestor=videxa-docs:latest)
```

### **Step 4: Push to Azure Container Registry**

```bash
# Set variables
ACR_NAME="acrvidexa"
RESOURCE_GROUP="rg-videxa-docs"
LOCATION="centralus"

# Create ACR (if you don't have one)
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic

# Login to ACR
az acr login --name $ACR_NAME

# Tag image
docker tag videxa-docs:latest $ACR_NAME.azurecr.io/videxa-docs:latest

# Push to ACR
docker push $ACR_NAME.azurecr.io/videxa-docs:latest

# Verify
az acr repository list --name $ACR_NAME --output table
```

### **Step 5: Deploy to Azure Container Apps**

```bash
# Set variables
CONTAINER_APP_NAME="ca-videxa-docs"
CONTAINER_APP_ENV="cae-videxa-docs"
IMAGE="$ACR_NAME.azurecr.io/videxa-docs:latest"

# Create Container Apps environment
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Create container app
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image $IMAGE \
  --target-port 80 \
  --ingress external \
  --registry-server $ACR_NAME.azurecr.io \
  --query properties.configuration.ingress.fqdn

# Enable managed identity for ACR pull
az containerapp identity assign \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --system-assigned

# Get the app URL
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn
```

**Output:** `https://ca-videxa-docs.randomstring.centralus.azurecontainerapps.io`

### **Step 6: Add Azure Front Door (for custom domain + CDN)**

```bash
# Create Front Door (same as Approach A, but backend is Container App)
FRONTDOOR_NAME="fd-videxa-docs"
BACKEND_HOST="ca-videxa-docs.randomstring.centralus.azurecontainerapps.io"

# Follow same Front Door steps from Approach A
# Point origin to Container App instead of Storage
```

---

## CI/CD Pipeline with GitHub Actions

### **For Approach A (Azure Storage Static Website)**

Create `.github/workflows/deploy-docs.yml`:

```yaml
name: Deploy Documentation to Azure Storage

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Build Docusaurus site
      run: npm run build

    - name: Azure Login
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Upload to Azure Storage
      run: |
        az storage blob upload-batch \
          --account-name stvidexadocs \
          --source ./build \
          --destination '$web' \
          --auth-mode login \
          --overwrite

    - name: Purge Azure Front Door CDN
      run: |
        az afd endpoint purge \
          --endpoint-name docs-videxa \
          --profile-name fd-videxa-docs \
          --resource-group rg-videxa-docs \
          --content-paths "/*"
```

### **For Approach B (Docker + Container Apps)**

Create `.github/workflows/deploy-docker-docs.yml`:

```yaml
name: Deploy Dockerized Docs to Azure Container Apps

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Azure Login
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}

    - name: Build and push Docker image
      uses: azure/docker-login@v1
      with:
        login-server: acrvidexa.azurecr.io
        username: ${{ secrets.ACR_USERNAME }}
        password: ${{ secrets.ACR_PASSWORD }}

    - name: Build Docker image
      run: |
        docker build -t acrvidexa.azurecr.io/videxa-docs:${{ github.sha }} .
        docker tag acrvidexa.azurecr.io/videxa-docs:${{ github.sha }} \
                   acrvidexa.azurecr.io/videxa-docs:latest

    - name: Push to ACR
      run: |
        docker push acrvidexa.azurecr.io/videxa-docs:${{ github.sha }}
        docker push acrvidexa.azurecr.io/videxa-docs:latest

    - name: Deploy to Container Apps
      run: |
        az containerapp update \
          --name ca-videxa-docs \
          --resource-group rg-videxa-docs \
          --image acrvidexa.azurecr.io/videxa-docs:${{ github.sha }}

    - name: Purge Front Door CDN
      run: |
        az afd endpoint purge \
          --endpoint-name docs-videxa \
          --profile-name fd-videxa-docs \
          --resource-group rg-videxa-docs \
          --content-paths "/*"
```

---

## Cost Comparison

### **Approach A: Azure Storage Static Website**

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Azure Storage (LRS) | Standard | $0.50 - $2 |
| Azure Front Door | Standard | $35 + $0.01/GB egress |
| **Total** | | **~$36-40/month** |

**Notes:**
- Storage: $0.02/GB for first 50TB + $0.0004 per 10k operations
- Front Door Standard: $35 base + data transfer
- If using Front Door Premium: $330/month (overkill for docs)

### **Approach B: Docker + Container Apps**

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Azure Container Apps | 0.5 vCPU, 1GB RAM | $14-20/month |
| Azure Container Registry | Basic | $5/month |
| Azure Front Door | Standard | $35/month |
| **Total** | | **~$54-60/month** |

### **Recommendation:**
**Use Approach A (Static Website)** for documentation - it's simpler and cheaper.
**Use Approach B (Docker)** only if you need:
- Server-side rendering
- Dynamic content
- API endpoints
- Websockets

---

## Comparison: Azure vs Vercel/Netlify

| Feature | Azure Storage + Front Door | Vercel | Netlify |
|---------|---------------------------|--------|---------|
| **Cost (Docs Site)** | $36-40/month | $0/month | $0/month |
| **Setup Complexity** | High (multiple services) | Low (1 command) | Low (1 command) |
| **Infrastructure Control** | Full (you own it) | Limited | Limited |
| **CI/CD** | Manual GitHub Actions | Automatic | Automatic |
| **Preview Deployments** | Manual setup | Automatic | Automatic |
| **Custom Domain** | ✅ Yes | ✅ Yes | ✅ Yes |
| **SSL** | ✅ Free (Front Door) | ✅ Free | ✅ Free |
| **Global CDN** | ✅ Azure Front Door | ✅ Vercel Edge | ✅ Netlify Edge |
| **Best For** | Enterprise, compliance, existing Azure | Speed, DX | JAMstack |

**Truth:** For documentation, Vercel/Netlify are simpler and free. Azure makes sense if:
- You need everything in Azure for compliance
- You already have Azure Front Door
- You want full infrastructure control

---

## My Recommendation for Videxa

### **For docs.videxa.co:**

#### **Option 1: Start Simple (Recommended)**
Use **Vercel** (free) → Migrate to Azure later if needed
- **Time:** 30 minutes to deploy
- **Cost:** $0/month
- **Effort:** Minimal

#### **Option 2: Azure for Consistency**
Use **Azure Storage + Front Door** (Approach A)
- **Time:** 2-3 hours to set up properly
- **Cost:** $36-40/month
- **Benefit:** Everything in Azure

#### **Option 3: Full Azure with Docker**
Use **Docker + Container Apps** (Approach B)
- **Time:** 4-6 hours to set up
- **Cost:** $54-60/month
- **Benefit:** Maximum flexibility

### **For Main Web App (app.videxa.co):**
Use **Approach B (Docker + Container Apps)** because:
- You need dynamic features
- You want full control
- You have existing Azure infrastructure

---

## Quick Start Commands

### **Deploy to Azure Storage (Approach A)**

```bash
# 1. Create storage account
az storage account create \
  --name stvidexadocs \
  --resource-group rg-videxa-docs \
  --location centralus \
  --sku Standard_LRS

# 2. Enable static website
az storage blob service-properties update \
  --account-name stvidexadocs \
  --static-website \
  --404-document 404.html \
  --index-document index.html

# 3. Build docs
cd docs.videxa.co
npm run build

# 4. Upload
az storage blob upload-batch \
  --account-name stvidexadocs \
  --source ./build \
  --destination '$web' \
  --auth-mode login

# Done! Site is live.
```

---

## Next Steps

1. **Decide:** Approach A (static) or B (Docker)?
2. **Create:** Azure resources (storage/container apps)
3. **Build:** Docusaurus site
4. **Deploy:** To Azure
5. **Configure:** Custom domain + Front Door
6. **Automate:** GitHub Actions CI/CD

**Total Time:**
- Approach A: 2-3 hours (one-time setup)
- Approach B: 4-6 hours (one-time setup)

After setup, deployments are automatic on git push.

---

**Created by:** Claude (Sonnet 4.5)
**Date:** 2025-11-07
**For:** Videxa Documentation Hosting
