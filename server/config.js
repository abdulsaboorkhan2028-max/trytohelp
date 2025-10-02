export const config = {
  port: Number(process.env.PORT || 3000),
  allowedDomains: (process.env.ALLOWED_DOMAINS || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean),
  cacheTtlMs: Number(process.env.CACHE_TTL_SECONDS || 900) * 1000,
  careersUrl: process.env.CAREERS_URL || '',
  loansUrl: process.env.LOANS_URL || '',
  faqUrl: process.env.FAQ_URL || '',
  contactUrl: process.env.CONTACT_URL || '',
  branchesUrl: process.env.BRANCHES_URL || '',
  sitemapUrl: process.env.SITEMAP_URL || '',
  localeDefault: process.env.DEFAULT_LOCALE || 'en'
};

export const selectors = {
  careers: {
    item: process.env.CAREERS_SELECTOR_ITEM?.split(',') || [
      '[data-job-card]',
      '.job-card',
      '.career-item',
      'li.job'
    ],
    title: process.env.CAREERS_SELECTOR_TITLE?.split(',') || ['.job-title', 'h3', 'a'],
    location: process.env.CAREERS_SELECTOR_LOCATION?.split(',') || ['.job-location', '.location', '[data-location]'],
    type: process.env.CAREERS_SELECTOR_TYPE?.split(',') || ['.job-type', '.type'],
    date: process.env.CAREERS_SELECTOR_DATE?.split(',') || ['time', '.date'],
    link: process.env.CAREERS_SELECTOR_LINK?.split(',') || ['a']
  },
  loans: {
    item: process.env.LOANS_SELECTOR_ITEM?.split(',') || [
      '.loan-card',
      '.product-card',
      '.loan',
      '.card'
    ],
    title: process.env.LOANS_SELECTOR_TITLE?.split(',') || ['.loan-title', 'h3', 'h2'],
    rate: process.env.LOANS_SELECTOR_RATE?.split(',') || ['.apr', '.rate', '.markup'],
    bullets: process.env.LOANS_SELECTOR_BULLETS?.split(',') || ['li'],
    link: process.env.LOANS_SELECTOR_LINK?.split(',') || ['a']
  }
};
