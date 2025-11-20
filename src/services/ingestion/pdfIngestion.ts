/**
 * PDF Ingestion Pipeline
 * Handles automatic parsing, chunking, embedding, and storage of PDF documents
 */

import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../config/config.js';
import { Database } from '../../config/database.js';

export interface PdfIngestionResult {
  success: boolean;
  message: string;
  documentsCreated: number;
  documentIds: number[];
  error?: string;
}

export interface PdfChunkMetadata {
  filename: string;
  chunkIndex: number;
  totalChunks: number;
  originalTitle: string;
  type: 'pdf';
  pageNumbers?: number[];
  ingested_at: string;
  images?: Array<{
    pageNumber: number;
    imageIndex: number;
    dataUrl: string;
    width: number;
    height: number;
    kind?: string;
  }>;
}

export class PdfIngestionService {
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
   * Ingest PDF from buffer with automatic parsing and chunking
   */
  async ingestPdfBuffer(
    pdfBuffer: Buffer,
    filename: string = 'document.pdf'
  ): Promise<PdfIngestionResult> {
    try {
      console.log(`🚀 [PDF Ingestion] Starting PDF ingestion: ${filename}`);
      
      // Parse PDF to extract text using pdf-parse v2.4.5 class-based API
      // pdf-parse v2.4.5 uses class PDFParse instead of a function
      const pdfParseModule = await import('pdf-parse');
      const { PDFParse } = pdfParseModule;
      
      if (!PDFParse || typeof PDFParse !== 'function') {
        const errorMsg = `pdf-parse module does not export PDFParse class. ` +
          `Available exports: ${Object.keys(pdfParseModule).join(', ')}, ` +
          `Please ensure pdf-parse is installed correctly: npm install pdf-parse@^2.4.5`;
        console.error(`[PDF Ingestion] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Convert Buffer to Uint8Array for better memory usage (as recommended by pdf-parse)
      const uint8Array = new Uint8Array(pdfBuffer);
      
      // Create PDFParse instance with data parameter (not src)
      const pdfParser = new PDFParse({ data: uint8Array });
      
      // Extract text from PDF
      const textResult = await pdfParser.getText();
      let text = textResult.text || '';
      
      // Log extracted text preview for debugging
      console.log(`📄 [PDF Ingestion] Extracted text preview (first 500 chars): ${text.substring(0, 500)}...`);
      console.log(`📄 [PDF Ingestion] Total text length: ${text.length} characters`);
      
      // Get document info for metadata
      const infoResult = await pdfParser.getInfo();
      const numPages = infoResult.total || textResult.total || 1;
      const title = infoResult.info?.Title || filename.replace(/\.pdf$/i, '');
      
      // Log page-by-page text if available for debugging
      if (textResult.pages && textResult.pages.length > 0) {
        console.log(`📄 [PDF Ingestion] Text extracted from ${textResult.pages.length} pages`);
        textResult.pages.slice(0, 3).forEach((page, idx) => {
          if (page.text && page.text.trim().length > 0) {
            console.log(`📄 [PDF Ingestion] Page ${page.num || idx + 1} text preview: ${page.text.substring(0, 200)}...`);
          }
        });
      }
      
      // Extract images from PDF (screenshots of each page for multimodal support)
      console.log(`🖼️ [PDF Ingestion] Extracting images from ${numPages} pages...`);
      let pageImages: Array<{
        pageNumber: number;
        imageIndex: number;
        dataUrl: string;
        width: number;
        height: number;
        kind?: string;
      }> = [];
      
      try {
        // Get screenshots of all pages (better for multimodal analysis than embedded images)
        const screenshotResult = await pdfParser.getScreenshot({
          imageDataUrl: true, // Get as base64 data URL for easy storage
          imageBuffer: false, // Don't need binary buffer
        });
        
        if (screenshotResult && screenshotResult.pages) {
          pageImages = screenshotResult.pages.map((page, index) => ({
            pageNumber: page.pageNumber || index + 1,
            imageIndex: index,
            dataUrl: page.dataUrl || '',
            width: page.width || 0,
            height: page.height || 0,
            kind: 'screenshot',
          })).filter(img => img.dataUrl && img.dataUrl.length > 0);
          
          console.log(`🖼️ [PDF Ingestion] Extracted ${pageImages.length} page images`);
        }
      } catch (imageError) {
        console.warn(`⚠️ [PDF Ingestion] Failed to extract images: ${imageError instanceof Error ? imageError.message : String(imageError)}`);
        // Continue without images - text extraction is more important
      }
      
      // Also try to extract tables for better structured data capture
      // This helps capture tabular data like project member lists
      let tableText = '';
      try {
        const tableResult = await pdfParser.getTable();
        if (tableResult && tableResult.pages) {
          for (const page of tableResult.pages) {
            if (page.tables && page.tables.length > 0) {
              for (const table of page.tables) {
                // Convert table array to text format
                if (Array.isArray(table)) {
                  const tableRows = table.map((row: any) => {
                    if (Array.isArray(row)) {
                      return row.map((cell: any) => {
                        if (typeof cell === 'string') return cell;
                        if (cell && typeof cell === 'object' && 'text' in cell) return cell.text;
                        return String(cell || '');
                      }).join(' | ');
                    }
                    return String(row || '');
                  });
                  tableText += tableRows.join('\n') + '\n\n';
                }
              }
            }
          }
          if (tableText.trim().length > 0) {
            console.log(`📊 [PDF Ingestion] Extracted ${tableText.length} characters from tables`);
            // Append table text to main text for better coverage
            text = text + '\n\n' + tableText;
          }
        }
      } catch (tableError) {
        console.warn(`⚠️ [PDF Ingestion] Failed to extract tables: ${tableError instanceof Error ? tableError.message : String(tableError)}`);
        // Continue without tables - text extraction is primary
      }
      
      // Clean up parser instance
      await pdfParser.destroy();

      if (!text || text.trim().length === 0) {
        throw new Error('PDF contains no extractable text');
      }

      console.log(`📄 [PDF Ingestion] Extracted ${text.length} characters from ${numPages} pages (including tables if available)`);

      // Chunk the PDF content
      const chunks = await this.chunkPdfContent(text, numPages);
      console.log(`📄 [PDF Ingestion] Created ${chunks.length} chunks from PDF`);

      const documentIds: number[] = [];

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkTitle = `${title} (Part ${i + 1}/${chunks.length})`;

        // Estimate page numbers for this chunk
        const pageNumbers = this.estimatePageNumbers(i, chunks.length, numPages);
        
        // Get images for pages in this chunk
        const chunkImages = pageImages.filter(img => 
          pageNumbers.includes(img.pageNumber)
        );

        const metadata: PdfChunkMetadata = {
          filename,
          chunkIndex: i,
          totalChunks: chunks.length,
          originalTitle: title,
          type: 'pdf',
          pageNumbers,
          ingested_at: new Date().toISOString(),
          images: chunkImages.length > 0 ? chunkImages : undefined,
        };

        console.log(`🔮 [PDF Ingestion] Processing chunk ${i + 1}/${chunks.length}`);
        console.log(`📝 [PDF Ingestion] Chunk ${i + 1} preview: ${chunk.substring(0, 100)}...`);
        console.log(`📏 [PDF Ingestion] Chunk ${i + 1} length: ${chunk.length} characters`);

        // Generate embedding for chunk
        const embedding = await this.generateEmbedding(chunk);
        console.log(`🔮 [PDF Ingestion] Generated embedding for chunk ${i + 1} (dimension: ${embedding.length})`);

        // Store chunk with embedding
        const documentId = await this.storeChunkWithEmbedding(
          chunkTitle,
          chunk,
          metadata,
          embedding
        );

        documentIds.push(documentId);
        console.log(`✅ [PDF Ingestion] Stored chunk ${i + 1} with ID: ${documentId}, title: "${chunkTitle}"`);
      }

      const result: PdfIngestionResult = {
        success: true,
        message: `Successfully ingested ${filename} as ${chunks.length} chunks`,
        documentsCreated: chunks.length,
        documentIds,
      };

      console.log(`🎉 [PDF Ingestion] Completed: ${JSON.stringify(result)}`);
      return result;

    } catch (error) {
      console.error('❌ [PDF Ingestion] Failed:', error);
      return {
        success: false,
        message: 'Failed to ingest PDF content',
        documentsCreated: 0,
        documentIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Ingest PDF from file path
   */
  async ingestPdfFile(filePath: string): Promise<PdfIngestionResult> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const pdfBuffer = await fs.readFile(filePath);
      const filename = path.basename(filePath);
      
      return this.ingestPdfBuffer(pdfBuffer, filename);
    } catch (error) {
      return {
        success: false,
        message: `Failed to read PDF file: ${filePath}`,
        documentsCreated: 0,
        documentIds: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Chunk PDF content into meaningful sections
   * Preserves paragraph boundaries, tables, and logical sections
   * Improved to capture tabular data and structured information
   */
  private async chunkPdfContent(content: string, numPages: number): Promise<string[]> {
    const chunks: string[] = [];
    const maxChunkSize = 1200; // Reduced for better granularity
    const minChunkSize = 20; // Reduced minimum to capture short but important info
    
    // First, try to preserve structured data (tables, lists)
    // Split by patterns that indicate structured data
    const structuredPatterns = [
      /\n\s*\d+\s+[A-Z][a-z]+\s+[A-Z]/g, // Pattern: "2000112 Lilis Lianatus Solikhah"
      /\n\s*[A-Z][a-z]+\s+[A-Z]\s+[A-Za-z]+/g, // Pattern: "Julio N Programmer"
      /\n\s*[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g, // Pattern: "Project Management Analyst"
    ];
    
    // Split by double newlines (paragraphs) first
    let sections = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Further split sections that look like tables or structured lists
    const processedSections: string[] = [];
    for (const section of sections) {
      // Check if section looks like a table or structured list
      const lines = section.split('\n');
      const hasStructuredData = lines.some(line => {
        // Check for patterns like employee IDs, names, roles
        return /\d{7}\s+[A-Z]/.test(line) || // Employee ID pattern
               /[A-Z][a-z]+\s+[A-Z]\s+[A-Za-z]+/.test(line) || // Name pattern
               /[A-Z][a-z]+\s+[A-Z][a-z]+\s+\([A-Z]+\)/.test(line); // Role pattern
      });
      
      if (hasStructuredData && section.length > maxChunkSize) {
        // Split structured data by lines to preserve each entry
        const structuredLines: string[] = [];
        let currentGroup = '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          // If line looks like a header or section title, start new group
          if (/^[A-Z][A-Za-z\s]+\([A-Z]+\)$/.test(trimmedLine) || 
              /^[A-Z][A-Za-z\s]+$/.test(trimmedLine) && trimmedLine.length < 50) {
            if (currentGroup.trim().length > 0) {
              structuredLines.push(currentGroup.trim());
              currentGroup = trimmedLine + '\n';
            } else {
              currentGroup = trimmedLine + '\n';
            }
          } else {
            currentGroup += trimmedLine + '\n';
            
            // If current group is getting large, save it
            if (currentGroup.length > maxChunkSize) {
              structuredLines.push(currentGroup.trim());
              currentGroup = '';
            }
          }
        }
        
        if (currentGroup.trim().length > 0) {
          structuredLines.push(currentGroup.trim());
        }
        
        processedSections.push(...structuredLines);
      } else {
        processedSections.push(section);
      }
    }
    
    // Now chunk the processed sections
    let currentChunk = '';
    
    for (const section of processedSections) {
      const trimmedSection = section.trim();
      
      // If section itself is too long, split it further
      if (trimmedSection.length > maxChunkSize) {
        // Save current chunk if exists
        if (currentChunk.trim().length >= minChunkSize) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // Split long section by sentences or lines
        const lines = trimmedSection.split('\n');
        let lineChunk = '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          
          if (lineChunk.length + trimmedLine.length > maxChunkSize && lineChunk.length >= minChunkSize) {
            chunks.push(lineChunk.trim());
            lineChunk = trimmedLine;
          } else {
            lineChunk += (lineChunk ? '\n' : '') + trimmedLine;
          }
        }
        
        if (lineChunk.trim().length >= minChunkSize) {
          currentChunk = lineChunk;
        }
      } else {
        // If adding section exceeds max size, save current chunk
        if (currentChunk.length + trimmedSection.length > maxChunkSize && currentChunk.trim().length >= minChunkSize) {
          chunks.push(currentChunk.trim());
          currentChunk = trimmedSection;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + trimmedSection;
        }
      }
    }
    
    // Add the last chunk if it's not empty
    if (currentChunk.trim().length >= minChunkSize) {
      chunks.push(currentChunk.trim());
    }

    // Filter out very small chunks but keep important structured data
    const filteredChunks = chunks.filter(chunk => {
      if (chunk.length < minChunkSize) return false;
      
      // Keep chunks that look like structured data even if small
      const hasStructuredPattern = /\d{7}\s+[A-Z]/.test(chunk) || 
                                   /[A-Z][a-z]+\s+[A-Z]\s+[A-Za-z]+/.test(chunk) ||
                                   /[A-Z][a-z]+\s+[A-Z][a-z]+\s+\([A-Z]+\)/.test(chunk);
      
      return chunk.length >= minChunkSize || hasStructuredPattern;
    });
    
    console.log(`📊 [PDF Chunking] Created ${filteredChunks.length} chunks (filtered from ${chunks.length} raw chunks)`);
    console.log(`📊 [PDF Chunking] Chunk sizes: ${filteredChunks.map(c => c.length).join(', ')}`);
    
    return filteredChunks;
  }

  /**
   * Estimate page numbers for a chunk based on its position
   */
  private estimatePageNumbers(chunkIndex: number, totalChunks: number, totalPages: number): number[] {
    const pagesPerChunk = totalPages / totalChunks;
    const startPage = Math.max(1, Math.floor(chunkIndex * pagesPerChunk) + 1);
    const endPage = Math.min(totalPages, Math.floor((chunkIndex + 1) * pagesPerChunk));
    
    const pages: number[] = [];
    for (let page = startPage; page <= endPage; page++) {
      pages.push(page);
    }
    
    return pages.length > 0 ? pages : [1];
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
    metadata: PdfChunkMetadata,
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
   * Cleanup resources
   */
  async close(): Promise<void> {
    // Don't close the pool as it's shared - Database singleton handles it
  }
}

