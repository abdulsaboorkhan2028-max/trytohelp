import { JSDOM } from 'jsdom';
import { selectors } from './config.js';
import { normalizeUrl } from './fetcher.js';

function pickFirstText(element, selectorList) {
  for (const selector of selectorList) {
    const target = selector === ':self' ? element : element.querySelector(selector);
    if (target && target.textContent?.trim()) {
      return target.textContent.trim();
    }
  }
  return '';
}

function pickFirstAttr(element, selectorList, attribute) {
  for (const selector of selectorList) {
    const target = selector === ':self' ? element : element.querySelector(selector);
    if (target && target.getAttribute?.(attribute)) {
      return target.getAttribute(attribute);
    }
  }
  return '';
}

export function sanitizeCopy(input) {
  return String(input || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

export function parseCareers(html, baseUrl) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const uniqueNodes = new Set();
  selectors.careers.item.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((node) => uniqueNodes.add(node));
  });

  const cards = [];
  for (const node of uniqueNodes) {
    const title = sanitizeCopy(pickFirstText(node, selectors.careers.title));
    if (!title) continue;
    const location = sanitizeCopy(pickFirstText(node, selectors.careers.location));
    const type = sanitizeCopy(pickFirstText(node, selectors.careers.type));
    const dateRaw = pickFirstAttr(node, selectors.careers.date, 'datetime') || pickFirstText(node, selectors.careers.date);
    const date = sanitizeCopy(dateRaw);
    const hrefRaw = pickFirstAttr(node, selectors.careers.link, 'href');
    const href = normalizeUrl(hrefRaw, baseUrl);

    const subtitleParts = [location, type].filter(Boolean);
    cards.push({
      title,
      subtitle: subtitleParts.join(' — '),
      badges: date ? [`Posted: ${date}`] : [],
      actions: href ? [{ label: 'Apply', href }] : []
    });
    if (cards.length >= 20) break;
  }
  return cards;
}

export function parseLoans(html, baseUrl) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const uniqueNodes = new Set();
  selectors.loans.item.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((node) => uniqueNodes.add(node));
  });

  const cards = [];
  for (const node of uniqueNodes) {
    const title = sanitizeCopy(pickFirstText(node, selectors.loans.title));
    if (!title) continue;
    const rate = sanitizeCopy(pickFirstText(node, selectors.loans.rate));
    const bullets = [];
    selectors.loans.bullets.forEach((selector) => {
      node.querySelectorAll(selector).forEach((li) => {
        const copy = sanitizeCopy(li.textContent);
        if (copy) bullets.push(copy);
      });
    });
    const hrefRaw = pickFirstAttr(node, selectors.loans.link, 'href');
    const href = normalizeUrl(hrefRaw, baseUrl);
    cards.push({
      title,
      subtitle: rate,
      badges: bullets.slice(0, 3),
      actions: href ? [{ label: 'View details', href }] : []
    });
    if (cards.length >= 12) break;
  }
  return cards;
}

export function extractTableRows(html, selector = 'table') {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const table = doc.querySelector(selector);
  if (!table) return [];
  const rows = [];
  table.querySelectorAll('tr').forEach((row) => {
    const cells = [...row.querySelectorAll('th,td')]
      .map((cell) => sanitizeCopy(cell.textContent))
      .filter(Boolean);
    if (cells.length) rows.push(cells);
  });
  return rows;
}
