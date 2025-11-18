import { LLMProvider, LLMConfig } from '../types/llm';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider implements LLMProvider {
  private genAI: GoogleGenerativeAI;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey || process.env.GEMINI_API_KEY || '');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const result = await model.embedContent(text);
      
      return result.embedding.values || [];
    } catch (error) {
      console.error('❌ Gemini embedding error:', error);
      throw error;
    }
  }

  async generateResponse(prompt: string, context: string[]): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      const contextText = context.join('\n\n');
      
      const fullPrompt = `You are a helpful AI assistant that answers questions based on provided context. Use the context documents to provide accurate and relevant answers. If the context doesn't contain enough information, mention what additional information would be helpful.

Context Documents:
${contextText}

Question: ${prompt}

Please provide a comprehensive answer based on the context provided.`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      
      return response.text() || 'Sorry, I could not generate a response.';
    } catch (error) {
      console.error('❌ Gemini chat error:', error);
      throw error;
    }
  }
}


export class LLMService {
  private provider: GeminiProvider;

  constructor(config: LLMConfig = { provider: 'gemini' }) {
    this.provider = new GeminiProvider(config);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return this.provider.generateEmbedding(text);
  }

  async generateResponse(prompt: string, context: string[]): Promise<string> {
    return this.provider.generateResponse(prompt, context);
  }
}