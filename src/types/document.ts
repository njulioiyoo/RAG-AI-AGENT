export interface Document {
  id?: number;
  title: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

export interface VectorSearchResult {
  document: Document;
  similarity: number;
}

export interface RAGQuery {
  query: string;
  limit?: number;
  threshold?: number;
}

export interface RAGResponse {
  answer: string;
  sources: VectorSearchResult[];
  query: string;
  timestamp: Date;
}