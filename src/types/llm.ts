export interface LLMProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateResponse(prompt: string, context: string[]): Promise<string>;
}

export interface LLMConfig {
  provider: 'gemini';
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface EmbeddingResponse {
  embedding: number[];
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}