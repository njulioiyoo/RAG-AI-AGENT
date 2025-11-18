import { Pool, PoolClient } from 'pg';
import { config } from './config.js';
import { DatabaseConnectionError, ErrorHandler } from '../utils/errors.js';

export class Database {
  private static instance: Database;
  private pool!: Pool;
  private isConnected: boolean = false;
  private vectorSupported: boolean = false;

  private constructor() {
    this.initializePool();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Initialize PostgreSQL connection pool with enhanced configuration
   */
  private initializePool(): void {
    const dbConfig = config.getDatabaseConfig();
    
    this.pool = new Pool({
      connectionString: dbConfig.url,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      ssl: dbConfig.ssl,
      max: dbConfig.maxConnections,
      connectionTimeoutMillis: dbConfig.connectionTimeout,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: true
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      this.isConnected = false;
      ErrorHandler.logError(err, { context: 'database_pool' });
    });

    this.pool.on('connect', () => {
      this.isConnected = true;
      if (config.isDevelopment()) {
        console.log('🔗 Database client connected');
      }
    });
  }

  /**
   * Execute query with comprehensive error handling
   */
  public async query(text: string, params?: any[]): Promise<any> {
    let client;
    const startTime = Date.now();
    
    try {
      client = await this.pool.connect();
      const result = await client.query(text, params);
      
      if (config.isDevelopment()) {
        const duration = Date.now() - startTime;
        console.log(`🔍 Query executed in ${duration}ms: ${text.substring(0, 50)}...`);
      }
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      ErrorHandler.logError(error, { 
        context: 'database_query',
        query: text.substring(0, 100),
        duration,
        paramsCount: params?.length || 0
      });
      
      // Provide specific error messages
      if (error.code === 'ECONNREFUSED') {
        throw new DatabaseConnectionError('Database server is not reachable');
      } else if (error.code === '42P01') {
        throw new DatabaseConnectionError(`Table does not exist: ${error.message}`);
      } else if (error.code === '42703') {
        throw new DatabaseConnectionError(`Column does not exist: ${error.message}`);
      } else if (error.code === '23505') {
        throw new DatabaseConnectionError(`Duplicate key violation: ${error.detail}`);
      } else {
        throw error;
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Test database connection with comprehensive checks
   */
  public async testConnection(): Promise<boolean> {
    let client: PoolClient | undefined;
    
    try {
      console.log('🔄 Testing database connection...');
      
      client = await this.pool.connect();
      console.log('✅ Connected to PostgreSQL database');

      // Test basic query
      const result = await client.query('SELECT 1 as test');
      if (result.rows.length === 0) {
        throw new Error('Basic query returned no results');
      }
      console.log('✅ Database query test passed');

      this.isConnected = true;
      return true;

    } catch (error: any) {
      this.isConnected = false;
      ErrorHandler.logError(error, { 
        context: 'database_connection_test',
        dbConfig: {
          host: config.getDatabaseConfig().host,
          port: config.getDatabaseConfig().port,
          database: config.getDatabaseConfig().database
        }
      });

      console.error('❌ Database connection test failed:', error.message);
      return false;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Ensure pgvector extension is available
   */
  public async ensureVectorExtension(): Promise<boolean> {
    try {
      await this.query('CREATE EXTENSION IF NOT EXISTS vector');
      
      // Test vector functionality
      await this.query('SELECT vector_dims(\'[1,2,3]\'::vector) as dims');
      
      this.vectorSupported = true;
      console.log('✅ pgvector extension ensured');
      return true;
      
    } catch (error: any) {
      this.vectorSupported = false;
      
      if (error.message?.includes('extension "vector" is not available')) {
        console.warn('⚠️  pgvector extension is not installed on this PostgreSQL instance');
        console.warn('   Install pgvector: https://github.com/pgvector/pgvector#installation');
      } else {
        console.warn('⚠️  pgvector functionality test failed:', error.message);
      }
      
      return false;
    }
  }

  /**
   * Initialize database with all required setup
   */
  public async initialize(): Promise<void> {
    try {
      const isConnected = await this.testConnection();
      if (!isConnected) {
        throw new DatabaseConnectionError('Failed to establish database connection');
      }

      const hasVector = await this.ensureVectorExtension();
      if (!hasVector) {
        console.warn('⚠️  Vector search will be limited without pgvector extension');
      }

      console.log('🗄️  Database initialized successfully');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get connection and vector support status
   */
  public getStatus(): { connected: boolean; vectorSupported: boolean; poolStats: any } {
    return {
      connected: this.isConnected,
      vectorSupported: this.vectorSupported,
      poolStats: {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        waiting: this.pool.waitingCount
      }
    };
  }

  /**
   * Close all database connections
   */
  public async close(): Promise<void> {
    try {
      console.log('🔄 Closing database connections...');
      await this.pool.end();
      this.isConnected = false;
      console.log('🗄️ Database connection closed');
    } catch (error) {
      ErrorHandler.logError(error, { context: 'database_close' });
    }
  }
}

export default Database.getInstance();