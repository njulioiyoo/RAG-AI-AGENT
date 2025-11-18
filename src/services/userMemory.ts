import Database from '../config/database';
import { LLMService } from './llm';

export interface ConversationTurn {
  id?: number;
  userId: string;
  sessionId: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: Date;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface MemoryContext {
  recentConversation: ConversationTurn[];
  relevantHistory: ConversationTurn[];
  userProfile: Record<string, any>;
}

export class UserMemoryService {
  private db: typeof Database;
  private llmService: LLMService;

  constructor() {
    this.db = Database;
    this.llmService = new LLMService();
  }

  // Initialize conversation memory table
  async initializeMemoryTables(): Promise<void> {
    try {
      // Create conversation_history table
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          session_id VARCHAR(255) NOT NULL,
          user_message TEXT NOT NULL,
          assistant_response TEXT NOT NULL,
          embedding vector(768),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create user_profiles table for storing user preferences and context
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) UNIQUE NOT NULL,
          profile_data JSONB DEFAULT '{}',
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better performance
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_conversation_user_session 
        ON conversation_history(user_id, session_id)
      `);
      
      await this.db.query(`
        CREATE INDEX IF NOT EXISTS idx_conversation_embedding 
        ON conversation_history USING ivfflat (embedding vector_cosine_ops)
      `);

      console.log('✅ Memory tables initialized');
    } catch (error) {
      console.error('❌ Error initializing memory tables:', error);
      throw error;
    }
  }

  // Store conversation turn in memory
  async storeConversationTurn(conversationTurn: ConversationTurn): Promise<number> {
    try {
      // Create embedding for the conversation context
      const conversationText = `User: ${conversationTurn.userMessage}\nAssistant: ${conversationTurn.assistantResponse}`;
      const embedding = await this.llmService.generateEmbedding(conversationText);

      const result = await this.db.query(
        `INSERT INTO conversation_history 
         (user_id, session_id, user_message, assistant_response, embedding, metadata) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id`,
        [
          conversationTurn.userId,
          conversationTurn.sessionId,
          conversationTurn.userMessage,
          conversationTurn.assistantResponse,
          JSON.stringify(embedding),
          conversationTurn.metadata || {}
        ]
      );

      console.log(`✅ Stored conversation turn for user ${conversationTurn.userId}`);
      return result.rows[0].id;
    } catch (error) {
      console.error('❌ Error storing conversation turn:', error);
      throw error;
    }
  }

  // Get recent conversation history for a user session
  async getRecentConversation(userId: string, sessionId: string, limit: number = 10): Promise<ConversationTurn[]> {
    try {
      const result = await this.db.query(
        `SELECT id, user_id, session_id, user_message, assistant_response, 
                metadata, created_at, updated_at
         FROM conversation_history 
         WHERE user_id = $1 AND session_id = $2 
         ORDER BY created_at DESC 
         LIMIT $3`,
        [userId, sessionId, limit]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        userMessage: row.user_message,
        assistantResponse: row.assistant_response,
        timestamp: row.created_at,
        metadata: row.metadata
      })).reverse(); // Return in chronological order
    } catch (error) {
      console.error('❌ Error getting recent conversation:', error);
      throw error;
    }
  }

  // Search for relevant conversation history using vector similarity
  async searchRelevantHistory(
    userId: string, 
    query: string, 
    limit: number = 5, 
    threshold: number = 0.7,
    excludeSessionId?: string
  ): Promise<ConversationTurn[]> {
    try {
      const queryEmbedding = await this.llmService.generateEmbedding(query);
      
      let sqlQuery = `
        SELECT id, user_id, session_id, user_message, assistant_response, 
               metadata, created_at, updated_at,
               1 - (embedding <=> $2::vector) as similarity
        FROM conversation_history 
        WHERE user_id = $1 
          AND 1 - (embedding <=> $2::vector) > $3
      `;
      
      const params = [userId, JSON.stringify(queryEmbedding), threshold];
      
      if (excludeSessionId) {
        sqlQuery += ` AND session_id != $4`;
        params.push(excludeSessionId);
      }
      
      sqlQuery += `
        ORDER BY embedding <=> $2::vector
        LIMIT $${params.length + 1}
      `;
      params.push(limit);

      const result = await this.db.query(sqlQuery, params);

      return result.rows.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        sessionId: row.session_id,
        userMessage: row.user_message,
        assistantResponse: row.assistant_response,
        timestamp: row.created_at,
        metadata: { ...row.metadata, similarity: parseFloat(row.similarity) }
      }));
    } catch (error) {
      console.error('❌ Error searching relevant history:', error);
      throw error;
    }
  }

  // Get or create user profile
  async getUserProfile(userId: string): Promise<Record<string, any>> {
    try {
      let result = await this.db.query(
        'SELECT profile_data, preferences FROM user_profiles WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Create new user profile
        result = await this.db.query(
          `INSERT INTO user_profiles (user_id, profile_data, preferences) 
           VALUES ($1, '{}', '{}') 
           RETURNING profile_data, preferences`,
          [userId]
        );
      }

      return {
        ...result.rows[0].profile_data,
        preferences: result.rows[0].preferences
      };
    } catch (error) {
      console.error('❌ Error getting user profile:', error);
      throw error;
    }
  }

  // Update user profile
  async updateUserProfile(userId: string, profileData: Record<string, any>, preferences?: Record<string, any>): Promise<void> {
    try {
      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const params: any[] = [];
      let paramIndex = 1;

      if (profileData) {
        updates.push(`profile_data = profile_data || $${paramIndex}::jsonb`);
        params.push(JSON.stringify(profileData));
        paramIndex++;
      }

      if (preferences) {
        updates.push(`preferences = preferences || $${paramIndex}::jsonb`);
        params.push(JSON.stringify(preferences));
        paramIndex++;
      }

      params.push(userId);

      await this.db.query(
        `UPDATE user_profiles 
         SET ${updates.join(', ')} 
         WHERE user_id = $${paramIndex}`,
        params
      );

      console.log(`✅ Updated profile for user ${userId}`);
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      throw error;
    }
  }

  // Get comprehensive memory context for a user
  async getMemoryContext(userId: string, sessionId: string, currentQuery: string): Promise<MemoryContext> {
    try {
      const [recentConversation, relevantHistory, userProfile] = await Promise.all([
        this.getRecentConversation(userId, sessionId, 5),
        this.searchRelevantHistory(userId, currentQuery, 3, 0.7, sessionId),
        this.getUserProfile(userId)
      ]);

      return {
        recentConversation,
        relevantHistory,
        userProfile
      };
    } catch (error) {
      console.error('❌ Error getting memory context:', error);
      throw error;
    }
  }

  // Clean old conversation history (retention policy)
  async cleanOldConversations(retentionDays: number = 30): Promise<number> {
    try {
      const result = await this.db.query(
        `DELETE FROM conversation_history 
         WHERE created_at < NOW() - INTERVAL '${retentionDays} days'`
      );

      console.log(`🧹 Cleaned ${result.rowCount} old conversation records`);
      return result.rowCount || 0;
    } catch (error) {
      console.error('❌ Error cleaning old conversations:', error);
      throw error;
    }
  }
}