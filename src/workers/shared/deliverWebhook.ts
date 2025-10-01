// Webhook delivery logic
import { fetchWithTimeout } from '../../http/client';
import { MessageWithDetails } from '../../types';
import { deliveryLatency, messagesDelivered } from '../../metrics';
import { pool } from '../../db/pool';
import { v4 as uuidv4 } from 'uuid';

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  duration: number;
  errorMessage?: string;
  responseBody?: string;
}

export async function deliverWebhook(
  message: MessageWithDetails,
  _workerId: string
): Promise<DeliveryResult> {
  const startTime = Date.now();
  
  try {
    // Make webhook call
    const response = await fetchWithTimeout(message.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Type': message.event_type,
        'X-Event-Version': message.version,
        'X-Message-Id': message.id,
        'X-Event-Id': message.event_id,
        'X-Delivery-Attempt': String(message.retry_count + 1),
      },
      body: JSON.stringify(message.payload),
      timeout: 10000,
    });
    
    const duration = Date.now() - startTime;
    
    // Read response body (max 1KB for logging)
    const responseText = await response.text().catch(() => '');
    const responseBody = responseText.slice(0, 1000);
    
    // Log delivery attempt
    await pool.query(`
      INSERT INTO delivery_attempts (
        id, message_id, attempt_number,
        http_status, response_body, attempted_at, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
    `, [
      uuidv4(),
      message.id,
      message.retry_count + 1,
      response.status,
      responseBody,
      duration,
    ]);
    
    // Metrics
    deliveryLatency.observe({ subscriber_id: message.subscriber_id }, duration / 1000);
    
    // Check response status
    if (response.ok) {
      // Success (2xx)
      messagesDelivered.inc({ subscriber_id: message.subscriber_id, status: 'success' });
      
      return {
        success: true,
        statusCode: response.status,
        duration,
        responseBody,
      };
    } else {
      // HTTP error
      messagesDelivered.inc({ subscriber_id: message.subscriber_id, status: 'http_error' });
      
      return {
        success: false,
        statusCode: response.status,
        duration,
        errorMessage: `HTTP ${response.status}`,
        responseBody,
      };
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log delivery attempt with error
    await pool.query(`
      INSERT INTO delivery_attempts (
        id, message_id, attempt_number,
        error_message, attempted_at, duration_ms
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      uuidv4(),
      message.id,
      message.retry_count + 1,
      errorMessage,
      duration,
    ]);
    
    messagesDelivered.inc({ subscriber_id: message.subscriber_id, status: 'network_error' });
    
    return {
      success: false,
      duration,
      errorMessage,
    };
  }
}

// Categorize errors for retry decisions
export function shouldRetry(result: DeliveryResult): boolean {
  if (result.success) return false;
  
  const status = result.statusCode;
  
  // Retry on: 429, 5xx, timeout, network errors
  if (!status) return true; // Network error or timeout
  if (status === 429) return true; // Rate limited
  if (status >= 500) return true; // Server error
  
  // Don't retry on: 4xx (except 429)
  return false;
}

