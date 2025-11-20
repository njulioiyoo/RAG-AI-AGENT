/**
 * User Preferences Tool for Mastra Agent
 * Allows agent to get and update user preferences
 */

import { createTool } from '@mastra/core';
import { extractAndValidateParams } from './toolUtils.js';
import type { UserMemory } from '../../../types/mastra.js';

interface GetUserPreferencesParams extends Record<string, unknown> {
  userId: string;
}

interface UpdateUserPreferencesParams extends Record<string, unknown> {
  userId: string;
  preferences: Record<string, unknown>;
}

/**
 * Create user preferences tool for Mastra Agent
 */
export function createUserPreferencesTool(
  getUserMemoryFn: (userId: string, sessionId: string) => Promise<UserMemory>,
  updatePreferencesFn: (userId: string, preferences: Record<string, unknown>) => Promise<void>
) {
  return createTool({
    id: 'get_user_preferences',
    description: `Get user preferences and profile information.
Use this tool to retrieve user-specific preferences like language, response style, or other customizations.
This helps you personalize responses based on user preferences.

Parameters:
- userId (required): The user ID to get preferences for`,
    execute: async (context: unknown): Promise<Record<string, unknown>> => {
      try {
        // Extract parameters from Mastra's ToolExecutionContext
        const params = extractAndValidateParams<GetUserPreferencesParams>(
          context,
          ['userId']
        );
        
        const { userId } = params;
        
        if (typeof userId !== 'string') {
          throw new Error('userId parameter must be a string');
        }

        console.log(`👤 [Tool] Getting preferences for user: ${userId}`);
        
        // Use empty sessionId for preferences lookup
        const userMemory = await getUserMemoryFn(userId, 'default');
        
        return {
          preferences: userMemory.preferences || {},
          profile: userMemory.profile || {}
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [Tool] Get preferences error: ${errorMessage}`);
        throw new Error(`Failed to get user preferences: ${errorMessage}`);
      }
    }
  });
}

/**
 * Create update user preferences tool for Mastra Agent
 */
export function createUpdateUserPreferencesTool(
  updatePreferencesFn: (userId: string, preferences: Record<string, unknown>) => Promise<void>
) {
  return createTool({
    id: 'update_user_preferences',
    description: `Update user preferences and profile information.
Use this tool when the user explicitly requests to change their preferences, such as language, response style, or notification settings.
Only update preferences when the user explicitly asks for it.

Parameters:
- userId (required): The user ID to update preferences for
- preferences (required): The preferences to update (e.g., { language: "en", response_style: "detailed" })`,
    execute: async (context: unknown): Promise<{ success: boolean; message: string }> => {
      try {
        // Extract parameters from Mastra's ToolExecutionContext
        const params = extractAndValidateParams<UpdateUserPreferencesParams>(
          context,
          ['userId', 'preferences']
        );
        
        const { userId, preferences } = params;
        
        if (typeof userId !== 'string') {
          throw new Error('userId parameter must be a string');
        }
        
        if (!preferences || typeof preferences !== 'object') {
          throw new Error('preferences parameter is required and must be an object');
        }

        console.log(`👤 [Tool] Updating preferences for user: ${userId}`);
        
        await updatePreferencesFn(userId, preferences);
        
        return {
          success: true,
          message: 'User preferences updated successfully'
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [Tool] Update preferences error: ${errorMessage}`);
        throw new Error(`Failed to update user preferences: ${errorMessage}`);
      }
    }
  });
}

