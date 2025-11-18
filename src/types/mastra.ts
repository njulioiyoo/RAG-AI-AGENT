/**
 * Mastra RAG Service Types
 * Type definitions for Mastra-powered RAG functionality
 */

/**
 * Query options for RAG searches
 */
export interface QueryOptions {
  /** Maximum number of documents to retrieve */
  limit?: number;
  /** Similarity threshold (0-1) for vector search */
  threshold?: number;
}

/**
 * Chat options for conversational interactions
 */
export interface ChatOptions extends QueryOptions {
  /** Include conversation history in context */
  includeHistory?: boolean;
  /** Maximum conversation turns to include */
  maxHistoryTurns?: number;
}

/**
 * Document with similarity score from vector search
 */
export interface VectorSearchDocument {
  document: {
    id: number;
    title: string;
    content: string;
    metadata: Record<string, any>;
  };
  similarity: number;
}

/**
 * User memory data structure
 */
export interface UserMemory {
  conversations: ConversationTurn[];
  preferences: Record<string, any>;
  profile: Record<string, any>;
}

/**
 * Single conversation turn
 */
export interface ConversationTurn {
  user_message: string;
  assistant_response: string;
  created_at: Date;
  metadata?: Record<string, any>;
}

/**
 * RAG query response
 */
export interface RAGQueryResponse {
  success: boolean;
  query: string;
  answer: string;
  sources: VectorSearchDocument[];
  framework: string;
  executionTime?: number;
  error?: string;
}

/**
 * Chat response with memory context
 */
export interface ChatResponse extends RAGQueryResponse {
  userId: string;
  sessionId: string;
  message: string;
  conversationTurn: number;
  memoryContext?: UserMemory;
}

/**
 * Document addition response
 */
export interface DocumentAddResponse {
  success: boolean;
  documentId: string | number;
  title: string;
  framework: string;
  message: string;
  error?: string;
}

/**
 * Service statistics
 */
export interface ServiceStats {
  framework: string;
  version: string;
  agent: string;
  tools: string[];
  status: string;
}

/**
 * Service configuration constants
 */
export const SERVICE_CONSTANTS = {
  DEFAULT_LIMIT: 5,
  DEFAULT_THRESHOLD: 0.3,
  MAX_HISTORY_TURNS: 10,
  DEFAULT_TIMEOUT: 30000,
  MAX_CONTENT_LENGTH: 1000,
  EMBEDDING_MODEL: 'text-embedding-004',
  CHAT_MODEL: 'gemini-2.5-flash',
} as const;

/**
 * Error types for better error handling
 */
export class MastraServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'MastraServiceError';
  }
}

export class DatabaseError extends MastraServiceError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'DATABASE_ERROR', context);
    this.name = 'DatabaseError';
  }
}

export class VectorSearchError extends MastraServiceError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VECTOR_SEARCH_ERROR', context);
    this.name = 'VectorSearchError';
  }
}

export class AgentError extends MastraServiceError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AGENT_ERROR', context);
    this.name = 'AgentError';
  }
}