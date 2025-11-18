/**
 * Vector Database Operations
 * Handles vector search and embedding operations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pool } from 'pg';
import { config } from '../../../config/config.js';
import {
  QueryOptions,
  VectorSearchDocument,
  SERVICE_CONSTANTS,
  VectorSearchError,
  DatabaseError,
} from '../../../types/mastra.js';

export class VectorOperations {
  private genAI: GoogleGenerativeAI;
  private dbPool: Pool;

  constructor(genAI: GoogleGenerativeAI, dbPool: Pool) {
    this.genAI = genAI;
    this.dbPool = dbPool;
  }

  /**
   * Generate query embedding using Google's text-embedding model
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const embeddingConfig = config.getLLMConfig();
      const model = this.genAI.getGenerativeModel({ 
        model: embeddingConfig.embeddingModel 
      });

      const result = await model.embedContent(query);
      const embedding = result.embedding;
      
      if (!embedding.values || embedding.values.length === 0) {
        throw new Error('No embedding values returned from Google AI');
      }

      return embedding.values;
    } catch (error) {
      throw new VectorSearchError(
        `Failed to generate embedding for query: "${query}"`,
        { query, originalError: error }
      );
    }
  }

  /**
   * Perform semantic vector search in document database
   */
  async vectorSearch(
    query: string, 
    options: QueryOptions = {}
  ): Promise<VectorSearchDocument[]> {
    try {
      console.log(`🔍 [Mastra] Vector search: "${query}"`);

      const { limit = SERVICE_CONSTANTS.DEFAULT_LIMIT, threshold = SERVICE_CONSTANTS.DEFAULT_THRESHOLD } = options;
      console.log(`🔍 Search params - limit: ${limit}, threshold: ${threshold}`);

      // Generate embedding for the query
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Perform vector similarity search
      const searchQuery = `
        SELECT 
          id,
          title,
          content,
          metadata,
          embedding <-> $1::vector as distance,
          1 - (embedding <-> $1::vector) as similarity
        FROM rag_documents 
        WHERE 1 - (embedding <-> $1::vector) > $2
        ORDER BY embedding <-> $1::vector
        LIMIT $3;
      `;

      const result = await this.dbPool.query(searchQuery, [
        `[${queryEmbedding.join(',')}]`,
        threshold,
        limit
      ]);

      console.log(`🔍 Found ${result.rows.length} documents with similarity > ${threshold}`);

      return result.rows.map(row => ({
        document: {
          id: row.id,
          title: row.title || 'Untitled Document',
          content: row.content || '',
          metadata: row.metadata || {}
        },
        similarity: parseFloat(row.similarity) || 0
      }));

    } catch (error) {
      throw new VectorSearchError(
        `Vector search failed for query: "${query}"`,
        { query, limit: options.limit, threshold: options.threshold, originalError: error }
      );
    }
  }

  /**
   * Add document with vector embedding to database
   */
  async addDocumentWithEmbedding(
    title: string, 
    content: string, 
    metadata: Record<string, any> = {}
  ): Promise<{ documentId: string }> {
    try {
      // Generate embedding for document content
      const embedding = await this.generateQueryEmbedding(content);

      // Insert document with embedding
      const insertQuery = `
        INSERT INTO rag_documents (title, content, metadata, embedding, created_at, updated_at)
        VALUES ($1, $2, $3, $4::vector, NOW(), NOW())
        RETURNING id;
      `;

      const result = await this.dbPool.query(insertQuery, [
        title,
        content,
        JSON.stringify(metadata),
        `[${embedding.join(',')}]`
      ]);

      return { documentId: result.rows[0].id };

    } catch (error) {
      throw new DatabaseError(
        `Failed to add document: "${title}"`,
        { title, contentLength: content.length, originalError: error }
      );
    }
  }

  /**
   * Test database connection and vector extension
   */
  async testConnection(): Promise<void> {
    try {
      const client = await this.dbPool.connect();
      
      try {
        // Test basic connection
        await client.query('SELECT 1');
        
        // Test pgvector extension
        await client.query('SELECT vector_dims(\'[1,2,3]\'::vector) as dims');
        
      } finally {
        client.release();
      }
    } catch (error) {
      throw new DatabaseError(
        'Failed to connect to database or pgvector extension not found',
        { originalError: error }
      );
    }
  }
}