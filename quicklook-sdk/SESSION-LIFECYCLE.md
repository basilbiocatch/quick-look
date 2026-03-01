# Session Lifecycle

## How Sessions Start and End

### Session Start

A session starts when:
1. User visits a page with the Quicklook SDK
2. SDK calls `window.quicklook("init", "PROJECT_KEY")`
3. Server creates a new session with `status: "active"`
4. Session ID is stored in `sessionStorage`

### Session End

A session ends when:

#### 1. Tab/Browser Close (Immediate) ✅
```javascript
// User closes tab or browser
// → pagehide event fires
// → SDK sends final data to /end endpoint
// → Session marked as "closed" immediately
```

**Behavior:**
- ✅ Session closes immediately
- ✅ Final data is sent via `sendBeacon()`
- ✅ Session marked as "closed" in database
- ✅ Duration calculated

#### 2. Page Navigation (Depends)

**Same-Origin Navigation:**
```javascript
// User navigates to another page on same domain
// → pagehide event fires
// → Session ENDS (closes)
// → New page loads
// → New session starts (or reuses if in bfcache)
```

**Note:** The SDK now ends sessions on navigation to ensure clean session boundaries.

#### 3. Manual Stop
```javascript
// App explicitly stops recording
window.quicklook("stop");
// → Session ends immediately
// → Recording stops
```

#### 4. Session Rotation (Duration Limit)
```javascript
// Session reaches 60 minutes (configurable)
// → Current session closes
// → New session starts automatically
// → Both sessions linked via sessionChainId
```

#### 5. Auto-Close Job (Abandoned Sessions)
```javascript
// Session inactive for 5 minutes (no chunks received)
// → Auto-close job marks it as "closed"
// → Runs every minute on server
```

## Session States

### Active
```javascript
{
  status: "active",
  createdAt: "2026-02-28T10:00:00Z",
  closedAt: null,
  duration: null
}
```

**Meaning:** Recording is currently happening or session is still alive.

### Closed
```javascript
{
  status: "closed",
  createdAt: "2026-02-28T10:00:00Z",
  closedAt: "2026-02-28T10:30:00Z",
  duration: 1800000  // 30 minutes in ms
}
```

**Meaning:** Session has ended, no more data will be recorded.

## Event Flow

### Normal Tab Close

```
Time    Event                           SDK Action              Server Status
────────────────────────────────────────────────────────────────────────────
0:00    User opens page                 Start session           active
0:05    User interacts                  Send chunks             active
0:10    User closes tab                 pagehide fires          active
0:10    SDK sends final data            POST /end               closed ✅
0:10    Session closed                  -                       closed
```

### Page Navigation (Same Origin)

```
Time    Event                           SDK Action              Server Status
────────────────────────────────────────────────────────────────────────────
0:00    User on page1                   Session 1 active        active
0:05    User clicks link to page2       pagehide fires          active
0:05    SDK ends session 1              POST /end               closed ✅
0:06    page2 loads                     New session starts      active
```

### Session Rotation (60 min limit)

```
Time    Event                           SDK Action              Server Status
────────────────────────────────────────────────────────────────────────────
0:00    User opens page                 Session 1 starts        active
1:00    60 minutes elapsed              Rotation triggered      active
1:00    Close session 1                 (implicit close)        closed ✅
1:00    Start session 2                 New session             active
        (linked via sessionChainId)
```

### Abandoned Session (Auto-Close)

```
Time    Event                           SDK Action              Server Status
────────────────────────────────────────────────────────────────────────────
0:00    User opens page                 Session starts          active
0:05    User leaves (no tab close)      -                       active
5:05    Auto-close job runs             -                       closed ✅
        (5 min of inactivity)
```

## Browser Back/Forward Cache (bfcache)

### What is bfcache?

Modern browsers cache pages when you navigate away, allowing instant "back" navigation.

### How Quicklook Handles It

```javascript
window.addEventListener("pagehide", (event) => {
  if (event.persisted) {
    // Page going into bfcache - might come back
    flush();  // Just flush data, keep session alive
  } else {
    // Page truly unloading - won't come back
    flushAndEnd();  // End the session
    endSession();
  }
});
```

**Example:**
```
1. User on page A (session active)
2. User navigates to page B
   - If page A goes into bfcache: session stays active
   - If page A unloads: session closes
3. User clicks back button
   - If page A from bfcache: same session continues
   - If page A reloads: new session starts
```

## Session Continuity

### When Sessions Continue

- ❌ **Never** - Sessions always end on page exit
- ❌ **Never** - Each page load gets a new session
- ✅ **Only** - Within same page (SPA navigation)

### When New Sessions Start

- ✅ Page load/reload
- ✅ Tab close and reopen
- ✅ Navigation to new page
- ✅ Session rotation (60 min)
- ✅ Manual stop + restart

## Best Practices

### For Multi-Page Tracking

If you want to track user journeys across multiple pages:

**Option 1: Use User Identification**
```javascript
window.quicklook("identify", {
  email: "user@example.com",
  userId: "12345"
});

// All sessions for this user can be queried together
```

**Option 2: Use Session Chains**
```javascript
// Sessions that rotate due to duration limits are automatically linked
// Query by sessionChainId to see related sessions
```

**Option 3: Custom Attributes**
```javascript
window.quicklook("init", "PROJECT_KEY", {
  visitId: generateVisitId(),  // Your own visit tracking
  campaignId: "summer-sale"
});
```

### For SPA (Single Page Apps)

SPAs work perfectly because:
- ✅ Session stays alive during route changes
- ✅ All pages tracked automatically (History API patching)
- ✅ Session only ends when tab closes

```javascript
// React Router example
<Route path="/page1" />  // Same session
<Route path="/page2" />  // Same session
<Route path="/page3" />  // Same session
// User closes tab → Session ends
```

### For Multi-Page Apps

Each page gets its own session:
```
Page 1 → Session 1 (closed on navigation)
Page 2 → Session 2 (closed on navigation)
Page 3 → Session 3 (closed on tab close)
```

Use `identify()` to link them by user.

## Debugging Session Lifecycle

### Check Session Status

```javascript
// In browser console
const sessionId = window.quicklook.sessionId;
console.log('Current session:', sessionId);

// Check if session is still active
fetch(`/api/quicklook/sessions/${sessionId}`)
  .then(r => r.json())
  .then(data => console.log('Status:', data.data.status));
```

### Monitor Session Events

```javascript
// Add logging to see when sessions end
window.addEventListener('pagehide', (e) => {
  console.log('pagehide fired, persisted:', e.persisted);
  console.log('Session will', e.persisted ? 'continue' : 'end');
});

window.addEventListener('beforeunload', () => {
  console.log('beforeunload fired - session ending');
});
```

### Check Database

```javascript
// MongoDB query
db.quicklook_sessions.find({ 
  sessionId: "your-session-id" 
})

// Should show:
{
  status: "closed",
  closedAt: ISODate("2026-02-28T10:30:00Z"),
  duration: 1800000
}
```

## Common Issues

### Issue: Session stays active after tab close

**Cause:** Browser didn't fire pagehide/beforeunload (rare)

**Solution:** Auto-close job will close it after 5 minutes

### Issue: Session ends on every page navigation

**Cause:** This is the correct behavior for multi-page apps

**Solution:** Use `identify()` to track users across sessions

### Issue: Session ends too quickly

**Cause:** Inactivity timeout or duration limit reached

**Solution:** Adjust configuration:
```javascript
window.quicklook("init", "PROJECT_KEY", {
  maxSessionDuration: 120 * 60 * 1000,  // 2 hours
  inactivityTimeout: 10 * 60 * 1000     // 10 minutes
});
```

## Summary

| Event | Session Behavior | Status Change |
|-------|------------------|---------------|
| Tab close | Ends immediately | active → closed |
| Browser close | Ends immediately | active → closed |
| Page navigation | Ends immediately | active → closed |
| SPA route change | Continues | active |
| 60 min elapsed | Rotates to new session | active → closed (old), active (new) |
| 5 min inactive | Auto-closed by server | active → closed |
| Manual stop() | Ends immediately | active → closed |

**Key Point:** Sessions now end immediately when users leave, providing accurate session boundaries and durations.
