import { Mastra } from '@mastra/core';
import { VectorSearchService } from './vectorSearch';
import { LLMService } from './llm';
import { UserMemoryService, MemoryContext } from './userMemory';
import { DocumentIngestionService } from './documentIngestion';
import { RAGQuery, RAGResponse } from '../types/document';

export class RAGAgent {
  private mastra: Mastra;
  private vectorSearch: VectorSearchService;
  private llmService: LLMService;
  private memoryService: UserMemoryService;
  private ingestionService: DocumentIngestionService;

  constructor() {
    this.mastra = new Mastra({});
    this.vectorSearch = new VectorSearchService();
    this.llmService = new LLMService();
    this.memoryService = new UserMemoryService();
    this.ingestionService = new DocumentIngestionService();
  }

  async query(ragQuery: RAGQuery): Promise<RAGResponse> {
    try {
      console.log(`🔍 Processing query: "${ragQuery.query}"`);

      // Search for relevant documents using vector search
      const searchResults = await this.vectorSearch.searchSimilar(
        ragQuery.query, 
        ragQuery.limit || 5, 
        ragQuery.threshold || 0.3
      );

      console.log(`📄 Found ${searchResults.length} relevant documents`);

      if (searchResults.length === 0) {
        return {
          answer: "I couldn't find any relevant documents to answer your question. Please try rephrasing your query or check if the information exists in the knowledge base.",
          sources: [],
          query: ragQuery.query,
          timestamp: new Date()
        };
      }

      // Extract context from search results
      const context = searchResults.map(result => 
        `Title: ${result.document.title}\nContent: ${result.document.content}\nRelevance: ${(result.similarity * 100).toFixed(1)}%`
      );

      // Generate response using LLM
      const prompt = `Please answer the following question based on the provided context documents:

Question: ${ragQuery.query}

Context Documents:
${context.join('\n\n---\n\n')}

Please provide a comprehensive answer based on the context provided. If the context doesn't fully address the question, mention what information might be missing.`;

      const answer = await this.llmService.generateResponse(ragQuery.query, context);

      return {
        answer,
        sources: searchResults,
        query: ragQuery.query,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('❌ Error processing RAG query:', error);
      throw error;
    }
  }

  async addDocument(title: string, content: string, metadata?: Record<string, any>) {
    try {
      const documentId = await this.vectorSearch.addDocument({ title, content, metadata });
      console.log(`✅ Document "${title}" added to knowledge base`);
      return documentId;
    } catch (error) {
      console.error('❌ Error adding document:', error);
      throw error;
    }
  }

  async initializeKnowledgeBase() {
    try {
      console.log('🚀 Initializing RAG knowledge base...');
      await this.memoryService.initializeMemoryTables();
      await this.vectorSearch.processExistingDocuments();
      console.log('✅ Vector search knowledge base initialized');
    } catch (error) {
      console.error('❌ Error initializing knowledge base:', error);
      throw error;
    }
  }

  // Chat with memory-aware context
  async chat(
    userId: string,
    sessionId: string,
    message: string,
    options: { limit?: number; threshold?: number } = {}
  ): Promise<RAGResponse & { memoryContext: MemoryContext }> {
    try {
      console.log(`💬 Processing chat for user ${userId}, session ${sessionId}: "${message}"`);

      // Get memory context for this user
      const memoryContext = await this.memoryService.getMemoryContext(userId, sessionId, message);

      // Search for relevant documents
      const searchResults = await this.vectorSearch.searchSimilar(
        message,
        options.limit || 5,
        options.threshold || 0.3
      );

      console.log(`📄 Found ${searchResults.length} relevant documents`);

      // Prepare context from documents
      const documentContext = searchResults.map(result => 
        `Title: ${result.document.title}\nContent: ${result.document.content}\nRelevance: ${(result.similarity * 100).toFixed(1)}%`
      );

      // Prepare conversation context
      let conversationContext = '';
      if (memoryContext.recentConversation.length > 0) {
        conversationContext = '\n\nRecent conversation:\n' + 
          memoryContext.recentConversation.map(turn => 
            `User: ${turn.userMessage}\nAssistant: ${turn.assistantResponse}`
          ).join('\n');
      }

      // Prepare relevant history context
      let historyContext = '';
      if (memoryContext.relevantHistory.length > 0) {
        historyContext = '\n\nRelevant past discussions:\n' + 
          memoryContext.relevantHistory.map(turn => 
            `User: ${turn.userMessage}\nAssistant: ${turn.assistantResponse}`
          ).join('\n');
      }

      // Generate comprehensive prompt with all context
      const fullContext = [
        ...documentContext,
        conversationContext,
        historyContext
      ].filter(Boolean);

      let answer: string;
      if (searchResults.length === 0 && memoryContext.recentConversation.length === 0) {
        answer = "I don't have any relevant information to answer your question. Could you provide more context or try a different question?";
      } else {
        answer = await this.llmService.generateResponse(message, fullContext);
      }

      // Store this conversation turn in memory
      await this.memoryService.storeConversationTurn({
        userId,
        sessionId,
        userMessage: message,
        assistantResponse: answer,
        timestamp: new Date(),
        metadata: {
          documentsUsed: searchResults.length,
          memoryContextUsed: memoryContext.recentConversation.length + memoryContext.relevantHistory.length
        }
      });

      return {
        answer,
        sources: searchResults,
        query: message,
        timestamp: new Date(),
        memoryContext
      };

    } catch (error) {
      console.error('❌ Error processing chat:', error);
      throw error;
    }
  }

  // Ingest documents from various sources
  async ingestMarkdownFile(filePath: string): Promise<number[]> {
    return this.ingestionService.ingestMarkdownFile(filePath);
  }

  async ingestMarkdownDirectory(directoryPath: string): Promise<number[]> {
    return this.ingestionService.ingestMarkdownDirectory(directoryPath);
  }

  async ingestMarkdownContent(content: string, filename: string): Promise<number[]> {
    return this.ingestionService.ingestMarkdownContent(content, filename);
  }

  // User memory management
  async getUserMemory(userId: string): Promise<Record<string, any>> {
    return this.memoryService.getUserProfile(userId);
  }

  async updateUserMemory(userId: string, data: Record<string, any>, preferences?: Record<string, any>): Promise<void> {
    return this.memoryService.updateUserProfile(userId, data, preferences);
  }

  async getStats() {
    try {
      const documents = await this.vectorSearch.getAllDocuments();
      
      return {
        totalDocuments: documents.length,
        documentsWithMetadata: documents.filter(doc => doc.metadata && Object.keys(doc.metadata).length > 0).length,
        categories: [...new Set(documents.map(doc => doc.metadata?.category).filter(Boolean))],
        searchMode: 'vector'
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      throw error;
    }
  }
}