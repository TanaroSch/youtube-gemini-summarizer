// YouTube → homeserver: ein Kontextmenue-Eintrag (eigene Erweiterung, damit er
// direkt im Menue steht; mit zwei Eintraegen buendelt Brave sie im Untermenue).
// Sendet im Hintergrund an die Video-Seite von ki-briefing; fertig meldet ntfy.

const PAGE = 'https://tools.server.tanaro.one/video/';
const API = PAGE + 'api/videos';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'hs-link', title: 'Auf homeserver zusammenfassen', contexts: ['link'],
      documentUrlPatterns: ['*://www.youtube.com/*', '*://m.youtube.com/*'],
      targetUrlPatterns: ['*://www.youtube.com/watch*', '*://www.youtube.com/shorts/*',
                          '*://youtu.be/*', '*://m.youtube.com/watch*'],
    });
    chrome.contextMenus.create({
      id: 'hs-page', title: 'Auf homeserver zusammenfassen', contexts: ['page'],
      documentUrlPatterns: ['*://www.youtube.com/watch*', '*://www.youtube.com/shorts/*',
                            '*://m.youtube.com/watch*'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'hs-link' && info.menuItemId !== 'hs-page') return;
  send(cleanYouTubeUrl(info.menuItemId === 'hs-link' ? info.linkUrl : tab.url), tab);
});

// Mit Braves Authelia-Cookie (Host-Berechtigung fuer tools.server.tanaro.one).
// Ohne Sitzung oder bei Fehler oeffnet sich einmal die Seite: dort anmelden,
// sie schickt den Link dann selbst.
async function send(url, tab) {
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
    chrome.tabs.create({ url: PAGE + '?url=' + encodeURIComponent(url), index: tab.index + 1 });
  }
}

function setBadge(text, color) {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

function cleanYouTubeUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.hostname === 'youtu.be') return `https://www.youtube.com/watch?v=${url.pathname.slice(1)}`;
    if (url.pathname.startsWith('/shorts/')) return `https://www.youtube.com/watch?v=${url.pathname.split('/')[2]}`;
    const v = url.searchParams.get('v');
    if (v) return `https://www.youtube.com/watch?v=${v}`;
  } catch (_) {}
  return raw;
}
