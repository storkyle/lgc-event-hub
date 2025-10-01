// Unit tests for delivery logic
import { shouldRetry } from '../../src/workers/shared/deliverWebhook';
import { DeliveryResult } from '../../src/workers/shared/deliverWebhook';

describe('shouldRetry', () => {
  it('should not retry on success', () => {
    const result: DeliveryResult = {
      success: true,
      statusCode: 200,
      duration: 100,
    };

    expect(shouldRetry(result)).toBe(false);
  });

  it('should retry on network error (no status code)', () => {
    const result: DeliveryResult = {
      success: false,
      duration: 100,
      errorMessage: 'Network error',
    };

    expect(shouldRetry(result)).toBe(true);
  });

  it('should retry on 429 rate limit', () => {
    const result: DeliveryResult = {
      success: false,
      statusCode: 429,
      duration: 100,
      errorMessage: 'Rate limited',
    };

    expect(shouldRetry(result)).toBe(true);
  });

  it('should retry on 500 server error', () => {
    const result: DeliveryResult = {
      success: false,
      statusCode: 500,
      duration: 100,
      errorMessage: 'Internal server error',
    };

    expect(shouldRetry(result)).toBe(true);
  });

  it('should retry on 503 service unavailable', () => {
    const result: DeliveryResult = {
      success: false,
      statusCode: 503,
      duration: 100,
      errorMessage: 'Service unavailable',
    };

    expect(shouldRetry(result)).toBe(true);
  });

  it('should not retry on 400 bad request', () => {
    const result: DeliveryResult = {
      success: false,
      statusCode: 400,
      duration: 100,
      errorMessage: 'Bad request',
    };

    expect(shouldRetry(result)).toBe(false);
  });

  it('should not retry on 404 not found', () => {
    const result: DeliveryResult = {
      success: false,
      statusCode: 404,
      duration: 100,
      errorMessage: 'Not found',
    };

    expect(shouldRetry(result)).toBe(false);
  });

  it('should not retry on 422 unprocessable entity', () => {
    const result: DeliveryResult = {
      success: false,
      statusCode: 422,
      duration: 100,
      errorMessage: 'Unprocessable entity',
    };

    expect(shouldRetry(result)).toBe(false);
  });
});

