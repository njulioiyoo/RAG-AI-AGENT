/**
 * Mastra Agent Operations
 * Handles Mastra agent setup and response generation
 */

import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { Tool } from '@mastra/core';
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
  private tools: Tool[] = [];

  constructor() {
    // Initialize in setup method
  }

  /**
   * Setup Mastra framework and Agent with tools
   */
  async setup(tools: Tool[] = []): Promise<void> {
    try {
      // Initialize Mastra framework
      // Mastra instance can be used for workflows, tools registry, and advanced features
      this.mastra = new Mastra({});

      // Store tools
      this.tools = tools;

      // Setup Agent with proper configuration and tools
      const llmConfig = config.getLLMConfig();

      this.agent = new Agent({
        name: 'hr-assistant',
        instructions: this.getAgentInstructions(),
        model: {
          id: `google/${SERVICE_CONSTANTS.CHAT_MODEL}`,
          apiKey: llmConfig.geminiApiKey
        },
        tools: tools.length > 0 ? tools : undefined,
      });

      console.log(`🔧 Mastra Agent configured successfully with ${tools.length} tool(s)`);
    } catch (error) {
      throw new AgentError(
        'Failed to setup Mastra agent',
        { originalError: error }
      );
    }
  }

  /**
   * Generate response using Mastra Agent
   * If tools are available, agent can use them for additional searches or refinements
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

      // If agent has tools, allow it to use them for follow-up searches or refinements
      // Agent can call search-documents tool if it needs more information or wants to refine search
      const prompt = this.buildPrompt(query, context, memoryContext);

      console.log('🤖 [Mastra] Generating response with agent...');
      console.log('📝 [Mastra] Prompt length:', prompt.length);
      console.log('📚 [Mastra] Sources count:', sources.length);
      console.log(`🔧 [Mastra] Agent has ${this.tools.length} tool(s) available`);

      // Generate response using Mastra Agent
      // Agent can use tools if needed (e.g., for follow-up searches, refine search parameters, etc.)
      // Handle both streaming and non-streaming responses
      let response: unknown;
      
      try {
        // Generate with timeout to prevent hanging on streaming issues
        const generatePromise = this.agent.generate(prompt);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Agent generation timeout after 60 seconds')), 60000);
        });
        
        response = await Promise.race([generatePromise, timeoutPromise]);
        
        // Small delay to ensure any internal promises are resolved
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (streamError: unknown) {
        // If streaming error occurs, try to extract any partial response
        const errorMessage = streamError instanceof Error ? streamError.message : String(streamError);
        const errorStack = streamError instanceof Error ? streamError.stack : undefined;
        
        console.warn('⚠️ [Mastra] Streaming error, attempting to recover:', errorMessage);
        if (errorStack) {
          console.warn('⚠️ [Mastra] Error stack:', errorStack.substring(0, 500));
        }
        
        // Check if error has a response property
        if (streamError && typeof streamError === 'object' && 'response' in streamError) {
          response = (streamError as { response: unknown }).response;
        } else {
          // Re-throw if we can't recover
          throw streamError;
        }
      }

      // Log the response type and structure for debugging (only in development)
      if (process.env.NODE_ENV !== 'production') {
        console.log('📦 [Mastra] Response type:', typeof response);
        if (response && typeof response === 'object') {
          console.log('📦 [Mastra] Response keys:', Object.keys(response));
        }
      }
      
      // Extract text from response
      // Handle promise-based response (for streaming)
      // Mastra Agent may return response with text as a promise that needs to be resolved
      let answer: string = '';
      
      // Check if response has text property that might be a promise
      if (response && typeof response === 'object' && 'text' in response) {
        const textValue = response.text;
        
        // If text is a promise, await it with timeout
        if (textValue && typeof (textValue as Promise<string>).then === 'function') {
          try {
            const textPromise = textValue as Promise<string>;
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error('Text promise timeout after 30 seconds')), 30000);
            });
            
            const resolvedText = await Promise.race([textPromise, timeoutPromise]);
            if (resolvedText && typeof resolvedText === 'string' && resolvedText.trim().length > 0) {
              answer = resolvedText;
            }
          } catch (promiseError) {
            const errorMsg = promiseError instanceof Error ? promiseError.message : String(promiseError);
            console.warn('⚠️ [Mastra] Could not resolve text promise:', errorMsg);
            // Fallback to extraction method
            answer = this.extractTextFromResponse(response);
          }
        } else if (typeof textValue === 'string' && textValue.trim().length > 0) {
          answer = textValue;
        } else {
          // Try extraction method
          answer = this.extractTextFromResponse(response);
        }
      } else {
        // No text property, use extraction method
        answer = this.extractTextFromResponse(response);
      }

      // Validate that we got a meaningful answer
      if (!answer || answer.trim().length === 0) {
        console.error('❌ [Mastra] Empty answer generated');
        console.error('❌ [Mastra] Response structure:', response ? Object.keys(response) : 'null');
        console.error('❌ [Mastra] Response value:', JSON.stringify(response, null, 2).substring(0, 500));
        return 'I apologize, but I was unable to generate a response. Please try rephrasing your question.';
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
      .map((turn) => `User: ${turn.user_message}\nAssistant: ${turn.assistant_response}`)
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
    
    // If tools are available, inform agent it can use them for additional searches
    if (this.tools.length > 0) {
      prompt += `\n\nNOTE: You have access to tools (search-documents, get-user-preferences, update-user-preferences). `;
      prompt += `If you need to search for additional information, refine your search with different parameters, `;
      prompt += `or perform multi-step reasoning that requires multiple searches, feel free to use the search-documents tool. `;
      prompt += `The initial context provided above is a starting point, but you can search for more specific information if needed.`;
    } else {
      prompt += `If the information is not available in the context, please say so clearly in the user's language.`;
    }
    
    return prompt;
  }

  /**
   * Extract text from agent response - handles multiple response formats
   * @private
   */
  private extractTextFromResponse(response: unknown): string {
    // Handle string response
    if (typeof response === 'string') {
      return response;
    }

    // Handle object response
    if (!response || typeof response !== 'object') {
      console.error('❌ [Mastra] Invalid response format:', response);
      return 'I apologize, but I was unable to generate a response.';
    }

    const agentResponse = response as Record<string, unknown>;

    // Mastra Agent format: response.text contains the generated text
    if ('text' in agentResponse && typeof agentResponse.text === 'string') {
      return agentResponse.text;
    }

    // Try common response formats
    if ('content' in agentResponse && typeof agentResponse.content === 'string') {
      return agentResponse.content;
    }

    // Handle message format
    if ('message' in agentResponse && agentResponse.message) {
      return this.extractTextFromMessage(agentResponse.message);
    }

    // Handle choices array format
    if ('choices' in agentResponse && Array.isArray(agentResponse.choices) && agentResponse.choices.length > 0) {
      return this.extractTextFromChoice(agentResponse.choices[0]);
    }

    // Try to find text in nested structures
    return this.extractTextFromNestedStructure(response);
  }

  /**
   * Extract text from message object
   * @private
   */
  private extractTextFromMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message && typeof message === 'object' && message !== null && 'content' in message) {
      return String((message as { content: unknown }).content);
    }
    return String(message);
  }

  /**
   * Extract text from choice object
   * @private
   */
  private extractTextFromChoice(choice: unknown): string {
    if (choice && typeof choice === 'object' && choice !== null) {
      const choiceObj = choice as { text?: unknown; message?: unknown };
      if ('text' in choiceObj) {
        return String(choiceObj.text);
      }
      if ('message' in choiceObj && choiceObj.message) {
        return this.extractTextFromMessage(choiceObj.message);
      }
    }
    return String(choice);
  }

  /**
   * Recursively search for text in nested structures
   * @private
   */
  private extractTextFromNestedStructure(response: unknown): string {
    const responseStr = JSON.stringify(response);
    
    // Check if response might contain text/content/message
    if (!responseStr.includes('text') && !responseStr.includes('content') && !responseStr.includes('message')) {
      console.warn('⚠️ [Mastra] Unexpected response format:', responseStr.substring(0, 200));
      return responseStr;
    }

    try {
      const parsed: unknown = JSON.parse(responseStr);
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
  private findTextRecursively(obj: unknown): string | null {
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
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const result = this.findTextRecursively((obj as Record<string, unknown>)[key]);
          if (result) {
            return result;
          }
        }
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

Available Tools:
- search-documents: Use this tool to search the employee handbook knowledge base for relevant information. 
  * Use this tool when you need additional information beyond what's provided in the initial context
  * Use this tool for follow-up questions that require new searches
  * Use this tool to refine searches with different parameters (e.g., different threshold, limit)
  * Use this tool for multi-step reasoning that requires multiple searches
  * You can call this tool multiple times if needed to gather comprehensive information
- get-user-preferences: Use this tool to retrieve user preferences and personalize responses accordingly.
- update-user-preferences: Use this tool only when the user explicitly requests to change their preferences.

Multilingual Support:
- Detect the language of the user's question automatically (Indonesian, English, or other languages)
- Always respond in the same language as the user's question
- If the context documents are in a different language, translate and adapt the information while maintaining accuracy
- Maintain professional tone and clarity regardless of language

Guidelines:
- Use the search-documents tool to find relevant information before answering questions
- If information is not available in the context, say so clearly in the user's language
- Provide actionable advice when possible
- Use a friendly but professional tone
- Format responses clearly with bullet points or steps when appropriate
- Ensure translations are accurate and culturally appropriate
- When referencing documents, mention the document title and similarity score if available`;
  }

  /**
   * Get agent statistics
   */
  getStats(): { agent: string; tools: string[]; framework: string } {
    const toolNames = this.tools.map(tool => tool.id || 'unknown-tool');
    return {
      agent: 'hr-assistant',
      tools: toolNames.length > 0 ? toolNames : ['vector-search', 'user-memory', 'generate-response'],
      framework: 'mastra'
    };
  }

  /**
   * Get Mastra instance (for workflows or advanced features)
   */
  getMastra(): Mastra | undefined {
    return this.mastra;
  }
}