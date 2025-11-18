/**
 * Input Validation Utilities for RAG AI Agent
 * Provides comprehensive validation for API inputs and data
 */

import { ValidationError } from './errors.js';

export interface ValidationRule {
  field: string;
  value: any;
  rules: ValidationType[];
}

export enum ValidationType {
  REQUIRED = 'required',
  STRING = 'string',
  NUMBER = 'number',
  EMAIL = 'email',
  MIN_LENGTH = 'minLength',
  MAX_LENGTH = 'maxLength',
  ARRAY = 'array',
  OBJECT = 'object',
  POSITIVE = 'positive',
  UUID = 'uuid'
}

export class Validator {
  /**
   * Validate a single value against rules
   */
  static validateField(field: string, value: any, rules: ValidationType[], options?: any): void {
    // Required check
    if (rules.includes(ValidationType.REQUIRED) && this.isEmpty(value)) {
      throw new ValidationError(field, 'Field is required');
    }

    // Skip other validations if value is empty and not required
    if (this.isEmpty(value)) return;

    // Type validations
    if (rules.includes(ValidationType.STRING) && typeof value !== 'string') {
      throw new ValidationError(field, 'Must be a string');
    }

    if (rules.includes(ValidationType.NUMBER) && typeof value !== 'number') {
      throw new ValidationError(field, 'Must be a number');
    }

    if (rules.includes(ValidationType.ARRAY) && !Array.isArray(value)) {
      throw new ValidationError(field, 'Must be an array');
    }

    if (rules.includes(ValidationType.OBJECT) && typeof value !== 'object') {
      throw new ValidationError(field, 'Must be an object');
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.includes(ValidationType.MIN_LENGTH) && options?.minLength) {
        if (value.length < options.minLength) {
          throw new ValidationError(field, `Must be at least ${options.minLength} characters`);
        }
      }

      if (rules.includes(ValidationType.MAX_LENGTH) && options?.maxLength) {
        if (value.length > options.maxLength) {
          throw new ValidationError(field, `Must be no more than ${options.maxLength} characters`);
        }
      }

      if (rules.includes(ValidationType.EMAIL)) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          throw new ValidationError(field, 'Must be a valid email address');
        }
      }

      if (rules.includes(ValidationType.UUID)) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
          throw new ValidationError(field, 'Must be a valid UUID');
        }
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.includes(ValidationType.POSITIVE) && value <= 0) {
        throw new ValidationError(field, 'Must be a positive number');
      }
    }
  }

  /**
   * Validate chat request
   */
  static validateChatRequest(body: any): void {
    this.validateField('userId', body.userId, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1 });
    this.validateField('sessionId', body.sessionId, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1 });
    this.validateField('message', body.message, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1, maxLength: 10000 });
    
    if (body.limit !== undefined) {
      this.validateField('limit', body.limit, [ValidationType.NUMBER, ValidationType.POSITIVE]);
    }
    
    if (body.threshold !== undefined) {
      this.validateField('threshold', body.threshold, [ValidationType.NUMBER]);
    }
  }

  /**
   * Validate query request
   */
  static validateQueryRequest(body: any): void {
    this.validateField('query', body.query, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1, maxLength: 10000 });
    
    if (body.limit !== undefined) {
      this.validateField('limit', body.limit, [ValidationType.NUMBER, ValidationType.POSITIVE]);
    }
    
    if (body.threshold !== undefined) {
      this.validateField('threshold', body.threshold, [ValidationType.NUMBER]);
    }
  }

  /**
   * Validate document request
   */
  static validateDocumentRequest(body: any): void {
    this.validateField('title', body.title, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1, maxLength: 500 });
    this.validateField('content', body.content, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1, maxLength: 100000 });
    
    if (body.metadata !== undefined) {
      this.validateField('metadata', body.metadata, [ValidationType.OBJECT]);
    }
  }

  /**
   * Validate markdown ingestion request
   */
  static validateMarkdownRequest(body: any): void {
    this.validateField('content', body.content, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1, maxLength: 100000 });
    
    if (body.filename !== undefined) {
      this.validateField('filename', body.filename, [ValidationType.STRING], { maxLength: 255 });
    }
  }

  /**
   * Validate file path
   */
  static validateFilePath(filePath: string): void {
    this.validateField('filePath', filePath, [ValidationType.REQUIRED, ValidationType.STRING]);
    
    // Check for dangerous paths
    const dangerousPatterns = ['../', '~/', '/etc/', '/var/', '/usr/'];
    for (const pattern of dangerousPatterns) {
      if (filePath.includes(pattern)) {
        throw new ValidationError('filePath', 'Path contains dangerous patterns');
      }
    }
    
    // Ensure it's a markdown file
    if (!filePath.endsWith('.md')) {
      throw new ValidationError('filePath', 'File must be a Markdown file (.md)');
    }
  }

  /**
   * Validate user memory update
   */
  static validateUserMemoryUpdate(body: any): void {
    if (body.profileData !== undefined) {
      this.validateField('profileData', body.profileData, [ValidationType.OBJECT]);
    }
    
    if (body.preferences !== undefined) {
      this.validateField('preferences', body.preferences, [ValidationType.OBJECT]);
    }
    
    // At least one field should be provided
    if (!body.profileData && !body.preferences) {
      throw new ValidationError('request', 'At least profileData or preferences must be provided');
    }
  }

  /**
   * Validate user ID
   */
  static validateUserId(userId: string): void {
    this.validateField('userId', userId, [ValidationType.REQUIRED, ValidationType.STRING], { minLength: 1, maxLength: 255 });
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>\"']/g, '') // Remove potential XSS characters
      .slice(0, 10000); // Limit length
  }

  /**
   * Check if value is empty
   */
  private static isEmpty(value: any): boolean {
    return value === null || 
           value === undefined || 
           value === '' || 
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  }
}

/**
 * Middleware for request validation
 */
export const validateRequest = (validationFn: (body: any) => void) => {
  return (req: any, res: any, next: any) => {
    try {
      validationFn(req.body);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          field: error.message.includes("'") ? error.message.split("'")[1] : undefined
        });
      } else {
        next(error);
      }
    }
  };
};