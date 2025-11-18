/**
 * Configuration Management for RAG AI Agent
 * Centralizes all configuration with validation and defaults
 */

import * as dotenv from 'dotenv';
import { InvalidAPIKeyError, DatabaseConnectionError } from '../utils/errors';

// Load environment variables
dotenv.config();

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  connectionTimeout: number;
}

export interface LLMConfig {
  geminiApiKey: string;
  provider: 'gemini';
  model: string;
  embeddingModel: string;
  maxTokens: number;
  temperature: number;
}

export interface VectorConfig {
  dimension: number;
  similarityThreshold: number;
  maxResults: number;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  requestLimit: string;
  timeout: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  llm: LLMConfig;
  vector: VectorConfig;
  server: ServerConfig;
  logging: {
    level: string;
    enableConsole: boolean;
    enableFile: boolean;
  };
}

class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfiguration();
    this.validateConfiguration();
  }

  /**
   * Load configuration from environment variables with defaults
   */
  private loadConfiguration(): AppConfig {
    // Parse database URL if provided
    const databaseUrl = process.env.DATABASE_URL;
    let dbConfig: Partial<DatabaseConfig> = {};
    
    if (databaseUrl) {
      try {
        const url = new URL(databaseUrl);
        dbConfig = {
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.slice(1), // Remove leading slash
          username: url.username,
          password: url.password,
        };
      } catch (error) {
        throw new DatabaseConnectionError('Invalid DATABASE_URL format');
      }
    }

    return {
      database: {
        url: process.env.DATABASE_URL || '',
        host: dbConfig.host || process.env.DB_HOST || 'localhost',
        port: dbConfig.port || parseInt(process.env.DB_PORT || '5432'),
        database: dbConfig.database || process.env.DB_NAME || 'rag_ai_agent',
        username: dbConfig.username || process.env.DB_USER || 'postgres',
        password: dbConfig.password || process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        connectionTimeout: parseInt(process.env.DB_TIMEOUT || '30000')
      },
      
      llm: {
        geminiApiKey: process.env.GEMINI_API_KEY || '',
        provider: 'gemini',
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048'),
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7')
      },
      
      vector: {
        dimension: parseInt(process.env.VECTOR_DIMENSION || '768'),
        similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.3'),
        maxResults: parseInt(process.env.MAX_SEARCH_RESULTS || '10')
      },
      
      server: {
        port: parseInt(process.env.PORT || '3000'),
        nodeEnv: process.env.NODE_ENV || 'development',
        corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
        requestLimit: process.env.REQUEST_LIMIT || '10mb',
        timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000')
      },
      
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableConsole: process.env.LOG_CONSOLE !== 'false',
        enableFile: process.env.LOG_FILE === 'true'
      }
    };
  }

  /**
   * Validate configuration values
   */
  private validateConfiguration(): void {
    const { database, llm, vector, server } = this.config;

    // Validate required fields
    if (!database.url && (!database.host || !database.username)) {
      throw new DatabaseConnectionError('Database configuration is incomplete');
    }

    if (!llm.geminiApiKey) {
      throw new InvalidAPIKeyError('Gemini');
    }

    // Validate API key format (basic check)
    if (!llm.geminiApiKey.startsWith('AIza')) {
      throw new InvalidAPIKeyError('Gemini - Invalid key format');
    }

    // Validate numeric ranges
    if (vector.dimension <= 0 || vector.dimension > 10000) {
      throw new Error('Vector dimension must be between 1 and 10000');
    }

    if (vector.similarityThreshold < 0 || vector.similarityThreshold > 1) {
      throw new Error('Similarity threshold must be between 0 and 1');
    }

    if (server.port <= 0 || server.port > 65535) {
      throw new Error('Server port must be between 1 and 65535');
    }

    // Validate environment
    if (!['development', 'production', 'test'].includes(server.nodeEnv)) {
      console.warn(`⚠️  Unknown NODE_ENV: ${server.nodeEnv}, defaulting to development`);
      this.config.server.nodeEnv = 'development';
    }
  }

  /**
   * Get database configuration
   */
  public getDatabaseConfig(): DatabaseConfig {
    return { ...this.config.database };
  }

  /**
   * Get LLM configuration
   */
  public getLLMConfig(): LLMConfig {
    return { ...this.config.llm };
  }

  /**
   * Get vector search configuration
   */
  public getVectorConfig(): VectorConfig {
    return { ...this.config.vector };
  }

  /**
   * Get server configuration
   */
  public getServerConfig(): ServerConfig {
    return { ...this.config.server };
  }

  /**
   * Get full configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Check if development mode
   */
  public isDevelopment(): boolean {
    return this.config.server.nodeEnv === 'development';
  }

  /**
   * Check if production mode
   */
  public isProduction(): boolean {
    return this.config.server.nodeEnv === 'production';
  }

  /**
   * Print configuration summary (without sensitive data)
   */
  public printConfigSummary(): void {
    const summary = {
      environment: this.config.server.nodeEnv,
      port: this.config.server.port,
      database: {
        host: this.config.database.host,
        port: this.config.database.port,
        database: this.config.database.database,
        ssl: this.config.database.ssl
      },
      llm: {
        provider: this.config.llm.provider,
        model: this.config.llm.model,
        embeddingModel: this.config.llm.embeddingModel,
        hasApiKey: !!this.config.llm.geminiApiKey
      },
      vector: {
        dimension: this.config.vector.dimension,
        threshold: this.config.vector.similarityThreshold
      }
    };

    console.log('🔧 Configuration Summary:');
    console.log(JSON.stringify(summary, null, 2));
  }
}

// Export singleton instance
export const config = new ConfigManager();