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
  workerUrl: "/path/to/compress.worker.js"  // or false to disable compression
});
```

### Commands

- `init(projectKey, options?)` — Start recording; required first.
- `identify({ firstName?, lastName?, email?, ...custom })` — Set user identity.
- `stop()` — Stop recording and flush.
- `getSessionId(callback?)` — Return or callback with current session ID.

## Local development

Point `apiUrl` to your quicklook-server (e.g. `http://localhost:3080`).

## Build

```bash
npm install
npm run build
```

Output: `dist/quicklook-sdk.js`, `dist/compress.worker.js`.
