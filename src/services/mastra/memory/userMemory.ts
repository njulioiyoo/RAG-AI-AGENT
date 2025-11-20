/**
 * User Memory Management
 * Handles conversation history and user preferences
 */

import { Pool, QueryResult } from 'pg';
import {
  UserMemory,
  ChatOptions,
  SERVICE_CONSTANTS,
  DatabaseError,
  ConversationTurn,
} from '../../../types/mastra.js';

interface UserProfileRow {
  preferences: Record<string, unknown> | null;
  profile_data: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface ConversationHistoryRow {
  user_message: string;
  assistant_response: string;
  created_at: Date;
}

export class UserMemoryManager {
  private dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
  }

  /**
   * Retrieve user memory and conversation history
   * Automatically creates user profile if it doesn't exist
   */
  async getUserMemory(userId: string, sessionId: string): Promise<UserMemory> {
    try {
      // Get user preferences from user_profiles table (matches schema)
      const userQuery = `
        SELECT preferences, profile_data, created_at, updated_at
        FROM user_profiles 
        WHERE user_id = $1
        LIMIT 1;
      `;
      
      let preferences: Record<string, unknown> = {};
      let profileData: Record<string, unknown> = {};
      
      try {
        const userResult: QueryResult<UserProfileRow> = await this.dbPool.query(userQuery, [userId]);
        if (userResult.rows.length > 0) {
          const row = userResult.rows[0];
          preferences = (row.preferences as Record<string, unknown>) || {};
          profileData = (row.profile_data as Record<string, unknown>) || {};
        } else {
          // User doesn't exist, create a new user profile
          await this.createUserProfile(userId);
          console.log(`✅ [UserMemory] Created new user profile for: ${userId}`);
        }
      } catch (error: unknown) {
        // If table doesn't exist or query fails, try to create user anyway
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`⚠️ [UserMemory] Could not fetch user preferences: ${errorMessage}`);
        try {
          await this.createUserProfile(userId);
        } catch (createError) {
          console.warn(`⚠️ [UserMemory] Could not create user profile: ${createError}`);
        }
      }

      // Get recent conversation history for this session (matches schema)
      const historyQuery = `
        SELECT user_message, assistant_response, created_at
        FROM conversation_history 
        WHERE user_id = $1 AND session_id = $2
        ORDER BY created_at ASC 
        LIMIT $3;
      `;

      let conversationHistory: ConversationTurn[] = [];
      
      try {
        const historyResult: QueryResult<ConversationHistoryRow> = await this.dbPool.query(historyQuery, [
        userId, 
        sessionId, 
        SERVICE_CONSTANTS.MAX_HISTORY_TURNS
      ]);

        conversationHistory = historyResult.rows.map(row => ({
          user_message: row.user_message,
          assistant_response: row.assistant_response,
          created_at: row.created_at
        }));
      } catch (error: unknown) {
        // If table doesn't exist or query fails, use empty history
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`⚠️ [UserMemory] Could not fetch conversation history: ${errorMessage}`);
      }

      return {
        conversations: conversationHistory,
        preferences,
        profile: { userId, sessionId, ...profileData }
      };

    } catch (error) {
      // Return empty memory instead of throwing error
      // This allows chat to work even if memory tables are missing
      console.error(`❌ [UserMemory] Error retrieving memory, returning empty: ${error}`);
      return {
        conversations: [],
        preferences: {},
        profile: { userId, sessionId }
      };
    }
  }

  /**
   * Save conversation turn to history
   */
  async saveConversationTurn(
    userId: string,
    sessionId: string,
    query: string,
    response: string
  ): Promise<void> {
    try {
      // Use schema column names: user_message and assistant_response
      const insertQuery = `
        INSERT INTO conversation_history (user_id, session_id, user_message, assistant_response, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING;
      `;

      await this.dbPool.query(insertQuery, [userId, sessionId, query, response]);

      // Clean up old conversation history (keep only recent entries)
      const cleanupQuery = `
        DELETE FROM conversation_history 
        WHERE user_id = $1 
        AND session_id = $2 
        AND id NOT IN (
          SELECT id FROM conversation_history 
          WHERE user_id = $1 AND session_id = $2 
          ORDER BY created_at DESC 
          LIMIT $3
        );
      `;

      try {
      await this.dbPool.query(cleanupQuery, [
        userId, 
        sessionId, 
        SERVICE_CONSTANTS.MAX_HISTORY_TURNS * 2
      ]);
      } catch (cleanupError) {
        // Non-critical error, just log it
        console.warn(`⚠️ [UserMemory] Could not cleanup old conversations: ${cleanupError}`);
      }

    } catch (error) {
      // Don't throw error - just log it so chat can still work
      console.error(`❌ [UserMemory] Failed to save conversation turn: ${error}`);
      // Don't throw - allow chat to continue even if saving fails
    }
  }

  /**
   * Create a new user profile if it doesn't exist
   * @private
   */
  private async createUserProfile(userId: string): Promise<void> {
    try {
      const insertQuery = `
        INSERT INTO user_profiles (user_id, profile_data, preferences, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING;
      `;

      const defaultProfileData = {
        user_id: userId,
        created_at: new Date().toISOString()
      };

      const defaultPreferences = {
        language: 'auto', // Auto-detect language
        response_style: 'detailed'
      };

      await this.dbPool.query(insertQuery, [
        userId,
        JSON.stringify(defaultProfileData),
        JSON.stringify(defaultPreferences)
      ]);
    } catch (error) {
      // Log but don't throw - allow system to continue
      console.warn(`⚠️ [UserMemory] Could not create user profile for ${userId}: ${error}`);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Record<string, unknown>
  ): Promise<void> {
    try {
      // Use user_profiles table (matches schema)
      const upsertQuery = `
        INSERT INTO user_profiles (user_id, preferences, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          preferences = EXCLUDED.preferences,
          updated_at = NOW();
      `;

      await this.dbPool.query(upsertQuery, [
        userId, 
        JSON.stringify(preferences)
      ]);

    } catch (error) {
      // Don't throw error - just log it
      console.error(`❌ [UserMemory] Failed to update preferences: ${error}`);
    }
  }

  /**
   * Get conversation statistics for a user
   */
  async getUserStats(userId: string): Promise<{
    totalSessions: number;
    totalQuestions: number;
    lastActivity: Date | null;
  }> {
    try {
      // Use created_at instead of timestamp (matches schema)
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(*) as total_questions,
          MAX(created_at) as last_activity
        FROM conversation_history 
        WHERE user_id = $1;
      `;

      const result = await this.dbPool.query(statsQuery, [userId]);
      const row = result.rows[0];

      return {
        totalSessions: parseInt(row.total_sessions) || 0,
        totalQuestions: parseInt(row.total_questions) || 0,
        lastActivity: row.last_activity ? new Date(row.last_activity) : null
      };

    } catch (error) {
      // Return empty stats instead of throwing
      console.error(`❌ [UserMemory] Failed to get stats: ${error}`);
      return {
        totalSessions: 0,
        totalQuestions: 0,
        lastActivity: null
      };
    }
  }
}