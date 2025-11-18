/**
 * Mastra Agent Operations
 * Handles Mastra agent setup and response generation
 */

import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { config } from '../../../config/config.js';
import {
  VectorSearchDocument,
  UserMemory,
  SERVICE_CONSTANTS,
  AgentError,
} from '../../../types/mastra.js';

export class MastraAgent {
  private mastra?: Mastra;
  private agent?: Agent;

  constructor() {
    // Initialize in setup method
  }

  /**
   * Setup Mastra framework and Agent
   */
  async setup(): Promise<void> {
    try {
      // Initialize Mastra framework
      this.mastra = new Mastra({});

      // Setup Agent with proper configuration
      const llmConfig = config.getLLMConfig();

      this.agent = new Agent({
        name: 'hr-assistant',
        instructions: this.getAgentInstructions(),
        model: {
          id: `google/${SERVICE_CONSTANTS.CHAT_MODEL}`,
          apiKey: llmConfig.geminiApiKey
        },
      });

      console.log('🔧 Mastra Agent configured successfully');
    } catch (error) {
      throw new AgentError(
        'Failed to setup Mastra agent',
        { originalError: error }
      );
    }
  }

  /**
   * Generate response using Mastra Agent
   */
  async generateResponse(
    query: string,
    sources: VectorSearchDocument[],
    userMemory?: UserMemory
  ): Promise<string> {
    try {
      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      // Build context from sources
      const context = this.buildContext(sources);
      
      // Build memory context if available
      const memoryContext = userMemory ? this.buildMemoryContext(userMemory) : '';

      // Create comprehensive prompt
      const prompt = this.buildPrompt(query, context, memoryContext);

      console.log('🤖 [Mastra] Generating response with agent...');

      // Generate response using Mastra Agent
      const response = await this.agent.generate(prompt);

      return typeof response === 'string' ? response : 'I apologize, but I was unable to generate a response.';

    } catch (error) {
      console.error('❌ [Mastra Agent] Generation error:', error);
      throw new AgentError(
        'Failed to generate response with Mastra agent',
        { 
          query, 
          sourcesCount: sources.length,
          originalError: error 
        }
      );
    }
  }

  /**
   * Build context from vector search sources
   */
  private buildContext(sources: VectorSearchDocument[]): string {
    if (!sources.length) {
      return 'No relevant documents found in the knowledge base.';
    }

    const contextParts = sources.map((source, index) => {
      return `[Document ${index + 1}: ${source.document.title}]\n${source.document.content.substring(0, SERVICE_CONSTANTS.MAX_CONTENT_LENGTH)}`;
    });

    return `Context from Employee Handbook:\n\n${contextParts.join('\n\n')}`;
  }

  /**
   * Build memory context from user history
   */
  private buildMemoryContext(userMemory: UserMemory): string {
    if (!userMemory.conversations?.length) {
      return '';
    }

    const recentHistory = userMemory.conversations
      .slice(-SERVICE_CONSTANTS.MAX_HISTORY_TURNS)
      .map((turn: any) => `User: ${turn.user_message}\nAssistant: ${turn.assistant_response}`)
      .join('\n\n');

    return `\nConversation History:\n${recentHistory}\n`;
  }

  /**
   * Build comprehensive prompt for the agent
   */
  private buildPrompt(query: string, context: string, memoryContext: string): string {
    return `${context}

${memoryContext}

Human Question: ${query}

Please provide a helpful, accurate answer based on the provided context. If the information isn't available in the context, please say so clearly.`;
  }

  /**
   * Get comprehensive agent instructions
   */
  private getAgentInstructions(): string {
    return `You are an intelligent HR assistant that helps employees with company policy questions.

Your capabilities:
- Answer questions about company policies and procedures
- Provide helpful, accurate information based on employee handbook
- Remember conversation context and user preferences
- Be professional, courteous, and empathetic
- Always cite sources when referencing specific policies

Guidelines:
- If information is not available in the context, say so clearly
- Provide actionable advice when possible
- Use a friendly but professional tone
- Format responses clearly with bullet points or steps when appropriate`;
  }

  /**
   * Get agent statistics
   */
  getStats(): { agent: string; tools: string[]; framework: string } {
    return {
      agent: 'hr-assistant',
      tools: ['vector-search', 'user-memory', 'generate-response'],
      framework: 'mastra'
    };
  }
}