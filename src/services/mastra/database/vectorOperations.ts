/**
 * Vector Database Operations
 * Handles vector search and embedding operations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Pool, QueryResult } from 'pg';
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
   * Translate query to Indonesian for better multilingual search
   * This helps when documents are in Indonesian but query is in English
   */
  private async translateQueryToIndonesian(query: string): Promise<string> {
    try {
      const llmConfig = config.getLLMConfig();
      const model = this.genAI.getGenerativeModel({ 
        model: SERVICE_CONSTANTS.CHAT_MODEL 
      });

      const prompt = `Translate the following English question to Indonesian. Only return the translation, nothing else:\n\n"${query}"`;
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      const translated = response.text().trim();
      
      console.log(`🌐 [Translation] "${query}" -> "${translated}"`);
      return translated;
    } catch (error) {
      console.warn(`⚠️ [Translation] Failed to translate query, using original: ${error}`);
      return query; // Return original if translation fails
    }
  }

  /**
   * Execute vector similarity search query
   * @private
   */
  private async executeVectorSearch(
    embedding: number[],
    threshold: number,
    limit: number
  ): Promise<QueryResult> {
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

    return await this.dbPool.query(searchQuery, [
      `[${embedding.join(',')}]`,
      threshold,
      limit
    ]);
  }

  /**
   * Map database rows to VectorSearchDocument format
   * @private
   */
  private mapRowsToDocuments(rows: Array<{
    id: number;
    title: string | null;
    content: string | null;
    metadata: Record<string, unknown> | null;
    similarity: number | string;
  }>): VectorSearchDocument[] {
    return rows.map(row => ({
      document: {
        id: row.id,
        title: row.title || 'Untitled Document',
        content: row.content || '',
        metadata: (row.metadata as Record<string, unknown>) || {}
      },
      similarity: typeof row.similarity === 'number' ? row.similarity : parseFloat(String(row.similarity)) || 0
    }));
  }

  /**
   * Try vector search with multiple fallback thresholds
   * @private
   */
  private async trySearchWithFallbackThresholds(
    embedding: number[],
    originalThreshold: number,
    limit: number
  ): Promise<QueryResult | null> {
    const fallbackThresholds = [
      Math.max(0.05, originalThreshold * 0.5),
      0.05,
      0.01,
      0
    ].filter(t => t < originalThreshold);

    for (const threshold of fallbackThresholds) {
      console.log(`🌐 [Multilingual] Trying with lower threshold: ${threshold}`);
      
      const result = await this.executeVectorSearch(embedding, threshold, limit);
      console.log(`🌐 [Multilingual] Found ${result.rows.length} documents with similarity > ${threshold}`);
      
      if (result.rows.length > 0) {
        console.log(`✅ [Multilingual] Successfully found documents with threshold ${threshold}`);
        return result;
      }
    }

    return null;
  }

  /**
   * Perform semantic vector search in document database
   * Includes multilingual fallback support
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
      let queryEmbedding = await this.generateQueryEmbedding(query);

      // Perform initial vector similarity search
      let result = await this.executeVectorSearch(queryEmbedding, threshold, limit);
      console.log(`🔍 Found ${result.rows.length} documents with similarity > ${threshold}`);

      // Multilingual fallback: if no results found, try with progressively lower thresholds
      if (result.rows.length === 0) {
        const fallbackResult = await this.trySearchWithFallbackThresholds(
          queryEmbedding,
          threshold,
          limit
        );
        
        if (fallbackResult) {
          result = fallbackResult;
        } else {
          // If still no results, try translating query to Indonesian and search again
          console.log(`🌐 [Multilingual] Still no results, trying query translation to Indonesian...`);
          
          try {
            const translatedQuery = await this.translateQueryToIndonesian(query);
            queryEmbedding = await this.generateQueryEmbedding(translatedQuery);
            
            result = await this.executeVectorSearch(queryEmbedding, 0, limit);
            console.log(`🌐 [Multilingual] Found ${result.rows.length} documents with translated query`);
          } catch (translationError) {
            console.warn(`⚠️ [Multilingual] Query translation failed: ${translationError}`);
          }
        }
      }

      return this.mapRowsToDocuments(result.rows);

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
    metadata: Record<string, unknown> = {}
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