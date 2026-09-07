# YouTube → Gemini Summarizer

Right-click a YouTube video → **"Mit Gemini zusammenfassen"** → Gemini opens in a new tab, the video URL and a summary prompt are filled in automatically, and the request is sent.

This is a small Chrome/Brave/Edge extension (Manifest V3). It has no backend, no API key, and collects no data.

## What It Does

- Adds a context menu entry on YouTube video links (thumbnails, titles) and on the watch page itself.
- Normalizes `youtu.be`, `/shorts/` and `m.youtube.com` links to a canonical `watch?v=…` URL.
- Opens `gemini.google.com/app`, waits for the SPA to render, fills the prompt and clicks send.
- Injects only into the Gemini tab it opened itself, so unrelated Gemini tabs are never touched.

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.

## Usage

**On the YouTube home page or in search results:** right-click a video link → *"Mit Gemini zusammenfassen"*.

**While watching a video:** right-click anywhere on the page → *"Mit Gemini zusammenfassen"*.

You need to be signed in to Gemini with a Google account, otherwise the new tab lands on the login page.

## Language

The menu label and the summary prompt are German by default. Both live at the top of `background.js`:

```js
const PROMPT = (url) =>
  `${url}\n\nbitte fasse dieses Video zusammen (…)`;
```

and in the two `chrome.contextMenus.create({ title: … })` calls. Change them there, plus `name` and `description` in `manifest.json`, to run the extension in another language.

## Permissions

| Permission | Why |
| --- | --- |
| `contextMenus` | adds the right-click entry |
| `tabs` | reads the URL of the current YouTube tab and of the Gemini tab it opened |
| `scripting` | injects the fill-and-send function into that Gemini tab |
| `storage` | `storage.session` holds the pending prompt until the Gemini tab has loaded |
| `host_permissions` | YouTube (read the video URL) and `gemini.google.com` (submit the prompt) |

## Privacy

No server, no analytics, no tracking, no data collection. The extension runs entirely in the browser and talks to no host other than the YouTube and Gemini pages you are already on.

## Limitations

- Gemini's DOM is not a public API. The selectors in `fillGeminiAndSend()` are best-effort with fallbacks and a 20 s timeout, but a Google redesign can break automatic filling or sending.
- Gemini summarizes from the video URL; if it cannot access a video (private, region-locked), the summary will say so.

## Development

There is no build step.

```bash
node --check background.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
python3 generate_icons.py   # regenerates icons/ (pure stdlib, no dependencies)
```

## License

MIT
