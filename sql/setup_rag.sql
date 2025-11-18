-- Setup RAG tables in existing database
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table for RAG system
CREATE TABLE IF NOT EXISTS rag_documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS rag_documents_embedding_idx 
ON rag_documents USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Create index for text search
CREATE INDEX IF NOT EXISTS rag_documents_content_idx 
ON rag_documents USING gin(to_tsvector('english', content));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rag_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-updating timestamps
DROP TRIGGER IF EXISTS update_rag_documents_updated_at ON rag_documents;
CREATE TRIGGER update_rag_documents_updated_at
    BEFORE UPDATE ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_rag_updated_at_column();

-- Insert sample documents
INSERT INTO rag_documents (title, content, metadata) VALUES 
('Introduction to Machine Learning', 
 'Machine learning is a subset of artificial intelligence that focuses on the development of algorithms that can learn and make decisions from data without being explicitly programmed.',
 '{"category": "technology", "tags": ["AI", "ML", "algorithms"]}'),

('Understanding Neural Networks',
 'Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes called neurons that process information using connectionist approaches.',
 '{"category": "technology", "tags": ["neural networks", "deep learning", "AI"]}'),

('Database Design Principles',
 'Good database design is crucial for application performance. Key principles include normalization, proper indexing, and understanding relationships between entities.',
 '{"category": "database", "tags": ["SQL", "design", "performance"]}'),

('Web Development Best Practices',
 'Modern web development involves understanding frontend frameworks, backend APIs, security considerations, and performance optimization techniques.',
 '{"category": "web development", "tags": ["frontend", "backend", "security"]}')
ON CONFLICT DO NOTHING;

-- Note: Embeddings will be populated by the application when documents are processed