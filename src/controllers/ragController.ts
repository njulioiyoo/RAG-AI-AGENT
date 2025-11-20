import { Request, Response } from 'express';
import { Validator } from '../utils/validation.js';
import { ErrorHandler } from '../utils/errors.js';
import { MarkdownIngestionService } from '../services/ingestion/markdownIngestion.js';
import { PdfIngestionService } from '../services/ingestion/pdfIngestion.js';
import type { MastraRAGService as MastraRAGServiceType } from '../services/mastra/mastraRAGService.js';

// Dynamic import for Mastra to avoid ES module issues
type MastraRAGServiceClass = typeof import('../services/mastra/mastraRAGService.js').MastraRAGService;
let MastraRAGService: MastraRAGServiceClass | null = null;

async function loadMastraService(): Promise<void> {
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
  private mastraService: InstanceType<MastraRAGServiceClass> | null = null;
  private ingestionService: MarkdownIngestionService | null = null;
  private pdfIngestionService: PdfIngestionService | null = null;
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
      if (!MastraRAGService) {
        throw new Error('Failed to load MastraRAGService class');
      }
      this.mastraService = new MastraRAGService();
      await this.mastraService.initialize();
      
      // Initialize ingestion services
      this.ingestionService = new MarkdownIngestionService();
      this.pdfIngestionService = new PdfIngestionService();
      
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
      
      if (!this.mastraService) {
        res.status(503).json({ error: 'Service not initialized' });
        return;
      }

      const { query, limit, threshold } = req.body as { query: string; limit?: number; threshold?: number };

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
      
      if (!this.mastraService) {
        res.status(503).json({ error: 'Service not initialized' });
        return;
      }

      const { title, content, metadata } = req.body as { title: string; content: string; metadata?: Record<string, unknown> };

      if (!title || !content) {
        res.status(400).json({
          error: 'Title and content are required'
        });
        return;
      }

      const result = await this.mastraService.addDocument(title, content, metadata || {});

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
      
      if (!this.mastraService) {
        res.status(503).json({ error: 'Service not initialized' });
        return;
      }

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
      if (this.isInitialized && this.mastraService) {
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
      
      if (!this.mastraService) {
        res.status(503).json({ error: 'Service not initialized' });
        return;
      }

      const { userId, sessionId, message, limit, threshold } = req.body as { 
        userId: string; 
        sessionId: string; 
        message: string; 
        limit?: number; 
        threshold?: number 
      };

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
   * Ingest PDF from base64 or buffer
   */
  async ingestPdf(req: Request, res: Response): Promise<void> {
    try {
      this.ensureInitialized();
      
      // Validate input
      Validator.validatePdfRequest(req.body);
      
      const { pdfData, filename } = req.body as { 
        pdfData: string; // base64 encoded PDF
        filename?: string;
      };
      
      console.log(`📥 [Controller] Starting PDF ingestion: ${filename || 'document.pdf'}`);
      
      // Decode base64 PDF data
      const pdfBuffer = Buffer.from(pdfData, 'base64');
      
      const result = await this.pdfIngestionService!.ingestPdfBuffer(
        pdfBuffer,
        filename || 'document.pdf'
      );
      
      if (result.success) {
        res.status(201).json({
          message: result.message,
          documentsCreated: result.documentsCreated,
          documentIds: result.documentIds,
          framework: 'mastra',
          pipeline: 'pdf-ingestion',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: 'PDF ingestion failed',
          message: result.message,
          details: result.error
        });
      }
    } catch (error) {
      ErrorHandler.logError(error, { 
        context: 'pdf_ingestion_endpoint',
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
   * Ingest PDF file from server filesystem
   */
  async ingestPdfFile(req: Request, res: Response): Promise<void> {
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
      Validator.validatePdfFilePath(filePath);
      
      console.log(`📁 [Controller] Ingesting PDF file: ${filePath}`);
      
      const result = await this.pdfIngestionService!.ingestPdfFile(filePath);
      
      if (result.success) {
        res.status(201).json({
          message: result.message,
          documentsCreated: result.documentsCreated,
          documentIds: result.documentIds,
          framework: 'mastra',
          pipeline: 'pdf-file-ingestion',
          filePath,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: 'PDF file ingestion failed',
          message: result.message,
          details: result.error
        });
      }
    } catch (error) {
      ErrorHandler.logError(error, { 
        context: 'pdf_file_ingestion_endpoint',
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
   * Ingest file from server filesystem (supports markdown and PDF)
   * Auto-detects file format based on file extension
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
      
      // Auto-detect file format based on extension
      const fileExtension = filePath.toLowerCase().split('.').pop();
      const isPdf = fileExtension === 'pdf';
      const isMarkdown = fileExtension === 'md' || fileExtension === 'markdown';
      
      console.log(`📁 [Controller] Ingesting file: ${filePath} (format: ${fileExtension})`);
      
      let result;
      if (isPdf) {
        // Use PDF ingestion service for PDF files
        result = await this.pdfIngestionService!.ingestPdfFile(filePath);
      } else if (isMarkdown) {
        // Use markdown ingestion service for markdown files
        result = await this.ingestionService!.ingestMarkdownFile(filePath);
      } else {
        res.status(400).json({
          error: 'Unsupported file format',
          message: `File format .${fileExtension} is not supported. Supported formats: .md, .markdown, .pdf`
        });
        return;
      }
      
      if (result.success) {
        res.status(201).json({
          message: result.message,
          documentsCreated: result.documentsCreated,
          documentIds: result.documentIds,
          framework: 'mastra',
          pipeline: isPdf ? 'pdf-file-ingestion' : 'markdown-file-ingestion',
          filePath,
          fileType: fileExtension,
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
        if (this.mastraService) {
          await this.mastraService.shutdown();
        }
        if (this.ingestionService) {
          await this.ingestionService.close();
        }
        if (this.pdfIngestionService) {
          await this.pdfIngestionService.close();
        }
        this.isInitialized = false;
        console.log('🔌 RAG Controller shutdown complete');
      }
    } catch (error) {
      console.error('❌ Error during controller shutdown:', error);
    }
  }
}