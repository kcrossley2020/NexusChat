# NexusChat Windows 11 Docker Deployment Guide

This guide provides comprehensive instructions for deploying NexusChat (LibreChat v0.8.0) using Docker on Windows 11.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Installation Steps](#installation-steps)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Verification](#verification)
7. [Common Issues](#common-issues)
8. [Maintenance](#maintenance)

---

## Prerequisites

### Required Software

1. **Windows 11 Pro, Enterprise, or Education**
   - Windows 11 Home requires WSL2 backend (covered below)
   - 64-bit processor with Second Level Address Translation (SLAT)
   - Hardware virtualization support must be enabled in BIOS

2. **Docker Desktop for Windows**
   - Version: 4.x or later (latest recommended)
   - Download: https://www.docker.com/products/docker-desktop/
   - Docker Compose v2.x (included with Docker Desktop)

3. **WSL 2 (Windows Subsystem for Linux 2)**
   - Required for Docker Desktop on Windows 11
   - Ubuntu 20.04 or 22.04 recommended

4. **Git for Windows** (optional but recommended)
   - Download: https://git-scm.com/download/win
   - For cloning the repository

### Optional Software

- **Node.js 20.x** (only if building locally outside Docker)
- **Text editor** (VS Code, Notepad++, etc.)

---

## System Requirements

### Minimum Requirements
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 20 GB free space
- **Network**: Active internet connection

### Recommended Requirements
- **CPU**: 8 cores
- **RAM**: 16 GB or more
- **Storage**: 50 GB free space (SSD preferred)
- **Network**: Stable broadband connection

### Port Requirements
The following ports must be available:
- **3080** - LibreChat API/Frontend (default)
- **27017** - MongoDB (internal, can be changed)
- **7700** - MeiliSearch (internal, can be changed)
- **8000** - RAG API (internal, can be changed)

---

## Installation Steps

### Step 1: Enable WSL 2

1. Open PowerShell as Administrator and run:
```powershell
wsl --install
```

2. Restart your computer when prompted.

3. After restart, verify WSL 2 installation:
```powershell
wsl --list --verbose
```

4. Set WSL 2 as default:
```powershell
wsl --set-default-version 2
```

### Step 2: Install Docker Desktop

1. Download Docker Desktop from https://www.docker.com/products/docker-desktop/

2. Run the installer and follow the installation wizard.

3. During installation, ensure:
   - **Use WSL 2 instead of Hyper-V** is selected
   - **Add shortcut to desktop** (optional)

4. Restart your computer when installation completes.

5. Launch Docker Desktop and wait for it to start.

6. Verify installation by opening PowerShell or Command Prompt:
```powershell
docker --version
docker compose version
```

### Step 3: Configure Docker Desktop Settings

1. Open Docker Desktop

2. Go to **Settings** (gear icon) → **General**:
   - Enable **Use WSL 2 based engine**
   - Optionally enable **Start Docker Desktop when you log in**

3. Go to **Settings** → **Resources** → **WSL Integration**:
   - Enable integration with your WSL 2 distro (e.g., Ubuntu)

4. Go to **Settings** → **Resources** → **Advanced**:
   - **CPUs**: Allocate at least 4 (8 recommended)
   - **Memory**: Allocate at least 6 GB (12 GB recommended)
   - **Swap**: 2 GB minimum
   - **Disk image size**: 60 GB minimum

5. Click **Apply & Restart**

### Step 4: Clone or Copy the Repository

**Option A: Using Git (Recommended)**
```powershell
cd C:\videxa-repos
git clone <repository-url> NexusChat
cd NexusChat
```

**Option B: Manual Copy**
- Ensure all files are already in `C:\videxa-repos\NexusChat\`

### Step 5: Configure Environment Variables

1. Navigate to the project directory:
```powershell
cd C:\videxa-repos\NexusChat
```

2. Copy the example environment file:
```powershell
copy .env.example .env
```

3. Edit the `.env` file using your preferred text editor.

---

## Configuration

### Essential Environment Variables

Edit `C:\videxa-repos\NexusChat\.env` and configure the following:

#### 1. Server Configuration
```env
HOST=localhost
PORT=3080
DOMAIN_CLIENT=http://localhost:3080
DOMAIN_SERVER=http://localhost:3080
```

#### 2. Database Configuration
```env
MONGO_URI=mongodb://mongodb:27017/LibreChat
```
**Note**: Use the service name `mongodb` (not `127.0.0.1`) for Docker networking.

#### 3. User Permissions (Windows-specific)
```env
# UID=1000
# GID=1000
```
**Important for Windows**: Comment out or remove `UID` and `GID` variables as they are Linux-specific. Windows uses different permission models.

#### 4. Security Keys (REQUIRED - Generate New Values)
```env
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CREDS_KEY=your_generated_32_byte_hex_key
CREDS_IV=your_generated_16_byte_hex_key
JWT_SECRET=your_generated_jwt_secret
JWT_REFRESH_SECRET=your_generated_refresh_secret
MEILI_MASTER_KEY=your_generated_meili_key
```

**To generate secure keys in PowerShell:**
```powershell
# Run Node.js to generate keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

#### 5. AI Provider API Keys
Configure at least one AI provider:

```env
# OpenAI
OPENAI_API_KEY=user_provided

# Anthropic (Claude)
ANTHROPIC_API_KEY=user_provided

# Google (Gemini)
GOOGLE_KEY=user_provided
```

#### 6. Optional Features
```env
# Search
SEARCH=true
MEILI_HOST=http://meilisearch:7700

# User Registration
ALLOW_EMAIL_LOGIN=true
ALLOW_REGISTRATION=true

# Debug
DEBUG_LOGGING=true
```

### Docker Compose Configuration

The default `docker-compose.yml` should work on Windows, but verify:

#### Windows-Specific Adjustments

1. **Remove or comment out UID/GID from docker-compose.yml**:

Edit `docker-compose.yml` and comment out:
```yaml
services:
  api:
    # user: "${UID}:${GID}"  # Comment this line for Windows
```

Do the same for `mongodb` and `meilisearch` services.

2. **Volume Path Format**:

Windows Docker Desktop handles path conversion automatically, so keep paths as-is:
```yaml
volumes:
  - ./images:/app/client/public/images
  - ./uploads:/app/uploads
  - ./logs:/app/logs
```

### Optional: Custom Configuration File

If using `librechat.yaml` for advanced configuration:

1. Copy the example:
```powershell
copy librechat.example.yaml librechat.yaml
```

2. Edit as needed.

3. Create `docker-compose.override.yml`:
```powershell
copy docker-compose.override.yml.example docker-compose.override.yml
```

4. Edit and uncomment the config file section:
```yaml
services:
  api:
    volumes:
    - type: bind
      source: ./librechat.yaml
      target: /app/librechat.yaml
```

---

## Deployment

### First-Time Deployment

1. **Open PowerShell or Windows Terminal** in the project directory:
```powershell
cd C:\videxa-repos\NexusChat
```

2. **Pull the Docker images**:
```powershell
docker compose pull
```

3. **Build and start the containers**:
```powershell
docker compose up -d
```

The `-d` flag runs containers in detached mode (background).

4. **Monitor startup logs**:
```powershell
docker compose logs -f
```

Press `Ctrl+C` to stop following logs.

### Deployment Options

#### Option 1: Use Pre-built Images (Default)
The default `docker-compose.yml` uses pre-built images from GitHub Container Registry:
```yaml
image: ghcr.io/danny-avila/librechat-dev:latest
```

#### Option 2: Build Locally
To build from source:

1. Edit `docker-compose.override.yml`:
```yaml
services:
  api:
    image: librechat
    build:
      context: .
      target: node
```

2. Build and start:
```powershell
docker compose build
docker compose up -d
```

---

## Verification

### Check Running Containers
```powershell
docker compose ps
```

Expected output should show 4 containers running:
- `LibreChat` (api)
- `chat-mongodb`
- `chat-meilisearch`
- `rag_api`
- `vectordb`

### Check Container Logs
```powershell
# All services
docker compose logs

# Specific service
docker compose logs api
docker compose logs mongodb

# Follow logs in real-time
docker compose logs -f api
```

### Access the Application

1. Open your web browser
2. Navigate to: http://localhost:3080
3. You should see the LibreChat login/registration page

### Create First User Account

1. Click **Sign Up** (if registration is enabled)
2. Enter email and password
3. Complete registration

**Or create user via CLI**:
```powershell
docker compose exec api npm run create-user
```

---

## Common Issues

### Issue 1: Port Already in Use

**Error**: `Bind for 0.0.0.0:3080 failed: port is already allocated`

**Solution**:
1. Find process using port 3080:
```powershell
netstat -ano | findstr :3080
```
2. Kill the process or change PORT in `.env` file

### Issue 2: WSL 2 Not Enabled

**Error**: `WSL 2 installation is incomplete`

**Solution**:
1. Open PowerShell as Administrator
2. Run:
```powershell
wsl --install
wsl --set-default-version 2
```
3. Restart computer

### Issue 3: Docker Daemon Not Running

**Error**: `Cannot connect to Docker daemon`

**Solution**:
1. Open Docker Desktop
2. Wait for Docker to fully start (whale icon should be static)
3. Retry deployment commands

### Issue 4: Permission Errors on Volumes

**Error**: `Permission denied` when writing to volumes

**Solution**:
1. Remove `UID` and `GID` from `.env` file
2. Remove or comment `user:` directives from `docker-compose.yml`
3. Recreate containers:
```powershell
docker compose down
docker compose up -d
```

### Issue 5: MongoDB Connection Failed

**Error**: `MongoNetworkError: failed to connect to server`

**Solution**:
1. Check MongoDB is running:
```powershell
docker compose ps mongodb
```
2. Check logs:
```powershell
docker compose logs mongodb
```
3. Ensure `MONGO_URI` uses service name:
```env
MONGO_URI=mongodb://mongodb:27017/LibreChat
```

### Issue 6: Out of Memory

**Error**: Container crashes or build fails with memory errors

**Solution**:
1. Increase Docker memory allocation:
   - Docker Desktop → Settings → Resources → Advanced
   - Set Memory to at least 8 GB
2. Restart Docker Desktop

### Issue 7: Slow Build Times

**Issue**: Docker build takes very long on Windows

**Solution**:
1. Use pre-built images instead of building locally
2. Ensure WSL 2 is being used (not Hyper-V)
3. Store project files in WSL filesystem for better performance:
   - Move to `/home/user/NexusChat` in WSL
   - Access via `\\wsl$\Ubuntu\home\user\NexusChat` in Windows Explorer

---

## Maintenance

### Updating NexusChat

1. **Stop containers**:
```powershell
docker compose down
```

2. **Pull latest changes** (if using Git):
```powershell
git pull origin main
```

3. **Pull latest Docker images**:
```powershell
docker compose pull
```

4. **Restart containers**:
```powershell
docker compose up -d
```

### Backing Up Data

#### Backup MongoDB
```powershell
# Create backup directory
mkdir backups

# Backup MongoDB database
docker compose exec mongodb mongodump --out /data/backup
docker compose cp mongodb:/data/backup ./backups/mongodb-backup
```

#### Backup Volumes
```powershell
# Backup uploads, images, and logs
xcopy /E /I /Y uploads backups\uploads
xcopy /E /I /Y images backups\images
xcopy /E /I /Y logs backups\logs
```

#### Backup MeiliSearch Data
```powershell
# Stop containers first
docker compose down

# Copy MeiliSearch data
xcopy /E /I /Y meili_data_v1.12 backups\meili_data_v1.12

# Restart
docker compose up -d
```

### Viewing Logs

```powershell
# All services
docker compose logs

# Last 100 lines
docker compose logs --tail=100

# Follow logs
docker compose logs -f

# Specific service
docker compose logs api
docker compose logs mongodb
```

### Restarting Services

```powershell
# Restart all services
docker compose restart

# Restart specific service
docker compose restart api
docker compose restart mongodb
```

### Stopping and Removing Containers

```powershell
# Stop containers (keeps data)
docker compose stop

# Stop and remove containers (keeps volumes/data)
docker compose down

# Stop, remove containers AND volumes (DELETES ALL DATA)
docker compose down -v
```

### Accessing Container Shell

```powershell
# Access API container shell
docker compose exec api sh

# Access MongoDB shell
docker compose exec mongodb mongosh
```

### Monitoring Resources

```powershell
# View resource usage
docker stats

# View disk usage
docker system df
```

### Cleaning Up

```powershell
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

**Warning**: The last command will delete all unused Docker data.

---

## Advanced Configuration

### Using Custom Domain

1. Edit `.env`:
```env
DOMAIN_CLIENT=http://nexuschat.yourdomain.com
DOMAIN_SERVER=http://nexuschat.yourdomain.com
```

2. Configure reverse proxy (nginx, Caddy, etc.) on host machine

### Enabling HTTPS

For production deployments with HTTPS:

1. Use a reverse proxy (nginx/Caddy) on the host
2. Configure SSL certificates (Let's Encrypt recommended)
3. Update `.env` domains to use `https://`

### Scaling Services

For high-traffic deployments:

1. Create `docker-compose.override.yml`
2. Add replica configuration:
```yaml
services:
  api:
    deploy:
      replicas: 3
```

### Using External MongoDB

1. Edit `.env`:
```env
MONGO_URI=mongodb://your-external-mongo:27017/LibreChat
```

2. Edit `docker-compose.override.yml`:
```yaml
services:
  mongodb:
    image: tianon/true
    command: ""
    entrypoint: ""
```

---

## Security Recommendations

1. **Change all default secrets** in `.env` file
2. **Use strong passwords** for MongoDB if exposing ports
3. **Don't expose database ports** to the internet
4. **Enable HTTPS** for production deployments
5. **Regular backups** of data volumes
6. **Keep Docker Desktop updated**
7. **Monitor logs** for suspicious activity
8. **Disable registration** after creating admin accounts (if desired):
   ```env
   ALLOW_REGISTRATION=false
   ```

---

## Performance Optimization

### Windows-Specific Tips

1. **Use WSL 2 filesystem**: Store project in WSL for 2-3x better performance
   ```bash
   # In WSL terminal
   cd ~
   git clone <repo> NexusChat
   ```
   Access from Windows: `\\wsl$\Ubuntu\home\username\NexusChat`

2. **Allocate sufficient resources** in Docker Desktop settings

3. **Disable Windows Defender scanning** for Docker volumes:
   - Add exclusions for `%PROGRAMDATA%\Docker`
   - Add exclusions for WSL distro VHD files

4. **Use SSD storage** for better I/O performance

5. **Close unnecessary applications** during build

---

## Troubleshooting Commands

```powershell
# Check Docker version
docker --version
docker compose version

# Check WSL version
wsl --list --verbose

# Check Docker service status
docker info

# View all containers (including stopped)
docker compose ps -a

# View container resource usage
docker stats

# Inspect container details
docker inspect LibreChat

# Check network connectivity between containers
docker compose exec api ping mongodb

# Reset everything (CAUTION: Deletes all data)
docker compose down -v
docker system prune -a --volumes
```

---

## Support and Resources

- **Official Documentation**: https://docs.librechat.ai/
- **Docker Documentation**: https://docs.docker.com/desktop/windows/
- **WSL Documentation**: https://docs.microsoft.com/en-us/windows/wsl/
- **GitHub Issues**: https://github.com/danny-avila/LibreChat/issues
- **Discord Community**: https://discord.librechat.ai

---

## Summary Checklist

- [ ] Windows 11 with WSL 2 enabled
- [ ] Docker Desktop installed and running
- [ ] Repository cloned/copied to `C:\videxa-repos\NexusChat`
- [ ] `.env` file created and configured
- [ ] Security keys generated and set
- [ ] AI provider API keys configured
- [ ] UID/GID removed from Windows deployment
- [ ] Docker resources allocated (8GB+ RAM, 4+ CPUs)
- [ ] Ports 3080, 27017, 7700 available
- [ ] Containers deployed with `docker compose up -d`
- [ ] Application accessible at http://localhost:3080
- [ ] First user account created
- [ ] Backup strategy in place

---

**Document Version**: 1.0
**Last Updated**: 2025-01-18
**Compatible with**: NexusChat v0.8.0 (LibreChat)
