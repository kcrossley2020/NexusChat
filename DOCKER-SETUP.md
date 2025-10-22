# NexusChat Docker Setup for Videxa

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- At least one API key configured in `.env` (OpenAI, Anthropic, or Google)

### Step 1: Build the Docker Image

```bash
cd C:\videxa-repos\NexusChat

# Build the custom Videxa image
docker-compose -f docker-compose.videxa.yml build
```

This will create the image `nexuschat:videxa-latest` with all Videxa customizations baked in.

### Step 2: Start the Containers

```bash
# Start all services in detached mode
docker-compose -f docker-compose.videxa.yml up -d
```

This will start:
- `NexusChat-Videxa` - Main application (port 3080)
- `nexuschat-mongodb` - MongoDB database
- `nexuschat-meilisearch` - Search engine
- `nexuschat-vectordb` - PostgreSQL with pgvector
- `nexuschat-rag-api` - RAG API for document processing

### Step 3: Create First User

```bash
# Access the container
docker exec -it NexusChat-Videxa npm run create-user
```

Follow the prompts to create your admin user with @videxa.co email.

### Step 4: Access NexusChat

Open your browser to: **http://localhost:3080**

Login with the credentials you just created.

---

## Docker Commands

### View Running Containers
```bash
docker ps
```

### View Logs
```bash
# All services
docker-compose -f docker-compose.videxa.yml logs -f

# Specific service
docker logs -f NexusChat-Videxa
```

### Stop Containers
```bash
docker-compose -f docker-compose.videxa.yml down
```

### Stop and Remove All Data
```bash
# WARNING: This will delete all data!
docker-compose -f docker-compose.videxa.yml down -v
```

### Rebuild After Changes
```bash
# If you modified code/assets
docker-compose -f docker-compose.videxa.yml build --no-cache

# Then restart
docker-compose -f docker-compose.videxa.yml up -d
```

---

## Troubleshooting

### Container Won't Start

**Check logs:**
```bash
docker logs NexusChat-Videxa
```

**Common issues:**
1. Port 3080 already in use
2. Missing API keys in `.env`
3. MongoDB connection failed

### Reset Everything

```bash
# Stop and remove all containers and volumes
docker-compose -f docker-compose.videxa.yml down -v

# Remove images
docker rmi nexuschat:videxa-latest

# Rebuild from scratch
docker-compose -f docker-compose.videxa.yml build --no-cache
docker-compose -f docker-compose.videxa.yml up -d
```

### Database Issues

```bash
# Access MongoDB container
docker exec -it nexuschat-mongodb mongosh

# Inside mongo shell:
use NexChat
db.users.find()
exit
```

---

## Production Deployment

For production deployment to Azure:

1. **Push image to Azure Container Registry:**
   ```bash
   # Tag for ACR
   docker tag nexuschat:videxa-latest acrnexprd01.azurecr.io/nexuschat:latest

   # Login to ACR
   az acr login --name acrnexprd01

   # Push
   docker push acrnexprd01.azurecr.io/nexuschat:latest
   ```

2. **Use Azure Container Apps or AKS**
3. **Configure Azure CosmosDB (MongoDB API)**
4. **Set up SSL with Azure App Gateway or Let's Encrypt**
5. **Configure Azure Entra ID for SSO**

---

## Environment Variables

Key variables in `.env`:

```bash
# Server
HOST=localhost
PORT=3080

# Database
MONGO_URI=mongodb://mongodb:27017/NexChat

# AI Models (at least one required)
OPENAI_API_KEY=sk-proj-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
GOOGLE_KEY=xxxxx

# Search
MEILI_MASTER_KEY=your-master-key-here

# Optional: Production settings
DOMAIN_CLIENT=https://chat.videxa.ai
DOMAIN_SERVER=https://chat.videxa.ai
```

---

## Container Details

### NexusChat-Videxa (Main App)
- **Image**: `nexuschat:videxa-latest`
- **Port**: 3080
- **Volumes**: `.env`, `images/`, `uploads/`, `logs/`
- **Depends on**: mongodb, meilisearch, rag_api

### nexuschat-mongodb
- **Image**: `mongo:latest`
- **Internal Port**: 27017
- **Volume**: `./data-node`
- **Database**: NexChat

### nexuschat-meilisearch
- **Image**: `getmeili/meilisearch:v1.12.3`
- **Internal Port**: 7700
- **Volume**: `./meili_data_v1.12`

### nexuschat-vectordb
- **Image**: `pgvector/pgvector:0.8.0-pg15-trixie`
- **Internal Port**: 5432
- **Database**: nexuschat
- **User**: nexususer

### nexuschat-rag-api
- **Image**: `ghcr.io/danny-avila/librechat-rag-api-dev-lite:latest`
- **Port**: 8000
- **Purpose**: Document processing and RAG

---

## Health Checks

### Check if services are running:
```bash
# All containers should show "Up"
docker-compose -f docker-compose.videxa.yml ps

# Check specific service health
docker exec NexusChat-Videxa wget -q -O- http://localhost:3080 || echo "App not responding"
```

### Test MongoDB connection:
```bash
docker exec nexuschat-mongodb mongosh --eval "db.adminCommand('ping')"
```

### Test MeiliSearch:
```bash
docker exec nexuschat-meilisearch curl -s http://localhost:7700/health
```

---

## Backup and Restore

### Backup MongoDB:
```bash
docker exec nexuschat-mongodb mongodump --out=/data/backup
docker cp nexuschat-mongodb:/data/backup ./mongodb-backup
```

### Restore MongoDB:
```bash
docker cp ./mongodb-backup nexuschat-mongodb:/data/backup
docker exec nexuschat-mongodb mongorestore /data/backup
```

---

## Custom Image Contents

The `nexuschat:videxa-latest` image includes:

✅ Videxa logos (all sizes)
✅ Custom branding in HTML
✅ Videxa colors and theme
✅ librechat.yaml configuration
✅ Healthcare-specific settings
✅ All frontend assets compiled

---

**Last Updated**: October 22, 2025
**Videxa Version**: v1.0.0
