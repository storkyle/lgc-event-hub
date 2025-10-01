// Example Consumer: Simple webhook receiver that logs payloads to console
import express from 'express';

const app = express();
const PORT = process.env.CONSUMER_PORT || 4000;

// Parse JSON payloads
app.use(express.json());

// Webhook endpoint - receives events from Event Hub
app.post('/webhook', (req, res) => {
  const messageId = req.headers['x-message-id'];
  const eventType = req.headers['x-event-type'];
  const timestamp = new Date().toISOString();

  console.log('\n========================================');
  console.log(`[${timestamp}] 🎉 Webhook received!`);
  console.log('========================================');
  console.log('Headers:');
  console.log(`  - Message ID: ${messageId}`);
  console.log(`  - Event Type: ${eventType}`);
  console.log('\nPayload:');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('========================================\n');

  // Return 200 OK to acknowledge successful delivery
  res.status(200).json({
    status: 'success',
    message: 'Webhook received and logged',
    received_at: timestamp
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'example-consumer',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║       Example Consumer Service             ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`✓ Listening on http://localhost:${PORT}`);
  console.log(`✓ Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log('\n🎯 Ready to receive webhooks from Event Hub!\n');
  console.log('Waiting for events...\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down consumer...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down consumer...');
  process.exit(0);
});

