import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Database from './config/database';
import apiRoutes from './routes/api';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'RAG AI Agent',
    description: 'Retrieval-Augmented Generation AI Agent using Mastra framework',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      docs: '/api/docs',
      query: '/api/query',
      documents: '/api/documents',
      stats: '/api/stats'
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
async function startServer() {
  try {
    console.log('🚀 RAG AI Agent starting...');
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔌 Port: ${PORT}`);
    console.log(`🗄️ Database URL: ${process.env.DATABASE_URL?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

    // Test database connection
    const dbConnected = await Database.testConnection();
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }
    
    // Check pgvector extension availability
    const hasVectorExtension = await Database.ensureVectorExtension();
    console.log(`🔍 Vector search available: ${hasVectorExtension}`);

    const server = app.listen(PORT, () => {
      console.log(`✅ RAG AI Agent is running on port ${PORT}`);
      console.log(`🌐 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🔍 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📝 Query Endpoint: http://localhost:${PORT}/api/query`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('📦 Shutting down RAG AI Agent...');
      server.close(async () => {
        await Database.close();
        console.log('✅ Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();