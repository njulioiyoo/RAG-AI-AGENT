import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export class Database {
  private static instance: Database;
  private pool: Pool;

  private constructor() {
    this.pool = pool;
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async query(text: string, params?: any[]) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  public async connect(): Promise<void> {
    try {
      await this.pool.connect();
      console.log('🗄️ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    console.log('🗄️ Database connection closed');
  }

  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rows.length > 0;
    } catch (error) {
      console.error('❌ Database test connection failed:', error);
      return false;
    }
  }

  public async ensureVectorExtension(): Promise<boolean> {
    try {
      await this.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ pgvector extension ensured');
      return true;
    } catch (error) {
      console.warn('⚠️ pgvector extension not available on this database. Vector search will be disabled.');
      console.warn('Consider using a database with pgvector support or running locally with docker-compose.postgres.yml');
      return false;
    }
  }
}

export default Database.getInstance();