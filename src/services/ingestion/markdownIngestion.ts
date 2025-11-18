/**
 * Markdown Ingestion Pipeline
 * Handles automatic parsing, chunking, embedding, and storage of markdown documents
 */

import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/config.js';
import { Database } from '../../config/database.js';

export interface IngestionResult {
  success: boolean;
  message: string;
  documentsCreated: number;
  documentIds: number[];
  error?: string;
}

export interface ChunkMetadata {
  filename: string;
  chunkIndex: number;
  totalChunks: number;
  originalTitle: string;
  type: 'markdown';
  ingested_at: string;
}

export class MarkdownIngestionService {
  private dbPool: Pool;
  private genAI: GoogleGenerativeAI;

  constructor() {
    const llmConfig = config.getLLMConfig();

    // Use shared database pool from Database singleton
    const database = Database.getInstance();
    this.dbPool = database.getPool();

    this.genAI = new GoogleGenerativeAI(llmConfig.geminiApiKey);
  }

  /**
   * Ingest markdown content with automatic chunking and embedding
   */
  async ingestMarkdown(
    content: string,
    filename: string = 'document.md',
    originalTitle?: string
  ): Promise<IngestionResult> {
    try {
      console.log(`🚀 [Ingestion] Starting markdown ingestion: ${filename}`);
      
      // Parse and chunk the markdown content
      const chunks = await this.chunkMarkdownContent(content);
      console.log(`📄 [Ingestion] Created ${chunks.length} chunks from markdown`);

      const documentIds: number[] = [];
      const title = originalTitle || this.extractTitle(content) || filename;

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkTitle = `${title} (Part ${i + 1}/${chunks.length})`;

        const metadata: ChunkMetadata = {
          filename,
          chunkIndex: i,
          totalChunks: chunks.length,
          originalTitle: title,
          type: 'markdown',
          ingested_at: new Date().toISOString(),
        };

        console.log(`🔮 [Ingestion] Processing chunk ${i + 1}/${chunks.length}`);

        // Generate embedding for chunk
        const embedding = await this.generateEmbedding(chunk);

        // Store chunk with embedding
        const documentId = await this.storeChunkWithEmbedding(
          chunkTitle,
          chunk,
          metadata,
          embedding
        );

        documentIds.push(documentId);
        console.log(`✅ [Ingestion] Stored chunk ${i + 1} with ID: ${documentId}`);
      }

      const result: IngestionResult = {
        success: true,
        message: `Successfully ingested ${filename} as ${chunks.length} chunks`,
        documentsCreated: chunks.length,
        documentIds,
      };

      console.log(`🎉 [Ingestion] Completed: ${JSON.stringify(result)}`);
      return result;

    } catch (error) {
      console.error('❌ [Ingestion] Failed:', error);
      return {
        success: false,
        message: 'Failed to ingest markdown content',
        documentsCreated: 0,
        documentIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse markdown content and split into meaningful chunks
   */
  private async chunkMarkdownContent(content: string): Promise<string[]> {
    const chunks: string[] = [];
    
    // Split by markdown headers to create logical sections
    const sections = content.split(/(?=^#+\s)/m);
    
    for (const section of sections) {
      if (section.trim().length === 0) continue;

      // If section is too long, split it further
      if (section.length > 1500) {
        const subChunks = this.splitLongSection(section, 1500);
        chunks.push(...subChunks);
      } else {
        chunks.push(section.trim());
      }
    }

    // Filter out very small chunks
    return chunks.filter(chunk => chunk.length > 50);
  }

  /**
   * Split long sections into smaller chunks while preserving context
   */
  private splitLongSection(section: string, maxLength: number): string[] {
    const chunks: string[] = [];
    const lines = section.split('\n');
    let currentChunk = '';
    let headerContext = '';

    // Extract header for context
    const headerMatch = section.match(/^(#+\s.+)$/m);
    if (headerMatch) {
      headerContext = headerMatch[1];
    }

    for (const line of lines) {
      // If adding this line exceeds max length, save current chunk
      if (currentChunk.length + line.length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = headerContext ? `${headerContext}\n` : '';
      }

      currentChunk += line + '\n';
    }

    // Add the last chunk if it's not empty
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Extract title from markdown content
   */
  private extractTitle(content: string): string | null {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  /**
   * Generate embedding for content
   */
  private async generateEmbedding(content: string): Promise<number[]> {
    try {
      const embeddingConfig = config.getLLMConfig();
      const model = this.genAI.getGenerativeModel({ 
        model: embeddingConfig.embeddingModel 
      });

      const result = await model.embedContent(content);
      const embedding = result.embedding;
      
      if (!embedding.values || embedding.values.length === 0) {
        throw new Error('No embedding values returned from Google AI');
      }

      return embedding.values;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  /**
   * Store chunk with embedding in database
   */
  private async storeChunkWithEmbedding(
    title: string,
    content: string,
    metadata: ChunkMetadata,
    embedding: number[]
  ): Promise<number> {
    try {
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

      return result.rows[0].id;
    } catch (error) {
      throw new Error(`Failed to store chunk: ${error}`);
    }
  }

  /**
   * Ingest from file path
   */
  async ingestMarkdownFile(filePath: string): Promise<IngestionResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const content = await fs.readFile(filePath, 'utf-8');
      const filename = path.basename(filePath);
      
      return this.ingestMarkdown(content, filename);
    } catch (error) {
      return {
        success: false,
        message: `Failed to read file: ${filePath}`,
        documentsCreated: 0,
        documentIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cleanup resources
   * Note: We don't close the pool here as it's shared via Database singleton
   */
  async close(): Promise<void> {
    // Don't close the pool as it's shared - Database singleton handles it
    // This method is kept for API compatibility but does nothing
  }
}