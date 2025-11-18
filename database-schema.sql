-- RAG AI Agent Database Schema
-- Complete database setup for Employee Handbook RAG system

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. RAG Documents Table - Knowledge Base Storage
CREATE TABLE IF NOT EXISTS rag_documents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(768), -- Gemini embeddings are 768 dimensions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Conversation History Table - Chat Memory  
CREATE TABLE IF NOT EXISTS conversation_history (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    user_message TEXT NOT NULL,
    assistant_response TEXT NOT NULL,
    embedding vector(768), -- For semantic search of conversation history
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. User Profiles Table - User Management
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    profile_data JSONB DEFAULT '{}', -- name, department, role, employee_id, etc
    preferences JSONB DEFAULT '{}', -- language, response_style, notification preferences
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance Optimization

-- RAG Documents vector similarity search
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding 
    ON rag_documents USING ivfflat (embedding vector_cosine_ops);

-- RAG Documents metadata search
CREATE INDEX IF NOT EXISTS idx_rag_documents_metadata 
    ON rag_documents USING gin (metadata);

-- Conversation history user/session lookup
CREATE INDEX IF NOT EXISTS idx_conversation_user_session 
    ON conversation_history(user_id, session_id);

-- Conversation history vector similarity search  
CREATE INDEX IF NOT EXISTS idx_conversation_embedding 
    ON conversation_history USING ivfflat (embedding vector_cosine_ops);

-- User profiles fast lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id 
    ON user_profiles(user_id);

-- Sample Data for Testing (Optional)

-- Insert sample employee for testing
INSERT INTO user_profiles (user_id, profile_data, preferences) 
VALUES (
    'emp-001',
    '{
        "name": "John Doe",
        "employee_id": "EMP-001", 
        "department": "IT",
        "role": "Software Engineer",
        "start_date": "2024-01-15",
        "manager": "Jane Smith"
    }',
    '{
        "language": "Indonesian",
        "response_style": "detailed",
        "notification_frequency": "daily",
        "preferred_topics": ["hr_policies", "technical_support"]
    }'
) ON CONFLICT (user_id) DO NOTHING;

-- Database Statistics and Monitoring Queries

-- View to check knowledge base status
CREATE OR REPLACE VIEW knowledge_base_stats AS
SELECT 
    COUNT(*) as total_documents,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as documents_with_embeddings,
    ARRAY_AGG(DISTINCT metadata->>'category') FILTER (WHERE metadata->>'category' IS NOT NULL) as categories,
    MIN(created_at) as oldest_document,
    MAX(created_at) as newest_document
FROM rag_documents;

-- View to check conversation activity
CREATE OR REPLACE VIEW conversation_stats AS  
SELECT 
    COUNT(DISTINCT user_id) as active_users,
    COUNT(DISTINCT session_id) as total_sessions,
    COUNT(*) as total_conversations,
    DATE_TRUNC('day', created_at) as conversation_date,
    COUNT(*) as daily_conversations
FROM conversation_history
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY conversation_date DESC;

-- Functions for maintenance

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_rag_documents_updated_at 
    BEFORE UPDATE ON rag_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_history_updated_at 
    BEFORE UPDATE ON conversation_history 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;