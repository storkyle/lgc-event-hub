// PostgreSQL connection pool configuration
import { Pool, PoolConfig } from 'pg';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = {
  host: config.db.host,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  port: config.db.port,
  
  // Pool settings
  max: config.db.maxConnections,
  idleTimeoutMillis: config.db.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.connectionTimeoutMillis,
  
  // Query settings
  statement_timeout: config.db.statementTimeout,
};

export const pool = new Pool(poolConfig);

// Error handler
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

// Connection event
pool.on('connect', () => {
  logger.debug('New database connection established');
});

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info('Database connection successful', { time: result.rows[0].now });
    return true;
  } catch (error) {
    logger.error('Database connection failed', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  logger.info('Shutting down database pool...');
  await pool.end();
  logger.info('Database pool closed');
};

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

