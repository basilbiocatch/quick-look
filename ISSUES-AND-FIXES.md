# Issues and Fixes

## Issue 1: Only One Page Showing Despite Visiting Multiple Pages

### Problem
Session shows only 1 page even though user visited multiple pages during the session.

### Root Cause
**rrweb's Meta events (type 4) only fire on full page navigations**, not on:
- Single Page Application (SPA) route changes
- Hash changes (`#/page1` → `#/page2`)
- History API pushState/replaceState
- React Router, Vue Router, etc.

### Example
```javascript
// Full page navigation - rrweb captures ✅
window.location.href = '/page2';

// SPA navigation - rrweb DOES NOT capture ❌
history.pushState({}, '', '/page2');
router.push('/page2');  // React Router, Vue Router, etc.
```

### Solution Options

#### Option 1: Manual Page Tracking (Recommended)
Add custom events when routes change:

```javascript
// In your app's router
router.afterEach((to, from) => {
  window.quicklook('trackPage', {
    url: window.location.href,
    path: to.path,
    name: to.name
  });
});

// Or with History API
const originalPushState = history.pushState;
history.pushState = function(...args) {
  originalPushState.apply(this, args);
  window.quicklook('trackPage', { url: window.location.href });
};
```

#### Option 2: Automatic SPA Detection (SDK Enhancement)
Patch History API in the SDK to automatically detect route changes:

```javascript
// In SDK init.js
function patchHistoryAPI() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    // Emit custom Meta event
    pushEvent({
      type: 4,  // Meta
      data: { href: window.location.href },
      timestamp: Date.now()
    });
    return result;
  };
  
  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    pushEvent({
      type: 4,
      data: { href: window.location.href },
      timestamp: Date.now()
    });
    return result;
  };
  
  // Also listen for popstate (back/forward buttons)
  window.addEventListener('popstate', () => {
    pushEvent({
      type: 4,
      data: { href: window.location.href },
      timestamp: Date.now()
    });
  });
}
```

#### Option 3: URL Polling (Fallback)
Periodically check if URL changed:

```javascript
let lastUrl = window.location.href;
setInterval(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    pushEvent({
      type: 4,
      data: { href: currentUrl },
      timestamp: Date.now()
    });
    lastUrl = currentUrl;
  }
}, 1000);  // Check every second
```

---

## Issue 2: Session Not Moving to "Completed" When Page is Exited

### Problem
When user closes the tab or navigates away, session stays "active" instead of moving to "closed/completed".

### Root Cause
**By design**, the SDK keeps sessions alive across page navigations to:
- Track multi-page user journeys
- Maintain session continuity in SPAs
- Avoid creating new sessions for every page

Sessions only close when:
1. User explicitly calls `quicklook('stop')`
2. Auto-close job runs (after 30 minutes of inactivity)
3. Tab is closed and sessionStorage is cleared

### Current Behavior
```
User visits page 1 → Session starts (active)
User visits page 2 → Same session continues (active)
User closes tab → Session stays active ❌
30 minutes later → Auto-close job closes it ✅
```

### Solution Options

#### Option 1: Immediate Close on Page Exit (Aggressive)
Close session immediately when user leaves:

```javascript
// In init.js
window.addEventListener("pagehide", () => {
  if (recordingStarted) {
    flushAndEnd();  // Send data AND close session
    endSession();
  }
});
```

**Pros:**
- Sessions close immediately
- Clean session lifecycle
- Matches user expectation

**Cons:**
- ❌ Breaks multi-page tracking
- ❌ New session for every page navigation
- ❌ Can't track user journeys across pages

#### Option 2: Smart Detection (Recommended)
Close session only when tab is actually closed, not on navigation:

```javascript
// In init.js
let isNavigating = false;

window.addEventListener("beforeunload", (e) => {
  // Check if this is a navigation or tab close
  if (e.returnValue === undefined) {
    // Tab is closing
    isNavigating = false;
  } else {
    // User is navigating
    isNavigating = true;
  }
});

window.addEventListener("pagehide", () => {
  if (recordingStarted) {
    if (isNavigating) {
      // Just flush, keep session alive
      flush();
    } else {
      // Tab closing, end session
      flushAndEnd();
      endSession();
    }
  }
});
```

**Problem:** This is unreliable - browsers don't provide a clear way to distinguish tab close from navigation.

#### Option 3: Heartbeat System (Best)
Keep session alive with heartbeats, close after timeout:

```javascript
// SDK sends heartbeat every 30 seconds
setInterval(() => {
  if (recordingStarted) {
    // Send lightweight heartbeat
    fetch(`${apiUrl}/api/quicklook/sessions/${sessionId}/heartbeat`, {
      method: 'POST',
      keepalive: true
    });
  }
}, 30000);

// Server: Close sessions without heartbeat for 2 minutes
async function autoCloseInactiveSessions() {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  await QuicklookSession.updateMany(
    { 
      status: 'active',
      lastHeartbeat: { $lt: cutoff }
    },
    { 
      status: 'closed',
      closedAt: new Date()
    }
  );
}
```

**Pros:**
- ✅ Accurate detection of tab closure
- ✅ Maintains multi-page tracking
- ✅ Sessions close within 2 minutes of tab close

**Cons:**
- Requires server changes
- Additional API calls

#### Option 4: Visibility-Based Timeout (Compromise)
Close session after extended invisibility:

```javascript
let hiddenStartTime = null;
const HIDDEN_TIMEOUT = 5 * 60 * 1000; // 5 minutes

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenStartTime = Date.now();
  } else {
    hiddenStartTime = null;
  }
});

setInterval(() => {
  if (hiddenStartTime && Date.now() - hiddenStartTime > HIDDEN_TIMEOUT) {
    // Tab hidden for 5 minutes, likely closed
    flushAndEnd();
    endSession();
  }
}, 60000);  // Check every minute
```

---

## Recommended Implementation

### For Page Tracking
**Implement Option 2: Automatic SPA Detection**

Add to SDK to automatically track route changes:

```javascript
// In init.js after startRecording()
if (recordingStarted) {
  patchHistoryAPI();
}
```

This will automatically capture:
- `history.pushState()` calls
- `history.replaceState()` calls
- Back/forward button navigation
- All SPA route changes

### For Session Closing
**Keep current behavior + improve auto-close**

1. **Keep sessions alive across navigations** (current behavior)
2. **Reduce auto-close timeout** from 30 minutes to 5 minutes
3. **Add UI indicator** showing session is "active but idle"

```javascript
// Server: More aggressive auto-close
async function autoCloseInactiveSessions() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);  // 5 minutes
  // ... close sessions
}
```

---

## Quick Fixes

### Fix 1: Add SPA Route Tracking to SDK

```javascript
// Add to src/init.js
function patchHistoryAPI(pushEventFn) {
  if (typeof window === 'undefined' || typeof history === 'undefined') return;
  
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    pushEventFn({
      type: 4,
      data: { href: window.location.href },
      timestamp: Date.now()
    });
    return result;
  };
  
  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    pushEventFn({
      type: 4,
      data: { href: window.location.href },
      timestamp: Date.now()
    });
    return result;
  };
  
  window.addEventListener('popstate', () => {
    pushEventFn({
      type: 4,
      data: { href: window.location.href },
      timestamp: Date.now()
    });
  });
}

// In init() after startRecording()
patchHistoryAPI(pushEventAndMaybeStart);
```

### Fix 2: Reduce Auto-Close Timeout

```javascript
// In quicklookService.js
async autoCloseInactiveSessions(inactivityTimeoutMs = 5 * 60 * 1000) {  // 5 minutes instead of 30
  // ... existing code
}
```

### Fix 3: Run Auto-Close More Frequently

```javascript
// In server startup
setInterval(async () => {
  await QuicklookService.autoCloseInactiveSessions(5 * 60 * 1000);
}, 60 * 1000);  // Run every minute instead of every hour
```

---

## Testing

### Test Page Tracking

```html
<!-- SPA test page -->
<button onclick="history.pushState({}, '', '/page2')">Go to Page 2</button>
<button onclick="history.pushState({}, '', '/page3')">Go to Page 3</button>
<button onclick="history.back()">Back</button>

<script>
  // After clicking buttons, check session
  setTimeout(async () => {
    const response = await fetch(`/api/quicklook/sessions/${sessionId}`);
    const session = await response.json();
    console.log('Pages:', session.data.pages);
    // Should show: ['/page1', '/page2', '/page3']
  }, 5000);
</script>
```

### Test Session Closing

```javascript
// 1. Open page, start session
// 2. Close tab
// 3. Wait 5 minutes
// 4. Check database: session should be closed
db.quicklook_sessions.findOne({ sessionId: 'xxx' })
// { status: 'closed', closedAt: ISODate(...) }
```

---

## Summary

| Issue | Root Cause | Recommended Fix |
|-------|-----------|-----------------|
| Only 1 page tracked | rrweb doesn't capture SPA routes | Patch History API in SDK |
| Session stays active | By design (multi-page tracking) | Reduce auto-close timeout to 5 min |

Both fixes are backward compatible and improve the user experience significantly.
