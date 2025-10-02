(function () {
  const scriptEl = document.currentScript;
  const datasetConfig = scriptEl ? {
    apiBase: scriptEl.getAttribute('data-api-base'),
    locale: scriptEl.getAttribute('data-locale')
  } : {};
  const globalConfig = window.BankChatbot || {};
  const config = {
    apiBase: datasetConfig.apiBase || globalConfig.apiBase || '/api',
    locale: datasetConfig.locale || globalConfig.locale || 'en'
  };

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const state = {
    open: false,
    locale: config.locale,
    csrf: null,
    busy: false,
    theme: prefersDark ? 'dark' : 'light'
  };

  const localeLabels = {
    en: 'English',
    ur: 'اردو'
  };

  const mountId = 'bank-chatbot';

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (value == null) return;
        if (key === 'class') {
          el.className = value;
        } else if (key === 'style') {
          Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
          el.addEventListener(key.slice(2), value);
        } else if (key === 'dataset') {
          Object.entries(value).forEach(([dataKey, dataValue]) => {
            el.dataset[dataKey] = dataValue;
          });
        } else {
          el.setAttribute(key, value);
        }
      });
    }
    children.flat().forEach((child) => {
      if (child == null) return;
      if (typeof child === 'string' || typeof child === 'number') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });
    return el;
  }

  function sanitizeUrl(url) {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.href;
    } catch (error) {
      return '#';
    }
  }

  let logEl;
  let panelEl;
  let launcherEl;
  let inputEl;
  let sendEl;
  let chipsEl;
  let localeToggleEl;
  let themeToggleEl;
  let wrapperEl;

  function focusableElements(container) {
    return Array.from(
      container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled'));
  }

  function applyTheme() {
    if (wrapperEl) {
      wrapperEl.dataset.theme = state.theme;
    }
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const focusables = focusableElements(panelEl);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        event.preventDefault();
      }
    } else if (document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  }

  function openPanel() {
    state.open = true;
    panelEl.setAttribute('aria-hidden', 'false');
    panelEl.classList.add('bc-open');
    launcherEl.setAttribute('aria-expanded', 'true');
    panelEl.addEventListener('keydown', trapFocus);
    panelEl.focus();
  }

  function closePanel() {
    state.open = false;
    panelEl.setAttribute('aria-hidden', 'true');
    panelEl.classList.remove('bc-open');
    launcherEl.setAttribute('aria-expanded', 'false');
    panelEl.removeEventListener('keydown', trapFocus);
  }

  async function ensureCsrf() {
    if (state.csrf) return state.csrf;
    const res = await fetch(`${config.apiBase}/csrf`, {
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('Unable to obtain CSRF token');
    const data = await res.json();
    state.csrf = data.token;
    return state.csrf;
  }

  function appendBubble(contentEl, role) {
    const bubble = h('div', { class: `bc-bubble bc-${role}` }, contentEl);
    logEl.appendChild(bubble);
    bubble.setAttribute('aria-live', role === 'bot' ? 'polite' : 'off');
    requestAnimationFrame(() => {
      bubble.classList.add('bc-bubble-in');
      logEl.scrollTo({ top: logEl.scrollHeight, behavior: 'smooth' });
    });
  }

  function renderMessageBubble(message, response) {
    const container = h('div', { class: 'bc-msg' });
    container.appendChild(h('p', { class: 'bc-msg-text' }, message));
    if (response && Array.isArray(response.cards) && response.cards.length) {
      const cardsWrap = h('div', { class: 'bc-cards' });
      response.cards.forEach((card) => {
        const cardEl = h('div', { class: 'bc-card' });
        cardEl.appendChild(h('div', { class: 'bc-card-title' }, card.title || ''));
        if (card.subtitle) {
          cardEl.appendChild(h('div', { class: 'bc-card-sub' }, card.subtitle));
        }
        if (Array.isArray(card.badges) && card.badges.length) {
          const badges = h('div', { class: 'bc-card-badges' });
          card.badges.forEach((badge) => {
            badges.appendChild(h('span', { class: 'bc-badge' }, badge));
          });
          cardEl.appendChild(badges);
        }
        if (Array.isArray(card.actions) && card.actions.length) {
          const actions = h('div', { class: 'bc-card-actions' });
          card.actions.forEach((action) => {
            actions.appendChild(
              h(
                'a',
                {
                  class: 'bc-btn',
                  href: sanitizeUrl(action.href),
                  target: '_blank',
                  rel: 'noopener',
                  tabindex: '0'
                },
                action.label || 'Open'
              )
            );
          });
          cardEl.appendChild(actions);
        }
        cardsWrap.appendChild(cardEl);
      });
      container.appendChild(cardsWrap);
    }
    if (response && Array.isArray(response.sources) && response.sources.length) {
      const src = h('div', { class: 'bc-src', role: 'note' }, 'Sources: ');
      response.sources.forEach((link, index) => {
        src.appendChild(
          h(
            'a',
            { href: sanitizeUrl(link), target: '_blank', rel: 'noopener', class: 'bc-src-link' },
            link
          )
        );
        if (index < response.sources.length - 1) {
          src.appendChild(document.createTextNode(' • '));
        }
      });
      container.appendChild(src);
    }
    if (response && response.as_of) {
      const time = new Date(response.as_of);
      container.appendChild(h('div', { class: 'bc-ts' }, `Information as of ${time.toLocaleString()}`));
    }
    if (response && response.disclaimer) {
      container.appendChild(h('div', { class: 'bc-disclaimer' }, response.disclaimer));
    }
    return container;
  }

  function renderChips(chips) {
    chipsEl.innerHTML = '';
    if (!Array.isArray(chips) || !chips.length) return;
    chips.forEach((chip) => {
      const button = h(
        'button',
        {
          class: 'bc-chip',
          type: 'button',
          onclick: () => {
            inputEl.value = chip.value;
            inputEl.focus();
          }
        },
        chip.label
      );
      chipsEl.appendChild(button);
    });
  }

  async function ask(question) {
    if (!question || state.busy) return;
    state.busy = true;
    sendEl.setAttribute('disabled', 'true');
    inputEl.setAttribute('aria-busy', 'true');
    appendBubble(h('div', { class: 'bc-msg-user' }, question), 'user');
    inputEl.value = '';
    try {
      const token = await ensureCsrf();
      const res = await fetch(`${config.apiBase}/ask`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({ q: question, locale: state.locale })
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      state.locale = data.locale || state.locale;
      renderChips(data.chips);
      appendBubble(renderMessageBubble(data.message || '', data), 'bot');
    } catch (error) {
      appendBubble(
        renderMessageBubble(
          'Sorry, I ran into a problem. Please use the official website links while we investigate.',
          null
        ),
        'bot'
      );
    } finally {
      state.busy = false;
      sendEl.removeAttribute('disabled');
      inputEl.removeAttribute('aria-busy');
      inputEl.focus();
    }
  }

  function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    ask(text);
  }

  function createWidget() {
    wrapperEl = h('div', { class: 'bc-wrapper', role: 'presentation' });
    applyTheme();

    launcherEl = h(
      'button',
      {
        class: 'bc-launcher',
        'aria-expanded': 'false',
        'aria-controls': 'bc-panel',
        'aria-label': 'Open bank assistant',
        onclick: () => {
          if (state.open) closePanel();
          else openPanel();
        }
      },
      h('span', { class: 'bc-launcher-label' }, 'Need help?'),
      h('span', { class: 'bc-launcher-icon', 'aria-hidden': 'true' })
    );

    const header = h(
      'header',
      { class: 'bc-header' },
      h('div', { class: 'bc-title' }, 'National Bank Assistant'),
      h(
        'button',
        {
          class: 'bc-close',
          type: 'button',
          'aria-label': 'Close chat',
          onclick: closePanel
        },
        '×'
      )
    );

    const langOptions = Object.keys(localeLabels).map((key) =>
      h('option', { value: key, selected: key === state.locale }, localeLabels[key])
    );
    localeToggleEl = h(
      'select',
      {
        class: 'bc-locale',
        onchange: (event) => {
          state.locale = event.target.value;
          ensureCsrf().catch(() => {});
        },
        'aria-label': 'Select language'
      },
      langOptions
    );

    themeToggleEl = h(
      'button',
      {
        class: 'bc-theme',
        type: 'button',
        'aria-label': 'Toggle theme',
        onclick: () => {
          state.theme = state.theme === 'dark' ? 'light' : 'dark';
          applyTheme();
        }
      },
      '◐'
    );

    const headerMeta = h(
      'div',
      { class: 'bc-header-meta' },
      h('span', { class: 'bc-powered' }, 'Powered by National Bank Assistant'),
      h('div', { class: 'bc-header-controls' }, themeToggleEl, localeToggleEl)
    );
    header.appendChild(headerMeta);

    logEl = h('div', { class: 'bc-log', role: 'log', tabindex: '0' });

    chipsEl = h('div', { class: 'bc-chips', role: 'list' });

    inputEl = h('input', {
      class: 'bc-input',
      type: 'text',
      placeholder: 'Ask about jobs, loans, branches…',
      'aria-label': 'Type your question'
    });
    inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSend();
      }
      if (event.key === 'Escape') {
        closePanel();
      }
    });

    sendEl = h(
      'button',
      { class: 'bc-send', type: 'button', 'aria-label': 'Send message', onclick: handleSend },
      'Send'
    );

    const disclaimerBar = h('div', { class: 'bc-privacy' }, 'No account information is processed in this chat.');

    const inputBar = h('div', { class: 'bc-inputbar' }, inputEl, sendEl);

    panelEl = h(
      'section',
      {
        class: 'bc-panel',
        id: 'bc-panel',
        role: 'dialog',
        'aria-modal': 'true',
        tabindex: '-1',
        'aria-hidden': 'true'
      },
      header,
      disclaimerBar,
      logEl,
      chipsEl,
      inputBar
    );

    panelEl.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closePanel();
        launcherEl.focus();
      }
    });

    wrapperEl.appendChild(panelEl);
    wrapperEl.appendChild(launcherEl);
    return wrapperEl;
  }

  function injectStyles() {
    if (document.getElementById('bc-style')) return;
    const css = `
    :root {
      --brand-green: #0b7a4b;
      --brand-green-600: #0a5f3b;
      --brand-green-200: #c8f5e1;
      --bg: #ffffff;
      --text: #0f172a;
      --muted: #4b5563;
      --surface: #f7faf9;
      --border: rgba(15, 23, 42, 0.08);
      --radius: 16px;
    }
    [data-theme='dark'] {
      --bg: #0b1720;
      --text: #f8fafc;
      --surface: #13212b;
      --border: rgba(148, 163, 184, 0.16);
      --muted: #94a3b8;
    }
    .bc-wrapper {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483000;
      font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
      color: var(--text);
    }
    .bc-launcher {
      background: var(--brand-green);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      box-shadow: 0 12px 40px rgba(11, 122, 75, 0.35);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .bc-launcher:hover {
      transform: translateY(-1px);
      box-shadow: 0 18px 44px rgba(11, 122, 75, 0.42);
    }
    .bc-launcher:focus-visible {
      outline: 3px solid var(--brand-green-200);
      outline-offset: 2px;
    }
    .bc-launcher-icon {
      width: 12px;
      height: 12px;
      border-right: 2px solid #fff;
      border-bottom: 2px solid #fff;
      transform: rotate(-45deg);
      margin-top: -2px;
    }
    .bc-panel {
      width: min(360px, 90vw);
      max-height: min(80vh, 640px);
      background: var(--bg);
      border-radius: var(--radius);
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: scale(0.95);
      pointer-events: none;
      transition: opacity 180ms ease, transform 180ms ease;
    }
    .bc-panel.bc-open {
      opacity: 1;
      transform: scale(1);
      pointer-events: auto;
    }
    .bc-header {
      padding: 16px;
      background: linear-gradient(135deg, rgba(11, 122, 75, 0.92), rgba(11, 122, 75, 0.75));
      color: #fff;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }
    .bc-title {
      font-weight: 600;
      font-size: 1.1rem;
      letter-spacing: 0.01em;
    }
    .bc-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
      transition: background 150ms ease;
    }
    .bc-close:hover {
      background: rgba(255, 255, 255, 0.32);
    }
    .bc-close:focus-visible {
      outline: 3px solid var(--brand-green-200);
    }
    .bc-header-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      gap: 12px;
    }
    .bc-header-controls {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .bc-powered {
      opacity: 0.9;
    }
    .bc-locale {
      background: rgba(255, 255, 255, 0.22);
      border-radius: 999px;
      border: none;
      padding: 6px 10px;
      color: #fff;
      font-size: 12px;
    }
    .bc-theme {
      background: rgba(255, 255, 255, 0.22);
      border: none;
      border-radius: 999px;
      width: 32px;
      height: 32px;
      color: #fff;
      cursor: pointer;
      font-size: 16px;
      display: grid;
      place-items: center;
    }
    .bc-theme:focus-visible {
      outline: 2px solid var(--brand-green-200);
      outline-offset: 2px;
    }
    .bc-log {
      flex: 1;
      padding: 18px;
      overflow-y: auto;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
    }
    .bc-log:focus-visible {
      outline: 3px solid var(--brand-green-200);
      outline-offset: -4px;
    }
    .bc-privacy {
      padding: 10px 16px;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.9);
      color: var(--muted);
      border-bottom: 1px solid var(--border);
    }
    .bc-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 10px 18px 0;
    }
    .bc-chip {
      border: 1px solid rgba(11, 122, 75, 0.24);
      border-radius: 999px;
      padding: 6px 12px;
      background: #fff;
      color: var(--brand-green);
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .bc-chip:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(11, 122, 75, 0.2);
    }
    .bc-chip:focus-visible {
      outline: 2px solid var(--brand-green);
      outline-offset: 2px;
    }
    .bc-inputbar {
      display: flex;
      gap: 10px;
      padding: 16px;
      background: var(--bg);
      border-top: 1px solid var(--border);
    }
    .bc-input {
      flex: 1;
      border-radius: 999px;
      border: 1px solid var(--border);
      padding: 12px 16px;
      font-size: 15px;
      color: var(--text);
      background: #fff;
    }
    .bc-input:focus-visible {
      outline: 2px solid var(--brand-green);
      outline-offset: 2px;
    }
    .bc-send {
      background: var(--brand-green);
      color: #fff;
      border: none;
      padding: 12px 18px;
      border-radius: 999px;
      cursor: pointer;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .bc-send:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .bc-send:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 12px 24px rgba(11, 122, 75, 0.3);
    }
    .bc-send:focus-visible {
      outline: 2px solid var(--brand-green-200);
      outline-offset: 2px;
    }
    .bc-bubble {
      max-width: 100%;
      background: #fff;
      border-radius: 16px;
      padding: 14px 16px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
      align-self: flex-start;
      opacity: 0;
      transform: translateY(12px);
      animation: bc-bubble-in 180ms ease forwards;
    }
    .bc-bubble.bc-user {
      background: var(--brand-green);
      color: #fff;
      margin-left: auto;
      border-bottom-right-radius: 4px;
    }
    .bc-bubble.bc-bot {
      margin-right: auto;
      border-bottom-left-radius: 4px;
    }
    .bc-msg-text {
      margin: 0 0 8px 0;
      line-height: 1.45;
      font-size: 15px;
    }
    .bc-card {
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px;
      margin-top: 10px;
      background: #fff;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
    }
    .bc-cards {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .bc-card-title {
      font-weight: 600;
      font-size: 14px;
      color: var(--text);
    }
    .bc-card-sub {
      font-size: 13px;
      margin-top: 4px;
      color: var(--muted);
    }
    .bc-badge {
      display: inline-block;
      background: var(--brand-green-200);
      color: var(--brand-green-600);
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 11px;
      margin-right: 6px;
      margin-top: 6px;
    }
    .bc-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .bc-btn {
      border-radius: 999px;
      padding: 8px 14px;
      background: var(--brand-green);
      color: #fff;
      text-decoration: none;
      font-size: 13px;
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .bc-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px rgba(11, 122, 75, 0.28);
    }
    .bc-btn:focus-visible {
      outline: 2px solid var(--brand-green-200);
      outline-offset: 2px;
    }
    .bc-src {
      font-size: 12px;
      margin-top: 12px;
      color: var(--muted);
    }
    .bc-src-link {
      color: var(--brand-green);
      text-decoration: underline;
    }
    .bc-ts {
      font-size: 11px;
      color: var(--muted);
      margin-top: 8px;
    }
    .bc-disclaimer {
      font-size: 11px;
      color: var(--muted);
      margin-top: 6px;
    }
    @keyframes bc-bubble-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @media (max-width: 600px) {
      .bc-wrapper {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100%;
        padding: 0 16px 16px;
      }
      .bc-panel {
        width: 100%;
        max-height: calc(100vh - 32px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    `;
    const style = document.createElement('style');
    style.id = 'bc-style';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  function ensureMount() {
    let mount = document.getElementById(mountId);
    if (!mount) {
      mount = h('div', { id: mountId });
      document.body.appendChild(mount);
    }
    return mount;
  }

  function init() {
    injectStyles();
    const mount = ensureMount();
    const widget = createWidget();
    mount.appendChild(widget);
    ensureCsrf().catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
