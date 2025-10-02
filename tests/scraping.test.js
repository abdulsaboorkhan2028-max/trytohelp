import { describe, expect, test, beforeAll } from '@jest/globals';

beforeAll(() => {
  process.env.ALLOWED_DOMAINS = 'bank.example.com';
});

test('parseCareers extracts job cards', async () => {
  jest.resetModules();
  const { parseCareers } = await import('../server/scraping.js');
  const html = `
    <ul>
      <li class="job-card">
        <a href="/careers/123" class="job-title">Branch Operations Officer</a>
        <span class="job-location">Karachi</span>
        <span class="job-type">Full-time</span>
        <time datetime="2025-09-28"></time>
      </li>
    </ul>
  `;
  const cards = parseCareers(html, 'https://bank.example.com/careers');
  expect(cards).toHaveLength(1);
  expect(cards[0].title).toContain('Branch Operations Officer');
  expect(cards[0].actions[0].href).toBe('https://bank.example.com/careers/123');
});

test('parseLoans extracts loan cards with bullets', async () => {
  jest.resetModules();
  const { parseLoans } = await import('../server/scraping.js');
  const html = `
    <section class="product-card">
      <h3>Personal Loan</h3>
      <div class="apr">Markup 12%</div>
      <ul>
        <li>Up to PKR 2M</li>
        <li>Tenure 5 years</li>
      </ul>
      <a href="/loans/personal"></a>
    </section>
  `;
  const cards = parseLoans(html, 'https://bank.example.com/loans');
  expect(cards).toHaveLength(1);
  expect(cards[0].subtitle).toContain('12%');
  expect(cards[0].badges.length).toBeGreaterThan(0);
});
