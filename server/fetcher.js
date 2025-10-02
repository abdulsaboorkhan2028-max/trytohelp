import LRUCache from 'lru-cache';
import robotsParser from 'robots-parser';
import { config } from './config.js';

const pageCache = new LRUCache({ max: 200, ttl: config.cacheTtlMs });
const robotsCache = new Map();

export function isAllowedDomain(urlString) {
  try {
    const url = new URL(urlString);
    return config.allowedDomains.includes(url.hostname);
  } catch (error) {
    return false;
  }
}

async function fetchRobots(urlString) {
  const url = new URL(urlString);
  const origin = `${url.protocol}//${url.hostname}`;
  if (robotsCache.has(origin)) return robotsCache.get(origin);

  const robotsUrl = `${origin}/robots.txt`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(robotsUrl, {
      headers: { 'User-Agent': 'NationalBankChatbot/1.0 (+public site use)' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const parser = robotsParser(robotsUrl, '');
      robotsCache.set(origin, parser);
      return parser;
    }
    const text = await res.text();
    const parser = robotsParser(robotsUrl, text);
    robotsCache.set(origin, parser);
    return parser;
  } catch (error) {
    const parser = robotsParser(robotsUrl, '');
    robotsCache.set(origin, parser);
    return parser;
  }
}

async function assertRobots(urlString) {
  const parser = await fetchRobots(urlString);
  const path = new URL(urlString).pathname;
  const allowed = parser.isAllowed(path, 'NationalBankChatbot/1.0');
  if (allowed === false) {
    const err = new Error('Path disallowed by robots.txt');
    err.code = 'ROBOTS_DISALLOWED';
    throw err;
  }
}

function exponentialDelay(attempt) {
  return Math.min(1000, 200 * 2 ** attempt);
}

export async function safeFetch(urlString) {
  if (!isAllowedDomain(urlString)) {
    const err = new Error('Domain not allowlisted');
    err.code = 'DOMAIN_NOT_ALLOWED';
    throw err;
  }

  await assertRobots(urlString);

  const cached = pageCache.get(urlString);
  if (cached) {
    return { text: cached, cached: true };
  }

  let attempt = 0;
  let lastError;
  while (attempt < 3) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(urlString, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'NationalBankChatbot/1.0 (+public site use)'
        }
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }
      const text = await response.text();
      pageCache.set(urlString, text);
      return { text, cached: false };
    } catch (error) {
      lastError = error;
      const wait = exponentialDelay(attempt);
      await new Promise((resolve) => setTimeout(resolve, wait));
      attempt += 1;
    }
  }
  throw lastError || new Error('Failed to fetch resource');
}

export function normalizeUrl(maybeUrl, base) {
  try {
    const url = new URL(maybeUrl, base);
    if (!isAllowedDomain(url.href)) {
      return null;
    }
    return url.href;
  } catch (error) {
    return null;
  }
}

export function getCacheStats() {
  const stats = pageCache.stats || { hits: 0, misses: 0 }; // stats available in lru-cache v10+
  return {
    size: pageCache.size,
    hits: stats.hits || 0,
    misses: stats.misses || 0,
    ttlMs: config.cacheTtlMs
  };
}
