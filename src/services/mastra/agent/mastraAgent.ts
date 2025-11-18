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
      console.log('📝 [Mastra] Prompt length:', prompt.length);
      console.log('📚 [Mastra] Sources count:', sources.length);

      // Generate response using Mastra Agent
      const response = await this.agent.generate(prompt);

      // Log the response type and structure for debugging (only in development)
      if (process.env.NODE_ENV !== 'production') {
        console.log('📦 [Mastra] Response type:', typeof response);
        if (response && typeof response === 'object') {
          console.log('📦 [Mastra] Response keys:', Object.keys(response));
        }
      }
      
      // Extract text from response
      const answer = this.extractTextFromResponse(response);

      // Validate that we got a meaningful answer
      if (!answer || answer.trim().length === 0) {
        console.error('❌ [Mastra] Empty answer generated');
        console.error('❌ [Mastra] Response structure:', response ? Object.keys(response) : 'null');
        return 'I apologize, but I was unable to generate a response.';
      }

      console.log('✅ [Mastra] Answer generated successfully, length:', answer.length);
      return answer;

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
    // Build a clear, structured prompt that the agent can easily parse
    let prompt = '';
    
    // Add context if available
    if (context && context.trim().length > 0) {
      prompt += `${context}\n\n`;
    }
    
    // Add conversation history if available
    if (memoryContext && memoryContext.trim().length > 0) {
      prompt += `${memoryContext}\n`;
    }
    
    // Add the user's question
    prompt += `Question: ${query}\n\n`;
    
    // Add clear instructions with multilingual support
    prompt += `Please answer the question above based on the provided context from the Employee Handbook. `;
    prompt += `IMPORTANT: Detect the language of the user's question and respond in the SAME language. `;
    prompt += `If the information is available in the context, provide a clear and helpful answer in the user's language. `;
    prompt += `If the information is not available in the context, please say so clearly in the user's language.`;
    
    return prompt;
  }

  /**
   * Extract text from agent response - handles multiple response formats
   * @private
   */
  private extractTextFromResponse(response: any): string {
    // Handle string response
    if (typeof response === 'string') {
      return response;
    }

    // Handle object response
    if (!response || typeof response !== 'object') {
      console.error('❌ [Mastra] Invalid response format:', response);
      return 'I apologize, but I was unable to generate a response.';
    }

    // Mastra Agent format: response.text contains the generated text
    if ('text' in response && typeof response.text === 'string') {
      return response.text;
    }

    // Try common response formats
    if ('content' in response && typeof response.content === 'string') {
      return response.content;
    }

    // Handle message format
    if ('message' in response && response.message) {
      return this.extractTextFromMessage(response.message);
    }

    // Handle choices array format
    if ('choices' in response && Array.isArray(response.choices) && response.choices.length > 0) {
      return this.extractTextFromChoice(response.choices[0]);
    }

    // Try to find text in nested structures
    return this.extractTextFromNestedStructure(response);
  }

  /**
   * Extract text from message object
   * @private
   */
  private extractTextFromMessage(message: any): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message && typeof message === 'object' && 'content' in message) {
      return String(message.content);
    }
    return String(message);
  }

  /**
   * Extract text from choice object
   * @private
   */
  private extractTextFromChoice(choice: any): string {
    if (choice && 'text' in choice) {
      return String(choice.text);
    }
    if (choice && 'message' in choice && choice.message) {
      return this.extractTextFromMessage(choice.message);
    }
    return String(choice);
  }

  /**
   * Recursively search for text in nested structures
   * @private
   */
  private extractTextFromNestedStructure(response: any): string {
    const responseStr = JSON.stringify(response);
    
    // Check if response might contain text/content/message
    if (!responseStr.includes('text') && !responseStr.includes('content') && !responseStr.includes('message')) {
      console.warn('⚠️ [Mastra] Unexpected response format:', responseStr.substring(0, 200));
      return responseStr;
    }

    try {
      const parsed = JSON.parse(responseStr);
      const foundText = this.findTextRecursively(parsed);
      
      if (foundText) {
        return foundText;
      }
      
      throw new Error('Text not found in nested structure');
    } catch (e) {
      console.warn('⚠️ [Mastra] Could not extract text from nested structure');
      return responseStr;
    }
  }

  /**
   * Recursively find text in object structure
   * @private
   */
  private findTextRecursively(obj: any): string | null {
    if (typeof obj === 'string' && obj.length > 10) {
      return obj;
    }

    if (typeof obj !== 'object' || obj === null) {
      return null;
    }

    // Check common text properties
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text;
    }
    if ('content' in obj && typeof obj.content === 'string') {
      return obj.content;
    }
    if ('message' in obj) {
      return this.findTextRecursively(obj.message);
    }

    // Recursively search all properties
    for (const key in obj) {
      const result = this.findTextRecursively(obj[key]);
      if (result) {
        return result;
      }
    }

    return null;
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
- Support multiple languages: automatically detect the language of the user's question and respond in the same language

Multilingual Support:
- Detect the language of the user's question automatically (Indonesian, English, or other languages)
- Always respond in the same language as the user's question
- If the context documents are in a different language, translate and adapt the information while maintaining accuracy
- Maintain professional tone and clarity regardless of language

Guidelines:
- If information is not available in the context, say so clearly in the user's language
- Provide actionable advice when possible
- Use a friendly but professional tone
- Format responses clearly with bullet points or steps when appropriate
- Ensure translations are accurate and culturally appropriate`;
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