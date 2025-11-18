/**
 * Document Search Tool for Mastra Agent
 * Allows agent to search documents in the knowledge base
 */

import { createTool } from '@mastra/core';
import type { VectorSearchDocument } from '../../../types/mastra.js';

interface DocumentSearchParams {
  query: string;
  limit?: number;
  threshold?: number;
}

interface DocumentSearchResult {
  documents: Array<{
    id: number;
    title: string;
    content: string;
    similarity: number;
  }>;
  count: number;
}

/**
 * Create document search tool for Mastra Agent
 */
export function createDocumentSearchTool(
  searchFn: (query: string, options?: { limit?: number; threshold?: number }) => Promise<VectorSearchDocument[]>
) {
  return createTool({
    id: 'search-documents',
    description: `Search the employee handbook knowledge base for relevant information.
Use this tool when you need to find specific information about company policies, procedures, or guidelines.
The tool performs semantic search to find the most relevant documents based on the query.

Parameters:
- query (required): The search query describing what information you're looking for
- limit (optional): Maximum number of documents to return (default: 5)
- threshold (optional): Similarity threshold between 0 and 1 (default: 0.3)

Returns: Array of relevant documents with their content and similarity scores.`,
    execute: async (context: any): Promise<DocumentSearchResult> => {
      try {
        // Extract parameters from context
        const params = (context.params || context || {}) as DocumentSearchParams;
        const { query, limit = 5, threshold = 0.3 } = params;
        
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          throw new Error('Query parameter is required and must be a non-empty string');
        }

        console.log(`🔍 [Tool] Searching documents with query: "${query}"`);
        
        const results = await searchFn(query, { limit, threshold });
        
        const documents = results.map(result => ({
          id: result.document.id,
          title: result.document.title,
          content: result.document.content.substring(0, 500), // Limit content length
          similarity: result.similarity
        }));

        console.log(`✅ [Tool] Found ${documents.length} documents`);
        
        return {
          documents,
          count: documents.length
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [Tool] Document search error: ${errorMessage}`);
        throw new Error(`Failed to search documents: ${errorMessage}`);
      }
    }
  });
}

