const PROMPT = (url) =>
  `${url}\n\nbitte fasse dieses Video zusammen (wenn das Video auf Englisch ist, dann auf Englisch, ansonsten auf deutsch)`;

// ── Setup context menus ──────────────────────────────────────────────────────

const TOOL = 'https://tools.server.tanaro.one/video/?url=';
const LINK_TARGETS = ['*://www.youtube.com/watch*', '*://www.youtube.com/shorts/*', '*://youtu.be/*', '*://m.youtube.com/watch*'];
const WATCH_PAGES = ['*://www.youtube.com/watch*', '*://www.youtube.com/shorts/*', '*://m.youtube.com/watch*'];

chrome.runtime.onInstalled.addListener(() => {
  // homeserver: eigenes Transkript, Notiz im Vault, Verlauf in KI-Briefing/Videos.md
  chrome.contextMenus.create({ id: 'hs-link', title: 'Auf homeserver zusammenfassen', contexts: ['link'],
    documentUrlPatterns: ['*://www.youtube.com/*', '*://m.youtube.com/*'], targetUrlPatterns: LINK_TARGETS });
  chrome.contextMenus.create({ id: 'hs-page', title: 'Auf homeserver zusammenfassen', contexts: ['page'],
    documentUrlPatterns: WATCH_PAGES });
  // When hovering over a video link (thumbnail, title, etc.)
  chrome.contextMenus.create({
    id: 'ytg-link',
    title: 'Mit Gemini zusammenfassen',
    contexts: ['link'],
    documentUrlPatterns: [
      '*://www.youtube.com/*',
      '*://m.youtube.com/*',
    ],
    targetUrlPatterns: [
      '*://www.youtube.com/watch*',
      '*://www.youtube.com/shorts/*',
      '*://youtu.be/*',
      '*://m.youtube.com/watch*',
    ],
  });

  // When right-clicking anywhere on the page while watching a video
  chrome.contextMenus.create({
    id: 'ytg-page',
    title: 'Mit Gemini zusammenfassen',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://www.youtube.com/watch*',
      '*://www.youtube.com/shorts/*',
      '*://m.youtube.com/watch*',
    ],
  });
});

// ── Handle context menu click ────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (['hs-link', 'hs-page'].includes(info.menuItemId)) {
    const url = cleanYouTubeUrl(info.menuItemId === 'hs-link' ? info.linkUrl : tab.url);
    sendToHomeserver(url, tab);
    return;
  }
  if (!['ytg-link', 'ytg-page'].includes(info.menuItemId)) return;

  let rawUrl = info.menuItemId === 'ytg-link' ? info.linkUrl : tab.url;
  const videoUrl = cleanYouTubeUrl(rawUrl);
  const prompt = PROMPT(videoUrl);

  // Store prompt + target tab ID to avoid injecting into unrelated Gemini tabs
  chrome.tabs.create({ url: 'https://gemini.google.com/app' }, (geminiTab) => {
    chrome.storage.session.set({
      pendingPrompt: { text: prompt, targetTabId: geminiTab.id },
    });
  });
});

// ── Wait for the Gemini tab to finish loading, then inject ───────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.url.startsWith('https://gemini.google.com')) return;

  const result = await chrome.storage.session.get('pendingPrompt');
  const pending = result.pendingPrompt;
  if (!pending || pending.targetTabId !== tabId) return;

  await chrome.storage.session.remove('pendingPrompt');

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: fillGeminiAndSend,
      args: [pending.text],
    });
  } catch (err) {
    console.error('[YT→Gemini] Script injection failed:', err);
  }
});

// ── homeserver: in the background into the queue, ntfy reports when done ────
// The request carries Brave's Authelia session cookie (host permission for
// tools.server.tanaro.one). Without a session, or on any error, the page opens
// once instead: there you can sign in, and it sends the link itself.

const API = 'https://tools.server.tanaro.one/video/api/videos';

async function sendToHomeserver(url, tab) {
  setBadge('…', '#6b7280');
  try {
    const r = await fetch(API, {
      method: 'POST', credentials: 'include', redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-KIB': '1' },
      body: JSON.stringify({ url }),
    });
    const isJson = (r.headers.get('content-type') || '').includes('application/json');
    if (r.type === 'opaqueredirect' || !isJson) throw new Error('login');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    setBadge(data.existing ? '=' : '✓', '#396c61');
  } catch (err) {
    console.warn('[YT→homeserver]', err.message);
    setBadge('!', '#b42318');
    chrome.tabs.create({ url: TOOL + encodeURIComponent(url), index: tab.index + 1 });
  }
}

function setBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanYouTubeUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.slice(1);
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    if (url.pathname.startsWith('/shorts/')) {
      const videoId = url.pathname.split('/')[2];
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
    }
  } catch (_) {}
  return raw;
}

// ── Injected into Gemini page ─────────────────────────────────────────────────
// This function runs in the Gemini tab context — no outer-scope access.

function fillGeminiAndSend(prompt) {
  const INPUT_SELECTORS = [
    'rich-textarea .ql-editor',
    'rich-textarea div[contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'textarea',
  ];

  const SEND_SELECTORS = [
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
    'button[aria-label*="Senden"]',
    'button[jsname="c3Kyad"]',
    '[data-mat-icon-name="send"]',
    'button.send-button',
    'button[type="submit"]',
  ];

  const MAX_MS = 20000;
  const POLL_MS = 400;
  let elapsed = 0;

  function findVisible(selectors) {
    for (const sel of selectors) {
      const els = Array.from(document.querySelectorAll(sel));
      const el = els.find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !e.closest('[aria-hidden="true"]');
      });
      if (el) return el;
    }
    return null;
  }

  function insertText(input, text) {
    input.focus();
    // execCommand works reliably for Angular/React controlled inputs
    document.execCommand('selectAll', false, null);
    const ok = document.execCommand('insertText', false, text);
    if (ok) return;

    // Fallback for textarea
    if (input.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
      if (setter && setter.set) setter.set.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // Fallback for contenteditable
    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }

  function clickSend() {
    const btn = findVisible(SEND_SELECTORS);
    if (!btn) return;
    const button = btn.closest('button') ?? btn;
    if (!button.disabled && !button.hasAttribute('disabled')) button.click();
  }

  function tryFill() {
    const input = findVisible(INPUT_SELECTORS);
    if (!input) {
      elapsed += POLL_MS;
      if (elapsed < MAX_MS) setTimeout(tryFill, POLL_MS);
      return;
    }

    insertText(input, prompt);

    // Small delay to let the framework process the input event before sending
    setTimeout(clickSend, 1200);
  }

  // Wait for Gemini's SPA to finish rendering the input
  setTimeout(tryFill, 2000);
}
