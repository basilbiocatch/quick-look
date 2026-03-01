# Quicklook SDK

Browser SDK for session recording. Integrate with a single script tag.

## Installation

Include the script and worker on your page (e.g. from your own host or CDN):

```html
<script src="https://your-cdn.com/quicklook-sdk.js" async></script>
<!-- compress.worker.js must be served from the same origin or pass workerUrl in init -->
```

## Usage

```javascript
window.quicklook("init", "YOUR_PROJECT_KEY");
window.quicklook("identify", { firstName: "Jane", email: "jane@example.com" });
```

### Init options

```javascript
window.quicklook("init", "YOUR_PROJECT_KEY", {
  apiUrl: "http://localhost:3080",  // default for dev
  retentionDays: 30,
  captureStorage: false,
  workerUrl: "/path/to/compress.worker.js",  // or false to disable compression
  excludedUrls: ["/privacy", "/admin"],  // optional: do not record on these URL substrings; or configure in dashboard
  includedUrls: ["/checkout", "/pricing"],  // optional: only record on these URL substrings; if set, all other pages are ignored
  inactivityTimeout: 300000,  // default: 5 minutes (in ms). Set to 0 to disable inactivity detection
  pauseOnHidden: true,  // default: true. Pause recording when tab is hidden/minimized
  maxSessionDuration: 3600000,  // default: 60 minutes (in ms). Set to 0 to disable. Sessions auto-split after this duration
  region: "eu",  // any other keys are stored on the session
});
```

**Do not monitor certain pages:** In the project settings dashboard you can add URL patterns (e.g. `/privacy`, `/admin`). The SDK will not record or send data when the current page URL contains any of those patterns. If you don’t pass `excludedUrls` in options, the SDK fetches the list from the API automatically.

**Only monitor specific pages:** Pass `includedUrls` with an array of URL substrings (e.g. `["/checkout", "/pricing"]`). The SDK will only record when the current page URL contains at least one of these patterns. On SPAs, recording automatically pauses when the user navigates to a non-included page and resumes when they return to an included page. Omit `includedUrls` to record on all pages (subject to `excludedUrls`).

**Automatic pause on inactivity:** By default, the SDK pauses recording after 5 minutes of user inactivity (no mouse, keyboard, scroll, or touch events) and when the tab is hidden/minimized. Recording automatically resumes when the user returns or becomes active again. This saves bandwidth, storage, and reduces unnecessary data collection. Configure with `inactivityTimeout` and `pauseOnHidden` options.

**Session duration limits:** Sessions automatically split after 60 minutes (configurable with `maxSessionDuration`). When a session reaches the duration limit, it's automatically closed and a new session starts seamlessly. Split sessions are linked together as a "session chain" so you can view the complete user journey. This prevents extremely long sessions, improves performance, and matches industry standards (Smartlook uses 60 minutes).

**SPA route tracking:** The SDK automatically tracks route changes in Single Page Applications (SPAs) using React Router, Vue Router, or the History API. All page navigations are captured, including `pushState`, `replaceState`, and back/forward button clicks. No additional configuration needed.

### Commands

- `init(projectKey, options?)` — Start recording; required first.
- `identify({ firstName?, lastName?, email?, ...custom })` — Set user identity.
- `stop()` — Stop recording and flush.
- `getSessionId(callback?)` — Return or callback with current session ID.

### Reading the current session ID

You can read the current session ID as a property (synchronous, may be `null` before session has started):

```javascript
const id = window.quicklook.sessionId;
```

## Local development

Point `apiUrl` to your quicklook-server (e.g. `http://localhost:3080`).

## Build

```bash
npm install
npm run build
```

Output: `dist/quicklook-sdk.js`, `dist/compress.worker.js`.
