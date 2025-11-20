import { Router, Request, Response, NextFunction } from 'express';
import { RAGController } from '../controllers/ragController.js';

const router = Router();
const ragController = new RAGController();

// Store initialization promise to check status
let initializationPromise: Promise<void> | null = null;
let isInitialized = false;

// Initialize the RAG agent
const initializeController = async () => {
  try {
    await ragController.initialize();
    isInitialized = true;
    console.log('✅ Mastra RAG Controller fully initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Mastra RAG Controller:', error);
    throw error;
  }
};

initializationPromise = initializeController();

// Middleware to ensure controller is initialized
const ensureInitialized = async (req: Request, res: Response, next: NextFunction) => {
  if (!isInitialized && initializationPromise) {
    try {
      await initializationPromise;
    } catch (error) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'RAG service is still initializing or failed to initialize'
      });
    }
  }
  next();
};

// Health check endpoint
router.get('/health', (req, res) => {
  ragController.health(req, res);
});

// Apply initialization middleware to all endpoints that need it
router.use('/stats', ensureInitialized);
router.use('/query', ensureInitialized);
router.use('/chat', ensureInitialized);
router.use('/documents', ensureInitialized);

// Get knowledge base statistics
router.get('/stats', (req, res) => {
  ragController.getStats(req, res);
});

// Core Mastra-powered endpoints
router.post('/query', (req, res) => {
  ragController.query(req, res);
});

router.post('/chat', (req, res) => {
  ragController.chat(req, res);
});

router.post('/documents', (req, res) => {
  ragController.addDocument(req, res);
});

// Document ingestion endpoints
router.post('/documents/ingest-markdown', (req, res) => {
  ragController.ingestMarkdown(req, res);
});

router.post('/documents/ingest-file', (req, res) => {
  ragController.ingestMarkdownFile(req, res);
});

// PDF ingestion endpoints
router.post('/documents/ingest-pdf', (req, res) => {
  ragController.ingestPdf(req, res);
});

router.post('/documents/ingest-pdf-file', (req, res) => {
  ragController.ingestPdfFile(req, res);
});

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'Mastra RAG AI Agent API',
    version: '2.0.0',
    description: 'Retrieval-Augmented Generation AI Agent powered by Mastra framework',
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
        description: 'Query the Mastra-powered RAG system',
        body: {
          query: 'string (required) - The question to ask',
          limit: 'number (optional) - Max number of relevant documents to retrieve (default: 5)',
          threshold: 'number (optional) - Similarity threshold (default: 0.3)'
        }
      },
      {
        path: '/api/documents',
        method: 'POST',
        description: 'Add a new document to the knowledge base using Mastra',
        body: {
          title: 'string (required) - Document title',
          content: 'string (required) - Document content',
          metadata: 'object (optional) - Additional metadata'
        }
      },
      {
        path: '/api/chat',
        method: 'POST',
        description: 'Chat with Mastra-powered AI agent (with memory and context)',
        body: {
          userId: 'string (required) - User identifier',
          sessionId: 'string (required) - Session identifier',
          message: 'string (required) - User message',
          limit: 'number (optional) - Max number of documents to retrieve',
          threshold: 'number (optional) - Similarity threshold'
        }
      },
      {
        path: '/api/documents/ingest-markdown',
        method: 'POST',
        description: 'Ingest markdown content with automatic chunking and embedding pipeline',
        body: {
          content: 'string (required) - Markdown content to ingest',
          filename: 'string (optional) - Original filename for metadata'
        }
      },
      {
        path: '/api/documents/ingest-file',
        method: 'POST',
        description: 'Ingest file from server filesystem with automatic processing (supports .md, .markdown, .pdf)',
        body: {
          filePath: 'string (required) - Path to file on server (supports .md, .markdown, .pdf)'
        },
        note: 'Auto-detects file format based on extension. Supports both Markdown and PDF files.'
      },
      {
        path: '/api/documents/ingest-pdf',
        method: 'POST',
        description: 'Ingest PDF content (base64 encoded) with automatic parsing, chunking, and embedding pipeline',
        body: {
          pdfData: 'string (required) - Base64 encoded PDF content',
          filename: 'string (optional) - Original filename for metadata'
        }
      },
      {
        path: '/api/documents/ingest-pdf-file',
        method: 'POST',
        description: 'Ingest PDF file from server filesystem with automatic processing',
        body: {
          filePath: 'string (required) - Path to PDF file on server'
        }
      }
    ]
  });
});

export default router;