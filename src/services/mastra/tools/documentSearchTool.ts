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
    id: 'search_documents',
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
        // Log context structure for debugging
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔍 [Tool] Context received:', JSON.stringify(context, null, 2).substring(0, 300));
          console.log('🔍 [Tool] Context type:', typeof context);
          if (context && typeof context === 'object') {
            console.log('🔍 [Tool] Context keys:', Object.keys(context));
          }
        }
        
        // Extract parameters from context
        // Mastra passes parameters in different ways - try multiple extraction methods
        // Based on actual logs, Mastra passes as: { context: { query: '...' }, runId: '...', ... }
        let params: DocumentSearchParams;
        
        // Method 1: context.context (Mastra wraps params in a context property)
        if (context && typeof context === 'object' && context.context && typeof context.context === 'object' && 'query' in context.context) {
          params = context.context as DocumentSearchParams;
          console.log('✅ [Tool] Using context.context');
        }
        // Method 2: context.args (Mastra might pass as args)
        else if (context && typeof context === 'object' && context.args && typeof context.args === 'object' && 'query' in context.args) {
          params = context.args as DocumentSearchParams;
          console.log('✅ [Tool] Using context.args');
        }
        // Method 3: Direct context (if context is the params object)
        else if (context && typeof context === 'object' && 'query' in context) {
          params = context as DocumentSearchParams;
          console.log('✅ [Tool] Using direct context');
        }
        // Method 4: context.params
        else if (context && typeof context === 'object' && context.params && typeof context.params === 'object') {
          params = context.params as DocumentSearchParams;
          console.log('✅ [Tool] Using context.params');
        }
        // Method 5: Try to extract from context directly
        else {
          params = (context || {}) as DocumentSearchParams;
          console.log('⚠️ [Tool] Using fallback context extraction');
        }
        
        const { query, limit = 5, threshold = 0.3 } = params;
        
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
          console.error('❌ [Tool] Invalid params received. Context:', JSON.stringify(context, null, 2).substring(0, 500));
          console.error('❌ [Tool] Extracted params:', JSON.stringify(params, null, 2));
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

