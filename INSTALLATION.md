# RAG AI Agent - Installation Guide

Complete step-by-step guide for installing and configuring the RAG AI Agent.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Testing Installation](#testing-installation)
6. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **OS**: Linux, macOS, or Windows with WSL2
- **Memory**: 2GB RAM
- **CPU**: 1 core
- **Storage**: 1GB free space
- **Docker**: Version 20.10+
- **Docker Compose**: Version 1.29+

### Recommended Requirements
- **OS**: Linux (Ubuntu 20.04+) or macOS
- **Memory**: 4GB+ RAM
- **CPU**: 2+ cores
- **Storage**: 5GB+ free space
- **Network**: Stable internet connection for AI API calls

### Software Dependencies
- Docker & Docker Compose
- Git (for cloning repository)
- curl (for testing)
- jq (optional, for JSON formatting)

## Installation Methods

### Method 1: Docker Compose (Recommended)

This method uses Docker Compose to run the entire stack.

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/rag-ai-agent.git
cd rag-ai-agent

# 2. Copy environment template
cp .env.example .env

# 3. Configure environment (see Configuration section)
nano .env

# 4. Start the services
docker-compose up -d --build

# 5. Verify installation
curl http://localhost:3001/api/health
```

### Method 2: Local Development Setup

For development or when you want to run parts locally.

```bash
# 1. Clone and setup
git clone https://github.com/your-repo/rag-ai-agent.git
cd rag-ai-agent

# 2. Install Node.js dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 4. Start PostgreSQL (if not running)
# Option A: Use Docker
docker run --name postgres-rag \
  -e POSTGRES_DB=rag_ai_agent \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password123 \
  -p 5432:5432 \
  -d pgvector/pgvector:pg16

# Option B: Use existing PostgreSQL with pgvector

# 5. Build the application
npm run build

# 6. Start the application
npm start
```

## Configuration

### Environment Variables

Create and configure your `.env` file:

```bash
# Copy template
cp .env.example .env
```

**Required Configuration:**

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:password123@localhost:5432/rag_ai_agent

# Gemini AI Configuration (REQUIRED)
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Application Configuration
NODE_ENV=production
PORT=3000

# Vector Search Configuration
VECTOR_DIMENSION=768
SIMILARITY_THRESHOLD=0.3
```

**Optional Configuration:**

```env
# Advanced Database Settings
DB_MAX_CONNECTIONS=20
DB_TIMEOUT=30000
DB_SSL=false

# Performance Tuning
REQUEST_LIMIT=10mb
REQUEST_TIMEOUT=30000
MAX_SEARCH_RESULTS=10

# Logging
LOG_LEVEL=info
LOG_CONSOLE=true
LOG_FILE=false

# Security
CORS_ORIGINS=*
```

### Getting Gemini API Key

1. **Visit Google AI Studio**
   ```
   https://aistudio.google.com/app/apikey
   ```

2. **Create API Key**
   - Sign in with Google account
   - Click "Create API Key"
   - Select or create a project
   - Copy the generated key (starts with `AIza`)

3. **Test API Key**
   ```bash
   curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello, world!"}]}]}' \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY"
   ```

4. **Add to Environment**
   ```bash
   echo "GEMINI_API_KEY=AIzaSyBQE1llABMm-your-key-here" >> .env
   ```

## Database Setup

### Option 1: Use Docker PostgreSQL with pgvector

The easiest method for development and testing.

```bash
# Start PostgreSQL with pgvector
docker run --name rag-postgres \
  -e POSTGRES_DB=rag_ai_agent \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password123 \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  -d pgvector/pgvector:pg16

# Test connection
psql -h localhost -p 5432 -U postgres -d rag_ai_agent -c "SELECT version();"
```

### Option 2: Use Existing PostgreSQL

If you have PostgreSQL running, install pgvector extension.

```bash
# Install pgvector (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql-16-pgvector

# Or compile from source
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Create database and enable extension
createdb rag_ai_agent
psql -d rag_ai_agent -c "CREATE EXTENSION vector;"
```

### Option 3: Use Managed Database

For production, use managed PostgreSQL with pgvector support:

- **AWS RDS**: Use PostgreSQL with pgvector extension
- **Google Cloud SQL**: PostgreSQL with vector support
- **Azure Database**: PostgreSQL with pgvector
- **Supabase**: Built-in pgvector support
- **Neon**: PostgreSQL with pgvector

```bash
# Configure for managed database
DATABASE_URL=postgresql://username:password@your-host:5432/rag_ai_agent?sslmode=require
DB_SSL=true
```

### Database Schema Initialization

The application automatically creates required tables on startup:

- `rag_documents` - Document storage with vector embeddings
- `conversation_history` - User conversation memory
- `user_profiles` - User preferences and profiles

To manually initialize:

```sql
-- Connect to database
psql -d rag_ai_agent

-- Create extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Tables are created automatically by the application
-- Check if tables exist
\dt
```

## Testing Installation

### 1. Health Check

```bash
# Basic health check
curl http://localhost:3001/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "RAG AI Agent",
  "version": "1.0.0",
  "database": "connected",
  "knowledgeBase": {
    "documentsCount": 0,
    "categories": []
  }
}
```

### 2. Database Connectivity

```bash
# Test database connection
curl http://localhost:3001/api/stats

# Check specific database status
docker exec rag-ai-agent node -e "
const db = require('./dist/config/database.js').default;
db.testConnection().then(result => 
  console.log('Database test:', result ? 'PASS' : 'FAIL')
).catch(console.error);
"
```

### 3. AI API Testing

```bash
# Test document ingestion
curl -X POST http://localhost:3001/api/ingest/markdown \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Test Document\nThis is a test document for the RAG system.",
    "filename": "test.md"
  }'

# Test chat functionality
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "sessionId": "test-session",
    "message": "Hello, can you help me?"
  }'
```

### 4. Import Postman Collection

```bash
# Download and import the collection
# File: RAG_AI_Agent_API.postman_collection.json

# Set environment variables in Postman:
# - baseUrl: http://localhost:3001
# - userId: test-user
# - sessionId: test-session
```

## Troubleshooting

### Common Installation Issues

#### Docker Build Fails

```bash
# Check Docker version
docker --version
docker-compose --version

# Clear Docker cache
docker system prune -a

# Check available space
df -h

# Rebuild with verbose output
docker-compose build --no-cache --progress=plain
```

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check network connectivity
docker network ls
docker network inspect rag-ai-agent_default

# Test connection manually
psql -h localhost -p 5432 -U postgres -d rag_ai_agent
```

#### API Key Issues

```bash
# Validate API key format
echo $GEMINI_API_KEY | grep -E '^AIza[a-zA-Z0-9_-]{35}$'

# Test API key directly
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=$GEMINI_API_KEY"
```

#### Memory Issues

```bash
# Check available memory
free -h

# Monitor Docker resource usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Go to Settings > Resources > Memory > Increase limit
```

### Logs and Debugging

```bash
# View application logs
docker-compose logs rag-ai-agent

# Follow logs in real-time
docker-compose logs -f rag-ai-agent

# View specific service logs
docker logs rag-ai-agent

# Enable debug logging
echo "LOG_LEVEL=debug" >> .env
docker-compose restart rag-ai-agent
```

### Performance Tuning

```bash
# Optimize database connections
echo "DB_MAX_CONNECTIONS=10" >> .env

# Adjust memory usage
echo "NODE_OPTIONS=--max-old-space-size=1024" >> .env

# Enable production optimizations
echo "NODE_ENV=production" >> .env
```

## Next Steps

After successful installation:

1. **Import Sample Data**
   ```bash
   curl -X POST http://localhost:3001/api/ingest/markdown \
     -H "Content-Type: application/json" \
     -d @sample-documents.json
   ```

2. **Setup Monitoring** (Optional)
   - Configure log aggregation
   - Setup health check monitoring
   - Configure backup for database

3. **Security Hardening**
   - Change default passwords
   - Configure proper SSL/TLS
   - Setup firewall rules
   - Regular security updates

4. **Scaling Considerations**
   - Database connection pooling
   - Load balancing
   - Caching strategies
   - Horizontal scaling

For production deployment, refer to the [Production Guide](PRODUCTION.md).

---

**Need Help?**
- Check [Troubleshooting Guide](README.md#troubleshooting)
- Open an issue on GitHub
- Check existing documentation