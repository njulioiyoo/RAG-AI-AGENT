/**
 * Mastra-powered RAG Service (Refactored)
 * Clean, modular implementation of RAG capabilities
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pool } from 'pg';
import { config } from '../../config/config.js';
import {
  QueryOptions,
  ChatOptions,
  RAGQueryResponse,
  ChatResponse,
  DocumentAddResponse,
  ServiceStats,
  MastraServiceError,
} from '../../types/mastra.js';

// Modular components
import { VectorOperations } from './database/vectorOperations.js';
import { MastraAgent } from './agent/mastraAgent.js';
import { UserMemoryManager } from './memory/userMemory.js';

/**
 * Clean, modular Mastra RAG Service
 * 
 * @example
 * ```typescript
 * const service = new MastraRAGService();
 * await service.initialize();
 * const response = await service.query('What is the leave policy?');
 * ```
 */
export class MastraRAGService {
  private vectorOps?: VectorOperations;
  private agent?: MastraAgent;
  private memoryManager?: UserMemoryManager;
  private dbPool?: Pool;
  private genAI?: GoogleGenerativeAI;
  private isInitialized = false;

  constructor() {
    // Defer initialization to avoid async constructor pattern
  }

  /**
   * Initialize all service components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🚀 [Mastra] Initializing RAG Service...');

      // Initialize core services
      await this.initializeServices();

      // Initialize modular components
      this.vectorOps = new VectorOperations(this.genAI!, this.dbPool!);
      this.agent = new MastraAgent();
      this.memoryManager = new UserMemoryManager(this.dbPool!);

      // Test connections
      await this.vectorOps.testConnection();
      
      // Setup agent
      await this.agent.setup();

      this.isInitialized = true;
      console.log('🤖 Mastra RAG Service fully initialized');

    } catch (error) {
      throw new MastraServiceError(
        'Failed to initialize Mastra RAG Service',
        'INITIALIZATION_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Query the RAG system with semantic search and AI response
   */
  async query(query: string, options: QueryOptions = {}): Promise<RAGQueryResponse> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      console.log(`🚀 [Mastra] Processing query: "${query}"`);

      // Perform vector search
      const sources = await this.vectorOps!.vectorSearch(query, options);

      // Generate AI response
      const answer = await this.agent!.generateResponse(query, sources);

      const response: RAGQueryResponse = {
        success: true,
        query,
        answer,
        sources: sources.map(source => ({
          document: {
            id: source.document.id,
            title: source.document.title,
            content: source.document.content.substring(0, 200) + '...',
            metadata: source.document.metadata
          },
          similarity: source.similarity
        })),
        framework: 'mastra',
        executionTime: Date.now() - startTime
      };

      return response;

    } catch (error) {
      console.error('❌ Mastra query error:', error);
      
      return {
        success: false,
        query,
        answer: 'I apologize, but I encountered an error processing your request.',
        sources: [],
        framework: 'mastra',
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Chat with memory and conversation context
   */
  async chat(
    userId: string,
    sessionId: string,
    message: string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      console.log(`💬 [Mastra] Processing chat for user ${userId}`);

      // Get user memory and conversation history
      const userMemory = await this.memoryManager!.getUserMemory(userId, sessionId);

      // Perform vector search
      const sources = await this.vectorOps!.vectorSearch(message, options);

      // Generate AI response with memory context
      const answer = await this.agent!.generateResponse(message, sources, userMemory);

      // Save conversation turn
      await this.memoryManager!.saveConversationTurn(userId, sessionId, message, answer);

      const response: ChatResponse = {
        success: true,
        query: message,
        userId,
        sessionId,
        message,
        answer,
        sources: sources.map(source => ({
          document: {
            id: source.document.id,
            title: source.document.title,
            content: source.document.content.substring(0, 200) + '...',
            metadata: source.document.metadata
          },
          similarity: source.similarity
        })),
        framework: 'mastra',
        executionTime: Date.now() - startTime,
        conversationTurn: userMemory.conversations.length + 1
      };

      return response;

    } catch (error) {
      console.error('❌ Mastra chat error:', error);
      
      return {
        success: false,
        query: message,
        userId,
        sessionId,
        message,
        answer: 'I apologize, but I encountered an error processing your message.',
        sources: [],
        framework: 'mastra',
        executionTime: Date.now() - startTime,
        conversationTurn: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add document to knowledge base
   */
  async addDocument(
    title: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<DocumentAddResponse> {
    this.ensureInitialized();

    try {
      const result = await this.vectorOps!.addDocumentWithEmbedding(title, content, metadata);

      return {
        success: true,
        documentId: result.documentId,
        title,
        framework: 'mastra',
        message: 'Document added successfully to Mastra knowledge base'
      };

    } catch (error) {
      console.error('❌ Error adding document:', error);
      
      return {
        success: false,
        documentId: '',
        title,
        framework: 'mastra',
        message: 'Failed to add document',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get service statistics and health information
   */
  async getStats(): Promise<ServiceStats> {
    const agentStats = this.agent?.getStats() || { agent: 'hr-assistant', tools: [], framework: 'mastra' };
    
    return {
      framework: 'mastra',
      version: '0.24.1',
      agent: agentStats.agent,
      tools: agentStats.tools,
      status: this.isInitialized ? 'active' : 'inactive'
    };
  }

  /**
   * Gracefully shutdown service and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      if (this.dbPool) {
        await this.dbPool.end();
      }
      this.isInitialized = false;
      console.log('🔌 Mastra RAG Service shutdown complete');
    } catch (error) {
      console.error('❌ Error during service shutdown:', error);
    }
  }

  /**
   * Initialize core services (database, AI)
   */
  private async initializeServices(): Promise<void> {
    const dbConfig = config.getDatabaseConfig();
    const llmConfig = config.getLLMConfig();

    // Initialize Google AI
    this.genAI = new GoogleGenerativeAI(llmConfig.geminiApiKey);

    // Initialize database connection
    this.dbPool = new Pool({
      connectionString: dbConfig.url,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      max: dbConfig.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: dbConfig.connectionTimeout,
    });
  }

  /**
   * Ensure service is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.vectorOps || !this.agent || !this.memoryManager) {
      throw new MastraServiceError(
        'Service not initialized. Call initialize() first.',
        'NOT_INITIALIZED'
      );
    }
  }
}