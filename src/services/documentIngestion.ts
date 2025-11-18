import * as fs from 'fs';
import * as path from 'path';
import { VectorSearchService } from './vectorSearch';

export interface DocumentChunk {
  title: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  metadata: Record<string, any>;
}

export class DocumentIngestionService {
  private vectorSearchService: VectorSearchService;

  constructor() {
    this.vectorSearchService = new VectorSearchService();
  }

  // Parse Markdown and extract metadata
  parseMarkdown(content: string, filename: string): { title: string; content: string; metadata: Record<string, any> } {
    const lines = content.split('\n');
    let title = filename.replace('.md', '');
    let cleanContent = content;
    const metadata: Record<string, any> = {
      filename,
      type: 'markdown',
      ingested_at: new Date().toISOString()
    };

    // Extract title from first H1 heading
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (line.startsWith('# ')) {
        title = line.substring(2).trim();
        break;
      }
    }

    // Extract frontmatter if exists
    if (content.startsWith('---')) {
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd > 0) {
        const frontmatter = content.substring(3, frontmatterEnd).trim();
        cleanContent = content.substring(frontmatterEnd + 3).trim();
        
        // Parse simple YAML frontmatter
        frontmatter.split('\n').forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim().replace(/['"]/g, '');
            metadata[key] = value;
          }
        });
      }
    }

    return { title, content: cleanContent, metadata };
  }

  // Chunk document into smaller pieces
  chunkDocument(content: string, maxChunkSize: number = 1000, overlapSize: number = 200): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim() + '.';
      
      if ((currentChunk + trimmedSentence).length <= maxChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // Start new chunk with overlap
        if (chunks.length > 0 && overlapSize > 0) {
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.min(words.length, Math.floor(overlapSize / 6))); // Approx 6 chars per word
          currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
        } else {
          currentChunk = trimmedSentence;
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks.length > 0 ? chunks : [content];
  }

  // Ingest single Markdown file
  async ingestMarkdownFile(filePath: string): Promise<number[]> {
    try {
      console.log(`📄 Ingesting file: ${filePath}`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const filename = path.basename(filePath);
      
      const { title, content: cleanContent, metadata } = this.parseMarkdown(content, filename);
      const chunks = this.chunkDocument(cleanContent);
      
      console.log(`📚 Document "${title}" split into ${chunks.length} chunks`);

      const documentIds: number[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle = chunks.length > 1 ? `${title} (Part ${i + 1}/${chunks.length})` : title;
        const chunkMetadata = {
          ...metadata,
          chunkIndex: i,
          totalChunks: chunks.length,
          originalTitle: title
        };

        const documentId = await this.vectorSearchService.addDocument({
          title: chunkTitle,
          content: chunks[i],
          metadata: chunkMetadata
        });

        documentIds.push(documentId);
      }

      console.log(`✅ Successfully ingested "${title}" as ${chunks.length} documents`);
      return documentIds;
      
    } catch (error) {
      console.error(`❌ Error ingesting file ${filePath}:`, error);
      throw error;
    }
  }

  // Ingest all Markdown files from a directory
  async ingestMarkdownDirectory(directoryPath: string): Promise<number[]> {
    try {
      console.log(`📁 Ingesting directory: ${directoryPath}`);
      
      if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
      }

      const files = fs.readdirSync(directoryPath);
      const markdownFiles = files.filter(file => file.endsWith('.md'));
      
      console.log(`📚 Found ${markdownFiles.length} Markdown files`);

      const allDocumentIds: number[] = [];
      
      for (const file of markdownFiles) {
        const filePath = path.join(directoryPath, file);
        const documentIds = await this.ingestMarkdownFile(filePath);
        allDocumentIds.push(...documentIds);
      }

      console.log(`✅ Successfully ingested ${markdownFiles.length} files (${allDocumentIds.length} total documents)`);
      return allDocumentIds;
      
    } catch (error) {
      console.error(`❌ Error ingesting directory ${directoryPath}:`, error);
      throw error;
    }
  }

  // Ingest from text content directly
  async ingestMarkdownContent(content: string, filename: string = 'untitled.md'): Promise<number[]> {
    try {
      console.log(`📝 Ingesting content: ${filename}`);
      
      const { title, content: cleanContent, metadata } = this.parseMarkdown(content, filename);
      const chunks = this.chunkDocument(cleanContent);
      
      console.log(`📚 Content "${title}" split into ${chunks.length} chunks`);

      const documentIds: number[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkTitle = chunks.length > 1 ? `${title} (Part ${i + 1}/${chunks.length})` : title;
        const chunkMetadata = {
          ...metadata,
          chunkIndex: i,
          totalChunks: chunks.length,
          originalTitle: title
        };

        const documentId = await this.vectorSearchService.addDocument({
          title: chunkTitle,
          content: chunks[i],
          metadata: chunkMetadata
        });

        documentIds.push(documentId);
      }

      console.log(`✅ Successfully ingested "${title}" as ${chunks.length} documents`);
      return documentIds;
      
    } catch (error) {
      console.error(`❌ Error ingesting content ${filename}:`, error);
      throw error;
    }
  }
}