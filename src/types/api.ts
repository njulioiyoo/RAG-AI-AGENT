/**
 * API Response Types
 * Standardized response formats for all API endpoints
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
}

/**
 * Error response details
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  framework?: string;
  database?: string;
  agent?: string;
  tools?: string[];
}

/**
 * Statistics response
 */
export interface StatsResponse {
  framework: string;
  version: string;
  agent: string;
  tools: string[];
  status: string;
}

/**
 * Query request validation interface
 */
export interface QueryRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

/**
 * Chat request validation interface
 */
export interface ChatRequest {
  userId: string;
  sessionId: string;
  message: string;
  limit?: number;
  threshold?: number;
}

/**
 * Document addition request interface
 */
export interface DocumentRequest {
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * API endpoint documentation structure
 */
export interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  body?: Record<string, string>;
}

/**
 * API documentation response
 */
export interface ApiDocsResponse {
  name: string;
  version: string;
  description: string;
  endpoints: ApiEndpoint[];
}

/**
 * HTTP status codes used in the application
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Common error codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVICE_ERROR: 'SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;