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

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your API keys
nano .env
```

**Required Environment Variables:**
```env
DATABASE_URL=postgresql://postgres:password123@postgres_master:5432/rag_ai_agent
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create new API key
3. Copy the key to `.env` file

### 3. Run with Docker

```bash
# Build and start the service
docker-compose up -d --build

# Check if running
curl http://localhost:3001/api/health
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

1. **Container won't start**: Check if PostgreSQL is running
2. **API errors**: Verify Gemini API key is correct
3. **Memory issues**: Ensure pgvector extension is installed
4. **Build failures**: Check Node.js version (requires v20+)

### Logs

```bash
# Check container logs
docker logs rag-ai-agent

# Follow logs in real-time  
docker logs -f rag-ai-agent
```

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