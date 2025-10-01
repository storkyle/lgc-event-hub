// HTTP client configuration using undici for connection pooling
import { Agent, setGlobalDispatcher } from 'undici';
import { config } from '../utils/config';

// Configure global connection pool for fetch
const agent = new Agent({
  connections: config.http.maxConnections,
  pipelining: 1,
  keepAliveTimeout: config.http.keepAliveTimeout,
  keepAliveMaxTimeout: config.http.keepAliveMaxTimeout,
  headersTimeout: config.http.headersTimeout,
  bodyTimeout: config.http.bodyTimeout,
});

setGlobalDispatcher(agent);

// Helper function for webhook calls with timeout
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = config.worker.webhookTimeoutMs, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
    }
    
    throw error;
  }
}

export { agent };

