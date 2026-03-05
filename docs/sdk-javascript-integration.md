# QuickLook SDK — JavaScript integration

This guide explains how to add the QuickLook session recording SDK to your website with JavaScript and view recordings in the QuickLook dashboard.

## 1. Get your project key

In the dashboard, create a project (or open an existing one) and go to **Project → Settings → Integration**. Your **Project ID** is the project key you will pass to the SDK. You can also copy the ready-made script from the Integration tab.

If you haven’t created a project yet: from the home page click **New project**, name it, then go to the Integration tab to get the snippet and your project key.

## 2. Installation

Add the SDK script to your HTML (e.g. in `<head>` or before `</body>`). Load it with `async` so it doesn’t block the page.

```html
<script src="https://your-quicklook-server.com/quicklook-sdk.js" async></script>
<!-- Optional: serve compress.worker.js from the same origin, or pass workerUrl in init -->
```

Replace `your-quicklook-server.com` with your QuickLook API base URL (e.g. `https://quicklook.io`).

## 3. Initialize and connect to the dashboard

Call `quicklook('init', projectKey, options)` after the script loads. Use the **project key** from the dashboard (Project Settings → Integration). Sessions will appear under that project in the dashboard.

```html
<script src="https://quicklook.io/quicklook-sdk.js" async></script>
<script>
  window.quicklook("init", "YOUR_PROJECT_KEY", {
    apiUrl: "https://quicklook.io"
  });
</script>
```

Sessions will appear under that project in the dashboard.

## 4. Init options (optional)

You can pass a third argument to `init` with options:

```javascript
window.quicklook("init", "YOUR_PROJECT_KEY", {
  apiUrl: "https://quicklook.io",
  retentionDays: 30,
  captureStorage: false,
  workerUrl: "/path/to/compress.worker.js",
  excludedUrls: ["/privacy", "/admin"],
  includedUrls: ["/checkout", "/pricing"],
  inactivityTimeout: 300000,
  pauseOnHidden: true,
  maxSessionDuration: 3600000,
  region: "eu"
});
```

- **excludedUrls**: If the current URL contains any of these strings, recording is skipped. You can also configure exclusions in the dashboard (Project Settings → Page exclusions).
- **includedUrls**: If set, recording runs only when the URL contains at least one of these strings.

## 5. Identify users (optional)

To see who a session belongs to in the dashboard, call `identify` with user data:

```javascript
window.quicklook("identify", {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com"
});
```

## 6. Commands reference

- `init(projectKey, options?)` — Start recording (required first).
- `identify({ firstName?, lastName?, email?, ...custom })` — Set user identity.
- `getIdentity()` — Return current identity (debugging).
- `stop()` — Stop recording and flush data.
- `getSessionId(callback?)` — Current session ID (sync or via callback).

You can also read `window.quicklook.sessionId` (may be `null` before the session has started).

## 7. View sessions in the dashboard

Once the SDK is sending data for your project key:

1. Open the dashboard and select your project.
2. Go to **Sessions** to see the list of recordings (filter by date, status, etc.).
3. Click a session to watch the replay (playback of DOM, clicks, scrolls, and navigation).
4. If you called `identify()`, the user info and related sessions appear in the replay panel.

## 8. Self‑hosted / local development (optional)

Only if you run your own QuickLook server (e.g. on-prem or local dev): set `apiUrl` to that server’s URL. For production websites, use the default QuickLook API (`https://quicklook.io`) and do not set `apiUrl` to localhost.

Ensure `quicklook-sdk.js` and `compress.worker.js` are served by your server (or set `workerUrl`). Sessions will appear in the dashboard when the app is pointed at that server.

## 9. Full page example

```html
<!DOCTYPE html>
<html>
<head>
  <title>My app</title>
</head>
<body>
  <h1>My app</h1>

  <script src="https://quicklook.io/quicklook-sdk.js" async></script>
  <script>
    window.quicklook("init", "YOUR_PROJECT_KEY", { apiUrl: "https://quicklook.io" });
    // Optional: after login
    // window.quicklook("identify", { email: "user@example.com", firstName: "Jane" });
  </script>
</body>
</html>
```

---

For more details (SPA routing, inactivity, session limits), see `quicklook-sdk/README.md` in the project repo.
