import { config } from './config.js';
import { safeFetch } from './fetcher.js';
import { parseCareers, parseLoans, extractTableRows, sanitizeCopy } from './scraping.js';
import { locales, resolveLocale } from './locale.js';

const HANDOFF_LINK = process.env.HANDOFF_URL || config.contactUrl;

function nowIso() {
  return new Date().toISOString();
}

function buildBase(intent, localeKey) {
  const locale = locales[localeKey];
  return {
    intent,
    as_of: nowIso(),
    sources: [],
    cards: [],
    chips: locale.quickChips,
    disclaimer: locale.disclaimer,
    handoff: HANDOFF_LINK
      ? { label: locale.handoffLabel, href: HANDOFF_LINK }
      : null
  };
}

function withSource(payload, sourceUrl) {
  if (sourceUrl) {
    payload.sources = Array.from(new Set([...(payload.sources || []), sourceUrl]));
  }
  return payload;
}

function sanitizeMessage(message) {
  return sanitizeCopy(message);
}

function containsAccountLanguage(text) {
  return /(account|statement|balance|card number|password|pin|otp|login|transfer)/i.test(text);
}

export async function routeIntent(question, localeKey = config.localeDefault) {
  const locale = resolveLocale(localeKey);
  const q = String(question || '').trim();
  if (!q) {
    const res = buildBase('general.faq', locale);
    res.message = sanitizeMessage(locales[locale].faqPrompt);
    return res;
  }

  if (containsAccountLanguage(q)) {
    const res = buildBase('general.faq', locale);
    res.message = sanitizeMessage(locales[locale].accountRedirect);
    if (config.contactUrl) {
      res.cards.push({
        title: 'Secure Support Portal',
        actions: [{ label: 'Sign in', href: config.contactUrl }]
      });
      res.sources.push(config.contactUrl);
    }
    return res;
  }

  const lower = q.toLowerCase();

  if (/(job|career|opening|vacancy|position)/.test(lower)) {
    const res = buildBase('jobs.openings', locale);
    if (!config.careersUrl) {
      res.message = sanitizeMessage('The careers page is not configured yet.');
      return res;
    }
    try {
      const { text } = await safeFetch(config.careersUrl);
      const cards = parseCareers(text, config.careersUrl);
      if (cards.length) {
        res.cards = cards;
        res.message = sanitizeMessage('Here are the latest openings from our Careers page.');
      } else {
        res.message = sanitizeMessage("I couldn't find current openings. Please check the Careers site.");
      }
      withSource(res, config.careersUrl);
      return res;
    } catch (error) {
      res.message = sanitizeMessage("I couldn't reach the Careers page safely. Please visit the official site.");
      withSource(res, config.careersUrl);
      return res;
    }
  }

  if (/(loan|finance|mortgage|auto|personal|home)/.test(lower)) {
    const res = buildBase('loans.products', locale);
    if (!config.loansUrl) {
      res.message = sanitizeMessage('Our loans catalog is not configured yet.');
      return res;
    }
    try {
      const { text } = await safeFetch(config.loansUrl);
      const cards = parseLoans(text, config.loansUrl);
      if (cards.length) {
        res.cards = cards;
        res.message = sanitizeMessage('Here are loan products currently listed on our site.');
      } else {
        res.message = sanitizeMessage('I could not extract loan details. Please review the loans page directly.');
      }
      withSource(res, config.loansUrl);
      return res;
    } catch (error) {
      res.message = sanitizeMessage('I could not reach the loans page. Please use the official site link.');
      withSource(res, config.loansUrl);
      return res;
    }
  }

  if (/(branch|atm|location|nearby|visit)/.test(lower)) {
    const res = buildBase('branches.lookup', locale);
    const url = config.branchesUrl || config.contactUrl || config.faqUrl;
    res.message = sanitizeMessage('Use our official Branch & ATM finder for the most accurate information.');
    if (url) {
      res.cards.push({
        title: 'Branch & ATM Finder',
        actions: [{ label: 'Open finder', href: url }]
      });
      withSource(res, url);
    }
    return res;
  }

  if (/(rate|markup|apr|interest|fee)/.test(lower)) {
    const res = buildBase('rates.fees', locale);
    const url = config.loansUrl || config.faqUrl || config.sitemapUrl;
    if (url) {
      try {
        const { text } = await safeFetch(url);
        const rows = extractTableRows(text);
        if (rows.length) {
          res.message = sanitizeMessage('Here are the current rates & fees published on our site.');
          res.cards = rows.slice(0, 4).map((cells) => ({
            title: cells[0],
            subtitle: cells.slice(1).join(' • ')
          }));
        } else {
          res.message = sanitizeMessage('I could not find a rates table. Please review the official page.');
        }
        withSource(res, url);
      } catch (error) {
        res.message = sanitizeMessage('I could not reach the rates page right now.');
        withSource(res, url);
      }
    } else {
      res.message = sanitizeMessage('A rates or fees page is not configured yet.');
    }
    return res;
  }

  if (/(contact|phone|email|support|helpdesk|customer service)/.test(lower)) {
    const res = buildBase('contact.options', locale);
    const url = config.contactUrl || config.faqUrl;
    res.message = sanitizeMessage('Here are our official contact options.');
    if (url) {
      try {
        const { text } = await safeFetch(url);
        const contacts = [];
        const phoneMatch = text.match(/\+?[0-9][0-9\s\-]{6,}/);
        if (phoneMatch) {
          contacts.push({ title: 'Phone', subtitle: phoneMatch[0] });
        }
        const emailMatch = text.match(/([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);
        if (emailMatch) {
          contacts.push({ title: 'Email', subtitle: emailMatch[0] });
        }
        if (!contacts.length) {
          contacts.push({ title: 'Customer Care', subtitle: 'Visit our contact page for the latest details.' });
        }
        res.cards = contacts;
        withSource(res, url);
      } catch (error) {
        res.cards.push({ title: 'Customer Care', actions: [{ label: 'Visit contact page', href: url }] });
        withSource(res, url);
      }
    }
    return res;
  }

  if (/(human|agent|representative|escalate|handoff)/.test(lower)) {
    const res = buildBase('handoff', locale);
    if (res.handoff) {
      res.message = sanitizeMessage('You can reach a human representative using the link below.');
      res.cards.push({ title: 'Human support', actions: [{ label: res.handoff.label, href: res.handoff.href }] });
      withSource(res, res.handoff.href);
    } else {
      res.message = sanitizeMessage('A human support link is not configured yet.');
    }
    return res;
  }

  const res = buildBase('general.faq', locale);
  res.message = sanitizeMessage(`${locales[locale].fallback} ${config.faqUrl ? '' : locales[locale].faqPrompt}`.trim());
  if (config.faqUrl) {
    res.cards.push({
      title: 'FAQ Centre',
      subtitle: sanitizeMessage(locales[locale].faqPrompt),
      actions: [{ label: 'Open FAQ', href: config.faqUrl }]
    });
    withSource(res, config.faqUrl);
  }
  return res;
}
