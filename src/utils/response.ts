/**
 * Response Formatting Utilities
 * Standardized response formatting for API endpoints
 */

import { Response } from 'express';
import { ApiResponse, ErrorResponse, HTTP_STATUS, ERROR_CODES } from '../types/api.js';

/**
 * Response formatter utility class
 */
export class ResponseFormatter {
  /**
   * Send successful response with data
   */
  static success<T>(res: Response, data: T, statusCode: number = HTTP_STATUS.OK): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send error response with proper formatting
   */
  static error(
    res: Response,
    message: string,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: Record<string, any>
  ): void {
    const response: ErrorResponse = {
      error: message,
      code,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, message: string, details?: Record<string, any>): void {
    this.error(res, message, ERROR_CODES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST, details);
  }

  /**
   * Send not found error response
   */
  static notFound(res: Response, resource: string = 'Resource'): void {
    this.error(res, `${resource} not found`, ERROR_CODES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  /**
   * Send unauthorized error response
   */
  static unauthorized(res: Response, message: string = 'Unauthorized access'): void {
    this.error(res, message, ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
  }

  /**
   * Send service unavailable error response
   */
  static serviceUnavailable(res: Response, message: string = 'Service temporarily unavailable'): void {
    this.error(res, message, ERROR_CODES.SERVICE_ERROR, HTTP_STATUS.SERVICE_UNAVAILABLE);
  }

  /**
   * Send database error response
   */
  static databaseError(res: Response, message: string = 'Database operation failed'): void {
    this.error(res, message, ERROR_CODES.DATABASE_ERROR, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  /**
   * Format execution time for logging
   */
  static formatExecutionTime(startTime: number): string {
    return `${Date.now() - startTime}ms`;
  }

  /**
   * Create standardized log context
   */
  static createLogContext(
    operation: string,
    duration?: number,
    additionalContext?: Record<string, any>
  ): Record<string, any> {
    return {
      operation,
      timestamp: new Date().toISOString(),
      ...(duration !== undefined && { duration: `${duration}ms` }),
      ...additionalContext,
    };
  }
}

/**
 * Request timing middleware helper
 */
export class RequestTimer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time since creation
   */
  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get formatted elapsed time
   */
  getElapsedFormatted(): string {
    return ResponseFormatter.formatExecutionTime(this.startTime);
  }

  /**
   * Reset timer
   */
  reset(): void {
    this.startTime = Date.now();
  }
}