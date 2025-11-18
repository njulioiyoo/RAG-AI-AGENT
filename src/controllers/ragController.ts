import { Request, Response } from 'express';
import { RAGAgent } from '../services/ragAgent';
import { Validator } from '../utils/validation';
import { ErrorHandler } from '../utils/errors';

export class RAGController {
  private ragAgent: RAGAgent;

  constructor() {
    this.ragAgent = new RAGAgent();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing RAG Controller...');
      await this.ragAgent.initializeKnowledgeBase();
      console.log('✅ RAG Controller initialized successfully');
    } catch (error) {
      ErrorHandler.logError(error, { context: 'rag_controller_initialization' });
      throw error;
    }
  }

  async query(req: Request, res: Response) {
    const startTime = Date.now();
    
    try {
      // Validate input
      Validator.validateQueryRequest(req.body);
      
      const { query, limit, threshold } = req.body;

      const response = await this.ragAgent.query({
        query,
        limit: limit || 5,
        threshold: threshold || 0.3
      });

      const duration = Date.now() - startTime;
      console.log(`✅ Query processed in ${duration}ms`);
      
      res.json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      ErrorHandler.logError(error, { 
        context: 'query_endpoint',
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

  async addDocument(req: Request, res: Response) {
    try {
      const { title, content, metadata } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          error: 'Title and content are required'
        });
      }

      const documentId = await this.ragAgent.addDocument(title, content, metadata);

      res.status(201).json({
        message: 'Document added successfully',
        documentId,
        title
      });
    } catch (error) {
      console.error('❌ Error adding document:', error);
      res.status(500).json({
        error: 'Failed to add document',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const stats = await this.ragAgent.getStats();
      res.json(stats);
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      res.status(500).json({
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async health(req: Request, res: Response) {
    try {
      const stats = await this.ragAgent.getStats();
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'RAG AI Agent',
        version: '1.0.0',
        database: 'connected',
        knowledgeBase: {
          documentsCount: stats.totalDocuments,
          categories: stats.categories
        }
      });
    } catch (error) {
      console.error('❌ Health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Chat endpoint with user memory
  async chat(req: Request, res: Response) {
    const startTime = Date.now();
    
    try {
      // Validate input
      Validator.validateChatRequest(req.body);
      
      const { userId, sessionId, message, limit, threshold } = req.body;

      // Sanitize inputs
      const sanitizedMessage = Validator.sanitizeString(message);
      
      const response = await this.ragAgent.chat(
        userId, 
        sessionId, 
        sanitizedMessage, 
        {
          limit: limit || 5,
          threshold: threshold || 0.3
        }
      );

      const duration = Date.now() - startTime;
      console.log(`💬 Chat processed for user ${userId} in ${duration}ms`);
      
      res.json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      ErrorHandler.logError(error, { 
        context: 'chat_endpoint',
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

  // Markdown content ingestion
  async ingestMarkdown(req: Request, res: Response) {
    try {
      const { content, filename } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({
          error: 'Content is required and must be a string'
        });
      }

      const documentIds = await this.ragAgent.ingestMarkdownContent(
        content,
        filename || 'untitled.md'
      );

      res.status(201).json({
        message: 'Markdown content ingested successfully',
        documentIds,
        totalDocuments: documentIds.length
      });
    } catch (error) {
      console.error('❌ Error ingesting markdown:', error);
      res.status(500).json({
        error: 'Failed to ingest markdown content',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // File ingestion
  async ingestFile(req: Request, res: Response) {
    try {
      const { filePath } = req.body;

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({
          error: 'filePath is required and must be a string'
        });
      }

      const documentIds = await this.ragAgent.ingestMarkdownFile(filePath);

      res.status(201).json({
        message: 'File ingested successfully',
        documentIds,
        totalDocuments: documentIds.length,
        filePath
      });
    } catch (error) {
      console.error('❌ Error ingesting file:', error);
      res.status(500).json({
        error: 'Failed to ingest file',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get user memory
  async getUserMemory(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          error: 'userId is required'
        });
      }

      const memory = await this.ragAgent.getUserMemory(userId);

      res.json({
        userId,
        memory
      });
    } catch (error) {
      console.error('❌ Error getting user memory:', error);
      res.status(500).json({
        error: 'Failed to get user memory',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Update user memory
  async updateUserMemory(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { profileData, preferences } = req.body;

      if (!userId) {
        return res.status(400).json({
          error: 'userId is required'
        });
      }

      await this.ragAgent.updateUserMemory(userId, profileData || {}, preferences);

      res.json({
        message: 'User memory updated successfully',
        userId
      });
    } catch (error) {
      console.error('❌ Error updating user memory:', error);
      res.status(500).json({
        error: 'Failed to update user memory',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}