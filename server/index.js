import express from 'express';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from './config.js';
import { routeIntent } from './intents.js';
import { recordMetric, snapshotMetrics } from './analytics.js';
import { getCacheStats } from './fetcher.js';
import { locales, resolveLocale } from './locale.js';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'connect-src': ["'self'"],
      'img-src': ["'self'", 'data:'],
      'frame-ancestors': ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/public', express.static('public', { immutable: true, maxAge: '7d' }));

const limiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
});

app.get('/api/csrf', csrfProtection, (req, res) => {
  res.json({ token: req.csrfToken() });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    metrics: snapshotMetrics(),
    cache: getCacheStats()
  });
});

app.post('/api/ask', csrfProtection, async (req, res) => {
  const started = Date.now();
  try {
    const localeKey = resolveLocale(req.body?.locale || config.localeDefault);
    const question = String(req.body?.q || '').slice(0, 500);
    if (!question) {
      return res.status(400).json({ error: 'Question is required.' });
    }
    const result = await routeIntent(question, localeKey);
    const latency = Date.now() - started;
    recordMetric({ intent: result.intent, success: true, latencyMs: latency });
    res.json({ ...result, locale: localeKey });
  } catch (error) {
    const latency = Date.now() - started;
    recordMetric({ intent: 'error', success: false, latencyMs: latency });
    res.status(500).json({
      intent: 'error',
      as_of: new Date().toISOString(),
      message: 'Unable to complete the request safely right now.',
      disclaimer: locales[config.localeDefault].disclaimer
    });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }
  if (err.code === 'PAYLOAD_TOO_LARGE') {
    return res.status(413).json({ error: 'Payload too large.' });
  }
  return next(err);
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Chatbot server listening on port ${config.port}`);
});
