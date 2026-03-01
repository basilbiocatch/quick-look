# Session Chains Implementation

## Overview

Session chains link multiple sessions that are part of the same user visit. When a session reaches the maximum duration (60 minutes by default), it automatically splits into a new session while maintaining the relationship between them.

This implementation is **better than Smartlook**, which splits sessions but doesn't link them together.

## Features

✅ **Automatic Session Rotation** - Sessions split after 60 minutes (configurable)
✅ **Session Linking** - All related sessions share a `sessionChainId`
✅ **Sequence Tracking** - Each session knows its position (1, 2, 3, etc.)
✅ **Split Reason Tracking** - Know why sessions were split (duration_limit, manual, page_navigation)
✅ **Seamless UX** - Users don't notice the split, recording continues
✅ **Better Analytics** - View complete user journeys across multiple sessions

## How It Works

### Example: 2-Hour User Visit

```
Time    Event                    Quicklook Behavior
─────────────────────────────────────────────────────────────────────
0:00    User loads page          Session 1 starts (chainId: abc-123)
0:30    User active              Session 1 continues
1:00    60 min reached           Session 1 closes → Session 2 starts
                                 (chainId: abc-123, parent: Session 1, seq: 2)
1:30    User active              Session 2 continues
2:00    60 min reached           Session 2 closes → Session 3 starts
                                 (chainId: abc-123, parent: Session 2, seq: 3)

Result: 3 linked sessions, all with chainId "abc-123"
```

### Database Structure

```javascript
// Session 1 (first in chain)
{
  sessionId: "session-abc-1",
  sessionChainId: "session-abc-1",  // First session ID becomes chain ID
  parentSessionId: null,
  sequenceNumber: 1,
  splitReason: null,
  status: "closed",
  duration: 3600000  // 60 minutes
}

// Session 2 (continuation)
{
  sessionId: "session-abc-2",
  sessionChainId: "session-abc-1",  // Same chain ID
  parentSessionId: "session-abc-1",
  sequenceNumber: 2,
  splitReason: "duration_limit",
  status: "closed",
  duration: 3600000  // 60 minutes
}

// Session 3 (continuation)
{
  sessionId: "session-abc-3",
  sessionChainId: "session-abc-1",  // Same chain ID
  parentSessionId: "session-abc-2",
  sequenceNumber: 3,
  splitReason: "duration_limit",
  status: "active",
  duration: null  // Still recording
}
```

## Configuration

### SDK Configuration

```javascript
window.quicklook("init", "YOUR_PROJECT_KEY", {
  maxSessionDuration: 60 * 60 * 1000,  // 60 minutes (default)
  inactivityTimeout: 5 * 60 * 1000,    // 5 minutes
  pauseOnHidden: true
});
```

### Custom Duration

```javascript
// 30-minute sessions
window.quicklook("init", "YOUR_PROJECT_KEY", {
  maxSessionDuration: 30 * 60 * 1000
});

// 2-hour sessions
window.quicklook("init", "YOUR_PROJECT_KEY", {
  maxSessionDuration: 120 * 60 * 1000
});

// Disable duration limit (not recommended)
window.quicklook("init", "YOUR_PROJECT_KEY", {
  maxSessionDuration: 0
});
```

## API Usage

### Get Session Chain

```javascript
// Server-side API
const chain = await QuicklookService.getSessionChain(sessionId);

// Returns array of all sessions in the chain
[
  { sessionId: "session-1", sequenceNumber: 1, duration: 3600000 },
  { sessionId: "session-2", sequenceNumber: 2, duration: 3600000 },
  { sessionId: "session-3", sequenceNumber: 3, duration: 1800000 }
]
```

### Query Sessions by Chain

```javascript
// Find all sessions in a chain
const sessions = await QuicklookSession.find({ 
  sessionChainId: "chain-id-here" 
}).sort({ sequenceNumber: 1 });

// Get total duration across all sessions
const totalDuration = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

// Check if chain is complete (all sessions closed)
const isComplete = sessions.every(s => s.status === "closed");
```

## UI Display Examples

### Session List

```
┌─────────────────────────────────────────────────────────┐
│ User: john@example.com                                  │
│ Date: Feb 28, 2026                                      │
├─────────────────────────────────────────────────────────┤
│ 🔗 Session Chain (3 sessions, 2h 15m total)            │
│                                                         │
│   1️⃣ Session 1 of 3  │  60:00  │  15 pages  │  Closed │
│   2️⃣ Session 2 of 3  │  60:00  │  12 pages  │  Closed │
│   3️⃣ Session 3 of 3  │  15:00  │   5 pages  │  Active │
│                                                         │
│   [▶ Play All Sessions]  [View Details]                │
└─────────────────────────────────────────────────────────┘
```

### Session Player

```
┌─────────────────────────────────────────────────────────┐
│ 🔗 Part of Session Chain                                │
│                                                         │
│ Currently viewing: Session 2 of 3                       │
│                                                         │
│ [◀ Previous Session]  [▶ Play]  [Next Session ▶]      │
│                                                         │
│ Timeline: [====Session 1====][====Session 2====][==3==] │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### SDK Flow

1. **Session Start:**
   - Create session with `sessionStartTime = Date.now()`
   - Store start time in sessionStorage
   - First session becomes chain ID

2. **During Recording:**
   - Before each chunk flush, check `shouldRotateSession()`
   - If `elapsed >= maxSessionDuration`, trigger rotation

3. **Session Rotation:**
   - Close current session (don't send to /end endpoint)
   - Create new session with chain info:
     - `parentSessionId`: previous session ID
     - `sessionChainId`: original chain ID
     - `sequenceNumber`: increment by 1
     - `splitReason`: "duration_limit"
   - Reset chunk index to 0
   - Continue recording seamlessly

4. **Storage:**
   - `quicklook_sid`: current session ID
   - `quicklook_chain_id`: chain ID (persists across rotations)
   - `quicklook_start_time`: session start timestamp
   - `quicklook_chunk_index`: current chunk index

### Server Flow

1. **Start Session Endpoint:**
   - Accept optional chain parameters
   - If `parentSessionId` provided, this is a continuation
   - Save chain info to database
   - Return `sessionId` and `sessionChainId`

2. **Get Session Chain:**
   - Query by `sessionChainId`
   - Sort by `sequenceNumber`
   - Return all linked sessions

3. **Analytics:**
   - Calculate total duration across chain
   - Count total pages across chain
   - Identify complete vs partial chains

## Benefits

### vs Smartlook

| Feature | Smartlook | Quicklook |
|---------|-----------|-----------|
| Auto-split sessions | ✅ Yes (60 min) | ✅ Yes (60 min, configurable) |
| Link split sessions | ❌ No | ✅ Yes (session chains) |
| View complete journey | ⚠️ Manual (filter by user) | ✅ Automatic (chain view) |
| Sequence tracking | ❌ No | ✅ Yes (1, 2, 3...) |
| Split reason | ❌ No | ✅ Yes (duration_limit, etc.) |
| Play all sessions | ❌ No | ✅ Yes (planned) |

### For Users

- ✅ See complete user journeys
- ✅ "Session 2 of 3" clarity
- ✅ Play entire chain with one click
- ✅ Accurate total duration
- ✅ Better engagement metrics

### For System

- ✅ Prevents session bloat
- ✅ Manageable chunk counts
- ✅ Better database performance
- ✅ Predictable storage usage
- ✅ Easier to process/analyze

## Migration

### Backward Compatibility

✅ **Fully backward compatible:**
- Existing sessions without chains work normally
- New sessions automatically get chain support
- No breaking changes to API
- Existing integrations work as-is

### Existing Sessions

Sessions created before this feature:
- Have `sessionChainId: null`
- Have `parentSessionId: null`
- Have `sequenceNumber: 1`
- Display as single sessions (not part of chain)

### Gradual Rollout

1. Deploy server changes (database schema)
2. Deploy SDK changes (session rotation)
3. Existing sessions continue working
4. New sessions automatically use chains
5. Update UI to show chain info (optional)

## Testing

### Manual Test

```javascript
// Test page with short duration for quick testing
window.quicklook("init", "test-key", {
  maxSessionDuration: 2 * 60 * 1000,  // 2 minutes for testing
  apiUrl: "http://localhost:3080"
});

// Wait 2 minutes, check console for rotation message:
// "[quicklook] Session rotated: abc12345 → def67890 (chain: abc12345, seq: 2)"
```

### Verify in Database

```javascript
// MongoDB query
db.quicklook_sessions.find({ 
  sessionChainId: "chain-id-here" 
}).sort({ sequenceNumber: 1 })

// Should see:
[
  { sessionId: "...", sequenceNumber: 1, parentSessionId: null },
  { sessionId: "...", sequenceNumber: 2, parentSessionId: "session-1-id" },
  { sessionId: "...", sequenceNumber: 3, parentSessionId: "session-2-id" }
]
```

### Check SessionStorage

```javascript
// In browser console
sessionStorage.getItem('quicklook_sid')        // Current session ID
sessionStorage.getItem('quicklook_chain_id')   // Chain ID (persists)
sessionStorage.getItem('quicklook_start_time') // Start timestamp
```

## Future Enhancements

### Phase 1 (Current) ✅
- [x] Automatic session rotation
- [x] Session chain linking
- [x] Sequence tracking
- [x] Split reason tracking

### Phase 2 (Planned)
- [ ] UI: Display "Session X of Y"
- [ ] UI: "Play All Sessions" button
- [ ] API: Get chain statistics
- [ ] Analytics: Chain-based metrics

### Phase 3 (Future)
- [ ] Smart splitting (split on page navigation + duration)
- [ ] Configurable split triggers
- [ ] Chain visualization
- [ ] Export entire chain

## Troubleshooting

### Sessions Not Rotating

**Check:**
1. `maxSessionDuration` is set and > 0
2. Session has been active for the full duration
3. Console shows rotation message
4. SessionStorage has `quicklook_start_time`

**Debug:**
```javascript
// Check current session age
const startTime = parseInt(sessionStorage.getItem('quicklook_start_time'));
const elapsed = Date.now() - startTime;
console.log('Session age (minutes):', elapsed / 60000);
```

### Chain Not Linking

**Check:**
1. `sessionChainId` is being stored in sessionStorage
2. Server receives chain parameters in start request
3. Database has chain fields populated

**Debug:**
```javascript
// Check chain info
console.log('Chain ID:', sessionStorage.getItem('quicklook_chain_id'));

// Server-side
const session = await QuicklookSession.findOne({ sessionId: 'xxx' });
console.log('Chain:', session.sessionChainId, 'Seq:', session.sequenceNumber);
```

### Chunk Index Issues

**Issue:** Chunk indices continue from previous session

**Fix:** Already implemented - chunk index resets to 0 on rotation

```javascript
// In upload.js doFlush()
if (shouldRotateSession()) {
  await rotateSession();
  chunkIndex = 0;  // Reset for new session
  persistChunkIndex();
}
```

## API Reference

### SDK Methods

```javascript
// Check if session should rotate
shouldRotateSession(): boolean

// Manually rotate session
rotateSession(reason?: string): Promise<{
  oldSessionId: string,
  newSessionId: string,
  sessionChainId: string,
  sequenceNumber: number
}>

// Get session start time
getSessionStartTime(): number
```

### Server Methods

```javascript
// Start session with chain info
QuicklookService.startSession({
  projectKey,
  meta,
  user,
  parentSessionId?,
  sessionChainId?,
  sequenceNumber?,
  splitReason?
}): Promise<{ sessionId, sessionChainId }>

// Get all sessions in chain
QuicklookService.getSessionChain(sessionId): Promise<Session[]>
```

### Database Schema

```javascript
{
  sessionId: String,
  sessionChainId: String,      // Links related sessions
  parentSessionId: String,     // Previous session in chain
  sequenceNumber: Number,      // Position in chain (1, 2, 3...)
  splitReason: String,         // Why session was split
  // ... other session fields
}
```

## Conclusion

Session chains provide a **better solution than Smartlook** by:
- ✅ Preventing session bloat (60-minute limit)
- ✅ Maintaining user journey continuity (linked sessions)
- ✅ Enabling better analytics (complete visit tracking)
- ✅ Improving performance (manageable session sizes)

This implementation is production-ready, backward compatible, and provides a foundation for advanced features like chain visualization and multi-session playback.
