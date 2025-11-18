/**
 * User Memory Management
 * Handles conversation history and user preferences
 */

import { Pool } from 'pg';
import {
  UserMemory,
  ChatOptions,
  SERVICE_CONSTANTS,
  DatabaseError,
} from '../../../types/mastra.js';

export class UserMemoryManager {
  private dbPool: Pool;

  constructor(dbPool: Pool) {
    this.dbPool = dbPool;
  }

  /**
   * Retrieve user memory and conversation history
   */
  async getUserMemory(userId: string, sessionId: string): Promise<UserMemory> {
    try {
      // Get user preferences
      const userQuery = `
        SELECT preferences, created_at, updated_at
        FROM user_preferences 
        WHERE user_id = $1
        LIMIT 1;
      `;
      
      const userResult = await this.dbPool.query(userQuery, [userId]);
      
      const preferences = userResult.rows.length > 0 
        ? userResult.rows[0].preferences || {}
        : {};

      // Get recent conversation history for this session
      const historyQuery = `
        SELECT query, response, timestamp
        FROM conversation_history 
        WHERE user_id = $1 AND session_id = $2
        ORDER BY timestamp DESC 
        LIMIT $3;
      `;

      const historyResult = await this.dbPool.query(historyQuery, [
        userId, 
        sessionId, 
        SERVICE_CONSTANTS.MAX_HISTORY_TURNS
      ]);

      const conversationHistory = historyResult.rows
        .reverse() // Reverse to get chronological order
        .map(row => ({
          query: row.query,
          response: row.response,
          timestamp: row.timestamp
        }));

      return {
        conversations: conversationHistory.map(h => ({
          user_message: h.query,
          assistant_response: h.response,
          created_at: h.timestamp
        })),
        preferences,
        profile: { userId, sessionId }
      };

    } catch (error) {
      throw new DatabaseError(
        `Failed to retrieve user memory for user: ${userId}`,
        { userId, sessionId, originalError: error }
      );
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
      const insertQuery = `
        INSERT INTO conversation_history (user_id, session_id, query, response, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, session_id, query, timestamp) 
        DO UPDATE SET response = EXCLUDED.response;
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
          ORDER BY timestamp DESC 
          LIMIT $3
        );
      `;

      await this.dbPool.query(cleanupQuery, [
        userId, 
        sessionId, 
        SERVICE_CONSTANTS.MAX_HISTORY_TURNS * 2
      ]);

    } catch (error) {
      throw new DatabaseError(
        `Failed to save conversation turn for user: ${userId}`,
        { userId, sessionId, query: query.substring(0, 50), originalError: error }
      );
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<void> {
    try {
      const upsertQuery = `
        INSERT INTO user_preferences (user_id, preferences, updated_at)
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
      throw new DatabaseError(
        `Failed to update preferences for user: ${userId}`,
        { userId, preferences, originalError: error }
      );
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
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT session_id) as total_sessions,
          COUNT(*) as total_questions,
          MAX(timestamp) as last_activity
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
      throw new DatabaseError(
        `Failed to get stats for user: ${userId}`,
        { userId, originalError: error }
      );
    }
  }
}