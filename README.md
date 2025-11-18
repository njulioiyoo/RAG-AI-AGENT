# Mastra RAG AI Agent - Employee Handbook Assistant

🚀 **Complete Mastra-powered Retrieval-Augmented Generation (RAG) AI Agent** dengan **Advanced Markdown Ingestion Pipeline** untuk Employee Handbook dan HR assistance dengan conversational memory dan vector search capabilities.

## ✨ Key Features - 100% Mastra Framework

### 🔧 **Core Technologies**
- **Framework**: Mastra AI Framework (`@mastra/core` + `@mastra/rag`)
- **LLM**: Google Gemini 2.5 Flash via Mastra Agent
- **Embeddings**: Google `text-embedding-004` via Mastra
- **Database**: PostgreSQL + pgvector untuk vector similarity search
- **Memory**: Conversation history dan user preferences dengan Mastra patterns
- **Document Processing**: MDocument dari `@mastra/rag` untuk chunking

### 🎯 **Advanced Capabilities**
1. **📥 Markdown Ingestion Pipeline** - Automatic parsing, intelligent chunking, dan embedding generation
2. **🔍 Semantic Vector Search** - Mencari informasi relevan dengan similarity search
3. **💭 Conversational Memory** - Mengingat context percakapan dan user preferences  
4. **🤝 Context-Aware Responses** - Menggabungkan document retrieval dengan conversation history
5. **📄 Document Management** - Upload, processing, dan chunking dokumen HR policies
6. **🎯 Professional HR Assistant** - Specialized agent untuk employee handbook queries
7. **🌐 Multilingual Support** - Auto-detect bahasa query dan response dalam bahasa yang sama, dengan intelligent fallback untuk cross-language search

- Node.js 20+
- PostgreSQL dengan pgvector extension
- Google AI API Key (Gemini)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd rag-ai-agent

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env dengan database dan API key configuration

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
Mastra service health check dan status
```json
{
  "status": "healthy",
  "service": "Mastra RAG AI Agent",
  "version": "2.0.0",
  "framework": "mastra"
}
```

#### **POST** `/api/query`
Simple RAG query menggunakan Mastra Agent dengan dukungan multibahasa
```json
{
  "query": "How many annual leave days am I entitled to?",
  "limit": 5,
  "threshold": 0.3
}
```

**Multilingual Support:**
- Query dalam bahasa apapun (Indonesia, English, dll) akan otomatis terdeteksi
- Response akan diberikan dalam bahasa yang sama dengan query
- Jika dokumen dalam bahasa berbeda, agent akan menerjemahkan dan mengadaptasi informasi
- Vector search dengan intelligent fallback untuk cross-language matching

#### **POST** `/api/chat`
Conversational chat dengan memory (Mastra-powered) dan dukungan multibahasa
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
- Mendukung percakapan dalam berbagai bahasa
- Agent akan merespons dalam bahasa yang sama dengan pesan user
- Conversation history dipertahankan dalam bahasa asli

### 📥 Advanced Markdown Ingestion Pipeline

#### **POST** `/api/documents/ingest-markdown`
**Automatic markdown parsing, chunking, dan embedding generation**
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
# Query dalam Bahasa Indonesia
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Berapa hari cuti tahunan yang saya dapatkan?",
    "limit": 3,
    "threshold": 0.4
  }'

# Query dalam English (akan otomatis menemukan dokumen Indonesia)
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
# Chat dalam Bahasa Indonesia
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "emp-001",
    "sessionId": "hr-session-123",
    "message": "Saya perlu cuti sakit besok. Apa yang harus saya lakukan?",
    "limit": 5
  }'

# Chat dalam English
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

## 🧪 Testing dengan Postman

Import collection yang tersedia: `Employee_Handbook_RAG.postman_collection.json`

### Collection Features:
- **System Health & Stats** - Health checks dan Mastra statistics
- **📥 Markdown Ingestion Pipeline** - Auto-chunking dan embedding generation
- **Mastra Document Management** - Add dokumen HR policies
- **Mastra RAG Queries** - Simple queries tanpa memory
- **Mastra Conversational Chat** - Chat dengan context dan memory
- **Test Examples** - Test cases untuk berbagai scenarios

### Variables:
- `baseUrl`: `http://localhost:3001`
- `employeeId`: `emp-001` (test user)

## 🚨 Migration dari Custom Services

Project ini telah **100% dimigrasi ke Mastra framework**, menggantikan semua custom services:

### ✅ Completed
- ~~`src/services/ragAgent.ts`~~ → `MastraRAGService`
- ~~`src/services/vectorSearch.ts`~~ → Mastra vector search
- ~~`src/services/llm.ts`~~ → Mastra Agent dengan Gemini
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
- **Auto Language Detection**: Otomatis mendeteksi bahasa dari query user
- **Response Language Matching**: Response dalam bahasa yang sama dengan query
- **Cross-Language Search**: Intelligent fallback untuk mencari dokumen dalam bahasa berbeda
  - Progressive threshold fallback (0.3 → 0.15 → 0.05 → 0.01 → 0)
  - Query translation fallback (English → Indonesian, dll)
- **Supported Languages**: Indonesian, English, dan bahasa lain yang didukung Gemini

### Performance Settings
- **DB Connections**: 20 max (shared pool via Database singleton)
- **Request Timeout**: 30s
- **Vector Index**: ivfflat dengan cosine distance
- **Memory Limit**: 10 recent conversations per session
- **Multilingual Search**: Automatic threshold adjustment untuk cross-language matching

## 🌐 Multilingual Support

### How It Works

1. **Auto Language Detection**
   - Agent secara otomatis mendeteksi bahasa dari query user
   - Tidak perlu konfigurasi tambahan

2. **Response in User's Language**
   - Agent akan merespons dalam bahasa yang sama dengan query
   - Contoh: Query Indonesia → Response Indonesia, Query English → Response English

3. **Cross-Language Document Search**
   - Jika dokumen dalam bahasa berbeda dengan query, sistem akan:
     - Mencoba dengan threshold yang lebih rendah secara progresif
     - Menerjemahkan query ke bahasa dokumen jika diperlukan
     - Tetap memberikan response dalam bahasa query user

4. **Intelligent Fallback Strategy**
   ```
   Query (English) → Dokumen (Indonesian)
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