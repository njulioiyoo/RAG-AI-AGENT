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

      // Truncate query if too long (embedding models have token limits)
      const maxQueryLength = 8000; // Safe limit for most embedding models
      const truncatedQuery = query.length > maxQueryLength 
        ? query.substring(0, maxQueryLength) 
        : query;

      const result = await model.embedContent(truncatedQuery);
      const embedding = result.embedding;
      
      if (!embedding || !embedding.values || embedding.values.length === 0) {
        throw new Error('No embedding values returned from Google AI');
      }

      return embedding.values;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ [Embedding] Failed to generate embedding: ${errorMessage}`);
      console.error(`❌ [Embedding] Query length: ${query.length}, Query preview: ${query.substring(0, 100)}...`);
      
      throw new VectorSearchError(
        `Failed to generate embedding for query: "${query.substring(0, 50)}..."`,
        { query: query.substring(0, 100), queryLength: query.length, originalError: error }
      );
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

    const result = await this.dbPool.query(searchQuery, [
      `[${embedding.join(',')}]`,
      threshold,
      limit
    ]);

    // Log similarity scores for debugging
    if (result.rows.length > 0) {
      const similarities = result.rows.map((r: { similarity: number | string }) => 
        typeof r.similarity === 'number' ? r.similarity.toFixed(4) : parseFloat(String(r.similarity)).toFixed(4)
      );
      console.log(`📊 [Vector Search] Similarity scores: ${similarities.join(', ')}`);
    }

    return result;
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
    base_similarity?: number | string;
    keyword_boost?: number | string;
  }>): VectorSearchDocument[] {
    return rows.map(row => {
      const similarity = typeof row.similarity === 'number' ? row.similarity : parseFloat(String(row.similarity)) || 0;
      // Cap similarity at 1.0 (in case keyword boost pushes it over)
      const cappedSimilarity = Math.min(1.0, similarity);
      
      return {
        document: {
          id: row.id,
          title: row.title || 'Untitled Document',
          content: row.content || '',
          metadata: (row.metadata as Record<string, unknown>) || {}
        },
        similarity: cappedSimilarity
      };
    });
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
    // Generate fallback thresholds: progressively lower
    const fallbackThresholds = [
      Math.max(0.1, originalThreshold * 0.7),  // 70% of original
      Math.max(0.05, originalThreshold * 0.5), // 50% of original
      0.1,
      0.05,
      0.01,
      0  // No threshold - return top results regardless of similarity
    ].filter(t => t < originalThreshold);

    for (const threshold of fallbackThresholds) {
      console.log(`🔍 [Fallback] Trying with lower threshold: ${threshold}`);
      
      const result = await this.executeVectorSearch(embedding, threshold, limit);
      console.log(`🔍 [Fallback] Found ${result.rows.length} documents with similarity > ${threshold}`);
      
      if (result.rows.length > 0) {
        const topSimilarity = typeof result.rows[0].similarity === 'number' 
          ? result.rows[0].similarity 
          : parseFloat(String(result.rows[0].similarity));
        console.log(`✅ [Fallback] Successfully found documents with threshold ${threshold} (top similarity: ${topSimilarity.toFixed(4)})`);
        return result;
      }
    }

    return null;
  }

  /**
   * Try keyword-based search as last resort fallback
   * @private
   */
  private async tryKeywordSearch(
    query: string,
    limit: number
  ): Promise<QueryResult | null> {
    try {
      // Extract keywords dynamically from query
      // Filter based on word characteristics rather than hardcoded lists
      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.replace(/[^\w]/g, '')) // Remove punctuation
        .filter(word => {
          // Keep words that are:
          // - At least 3 characters long
          // - Not purely numeric (numbers are handled as identifiers)
          // - Contain at least one letter
          return word.length >= 3 && 
                 !/^\d+$/.test(word) && 
                 /[a-z]/.test(word);
        })
        .slice(0, 5); // Limit to 5 keywords

      if (keywords.length === 0) {
        return null;
      }

      console.log(`🔍 [Keyword Search] Trying keyword search with: ${keywords.join(', ')}`);

      // Build ILIKE query for PostgreSQL (case-insensitive search)
      // Use simpler approach with single pattern matching
      const keywordPatterns = keywords.map(k => `%${k}%`);
      const keywordConditions = keywordPatterns.map((_, i) => 
        `(title ILIKE $${i + 1} OR content ILIKE $${i + 1})`
      ).join(' OR ');

      const keywordQuery = `
        SELECT 
          id,
          title,
          content,
          metadata,
          0.5 as distance,  -- Default similarity for keyword matches
          0.5 as similarity
        FROM rag_documents 
        WHERE ${keywordConditions}
        ORDER BY 
          CASE 
            ${keywords.map((_, i) => `WHEN title ILIKE $${i + 1} THEN ${i + 1}`).join(' ')}
            ELSE ${keywords.length + 1}
          END,
          id DESC
        LIMIT $${keywordPatterns.length + 1};
      `;

      const result = await this.dbPool.query(
        keywordQuery,
        [...keywordPatterns, limit]
      );

      if (result.rows.length > 0) {
        console.log(`✅ [Keyword Search] Found ${result.rows.length} documents with keyword matching`);
      }

      return result.rows.length > 0 ? result : null;
    } catch (error) {
      console.warn(`⚠️ [Keyword Search] Failed: ${error}`);
      return null;
    }
  }

  /**
   * Extract important identifiers and keywords from query
   * @private
   */
  private extractQueryIdentifiers(query: string): {
    identifiers: string[];
    keywords: string[];
  } {
    // Extract potential identifiers (numbers, codes, project IDs)
    // Pattern matches various identifier formats
    const identifierPatterns = [
      /\b\d+[-\/]\d+\b/gi,           // Number-number or number/number patterns
      /\b[A-Z]{2,}[-\s]?\d+[-\/]?\d*\b/gi,  // Letters followed by numbers
      /\b\d+[-\s]?[A-Z]{2,}\b/gi,    // Numbers followed by letters
      /\b[A-Z]{2,}\d+\b/gi,          // Letters directly followed by numbers
      /\b\d+[A-Z]{2,}\b/gi           // Numbers directly followed by letters
    ];
    
    const identifiers: string[] = [];
    for (const pattern of identifierPatterns) {
      const matches = query.match(pattern) || [];
      identifiers.push(...matches);
    }
    
    // Remove duplicates and normalize
    const uniqueIdentifiers = [...new Set(identifiers.map(id => id.trim().toUpperCase()))];
    
    // Extract keywords dynamically from query
    // Include both lowercase and original case for better matching
    const words = query.split(/\s+/);
    const keywords: string[] = [];
    const seen = new Set<string>();
    
    for (const word of words) {
      const cleaned = word.replace(/[^\w]/g, ''); // Remove punctuation
      const lowerCleaned = cleaned.toLowerCase();
      
      // Keep words that are:
      // - At least 2 characters long (reduced from 3 to catch short names like "N")
      // - Not purely numeric (numbers are handled as identifiers)
      // - Contain at least one letter (filters pure punctuation)
      if (cleaned.length >= 2 && 
          !/^\d+$/.test(cleaned) && 
          /[a-zA-Z]/.test(cleaned) &&
          !seen.has(lowerCleaned)) {
        
        seen.add(lowerCleaned);
        // Add both lowercase and original case for better matching
        keywords.push(lowerCleaned);
        if (cleaned !== lowerCleaned && cleaned.length >= 3) {
          // Also add capitalized version if different (for names like "Julio")
          keywords.push(cleaned);
        }
      }
    }

    return { identifiers: uniqueIdentifiers, keywords: keywords.slice(0, 15) }; // Increased limit
  }

  /**
   * Hybrid search: Combine vector similarity with keyword matching
   * @private
   */
  private async hybridVectorSearch(
    queryEmbedding: number[],
    query: string,
    threshold: number,
    limit: number
  ): Promise<QueryResult> {
    const { identifiers, keywords } = this.extractQueryIdentifiers(query);
    
    // Build keyword conditions for identifiers and important keywords
    // Use more keywords (up to 10) for better matching, especially for names
    const allSearchTerms = [...identifiers, ...keywords.slice(0, 10)];
    
    if (allSearchTerms.length === 0) {
      // No keywords, just do vector search
      return await this.executeVectorSearch(queryEmbedding, threshold, limit);
    }

    console.log(`🔍 [Hybrid Search] Identifiers: ${identifiers.join(', ')}, Keywords: ${keywords.slice(0, 10).join(', ')}`);

    // Build hybrid query: vector similarity + keyword boost
    const keywordConditions = allSearchTerms.map((_, i) => 
      `(title ILIKE $${i + 2} OR content ILIKE $${i + 2})`
    ).join(' OR ');

    // Build keyword boost calculation (sum of all matches)
    // Increased boost values for better exact match prioritization
    // Title matches get higher boost as they're more relevant
    const titleBoosts = allSearchTerms.map((_, i) => 
      `CASE WHEN title ILIKE $${i + 2} THEN 0.5 ELSE 0 END`
    ).join(' + ');
    const contentBoosts = allSearchTerms.map((_, i) => 
      `CASE WHEN content ILIKE $${i + 2} THEN 0.3 ELSE 0 END`
    ).join(' + ');

    const hybridQuery = `
      SELECT 
        id,
        title,
        content,
        metadata,
        embedding <-> $1::vector as distance,
        1 - (embedding <-> $1::vector) as base_similarity,
        (${titleBoosts}) + (${contentBoosts}) as keyword_boost,
        LEAST(1.0, (1 - (embedding <-> $1::vector)) + (${titleBoosts}) + (${contentBoosts})) as similarity,
        CASE 
          WHEN (${titleBoosts}) > 0 THEN 1
          WHEN (${contentBoosts}) > 0 THEN 2
          ELSE 3
        END as keyword_priority
      FROM rag_documents 
      WHERE 
        (1 - (embedding <-> $1::vector) > $${allSearchTerms.length + 2} OR ${keywordConditions})
      ORDER BY 
        keyword_priority ASC,
        similarity DESC,
        embedding <-> $1::vector
      LIMIT $${allSearchTerms.length + 3};
    `;

    // Use much lower threshold for hybrid search to prioritize keyword matches
    // This is important for exact name/code matches
    const hybridThreshold = Math.max(0, threshold - 0.5);

    const result = await this.dbPool.query(
      hybridQuery,
      [
        `[${queryEmbedding.join(',')}]`,
        ...allSearchTerms.map(term => `%${term}%`),
        hybridThreshold,
        limit
      ]
    );

    // Log hybrid search results
    if (result.rows.length > 0) {
      const similarities = result.rows.map((r: { similarity: number | string; base_similarity: number | string; keyword_boost: number | string }) => {
        const sim = typeof r.similarity === 'number' ? r.similarity : parseFloat(String(r.similarity));
        const base = typeof r.base_similarity === 'number' ? r.base_similarity : parseFloat(String(r.base_similarity));
        const boost = typeof r.keyword_boost === 'number' ? r.keyword_boost : parseFloat(String(r.keyword_boost));
        return `${sim.toFixed(4)} (base: ${base.toFixed(4)}, boost: ${boost.toFixed(4)})`;
      });
      console.log(`📊 [Hybrid Search] Similarity scores: ${similarities.join(', ')}`);
    }

    return result;
  }

  /**
   * Perform semantic vector search in document database
   * Includes hybrid search (vector + keyword) and fallback mechanisms
   */
  async vectorSearch(
    query: string, 
    options: QueryOptions = {}
  ): Promise<VectorSearchDocument[]> {
    try {
      console.log(`🔍 [Mastra] Vector search: "${query}"`);

      const { limit = SERVICE_CONSTANTS.DEFAULT_LIMIT, threshold = SERVICE_CONSTANTS.DEFAULT_THRESHOLD } = options;
      console.log(`🔍 Search params - limit: ${limit}, threshold: ${threshold}`);

      // Generate embedding for the original query
      let queryEmbedding = await this.generateQueryEmbedding(query);

      // Try hybrid search first (vector + keyword) for better precision
      let result = await this.hybridVectorSearch(queryEmbedding, query, threshold, limit);
      console.log(`🔍 [Hybrid] Found ${result.rows.length} documents with hybrid search`);

      // If hybrid search found results, filter by threshold and return
      if (result.rows.length > 0) {
        // Filter results by threshold (considering both base similarity and keyword boost)
        // For hybrid search, be more lenient with keyword matches
        const filteredRows = result.rows.filter((row: { similarity: number | string; keyword_boost?: number | string; base_similarity?: number | string }) => {
          const sim = typeof row.similarity === 'number' ? row.similarity : parseFloat(String(row.similarity));
          const boost = typeof row.keyword_boost === 'number' ? row.keyword_boost : parseFloat(String(row.keyword_boost || 0));
          const baseSim = typeof row.base_similarity === 'number' ? row.base_similarity : parseFloat(String(row.base_similarity || 0));
          
          // If there's significant keyword boost (exact name/code match), be much more lenient
          // This helps with queries like "julio" even if vector similarity is lower
          if (boost > 0.3) {
            // Strong keyword match - accept if total similarity >= 0.5 or base similarity >= 0.2
            // This prioritizes exact keyword matches over vector similarity
            return sim >= 0.5 || baseSim >= 0.2;
          } else if (boost > 0.15) {
            // Moderate keyword match - accept if total similarity >= threshold - 0.2
            return sim >= Math.max(threshold - 0.2, 0.4);
          }
          
          // No significant keyword boost, use original threshold
          return sim >= threshold;
        });

        if (filteredRows.length > 0) {
          console.log(`✅ [Hybrid] ${filteredRows.length} documents passed threshold (with keyword boost consideration)`);
          return this.mapRowsToDocuments(filteredRows);
        } else {
          console.log(`⚠️ [Hybrid] Results found but none passed threshold ${threshold}, trying fallback...`);
        }
      }

      // If hybrid search didn't find results, try keyword search first before vector search
      // This prioritizes exact keyword matches
      if (result.rows.length === 0) {
        const { identifiers, keywords } = this.extractQueryIdentifiers(query);
        if (identifiers.length > 0 || keywords.length > 0) {
          console.log(`🔍 [Keyword Priority] Trying keyword search first before vector search...`);
          const keywordResult = await this.tryKeywordSearch(query, limit);
          if (keywordResult && keywordResult.rows.length > 0) {
            console.log(`✅ [Keyword Priority] Found ${keywordResult.rows.length} documents with keyword search`);
            result = keywordResult;
          }
        }
      }

      // Fallback to pure vector search if keyword search didn't work
      if (result.rows.length === 0) {
        result = await this.executeVectorSearch(queryEmbedding, threshold, limit);
        console.log(`🔍 Found ${result.rows.length} documents with similarity > ${threshold}`);
      }

      // If still no results, try with progressively lower thresholds
      if (result.rows.length === 0) {
        console.log(`🔍 [Fallback] Trying with lower thresholds...`);
        const fallbackResult = await this.trySearchWithFallbackThresholds(
          queryEmbedding,
          threshold,
          limit
        );
        
        if (fallbackResult) {
          result = fallbackResult;
        }
      }

      // Log final results
      if (result.rows.length > 0) {
        const topSimilarity = typeof result.rows[0].similarity === 'number' 
          ? result.rows[0].similarity 
          : parseFloat(String(result.rows[0].similarity));
        console.log(`✅ [Vector Search] Final result: ${result.rows.length} documents found (top similarity: ${topSimilarity.toFixed(4)})`);
      } else {
        console.warn(`⚠️ [Vector Search] No documents found for query: "${query}"`);
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