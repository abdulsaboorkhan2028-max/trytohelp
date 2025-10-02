# National Bank Chatbot

A secure, production-ready banking assistant featuring real-time scraping, intent routing, and an embeddable green & white chat widget.

## File tree

```
.
├── package.json
├── jest.config.js
├── public/
│   └── widget.js
├── server/
│   ├── analytics.js
│   ├── config.js
│   ├── fetcher.js
│   ├── intents.js
│   ├── locale.js
│   ├── scraping.js
│   └── index.js
├── tests/
│   ├── fetcher.test.js
│   ├── intents.test.js
│   └── scraping.test.js
└── README.md
```

## Prerequisites

- Node.js 18+
- npm or pnpm (examples use npm)

## Installation & local development

```bash
npm install
npm run dev
```

The server listens on `http://localhost:3000` by default and serves the widget from `/public/widget.js`.

## Environment variables

| Variable | Description |
| --- | --- |
| `ALLOWED_DOMAINS` | Comma separated list of hostnames the scraper can visit. |
| `CAREERS_URL` | Absolute URL to the careers page. |
| `LOANS_URL` | Absolute URL to the loans/products page. |
| `FAQ_URL` | Official FAQ URL (fallback). |
| `CONTACT_URL` | Official contact page (handoff + phone/email scraping). |
| `BRANCHES_URL` | Branch/ATM finder URL. |
| `SITEMAP_URL` | Sitemap for structured fallback. |
| `CACHE_TTL_SECONDS` | Cache TTL (default 900 seconds). |
| `HANDOFF_URL` | Optional human handoff URL. |
| `DEFAULT_LOCALE` | `en` or `ur` (default `en`). |

## API overview

- `GET /api/health` – health & analytics snapshot.
- `GET /api/csrf` – retrieves a CSRF token (sets secure cookie).
- `POST /api/ask` – accepts `{ q: string, locale?: 'en' | 'ur' }` and returns the structured answer payload (`intent`, `message`, `cards`, `sources`, `as_of`, `chips`).

## Testing

```bash
npm test
```

Unit coverage includes selector-based scraping, intent routing, and allowlist enforcement.

## Embedding the widget

Add the mount div and script tag anywhere on your public site:

```html
<div id="bank-chatbot"></div>
<script src="/public/widget.js" data-api-base="/api" data-locale="en" defer></script>
```

If you need a different API base or default language, adjust the `data-` attributes accordingly.

## Deployment notes

- Reverse proxy `/api` and `/public` through HTTPS.
- Ensure environment variables are set with the bank’s canonical domains.
- Set `NODE_ENV=production` to enforce secure cookies and stricter headers.
- Logs should capture only intent, success flag, and latency; avoid storing raw questions in production environments.

## Minimal technical spec (for automation/Codex)

- **Frontend**: Vanilla JS widget (`public/widget.js`) with accessible launcher, keyboard focus trap, locale & theme toggles, quick reply chips, card UI, and responsive green/white styling. Fetches CSRF token then posts to `/api/ask` with JSON `{ q, locale }`. Displays cards, sources, timestamps, disclaimer, and supports light/dark themes.
- **Backend**: Node.js (Express) server (`server/index.js`) using Helmet, CSRF cookies, and rate limiting. Endpoints `/api/csrf`, `/api/health`, `/api/ask`. Intent router (`server/intents.js`) detects jobs/loans/branches/rates/contact/general/handoff intents. Scrapers (`server/scraping.js`) parse careers & loan pages via configurable selectors. Fetcher (`server/fetcher.js`) enforces domain allowlist, robots.txt, caching, and exponential backoff. Responses follow `{ intent, as_of, message, sources[], cards[], chips[], disclaimer, handoff }`. Tests in `tests/` validate scraping, intents, and allowlist behavior.
- **Security**: No PII capture, strict domain allowlist, sanitized strings, CSRF tokens, rate limiting, caching TTL from env, robots.txt enforcement, and analytics limited to aggregated stats.
