# Mastra RAG AI Agent - Employee Handbook Assistant

🚀 **Complete Mastra-powered Retrieval-Augmented Generation (RAG) AI Agent** with **Advanced Markdown Ingestion Pipeline** for Employee Handbook and HR assistance with conversational memory and vector search capabilities.

## ✨ Key Features - 100% Mastra Framework

### 🔧 **Core Technologies**
- **Framework**: Mastra AI Framework (`@mastra/core` + `@mastra/rag`)
- **LLM**: Google Gemini 2.5 Flash via Mastra Agent
- **Embeddings**: Google `text-embedding-004` via Mastra
- **Database**: PostgreSQL + pgvector for vector similarity search
- **Memory**: Conversation history and user preferences with Mastra patterns
- **Document Processing**: MDocument from `@mastra/rag` for chunking

### 🎯 **Advanced Capabilities**
1. **📥 Markdown Ingestion Pipeline** - Automatic parsing, intelligent chunking, and embedding generation
2. **🔍 Semantic Vector Search** - Find relevant information with similarity search
3. **💭 Conversational Memory** - Remember conversation context and user preferences  
4. **🤝 Context-Aware Responses** - Combine document retrieval with conversation history
5. **📄 Document Management** - Upload, processing, and chunking of HR policy documents
6. **🎯 Professional HR Assistant** - Specialized agent for employee handbook queries
7. **🌐 Multilingual Support** - Auto-detect query language and respond in the same language, with intelligent fallback for cross-language search

### Requirements
- Node.js 20+
- PostgreSQL with pgvector extension
- Google AI API Key (Gemini)

## 📦 Installation

```bash
# Clone repository
git clone <repository-url>
cd rag-ai-agent

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with database and API key configuration

# Setup database
npm run db:setup

# Build project
npm run build

# Start development server
npm run dev
```

### Environment Variables

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:password123@postgres_master:5432/rag_ai_agent"

# Google AI Configuration
GEMINI_API_KEY="your-google-ai-api-key"
GEMINI_MODEL="gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL="text-embedding-004"

# Server Configuration
PORT=3000
NODE_ENV=development
```

## 🛠️ API Endpoints

### Core Endpoints (100% Mastra)

#### **GET** `/api/health`
Mastra service health check and status
```json
{
  "status": "healthy",
  "service": "Mastra RAG AI Agent",
  "version": "2.0.0",
  "framework": "mastra"
}
```

#### **POST** `/api/query`
Simple RAG query using Mastra Agent with multilingual support
```json
{
  "query": "How many annual leave days am I entitled to?",
  "limit": 5,
  "threshold": 0.3
}
```

**Multilingual Support:**
- Queries in any language (Indonesian, English, etc.) are automatically detected
- Responses are provided in the same language as the query
- If documents are in a different language, the agent will translate and adapt the information
- Vector search with intelligent fallback for cross-language matching

#### **POST** `/api/chat`
Conversational chat with memory (Mastra-powered) and multilingual support
```json
{
  "userId": "emp-001",
  "sessionId": "chat-session-123",
  "message": "I've been working here for 3 years. How many leave days do I get?",
  "limit": 5,
  "threshold": 0.3
}
```

**Multilingual Chat:**
- Supports conversations in multiple languages
- Agent responds in the same language as the user's message
- Conversation history is maintained in the original language

### 📥 Advanced Markdown Ingestion Pipeline

#### **POST** `/api/documents/ingest-markdown`
**Automatic markdown parsing, chunking, and embedding generation**
```json
{
  "content": "# Employee Handbook\\n\\n## Leave Policy\\n* Annual leave: 12 days...",
  "filename": "employee-handbook.md"
}
```

**Response:**
```json
{
  "message": "Successfully ingested employee-handbook.md as 5 chunks",
  "documentsCreated": 5,
  "documentIds": [14, 15, 16, 17, 18],
  "framework": "mastra",
  "pipeline": "markdown-ingestion",
  "timestamp": "2025-11-18T13:13:53.908Z"
}
```

## 📚 Usage Examples

### 1. Simple Query (Multilingual)
```bash
# Query in Indonesian
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Berapa hari cuti tahunan yang saya dapatkan?",
    "limit": 3,
    "threshold": 0.4
  }'

# Query in English (will automatically find Indonesian documents)
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How many annual leave days am I entitled to?",
    "limit": 3,
    "threshold": 0.4
  }'
```

### 2. Chat with Memory (Multilingual)
```bash
# Chat in Indonesian
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "emp-001",
    "sessionId": "hr-session-123",
    "message": "Saya perlu cuti sakit besok. Apa yang harus saya lakukan?",
    "limit": 5
  }'

# Chat in English
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "emp-001",
    "sessionId": "hr-session-123",
    "message": "I need to take sick leave tomorrow. What should I do?",
    "limit": 5
  }'
```

### 3. Document Ingestion Pipeline
```bash
# Ingest markdown content with auto-chunking
curl -X POST http://localhost:3001/api/documents/ingest-markdown \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Employee Handbook\\n\\n## Leave Policy\\n* Annual leave: 12 days per year\\n* Sick leave: 5 days per year\\n\\n## Working Hours\\n* Standard hours: 09:00-17:00\\n* Flexible start time: ±1 hour",
    "filename": "employee-handbook.md"
  }'
```

## 🧪 Testing with Postman

Import the available collection: `Employee_Handbook_RAG.postman_collection.json`

### Collection Features:
- **System Health & Stats** - Health checks and Mastra statistics
- **📥 Markdown Ingestion Pipeline** - Auto-chunking and embedding generation
- **Mastra Document Management** - Add HR policy documents
- **Mastra RAG Queries** - Simple queries without memory
- **Mastra Conversational Chat** - Chat with context and memory
- **Test Examples** - Test cases for various scenarios

### Variables:
- `baseUrl`: `http://localhost:3001`
- `employeeId`: `emp-001` (test user)

## 🚨 Migration from Custom Services

This project has been **100% migrated to Mastra framework**, replacing all custom services:

### ✅ Completed
- ~~`src/services/ragAgent.ts`~~ → `MastraRAGService`
- ~~`src/services/vectorSearch.ts`~~ → Mastra vector search
- ~~`src/services/llm.ts`~~ → Mastra Agent with Gemini
- ~~`src/services/userMemory.ts`~~ → Mastra Memory management
- ~~`src/services/documentIngestion.ts`~~ → MDocument processing

### Benefits
- **Cleaner codebase** - Single framework, no duplication
- **Better performance** - Optimized Mastra patterns
- **Enhanced capabilities** - Full Mastra ecosystem support
- **Easier maintenance** - Unified architecture

## 🔧 Configuration

### Mastra Framework Settings
- **Agent Name**: `hr-assistant`
- **Model**: `gemini-2.5-flash`
- **Embedding Model**: `text-embedding-004`
- **Vector Dimension**: 768
- **Similarity Threshold**: 0.3 (default)

### Multilingual Features
- **Auto Language Detection**: Automatically detects language from user query
- **Response Language Matching**: Response in the same language as the query
- **Cross-Language Search**: Intelligent fallback for searching documents in different languages
  - Progressive threshold fallback (0.3 → 0.15 → 0.05 → 0.01 → 0)
  - Query translation fallback (English → Indonesian, etc.)
- **Supported Languages**: Indonesian, English, and other languages supported by Gemini

### Performance Settings
- **DB Connections**: 20 max (shared pool via Database singleton)
- **Request Timeout**: 30s
- **Vector Index**: ivfflat with cosine distance
- **Memory Limit**: 10 recent conversations per session
- **Multilingual Search**: Automatic threshold adjustment for cross-language matching

## 🌐 Multilingual Support

### How It Works

1. **Auto Language Detection**
   - Agent automatically detects the language from the user's query
   - No additional configuration required

2. **Response in User's Language**
   - Agent responds in the same language as the query
   - Example: Indonesian Query → Indonesian Response, English Query → English Response

3. **Cross-Language Document Search**
   - If documents are in a different language than the query, the system will:
     - Try progressively lower thresholds
     - Translate the query to the document's language if needed
     - Still provide the response in the query user's language

4. **Intelligent Fallback Strategy**
   ```
   Query (English) → Documents (Indonesian)
   ├─ Try threshold 0.3 → No results
   ├─ Try threshold 0.15 → No results  
   ├─ Try threshold 0.05 → No results
   ├─ Try threshold 0.01 → No results
   ├─ Translate query to Indonesian → Search with threshold 0
   └─ Found documents → Translate & respond in English
   ```

### Supported Languages

- **Indonesian** (Bahasa Indonesia)
- **English**
- **Other languages** supported by Google Gemini (100+ languages)

### Example Use Cases

```bash
# User asks in English, documents in Indonesian
POST /api/query
{
  "query": "How many annual leave days am I entitled to?"
}
# Response: "You are entitled to 12 paid annual leave days per year..."

# User asks in Indonesian, documents in Indonesian  
POST /api/query
{
  "query": "Berapa hari cuti tahunan yang saya dapatkan?"
}
# Response: "Anda berhak atas 12 hari cuti tahunan berbayar per tahun..."
```

## 🔒 Security

- **API Key Protection**: Environment variables only
- **Input Validation**: Comprehensive sanitization
- **SQL Injection Prevention**: Parameterized queries
- **Error Handling**: Structured error responses
- **Rate Limiting**: Configurable request limits

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/mastra-enhancement`)
3. Commit changes (`git commit -m 'Add Mastra feature'`)
4. Push to branch (`git push origin feature/mastra-enhancement`)
5. Open Pull Request

---

**Powered by Mastra AI Framework** 🤖

For more information about Mastra: [https://mastra.ai](https://mastra.ai)
