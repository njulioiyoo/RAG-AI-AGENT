import Database from '../config/database';
import { Document, VectorSearchResult } from '../types/document';
import { LLMService } from './llm';

export class VectorSearchService {
  private db: typeof Database;
  private llmService: LLMService;

  constructor() {
    this.db = Database;
    this.llmService = new LLMService();
  }

  async addDocument(document: Document): Promise<number> {
    try {
      // Generate embedding for the document content
      const embedding = await this.llmService.generateEmbedding(
        `${document.title} ${document.content}`
      );

      const result = await this.db.query(
        `INSERT INTO rag_documents (title, content, embedding, metadata) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [document.title, document.content, JSON.stringify(embedding), document.metadata || {}]
      );

      console.log(`✅ Document "${document.title}" added with ID: ${result.rows[0].id}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error adding document:', error);
      throw error;
    }
  }

  async searchSimilar(query: string, limit: number = 5, threshold: number = 0.5): Promise<VectorSearchResult[]> {
    try {
      // Generate embedding for the search query
      const queryEmbedding = await this.llmService.generateEmbedding(query);

      // Perform vector similarity search
      const result = await this.db.query(
        `SELECT 
           id, title, content, metadata, created_at, updated_at,
           1 - (embedding <=> $1::vector) as similarity
         FROM rag_documents 
         WHERE 1 - (embedding <=> $1::vector) > $2
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [JSON.stringify(queryEmbedding), threshold, limit]
      );

      return result.rows.map((row: any) => ({
        document: {
          id: row.id,
          title: row.title,
          content: row.content,
          metadata: row.metadata,
          created_at: row.created_at,
          updated_at: row.updated_at
        },
        similarity: parseFloat(row.similarity)
      }));
    } catch (error) {
      console.error('❌ Error searching documents:', error);
      throw error;
    }
  }

  async updateDocumentEmbedding(id: number): Promise<void> {
    try {
      // Get the document
      const docResult = await this.db.query(
        'SELECT title, content FROM rag_documents WHERE id = $1',
        [id]
      );

      if (docResult.rows.length === 0) {
        throw new Error(`Document with ID ${id} not found`);
      }

      const doc = docResult.rows[0];
      const embedding = await this.llmService.generateEmbedding(
        `${doc.title} ${doc.content}`
      );

      // Update the embedding
      await this.db.query(
        'UPDATE rag_documents SET embedding = $1 WHERE id = $2',
        [JSON.stringify(embedding), id]
      );

      console.log(`✅ Updated embedding for document ID: ${id}`);
    } catch (error) {
      console.error('❌ Error updating document embedding:', error);
      throw error;
    }
  }

  async getAllDocuments(): Promise<Document[]> {
    try {
      const result = await this.db.query(
        'SELECT id, title, content, metadata, created_at, updated_at FROM rag_documents ORDER BY created_at DESC'
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        metadata: row.metadata,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('❌ Error getting all documents:', error);
      throw error;
    }
  }

  async processExistingDocuments(): Promise<void> {
    try {
      // Find documents without embeddings
      const result = await this.db.query(
        'SELECT id FROM rag_documents WHERE embedding IS NULL'
      );

      console.log(`📋 Found ${result.rows.length} documents without embeddings`);

      // Process each document
      for (const row of result.rows as any[]) {
        await this.updateDocumentEmbedding(row.id);
      }

      console.log('✅ All documents processed');
    } catch (error) {
      console.error('❌ Error processing existing documents:', error);
      throw error;
    }
  }
}