# RAG AI Agent

A Retrieval-Augmented Generation AI Agent built with Node.js, TypeScript, Mastra AI framework, PostgreSQL with pgvector, and Google Gemini AI.

## Features

- 🤖 **AI Agent with Memory**: User-specific conversation history and context
- 📚 **Document Ingestion**: Markdown file processing with automatic chunking
- 🔍 **Vector Search**: PostgreSQL with pgvector for similarity search
- 💬 **Chat Interface**: Memory-aware conversations with context retention
- 🔧 **REST API**: Complete API for all functionality
- 🐳 **Docker Ready**: Containerized deployment

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **AI Framework**: Mastra AI
- **LLM**: Google Gemini 2.5 Flash
- **Embeddings**: Gemini text-embedding-004
- **Database**: PostgreSQL + pgvector extension
- **Containerization**: Docker + Docker Compose

## Quick Start

### 1. Prerequisites

**System Requirements:**
- Docker & Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL with pgvector extension (provided via Docker)
- Google Gemini API key

**Hardware Requirements:**
- Minimum: 2GB RAM, 1 CPU core
- Recommended: 4GB RAM, 2+ CPU cores
- Storage: 1GB+ available space

### 2. Environment Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd rag-ai-agent

# Copy environment template
cp .env.example .env

# Edit .env file with your API keys
nano .env
```

**Required Environment Variables:**
```env
# Database (use existing PostgreSQL or configure new one)
DATABASE_URL=postgresql://postgres:password123@postgres_master:5432/rag_ai_agent

# Gemini AI API key (required)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional configurations
NODE_ENV=production
PORT=3000
VECTOR_DIMENSION=768
SIMILARITY_THRESHOLD=0.3
```

### 3. Get Gemini API Key

**Step-by-step guide:**

1. **Visit Google AI Studio**
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Sign in with your Google account

2. **Create API Key**
   - Click "Create API Key"
   - Choose project or create new one
   - Copy the generated key (starts with `AIza...`)

3. **Configure API Key**
   ```bash
   # Add to .env file
   echo "GEMINI_API_KEY=AIzaSyBQE1llABMm-your-actual-key-here" >> .env
   ```

### 4. Database Setup

**Option A: Use Existing PostgreSQL (Recommended)**
```bash
# If you have PostgreSQL running with pgvector
# Update DATABASE_URL in .env to point to your database
```

**Option B: Setup New PostgreSQL with pgvector**
```bash
# This will be handled by Docker Compose
# Make sure port 5432 is available or change the port
```

### 5. Build and Deploy

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f rag-ai-agent

# Check service health
curl http://localhost:3001/api/health
```

**Expected Output:**
```json
{
  "status": "healthy",
  "service": "RAG AI Agent",
  "database": "connected",
  "knowledgeBase": {
    "documentsCount": 0,
    "categories": []
  }
}
```

### 4. Test the API

Import the Postman collection: `RAG_AI_Agent_API.postman_collection.json`

Or test manually:

```bash
# Add a document
curl -X POST http://localhost:3001/api/ingest/markdown \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# PostgreSQL Guide\n\nPostgreSQL is a powerful database...",
    "filename": "postgres-guide.md"
  }'

# Chat with the agent
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "sessionId": "session456", 
    "message": "What is PostgreSQL?"
  }'
```

## API Endpoints

### Core Features
- `POST /api/chat` - Chat with memory-aware AI agent
- `POST /api/query` - Simple RAG query without memory
- `POST /api/ingest/markdown` - Ingest Markdown content with chunking
- `POST /api/documents` - Add single document to knowledge base

### User Memory
- `GET /api/users/:userId/memory` - Get user memory profile
- `PUT /api/users/:userId/memory` - Update user preferences

### System
- `GET /api/health` - Health check
- `GET /api/stats` - Knowledge base statistics  
- `GET /api/docs` - API documentation

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   RAG Agent     │    │   PostgreSQL    │
│                 │────│                 │────│   + pgvector    │
│  (Postman/UI)   │    │  Mastra + AI    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   Gemini AI     │
                       │  (Embeddings +  │
                       │   Generation)   │
                       └─────────────────┘
```

## Key Components

### 1. RAG Agent (`src/services/ragAgent.ts`)
- Orchestrates document retrieval and response generation
- Integrates user memory and conversation context
- Uses Mastra AI framework for agent functionality

### 2. User Memory (`src/services/userMemory.ts`)
- Stores conversation history with embeddings
- User profiles and preferences management
- Cross-session memory search using vector similarity

### 3. Document Ingestion (`src/services/documentIngestion.ts`)
- Markdown parsing with frontmatter support
- Automatic text chunking with overlap
- Metadata extraction and storage

### 4. Vector Search (`src/services/vectorSearch.ts`)
- PostgreSQL + pgvector integration
- Cosine similarity search for document retrieval
- Embedding generation and storage

## Memory System

The AI agent has sophisticated memory capabilities:

- **Session Memory**: Recent conversation in current session
- **Cross-Session Memory**: Relevant discussions from past sessions
- **User Profiles**: Stored preferences and context
- **Vector-based Retrieval**: Semantic search across conversation history

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

### Project Structure

```
src/
├── controllers/     # API route handlers
├── services/        # Core business logic
│   ├── ragAgent.ts           # Main RAG orchestrator
│   ├── userMemory.ts         # Memory management
│   ├── vectorSearch.ts       # Document search
│   ├── documentIngestion.ts  # Document processing
│   └── llm.ts               # Gemini AI integration
├── types/          # TypeScript type definitions
├── config/         # Database configuration
└── routes/         # API route definitions
```

## Security Notes

⚠️ **Important**: 
- Never commit `.env` files to git
- API keys are stored in environment variables only
- Use `.env.example` as template for new deployments

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Error**: `Database connection failed`
```bash
# Check PostgreSQL status
docker ps | grep postgres

# Test database connection manually
psql -h localhost -p 5432 -U postgres -d rag_ai_agent

# Check logs for specific errors
docker logs rag-ai-agent | grep -i database
```

**Solutions**:
- Ensure PostgreSQL is running and accessible
- Verify DATABASE_URL format: `postgresql://username:password@host:port/database`
- Check firewall/network connectivity
- Confirm database exists and user has permissions

#### 2. pgvector Extension Issues

**Error**: `pgvector extension is not available`
```bash
# Connect to database and check extensions
psql -h localhost -p 5432 -U postgres -c "SELECT * FROM pg_extension;"

# Try to install manually
psql -h localhost -p 5432 -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Solutions**:
- Install pgvector: https://github.com/pgvector/pgvector#installation
- Use PostgreSQL image with pgvector pre-installed
- Check if user has CREATE privilege

#### 3. Gemini API Key Errors

**Error**: `Invalid Gemini API key`
```bash
# Test API key manually
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_KEY"
```

**Solutions**:
- Verify key format starts with `AIza`
- Check Google Cloud Console for API quotas
- Ensure Gemini API is enabled in your project
- Try regenerating the API key

#### 4. Memory/Performance Issues

**Error**: Container crashes or high memory usage
```bash
# Check container resource usage
docker stats rag-ai-agent

# Adjust memory limits in docker-compose.yml
services:
  rag-ai-agent:
    deploy:
      resources:
        limits:
          memory: 2G
```

**Solutions**:
- Increase Docker memory allocation
- Reduce vector dimension if needed
- Limit concurrent requests
- Monitor database connection pool

#### 5. Port Conflicts

**Error**: `Port 3001 already in use`
```bash
# Check what's using the port
lsof -i :3001
netstat -tlnp | grep :3001

# Change port in docker-compose.yml
ports:
  - "3002:3000"  # Use different external port
```

### Detailed Error Analysis

#### View Application Logs
```bash
# Real-time logs
docker logs -f rag-ai-agent

# Last 100 lines
docker logs --tail 100 rag-ai-agent

# Filter for errors
docker logs rag-ai-agent 2>&1 | grep -i error
```

#### Check Database Status
```bash
# Database connection test
docker exec rag-ai-agent node -e "
const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect()
  .then(() => console.log('✅ Connected'))
  .catch(err => console.log('❌ Error:', err.message));
"
```

#### Verify Environment Variables
```bash
# Check loaded environment in container
docker exec rag-ai-agent printenv | grep -E "(DATABASE|GEMINI|NODE_ENV)"
```

### Performance Optimization

#### Database Optimization
```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_conversation_user_session 
ON conversation_history(user_id, session_id);

CREATE INDEX CONCURRENTLY idx_documents_metadata 
ON rag_documents USING GIN(metadata);

-- Analyze tables for query optimization
ANALYZE rag_documents;
ANALYZE conversation_history;
```

#### Application Tuning
```bash
# Adjust environment variables for better performance
NODE_ENV=production
DB_MAX_CONNECTIONS=20
REQUEST_TIMEOUT=30000
SIMILARITY_THRESHOLD=0.5  # Higher = more selective
```

### Health Check Commands

```bash
# Quick health check
curl -f http://localhost:3001/api/health || echo "Service unhealthy"

# Comprehensive system check
curl -s http://localhost:3001/api/health | jq '.'
curl -s http://localhost:3001/api/stats | jq '.'

# Test chat functionality
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","sessionId":"test","message":"Hello"}'
```

### Getting Help

If you encounter issues not covered here:

1. **Check GitHub Issues**: Search existing issues for similar problems
2. **Enable Debug Logging**: Set `LOG_LEVEL=debug` in environment
3. **Collect Information**:
   - Docker version: `docker --version`
   - Container logs: `docker logs rag-ai-agent`
   - System resources: `docker stats`
   - Database status: Connection test results

4. **Create Support Request** with:
   - Error messages and logs
   - Environment configuration (without sensitive data)
   - Steps to reproduce the issue

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License.

---

Built with ❤️ using Mastra AI, Google Gemini, and PostgreSQL.