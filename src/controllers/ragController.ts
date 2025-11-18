import { Request, Response } from 'express';
import { Validator } from '../utils/validation.js';
import { ErrorHandler } from '../utils/errors.js';
import { MarkdownIngestionService } from '../services/ingestion/markdownIngestion.js';

// Dynamic import for Mastra to avoid ES module issues
let MastraRAGService: any = null;

async function loadMastraService() {
  try {
    const module = await import('../services/mastra/mastraRAGService.js');
    MastraRAGService = module.MastraRAGService;
  } catch (error) {
    console.error('❌ Failed to load Mastra service:', error);
    throw error;
  }
}

/**
 * Controller for RAG operations powered by Mastra framework
 * 
 * Handles HTTP requests and delegates business logic to MastraRAGService
 * Provides proper error handling and response formatting
 */
export class RAGController {
  private mastraService: any = null;
  private ingestionService: MarkdownIngestionService | null = null;
  private isInitialized = false;

  constructor() {
    // Services will be initialized in initialize()
  }

  /**
   * Initialize the controller and underlying Mastra service
   * Must be called before handling any requests
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing Mastra RAG Controller...');
      
      // Load Mastra service dynamically
      await loadMastraService();
      this.mastraService = new MastraRAGService();
      await this.mastraService.initialize();
      
      // Initialize ingestion service
      this.ingestionService = new MarkdownIngestionService();
      
      this.isInitialized = true;
      console.log('✅ Mastra RAG Controller initialized successfully');
    } catch (error) {
      ErrorHandler.logError(error, { context: 'mastra_controller_initialization' });
      throw error;
    }
  }

  /**
   * Ensure controller is initialized before processing requests
   * @private
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Controller not initialized. Call initialize() first.');
    }
  }

  /**
   * Handle RAG query requests
   * Performs semantic search and generates AI responses
   */
  async query(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.ensureInitialized();
      
      // Validate input
      Validator.validateQueryRequest(req.body);
      
      const { query, limit, threshold } = req.body;

      const response = await this.mastraService.query(query, {
        limit: limit || 5,
        threshold: threshold || 0.3
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Mastra query processed in ${duration}ms`);
      
      res.json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      ErrorHandler.logError(error, { 
        context: 'mastra_query_endpoint',
        duration,
        query: req.body?.query?.substring(0, 50)
      });
      
      const errorResponse = ErrorHandler.formatErrorResponse(error);
      res.status(errorResponse.statusCode).json({
        error: errorResponse.error,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details })
      });
    }
  }

  /**
   * Add document to knowledge base
   * Processes and stores documents with vector embeddings
   */
  async addDocument(req: Request, res: Response): Promise<void> {
    try {
      this.ensureInitialized();
      
      const { title, content, metadata } = req.body;

      if (!title || !content) {
        res.status(400).json({
          error: 'Title and content are required'
        });
        return;
      }

      const result = await this.mastraService.addDocument(title, content, metadata);

      res.status(201).json({
        message: 'Document added successfully via Mastra',
        documentId: result.documentId,
        title,
        framework: result.framework
      });
    } catch (error) {
      console.error('❌ Error adding document via Mastra:', error);
      res.status(500).json({
        error: 'Failed to add document',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get service statistics and health information
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      this.ensureInitialized();
      
      const stats = await this.mastraService.getStats();
      res.json(stats);
    } catch (error) {
      console.error('❌ Error getting Mastra stats:', error);
      res.status(500).json({
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Health check endpoint
   * Returns service status and configuration information
   */
  async health(req: Request, res: Response): Promise<void> {
    try {
      // Health check should work even if not fully initialized
      if (this.isInitialized) {
        const stats = await this.mastraService.getStats();
        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          service: 'Mastra RAG AI Agent',
          version: '2.0.0',
          framework: stats.framework,
          database: 'connected',
          agent: stats.agent,
          tools: stats.tools,
          initialized: true
        });
      } else {
        res.json({
          status: 'initializing',
          timestamp: new Date().toISOString(),
          service: 'Mastra RAG AI Agent',
          version: '2.0.0',
          framework: 'mastra',
          database: 'unknown',
          initialized: false,
          message: 'Service is still initializing'
        });
      }
    } catch (error) {
      console.error('❌ Mastra health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        initialized: false
      });
    }
  }

  /**
   * Handle conversational chat requests with memory
   * Maintains conversation context and user preferences
   */
  async chat(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.ensureInitialized();
      
      // Validate input
      Validator.validateChatRequest(req.body);
      
      const { userId, sessionId, message, limit, threshold } = req.body;

      // Sanitize inputs
      const sanitizedMessage = Validator.sanitizeString(message);
      
      const response = await this.mastraService.chat(
        userId, 
        sessionId, 
        sanitizedMessage, 
        {
          limit: limit || 5,
          threshold: threshold || 0.3
        }
      );

      const duration = Date.now() - startTime;
      console.log(`💬 Mastra chat processed for user ${userId} in ${duration}ms`);
      
      res.json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      ErrorHandler.logError(error, { 
        context: 'mastra_chat_endpoint',
        duration,
        userId: req.body?.userId,
        sessionId: req.body?.sessionId
      });
      
      const errorResponse = ErrorHandler.formatErrorResponse(error);
      res.status(errorResponse.statusCode).json({
        error: errorResponse.error,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details })
      });
    }
  }

  /**
   * Mastra-powered query endpoint (alias for query)
   * Explicit endpoint name for Mastra-specific functionality
   */
  async mastraQuery(req: Request, res: Response): Promise<void> {
    return this.query(req, res);
  }

  /**
   * Mastra-powered chat endpoint (alias for chat)
   * Explicit endpoint name for Mastra-specific functionality
   */
  async mastraChat(req: Request, res: Response): Promise<void> {
    return this.chat(req, res);
  }

  /**
   * Ingest markdown content with automatic chunking and embedding
   * Implements proper ingestion pipeline as required
   */
  async ingestMarkdown(req: Request, res: Response): Promise<void> {
    try {
      this.ensureInitialized();
      
      // Validate input
      Validator.validateMarkdownRequest(req.body);
      
      const { content, filename } = req.body;
      
      console.log(`📥 [Controller] Starting markdown ingestion: ${filename || 'document.md'}`);
      
      const result = await this.ingestionService!.ingestMarkdown(
        content, 
        filename || 'document.md'
      );
      
      if (result.success) {
        res.status(201).json({
          message: result.message,
          documentsCreated: result.documentsCreated,
          documentIds: result.documentIds,
          framework: 'mastra',
          pipeline: 'markdown-ingestion',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: 'Ingestion failed',
          message: result.message,
          details: result.error
        });
      }
    } catch (error) {
      ErrorHandler.logError(error, { 
        context: 'markdown_ingestion_endpoint',
        filename: req.body?.filename
      });
      
      const errorResponse = ErrorHandler.formatErrorResponse(error);
      res.status(errorResponse.statusCode).json({
        error: errorResponse.error,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details })
      });
    }
  }

  /**
   * Ingest markdown file from server filesystem
   */
  async ingestMarkdownFile(req: Request, res: Response): Promise<void> {
    try {
      this.ensureInitialized();
      
      const { filePath } = req.body;
      
      if (!filePath) {
        res.status(400).json({
          error: 'File path is required',
          message: 'Please provide a filePath in the request body'
        });
        return;
      }

      // Validate file path for security
      Validator.validateFilePath(filePath);
      
      console.log(`📁 [Controller] Ingesting file: ${filePath}`);
      
      const result = await this.ingestionService!.ingestMarkdownFile(filePath);
      
      if (result.success) {
        res.status(201).json({
          message: result.message,
          documentsCreated: result.documentsCreated,
          documentIds: result.documentIds,
          framework: 'mastra',
          pipeline: 'file-ingestion',
          filePath,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: 'File ingestion failed',
          message: result.message,
          details: result.error
        });
      }
    } catch (error) {
      ErrorHandler.logError(error, { 
        context: 'file_ingestion_endpoint',
        filePath: req.body?.filePath
      });
      
      const errorResponse = ErrorHandler.formatErrorResponse(error);
      res.status(errorResponse.statusCode).json({
        error: errorResponse.error,
        code: errorResponse.code,
        ...(errorResponse.details && { details: errorResponse.details })
      });
    }
  }

  /**
   * Gracefully shutdown the controller and clean up resources
   */
  async shutdown(): Promise<void> {
    try {
      if (this.isInitialized) {
        await this.mastraService.shutdown();
        if (this.ingestionService) {
          await this.ingestionService.close();
        }
        this.isInitialized = false;
        console.log('🔌 RAG Controller shutdown complete');
      }
    } catch (error) {
      console.error('❌ Error during controller shutdown:', error);
    }
  }
}