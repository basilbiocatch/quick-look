# Session Duration Strategy: Smartlook vs Quicklook

## How Smartlook Handles Long Sessions

Based on research of Smartlook's documentation, here's their approach:

### Smartlook's Session Rules

**Web Sessions:**
- **Maximum Duration:** 60 minutes
- **Inactivity Timeout:** 15 minutes of no activity
- **Session Continuation:** If user returns within 15 minutes, continues same session
- **Automatic Split:** After 60 minutes OR 15 minutes of inactivity, a new session starts

**Mobile Sessions:**
- **Maximum Duration:** 60 minutes
- **Background Timeout:** 5 minutes in background
- **Force Close:** Immediate session end

### Example Scenario (2-hour session)

**User leaves page open for 2 hours:**

```
Time    Activity                Smartlook Behavior
────────────────────────────────────────────────────────────────
0:00    User loads page         Session 1 starts
0:30    User active             Session 1 continues
0:45    User stops activity     Session 1 continues
1:00    60 min reached          Session 1 ENDS → Session 2 starts
1:15    Still no activity       Session 2 continues
1:30    15 min inactivity       Session 2 ENDS (inactivity)
2:00    User returns            Session 3 starts (new session)
```

**Key Points:**
- ✅ Sessions automatically split after 60 minutes
- ✅ Sessions end after 15 minutes of inactivity
- ✅ New session starts when user returns
- ✅ Prevents extremely long sessions

## Current Quicklook Behavior

### What We Have Now

**Current Implementation:**
- ✅ Inactivity detection (5 minutes default, configurable)
- ✅ Pause on tab hidden
- ✅ Auto-close job (30 minutes default)
- ❌ **NO maximum session duration limit**

**Example: 2-hour session in Quicklook**

```
Time    Activity                Quicklook Behavior (Current)
────────────────────────────────────────────────────────────────
0:00    User loads page         Session starts
0:30    User active             Same session continues
1:00    User active             Same session continues (no limit!)
1:30    User active             Same session continues
2:00    User active             STILL same session (no split!)
```

**Problems with current approach:**
1. Sessions can grow indefinitely large
2. Massive chunk counts (hundreds or thousands)
3. Difficult to replay very long sessions
4. Storage/performance issues
5. No natural session boundaries

## Recommended Solution

Implement a **maximum session duration** similar to Smartlook:

### Option 1: Hard Session Duration Limit (Recommended)

**Implementation:**
- Maximum session duration: 60 minutes (configurable)
- After 60 minutes, automatically end session and start new one
- Seamless transition for user (no interruption)

**SDK Changes:**

```javascript
// src/session.js
let sessionStartTime = null;
let maxSessionDuration = 60 * 60 * 1000; // 60 minutes

export function setMaxSessionDuration(duration) {
  maxSessionDuration = duration;
}

export function checkSessionDuration() {
  if (!sessionStartTime || !sessionId) return false;
  const elapsed = Date.now() - sessionStartTime;
  return elapsed >= maxSessionDuration;
}

// In upload.js or record.js
// Check before each chunk upload
if (checkSessionDuration()) {
  // End current session
  flushAndEnd();
  endSession();
  
  // Start new session
  sessionId = null;
  sessionStartTime = Date.now();
  await startSession();
  startRecording();
}
```

**Configuration:**

```javascript
window.quicklook("init", "PROJECT_KEY", {
  maxSessionDuration: 60 * 60 * 1000, // 60 minutes (default)
  inactivityTimeout: 5 * 60 * 1000,   // 5 minutes
  pauseOnHidden: true
});
```

### Option 2: Soft Duration Limit with Continuation

**Implementation:**
- After 60 minutes, mark session as "completed" but allow continuation
- Create linked sessions (session chains)
- Useful for analytics: "Session 1 of 3", "Session 2 of 3", etc.

**Database Schema:**

```javascript
{
  sessionId: "abc-123",
  parentSessionId: "xyz-789",  // Links to previous session
  sessionSequence: 2,           // This is the 2nd session in chain
  status: "active",
  duration: 3600000,            // 60 minutes
  // ... other fields
}
```

### Option 3: Configurable per Project

Allow project owners to set their own limits:

```javascript
// Project settings
{
  projectKey: "my-project",
  maxSessionDuration: 120 * 60 * 1000, // 2 hours for this project
  inactivityTimeout: 10 * 60 * 1000,   // 10 minutes
  // ... other settings
}
```

## Comparison Table

| Feature | Smartlook | Quicklook (Current) | Quicklook (Recommended) |
|---------|-----------|---------------------|-------------------------|
| Max Duration | 60 min | ∞ (unlimited) | 60 min (configurable) |
| Inactivity Timeout | 15 min | 5 min (configurable) | 5 min (configurable) |
| Auto Split | ✅ Yes | ❌ No | ✅ Yes |
| Pause on Hidden | ✅ Yes | ✅ Yes | ✅ Yes |
| Session Chains | ❌ No | ❌ No | ⚠️ Optional |
| Manual Control | ✅ Yes | ✅ Yes | ✅ Yes |

## Implementation Priority

### Phase 1: Basic Duration Limit (High Priority)
```javascript
// Add to SDK init options
maxSessionDuration: 60 * 60 * 1000  // 60 minutes default
```

**Why:**
- Prevents extremely long sessions
- Matches industry standard (Smartlook)
- Easy to implement
- Immediate benefit

### Phase 2: Configurable Limits (Medium Priority)
- Allow per-project configuration
- Store in project settings
- SDK fetches on init

### Phase 3: Session Chains (Low Priority)
- Link related sessions
- Better analytics
- "Session 1 of 3" display

## Code Implementation Example

### 1. Add to SDK session.js

```javascript
let sessionStartTime = null;
let maxSessionDuration = 60 * 60 * 1000; // 60 minutes default

export function setMaxSessionDuration(duration) {
  if (typeof duration === 'number' && duration > 0) {
    maxSessionDuration = duration;
  }
}

export function getSessionStartTime() {
  return sessionStartTime;
}

export function shouldRotateSession() {
  if (!sessionStartTime || !sessionId || maxSessionDuration <= 0) {
    return false;
  }
  const elapsed = Date.now() - sessionStartTime;
  return elapsed >= maxSessionDuration;
}

export async function rotateSession() {
  // End current session
  const oldSessionId = sessionId;
  
  // Clear current session
  sessionId = null;
  started = false;
  
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem("quicklook_chunk_index");
    }
  } catch (_) {}
  
  // Start new session
  await startSession();
  sessionStartTime = Date.now();
  
  return { oldSessionId, newSessionId: sessionId };
}
```

### 2. Add to init.js

```javascript
function init(projectKey, options = {}) {
  // ... existing code ...
  
  setMaxSessionDuration(
    options.maxSessionDuration !== undefined 
      ? options.maxSessionDuration 
      : 60 * 60 * 1000
  );
  
  // ... rest of init ...
}
```

### 3. Add to upload.js

```javascript
async function doFlush() {
  // Check if session should rotate before flushing
  if (shouldRotateSession()) {
    const { oldSessionId, newSessionId } = await rotateSession();
    console.log(`[quicklook] Session rotated: ${oldSessionId} → ${newSessionId}`);
    // Continue with flush using new session
  }
  
  // ... existing flush logic ...
}
```

## Benefits of Duration Limits

### For Users
- ✅ Faster session loading
- ✅ Better replay performance
- ✅ Clearer session boundaries
- ✅ More accurate analytics

### For System
- ✅ Smaller chunk counts per session
- ✅ Better database performance
- ✅ Easier to process/analyze
- ✅ Predictable storage usage

### For Analytics
- ✅ Natural session boundaries
- ✅ Better engagement metrics
- ✅ Clearer user journeys
- ✅ More actionable insights

## Migration Strategy

### Backward Compatibility

1. **Default behavior:** 60 minutes (matches Smartlook)
2. **Opt-out:** Set `maxSessionDuration: 0` to disable
3. **Existing sessions:** Continue until they naturally end
4. **No breaking changes:** Existing integrations work as-is

### Rollout Plan

1. **Week 1:** Implement in SDK, default disabled
2. **Week 2:** Test with internal projects
3. **Week 3:** Enable for new projects only
4. **Week 4:** Announce feature, allow opt-in
5. **Week 5+:** Make default for all projects

## Conclusion

**Recommendation:** Implement Option 1 (Hard Session Duration Limit)

**Why:**
- Industry standard (Smartlook uses 60 minutes)
- Prevents session bloat
- Improves performance
- Easy to implement
- Configurable per project

**Default Settings:**
```javascript
{
  maxSessionDuration: 60 * 60 * 1000,  // 60 minutes
  inactivityTimeout: 5 * 60 * 1000,    // 5 minutes
  pauseOnHidden: true
}
```

This gives you the best of both worlds:
- Automatic session management (like Smartlook)
- Flexibility for different use cases
- Better performance and user experience
