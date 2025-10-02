import { beforeEach, expect, test } from '@jest/globals';

beforeEach(() => {
  process.env.ALLOWED_DOMAINS = 'bank.example.com,www.bank.example.com';
});

test('isAllowedDomain respects allowlist', async () => {
  jest.resetModules();
  const { isAllowedDomain } = await import('../server/fetcher.js');
  expect(isAllowedDomain('https://bank.example.com/careers')).toBe(true);
  expect(isAllowedDomain('https://evil.example.com/')).toBe(false);
});
