/**
 * Document Search Tool for Mastra Agent
 * Allows agent to search documents in the knowledge base
 */

import { createTool } from '@mastra/core';
import type { VectorSearchDocument } from '../../../types/mastra.js';
import { extractAndValidateParams } from './toolUtils.js';

interface DocumentSearchParams extends Record<string, unknown> {
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
    id: 'search_documents',
    description: `Search the employee handbook knowledge base for relevant information.
Use this tool when you need to find specific information about company policies, procedures, or guidelines.
The tool performs semantic search to find the most relevant documents based on the query.

Parameters:
- query (required): The search query describing what information you're looking for
- limit (optional): Maximum number of documents to return (default: 5)
- threshold (optional): Similarity threshold between 0 and 1 (default: 0.3)

Returns: Array of relevant documents with their content and similarity scores.`,
    execute: async (context: unknown): Promise<DocumentSearchResult> => {
      try {
        // Log context structure for debugging (development only)
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 [Tool] Context received:', JSON.stringify(context, null, 2).substring(0, 300));
        }
        
        // Extract parameters from Mastra's ToolExecutionContext
        // Uses utility function that handles Mastra's nested context structure
        const params = extractAndValidateParams<DocumentSearchParams>(
          context,
          ['query']
        );
        
        // Validate query parameter
        const { query, limit = 5, threshold = 0.3 } = params;
        
        if (typeof query !== 'string' || query.trim().length === 0) {
          throw new Error('Query parameter must be a non-empty string');
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

