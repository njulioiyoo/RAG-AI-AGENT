import { Router } from 'express';
import { RAGController } from '../controllers/ragController';

const router = Router();
const ragController = new RAGController();

// Initialize the RAG agent
ragController.initialize().catch(console.error);

// Health check endpoint
router.get('/health', (req, res) => ragController.health(req, res));

// Get knowledge base statistics
router.get('/stats', (req, res) => ragController.getStats(req, res));

// Query the RAG system
router.post('/query', (req, res) => ragController.query(req, res));

// Add a new document to the knowledge base
router.post('/documents', (req, res) => ragController.addDocument(req, res));

// Chat endpoint with memory
router.post('/chat', (req, res) => ragController.chat(req, res));

// Document ingestion endpoints
router.post('/ingest/markdown', (req, res) => ragController.ingestMarkdown(req, res));
router.post('/ingest/file', (req, res) => ragController.ingestFile(req, res));

// User memory management
router.get('/users/:userId/memory', (req, res) => ragController.getUserMemory(req, res));
router.put('/users/:userId/memory', (req, res) => ragController.updateUserMemory(req, res));

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'RAG AI Agent API',
    version: '1.0.0',
    description: 'Retrieval-Augmented Generation AI Agent using Mastra framework',
    endpoints: [
      {
        path: '/api/health',
        method: 'GET',
        description: 'Health check and service status'
      },
      {
        path: '/api/stats',
        method: 'GET',
        description: 'Get knowledge base statistics'
      },
      {
        path: '/api/query',
        method: 'POST',
        description: 'Query the RAG system',
        body: {
          query: 'string (required) - The question to ask',
          limit: 'number (optional) - Max number of relevant documents to retrieve (default: 5)',
          threshold: 'number (optional) - Similarity threshold (default: 0.3)'
        }
      },
      {
        path: '/api/documents',
        method: 'POST',
        description: 'Add a new document to the knowledge base',
        body: {
          title: 'string (required) - Document title',
          content: 'string (required) - Document content',
          metadata: 'object (optional) - Additional metadata'
        }
      },
      {
        path: '/api/chat',
        method: 'POST',
        description: 'Chat with the AI agent (with memory)',
        body: {
          userId: 'string (required) - User identifier',
          sessionId: 'string (required) - Session identifier',
          message: 'string (required) - User message',
          limit: 'number (optional) - Max number of documents to retrieve',
          threshold: 'number (optional) - Similarity threshold'
        }
      },
      {
        path: '/api/ingest/markdown',
        method: 'POST',
        description: 'Ingest markdown content with automatic chunking',
        body: {
          content: 'string (required) - Markdown content',
          filename: 'string (optional) - File name for metadata'
        }
      },
      {
        path: '/api/ingest/file',
        method: 'POST',
        description: 'Ingest markdown file from path',
        body: {
          filePath: 'string (required) - Path to markdown file'
        }
      },
      {
        path: '/api/users/:userId/memory',
        method: 'GET',
        description: 'Get user memory and preferences'
      },
      {
        path: '/api/users/:userId/memory',
        method: 'PUT',
        description: 'Update user memory and preferences',
        body: {
          profileData: 'object (optional) - User profile data',
          preferences: 'object (optional) - User preferences'
        }
      }
    ]
  });
});

export default router;