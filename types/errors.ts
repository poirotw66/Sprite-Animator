/**
 * Error types for better type safety
 */

export interface ApiError {
  message: string;
  status?: number;
  code?: number;
}

export interface QuotaError extends ApiError {
  status: 429 | 503;
  code?: 429 | 503;
}

/**
 * Type guard to check if error is an API error
 */
export const isApiError = (error: unknown): error is ApiError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('message' in error || 'status' in error || 'code' in error)
  );
};

/**
 * Type guard to check if error is a quota/rate limit error
 */
export const isQuotaError = (error: unknown): error is QuotaError => {
  if (!isApiError(error)) {
    const msg = typeof error === 'string' ? error : JSON.stringify(error);
    return (
      msg.includes('429') ||
      msg.includes('503') ||
      msg.includes('Quota') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('quota') ||
      msg.includes('exceeded') ||
      msg.includes('Overloaded')
    );
  }

  return (
    error.status === 429 ||
    error.code === 429 ||
    error.status === 503 ||
    error.code === 503 ||
    error.message.includes('429') ||
    error.message.includes('503') ||
    error.message.includes('Quota') ||
    error.message.includes('RESOURCE_EXHAUSTED') ||
    error.message.includes('quota') ||
    error.message.includes('exceeded') ||
    error.message.includes('Overloaded')
  );
};

/**
 * Extract error message from unknown error type
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (isApiError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
};
