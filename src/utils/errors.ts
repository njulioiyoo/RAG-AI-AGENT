/**
 * Custom Error Classes for RAG AI Agent
 * Provides specific error types for better error handling and debugging
 */

export class RAGError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  
  constructor(message: string, code: string, statusCode: number = 500) {
    super(message);
    this.name = 'RAGError';
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseConnectionError extends RAGError {
  constructor(message: string = 'Database connection failed') {
    super(message, 'DATABASE_CONNECTION_ERROR', 503);
    this.name = 'DatabaseConnectionError';
  }
}

export class InvalidAPIKeyError extends RAGError {
  constructor(provider: string) {
    super(`Invalid or missing API key for ${provider}`, 'INVALID_API_KEY', 401);
    this.name = 'InvalidAPIKeyError';
  }
}

export class DocumentNotFoundError extends RAGError {
  constructor(documentId?: string) {
    const message = documentId 
      ? `Document with ID ${documentId} not found` 
      : 'Document not found';
    super(message, 'DOCUMENT_NOT_FOUND', 404);
    this.name = 'DocumentNotFoundError';
  }
}

export class VectorSearchError extends RAGError {
  constructor(message: string = 'Vector search operation failed') {
    super(message, 'VECTOR_SEARCH_ERROR', 500);
    this.name = 'VectorSearchError';
  }
}

export class EmbeddingGenerationError extends RAGError {
  constructor(message: string = 'Failed to generate embeddings') {
    super(message, 'EMBEDDING_GENERATION_ERROR', 500);
    this.name = 'EmbeddingGenerationError';
  }
}

export class LLMGenerationError extends RAGError {
  constructor(message: string = 'Failed to generate LLM response') {
    super(message, 'LLM_GENERATION_ERROR', 500);
    this.name = 'LLMGenerationError';
  }
}

export class ValidationError extends RAGError {
  constructor(field: string, value?: any) {
    const message = `Validation failed for field '${field}'${value ? `: ${value}` : ''}`;
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class UserMemoryError extends RAGError {
  constructor(userId: string, operation: string) {
    super(`User memory operation '${operation}' failed for user ${userId}`, 'USER_MEMORY_ERROR', 500);
    this.name = 'UserMemoryError';
  }
}

export class FileIngestionError extends RAGError {
  constructor(filePath: string, reason?: string) {
    const message = `Failed to ingest file: ${filePath}${reason ? ` - ${reason}` : ''}`;
    super(message, 'FILE_INGESTION_ERROR', 400);
    this.name = 'FileIngestionError';
  }
}

/**
 * Error Handler Utility Functions
 */
export class ErrorHandler {
  /**
   * Check if error is a known RAG error type
   */
  static isRAGError(error: any): error is RAGError {
    return error instanceof RAGError;
  }

  /**
   * Format error for API response
   */
  static formatErrorResponse(error: any) {
    if (this.isRAGError(error)) {
      return {
        error: error.message,
        code: error.code,
        statusCode: error.statusCode
      };
    }

    // Handle specific known errors
    if (error.code === 'ECONNREFUSED') {
      return {
        error: 'Database connection refused',
        code: 'DATABASE_CONNECTION_REFUSED', 
        statusCode: 503
      };
    }

    if (error.code === '28000') { // PostgreSQL invalid auth
      return {
        error: 'Database authentication failed',
        code: 'DATABASE_AUTH_ERROR',
        statusCode: 503
      };
    }

    if (error.code === '3D000') { // PostgreSQL database does not exist
      return {
        error: 'Database does not exist',
        code: 'DATABASE_NOT_FOUND',
        statusCode: 503
      };
    }

    // Handle Gemini API errors
    if (error.message?.includes('API key')) {
      return {
        error: 'Invalid Gemini API key',
        code: 'INVALID_GEMINI_API_KEY',
        statusCode: 401
      };
    }

    if (error.status === 429) {
      return {
        error: 'API rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429
      };
    }

    // Generic error
    return {
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
      statusCode: 500,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    };
  }

  /**
   * Log error with context
   */
  static logError(error: any, context?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      message: error.message,
      stack: error.stack,
      code: error.code,
      ...context
    };

    console.error('❌ Error:', JSON.stringify(errorInfo, null, 2));
  }
}