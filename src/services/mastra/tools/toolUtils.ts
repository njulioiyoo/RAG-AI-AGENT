/**
 * Tool Utilities for Mastra
 * Provides helper functions for tool parameter extraction and context handling
 * 
 * Based on Mastra's ToolExecutionContext format:
 * - Mastra passes tool parameters in a nested context structure: { context: { param1: value1 }, runId: '...', ... }
 * - This utility handles parameter extraction from various context formats
 * - Provides validation to ensure required parameters are present
 * 
 * @see Mastra documentation for ToolExecutionContext structure
 */

/**
 * Extract parameters from Mastra's ToolExecutionContext
 * Mastra passes tool parameters in a nested context structure:
 * { context: { param1: value1, param2: value2 }, runId: '...', ... }
 * 
 * This function handles multiple context formats:
 * 1. context.context (primary - Mastra's actual format)
 * 2. context.args (fallback)
 * 3. Direct context (fallback)
 * 4. context.params (final fallback)
 * 
 * @param context - The ToolExecutionContext from Mastra
 * @returns Extracted parameters object
 */
export function extractToolParams<T extends Record<string, unknown>>(
  context: unknown
): T {
  if (!context || typeof context !== 'object') {
    throw new Error('Invalid tool context: context must be an object');
  }

  const ctx = context as Record<string, unknown>;

  // Method 1: context.context (Primary - Mastra's actual format)
  // Mastra wraps tool parameters in a nested context property
  if (ctx.context && typeof ctx.context === 'object' && ctx.context !== null) {
    const params = ctx.context as T;
    // Verify it has actual parameter properties (not just metadata)
    if (Object.keys(params).length > 0 && !('runId' in params)) {
      return params;
    }
  }

  // Method 2: context.args (Fallback - some versions might use args)
  if (ctx.args && typeof ctx.args === 'object' && ctx.args !== null) {
    const params = ctx.args as T;
    if (Object.keys(params).length > 0 && !('runId' in params)) {
      return params;
    }
  }

  // Method 3: Direct context (Fallback - if context is the params object)
  // Check if context has parameter-like properties (not metadata)
  const metadataKeys = ['runId', 'runtimeContext', 'writer', 'tracingContext'];
  const hasParams = Object.keys(ctx).some(key => !metadataKeys.includes(key));
  if (hasParams) {
    return ctx as T;
  }

  // Method 4: context.params (Final fallback)
  if (ctx.params && typeof ctx.params === 'object' && ctx.params !== null) {
    return ctx.params as T;
  }

  // If no parameters found, return empty object
  return {} as T;
}

/**
 * Validate that required parameters are present in extracted params
 * @param params - Extracted parameters
 * @param requiredFields - Array of required field names
 * @throws Error if required fields are missing
 */
export function validateRequiredParams(
  params: Record<string, unknown>,
  requiredFields: string[]
): void {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    if (!(field in params) || params[field] === null || params[field] === undefined) {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    throw new Error(
      `Missing required parameters: ${missingFields.join(', ')}`
    );
  }
}

/**
 * Extract and validate tool parameters in one step
 * @param context - The ToolExecutionContext from Mastra
 * @param requiredFields - Array of required field names
 * @returns Extracted and validated parameters
 */
export function extractAndValidateParams<T extends Record<string, unknown>>(
  context: unknown,
  requiredFields: string[]
): T {
  const params = extractToolParams<T>(context);
  validateRequiredParams(params, requiredFields);
  return params;
}

