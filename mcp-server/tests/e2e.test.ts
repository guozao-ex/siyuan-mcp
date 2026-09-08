/**
 * End-to-end tests for HTTP server
 *
 * These tests start the HTTP server and make real requests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHttpServer } from '../src/utils/http-server';
import { createClient } from '../src/siyuan/api';

const skipE2E = process.env.RUN_E2E_TESTS !== 'true';

describe.skipIf(skipE2E)('HTTP Server E2E Tests', () => {
  const TEST_PORT = 3001;
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  let server: any;

  beforeAll(async () => {
    // Create SiYuan client
    const siyuanClient = createClient();

    // Start HTTP server
    server = await createHttpServer(siyuanClient, {
      port: TEST_PORT,
      host: '127.0.0.1',
      cors: true,
    });
  });

  afterAll(async () => {
    // Note: Express doesn't expose server.close() in our implementation
    // In real scenarios, you'd need to modify HttpServer to return the http.Server
  });

  describe('Health Check', () => {
    it('should return OK status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Tools List', () => {
    it('should return available tools', async () => {
      const response = await fetch(`${BASE_URL}/tools`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.tools).toBeDefined();
      expect(Array.isArray(data.tools)).toBe(true);
      expect(data.tools).toContain('search_notes');
      expect(data.tools).toContain('list_notebooks');
    });
  });

  describe('Tool Calls', () => {
    it('should call list_notebooks tool', async () => {
      const response = await fetch(`${BASE_URL}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'list_notebooks',
          arguments: {},
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.content).toBeDefined();
      expect(data.content[0].type).toBe('text');

      const result = JSON.parse(data.content[0].text);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should call search_notes tool', async () => {
      const response = await fetch(`${BASE_URL}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'search_notes',
          arguments: { query: 'test', pageSize: 5 },
        }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.content).toBeDefined();

      const result = JSON.parse(data.content[0].text);
      expect(result).toHaveProperty('blocks');
      expect(result).toHaveProperty('total');
    });

    it('should return error for unknown tool', async () => {
      const response = await fetch(`${BASE_URL}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'nonexistent_tool',
          arguments: {},
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Unknown tool');
    });

    it('should return error when tool name missing', async () => {
      const response = await fetch(`${BASE_URL}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arguments: {},
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Tool name is required');
    });
  });

  describe('Direct Endpoints', () => {
    it('should search via /search endpoint', async () => {
      const response = await fetch(`${BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test', pageSize: 3 }),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.content).toBeDefined();

      const result = JSON.parse(data.content[0].text);
      expect(result.blocks).toBeDefined();
    });

    it('should list notebooks via /notebooks endpoint', async () => {
      const response = await fetch(`${BASE_URL}/notebooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      expect(response.ok).toBe(true);
      const result = JSON.parse(data.content[0].text);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await fetch(`${BASE_URL}/health`, {
        headers: { Origin: 'http://example.com' },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make 65 requests rapidly (limit is 60/minute)
      const requests = Array.from({ length: 65 }, () =>
        fetch(`${BASE_URL}/health`)
      );

      const responses = await Promise.all(requests);
      const statusCodes = responses.map((r) => r.status);

      // Should have some 429 responses
      expect(statusCodes).toContain(429);
    }, 10000); // Increase timeout for this test
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await fetch(`${BASE_URL}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${BASE_URL}/unknown-route`);
      expect(response.status).toBe(404);
    });
  });
});
