# Event Hub Tests

This directory contains the test suite for the Event Hub system.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual functions
├── integration/       # Integration tests for API and components
└── load/              # Load testing scripts (future)
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- validation.test.ts
```

## Test Coverage

The test suite covers:

- ✅ API validation middleware
- ✅ Event creation endpoint
- ✅ Health check endpoint
- ✅ Delivery retry logic
- ✅ Error handling
- ✅ Idempotency checks

## Future Tests

Additional tests to implement:

1. **Database Integration Tests**
   - Fan-out worker event processing
   - Dispatcher message delivery with ordering
   - Cleanup worker stale message recovery

2. **End-to-End Tests**
   - Full flow from event ingestion to webhook delivery
   - Ordering guarantees with concurrent events
   - Retry and DLQ behavior

3. **Load Tests**
   - 200 events/second sustained load
   - Burst traffic handling
   - Ordering stress test (many events, same key)

## Writing Tests

### Unit Tests

```typescript
import { functionToTest } from '../../src/path/to/module';

describe('functionToTest', () => {
  it('should do something', () => {
    const result = functionToTest(input);
    expect(result).toBe(expected);
  });
});
```

### Integration Tests

```typescript
import request from 'supertest';
import app from '../../src/api/server';

describe('API Endpoint', () => {
  it('should return 200', async () => {
    const response = await request(app).get('/endpoint');
    expect(response.status).toBe(200);
  });
});
```

## Mocking

We use Jest mocking for external dependencies:

```typescript
jest.mock('../../src/db/pool', () => ({
  pool: {
    query: jest.fn(),
  },
}));
```

## CI/CD

Tests are automatically run on:
- Pull request creation
- Push to main branch
- Pre-deployment checks

Minimum coverage thresholds:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

