# Testing Guide

## Overview

This project includes three types of tests:
- **Unit Tests**: Test individual functions and classes in isolation
- **Integration Tests**: Test interaction with real SiYuan API
- **E2E Tests**: Test the HTTP server with real requests

## Running Tests

### All Tests

```bash
cd mcp-server
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

## Unit Tests

Unit tests don't require any external dependencies:

```bash
npm test -- tests/cache.test.ts
npm test -- tests/search.test.ts
npm test -- tests/api.test.ts
```

## Integration Tests

Integration tests require a running SiYuan instance:

1. Start SiYuan
2. Set environment variables:

```bash
export SIYUAN_API_URL=http://127.0.0.1:6806
export SIYUAN_API_TOKEN=your-token-here  # Optional
export RUN_INTEGRATION_TESTS=true
```

3. Run integration tests:

```bash
npm test -- tests/integration.test.ts
```

## E2E Tests

E2E tests start the HTTP server and make real requests:

1. Ensure SiYuan is running
2. Set environment variables:

```bash
export SIYUAN_API_URL=http://127.0.0.1:6806
export RUN_E2E_TESTS=true
```

3. Run E2E tests:

```bash
npm test -- tests/e2e.test.ts
```

## Test Structure

```
mcp-server/tests/
├── api.test.ts          # SiYuan API client unit tests
├── cache.test.ts        # Cache utility unit tests
├── search.test.ts       # Search tools unit tests
├── integration.test.ts  # Integration tests with SiYuan
└── e2e.test.ts         # End-to-end HTTP server tests
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/myModule';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Mocking Example

```typescript
import { vi } from 'vitest';

const mockClient = {
  searchBlocks: vi.fn(),
} as any;

mockClient.searchBlocks.mockResolvedValueOnce({
  blocks: [],
  matchedBlockCount: 0,
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Unit Tests
  run: cd mcp-server && npm test

- name: Run Integration Tests
  if: env.SIYUAN_RUNNING == 'true'
  env:
    RUN_INTEGRATION_TESTS: true
    SIYUAN_API_URL: http://localhost:6806
  run: cd mcp-server && npm test -- tests/integration.test.ts
```

## Coverage Goals

- **Overall**: > 70%
- **API Client**: > 80%
- **Tools**: > 75%
- **Utilities**: > 80%

## Troubleshooting

### Tests Timeout

Increase timeout in test file:

```typescript
it('slow test', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Integration Tests Fail

- Check if SiYuan is running
- Verify API URL and token
- Check network connectivity
- Review SiYuan logs

### Mock Not Working

Clear mocks between tests:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Best Practices

1. **Isolation**: Each test should be independent
2. **Fast**: Unit tests should run quickly (< 100ms each)
3. **Clear**: Test names should describe what they test
4. **Coverage**: Aim for high coverage, but don't test trivial code
5. **Mocking**: Mock external dependencies in unit tests
6. **Real Data**: Use real data in integration tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://testingjavascript.com/)
- [SiYuan API Documentation](https://github.com/siyuan-note/siyuan)
