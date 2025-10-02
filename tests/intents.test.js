import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const sampleCareers = `
  <article class="job-card">
    <a class="job-title" href="/careers/ops">Operations Manager</a>
    <div class="job-location">Karachi</div>
    <div class="job-type">Full-time</div>
    <time datetime="2025-09-20"></time>
  </article>
`;

const sampleLoans = `
  <div class="product-card">
    <h3>Auto Loan</h3>
    <div class="apr">Markup 10%</div>
    <ul>
      <li>Up to PKR 4M</li>
      <li>Tenure 7 years</li>
    </ul>
    <a href="/loans/auto"></a>
  </div>
`;

beforeEach(() => {
  jest.resetModules();
  process.env.ALLOWED_DOMAINS = 'bank.example.com';
  process.env.CAREERS_URL = 'https://bank.example.com/careers';
  process.env.LOANS_URL = 'https://bank.example.com/loans';
  process.env.FAQ_URL = 'https://bank.example.com/faq';
  process.env.CONTACT_URL = 'https://bank.example.com/contact';
});

describe('routeIntent', () => {
  test('routes job queries to careers scraper', async () => {
    const safeFetchMock = jest.fn(async (url) => {
      if (url.includes('careers')) return { text: sampleCareers };
      throw new Error('unexpected url');
    });

    jest.unstable_mockModule('../server/fetcher.js', () => ({
      safeFetch: safeFetchMock,
      normalizeUrl: (href, base) => new URL(href, base).href,
      getCacheStats: () => ({}),
      isAllowedDomain: () => true
    }));

    const { routeIntent } = await import('../server/intents.js');
    const response = await routeIntent('What jobs are open in Karachi?', 'en');
    expect(response.intent).toBe('jobs.openings');
    expect(response.cards.length).toBeGreaterThan(0);
    expect(safeFetchMock).toHaveBeenCalledWith('https://bank.example.com/careers');
  });

  test('returns fallback for unknown query', async () => {
    const safeFetchMock = jest.fn(async () => ({ text: '' }));
    jest.unstable_mockModule('../server/fetcher.js', () => ({
      safeFetch: safeFetchMock,
      normalizeUrl: (href, base) => new URL(href, base).href,
      getCacheStats: () => ({}),
      isAllowedDomain: () => true
    }));

    const { routeIntent } = await import('../server/intents.js');
    const response = await routeIntent('hello there', 'en');
    expect(response.intent).toBe('general.faq');
    expect(response.cards.length).toBeGreaterThanOrEqual(0);
  });

  test('returns loan products when available', async () => {
    const safeFetchMock = jest.fn(async (url) => {
      if (url.includes('loans')) {
        return { text: sampleLoans };
      }
      return { text: '' };
    });
    jest.unstable_mockModule('../server/fetcher.js', () => ({
      safeFetch: safeFetchMock,
      normalizeUrl: (href, base) => new URL(href, base).href,
      getCacheStats: () => ({}),
      isAllowedDomain: () => true
    }));

    const { routeIntent } = await import('../server/intents.js');
    const response = await routeIntent('What loans do you offer?', 'en');
    expect(response.intent).toBe('loans.products');
    expect(response.cards[0].title).toContain('Auto Loan');
  });

  test('protects account-specific queries', async () => {
    const safeFetchMock = jest.fn(async () => ({ text: '' }));
    jest.unstable_mockModule('../server/fetcher.js', () => ({
      safeFetch: safeFetchMock,
      normalizeUrl: (href, base) => new URL(href, base).href,
      getCacheStats: () => ({}),
      isAllowedDomain: () => true
    }));

    const { routeIntent } = await import('../server/intents.js');
    const response = await routeIntent('I forgot my account password', 'en');
    expect(response.message).toMatch(/sign in/i);
    expect(response.intent).toBe('general.faq');
  });
});
