# Network Request Filtering

## Problem

The SDK records all network requests made by the application. However, we don't want to record the SDK's own API calls to the Quicklook server, as this would create:
- **Noise** in the network logs
- **Circular references** (recording the act of recording)
- **Wasted storage** (unnecessary data)
- **Confusion** for users reviewing sessions

## Solution

The SDK automatically filters out its own API requests before recording them.

## How It Works

### Blocklist

The SDK maintains a blocklist of URL patterns that should NOT be recorded:

```javascript
const BLOCKLIST = [
  "/api/quicklook/",     // All Quicklook API endpoints
  "quicklook",           // Any URL containing "quicklook"
  "sessions/start",      // Session start endpoint
  "sessions/",           // Session-related endpoints
  "/chunk",              // Chunk upload endpoint
  "/end"                 // Session end endpoint
];
```

### Filtering Logic

```javascript
function isQuicklookUrl(url) {
  // 1. Check if URL starts with the API base URL
  if (url.startsWith(apiBase)) return true;
  
  // 2. Check if URL contains any blocklist pattern
  return BLOCKLIST.some(pattern => url.includes(pattern));
}
```

### Network Patching

When the SDK patches `fetch()` and `XMLHttpRequest`:

```javascript
// Before making the request, check if it's a Quicklook URL
const url = getUrlFromRequest(input);
if (isQuicklookUrl(url)) {
  // Don't record this request - just pass it through
  return originalFetch.apply(this, arguments);
}

// For all other requests, record them
captureNetwork(method, url, status, duration, responseSize);
```

## Blocked Requests

The following Quicklook API requests are automatically blocked:

### Session Management
- `POST /api/quicklook/sessions/start` - Starting a new session
- `POST /api/quicklook/sessions/:id/chunk` - Uploading chunks
- `POST /api/quicklook/sessions/:id/end` - Ending a session

### Configuration
- `GET /api/quicklook/projects/:key/config` - Fetching project config

### Any Custom Endpoints
- Any URL containing `/api/quicklook/`
- Any URL containing the word "quicklook"

## Recorded Requests

All other network requests ARE recorded:

### External APIs
```javascript
fetch('https://api.example.com/data')  // ✅ RECORDED
fetch('https://jsonplaceholder.typicode.com/posts')  // ✅ RECORDED
```

### Your Application APIs
```javascript
fetch('/api/users')  // ✅ RECORDED
fetch('/api/products')  // ✅ RECORDED
```

### Third-Party Services
```javascript
fetch('https://analytics.google.com/...')  // ✅ RECORDED
fetch('https://api.stripe.com/...')  // ✅ RECORDED
```

## Testing

### Test File

Use `test-network-filtering.html` to verify filtering works:

```bash
open quicklook-sdk/test-network-filtering.html
```

### What to Check

1. **Automatic Filtering:**
   - SDK makes requests to start session
   - These should appear as "BLOCKED" (green) in the log
   - They should NOT appear in `ql_network` events

2. **External APIs:**
   - Click "Test External API" button
   - Request should appear as "RECORDED" (orange)
   - Should appear in `ql_network` events

3. **Statistics:**
   - Total Requests = Blocked + Recorded
   - Blocked = Quicklook API calls
   - Recorded = Everything else

### Console Verification

```javascript
// Check network events in a session
const events = sessionEvents.filter(e => e.type === 5 && e.data?.tag === 'ql_network');

// Should NOT contain Quicklook API URLs
events.forEach(e => {
  const url = e.data.payload.url;
  console.assert(!url.includes('/api/quicklook/'), 'Quicklook API should be filtered!');
  console.assert(!url.includes('sessions/'), 'Session endpoints should be filtered!');
});
```

## Edge Cases

### Custom API Base URL

If you use a custom API URL, it's automatically blocked:

```javascript
window.quicklook("init", "PROJECT_KEY", {
  apiUrl: "https://my-custom-domain.com"
});

// These are automatically blocked:
// - https://my-custom-domain.com/api/quicklook/sessions/start
// - https://my-custom-domain.com/api/quicklook/sessions/*/chunk
// - etc.
```

### Subdomain Variations

The blocklist catches variations:

```javascript
// All blocked:
http://localhost:3080/api/quicklook/sessions/start
https://quicklook.example.com/api/quicklook/sessions/start
https://api.example.com/api/quicklook/sessions/start
```

### False Positives

If your application has URLs containing "quicklook", they'll be blocked:

```javascript
// This would be blocked (false positive):
fetch('/api/quicklook-dashboard/stats')

// Workaround: Rename your endpoints to avoid "quicklook"
fetch('/api/ql-dashboard/stats')  // ✅ Not blocked
```

## Debugging

### Enable Debug Logging

Add this to see which requests are being filtered:

```javascript
// In network.js
function isQuicklookUrl(url) {
  const blocked = /* ... filtering logic ... */;
  if (blocked) {
    console.log('[quicklook] Blocked request:', url);
  }
  return blocked;
}
```

### Check Recorded Events

```javascript
// In browser console after recording
const networkEvents = sessionEvents.filter(e => 
  e.type === 5 && e.data?.tag === 'ql_network'
);

console.log('Recorded network requests:', networkEvents.length);
networkEvents.forEach(e => {
  console.log(e.data.payload.url);
});

// Should NOT see any /api/quicklook/ URLs
```

### Verify Blocklist

```javascript
// Check what's in the blocklist
console.log('Blocklist patterns:', BLOCKLIST);

// Test a URL manually
const testUrl = 'http://localhost:3080/api/quicklook/sessions/start';
console.log('Is blocked?', isQuicklookUrl(testUrl));  // Should be true
```

## Performance Impact

### Minimal Overhead

- Blocklist check: O(n) where n = blocklist size (currently 6 items)
- String operations: Very fast (< 0.1ms per request)
- No impact on application performance

### Memory Usage

- Blocklist: ~200 bytes
- No additional memory per request
- Negligible impact

## Security Considerations

### No Sensitive Data Leakage

By filtering Quicklook API calls:
- ✅ Session IDs not exposed in network logs
- ✅ Chunk data not recorded
- ✅ API keys not captured
- ✅ Internal implementation details hidden

### User Privacy

- Only user-initiated requests are recorded
- SDK's internal operations are invisible
- Cleaner, more relevant network logs

## Future Enhancements

### Configurable Blocklist

Allow users to add their own patterns:

```javascript
window.quicklook("init", "PROJECT_KEY", {
  excludeNetworkPatterns: [
    "/internal-api/",
    "sensitive-endpoint"
  ]
});
```

### Whitelist Mode

Only record specific patterns:

```javascript
window.quicklook("init", "PROJECT_KEY", {
  includeNetworkPatterns: [
    "/api/public/",
    "https://api.example.com/"
  ]
});
```

### Smart Filtering

Automatically detect and filter:
- Authentication endpoints
- Analytics requests
- Ad network calls
- Known tracking scripts

## Troubleshooting

### Issue: Quicklook API calls appearing in network logs

**Check:**
1. Verify blocklist includes `/api/quicklook/`
2. Check if `apiBase` is set correctly
3. Look for typos in URL patterns

**Debug:**
```javascript
// Add logging to isQuicklookUrl()
console.log('Checking URL:', url);
console.log('API Base:', apiBase);
console.log('Blocked?', isQuicklookUrl(url));
```

### Issue: Legitimate requests being blocked

**Cause:** URL contains "quicklook" or similar pattern

**Solution:**
1. Rename your endpoints
2. Or modify the blocklist to be more specific

### Issue: Too many network events

**Cause:** Recording too many requests

**Solution:**
```javascript
// Add more patterns to blocklist
const BLOCKLIST = [
  "/api/quicklook/",
  "/analytics/",
  "/tracking/",
  "google-analytics.com",
  "facebook.com/tr"
];
```

## Best Practices

### 1. Keep Blocklist Updated

When adding new Quicklook API endpoints, update the blocklist:

```javascript
const BLOCKLIST = [
  "/api/quicklook/",
  // Add new patterns here
];
```

### 2. Test After Changes

Always run `test-network-filtering.html` after modifying network collection.

### 3. Monitor Network Event Counts

If you see thousands of `ql_network` events per session:
- Check if filtering is working
- Consider adding more patterns to blocklist
- Review what requests your app is making

### 4. Document Custom Patterns

If you add custom blocklist patterns, document why:

```javascript
const BLOCKLIST = [
  "/api/quicklook/",
  "/internal-metrics/",  // Our internal monitoring, not relevant to users
  "cdn.example.com/ads"  // Ad requests, too noisy
];
```

## Summary

✅ **Automatic Filtering** - Quicklook API calls are never recorded
✅ **Clean Logs** - Only relevant network requests appear in sessions
✅ **No Configuration Needed** - Works out of the box
✅ **Extensible** - Can add custom patterns if needed
✅ **Testable** - Test file verifies filtering works correctly

The network filtering ensures that session recordings only contain meaningful network activity, making it easier to debug and understand user behavior.
