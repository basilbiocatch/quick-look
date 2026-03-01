# Inactivity Detection Feature

## Overview

The Quicklook SDK now includes automatic pause/resume functionality to handle inactive user sessions. This feature reduces unnecessary data collection, saves bandwidth, and minimizes storage costs when users leave pages open without interaction.

## Implementation

### Hybrid Approach

The implementation uses a **hybrid approach** combining two detection methods:

1. **Page Visibility Detection** - Pauses recording when the user switches tabs or minimizes the browser
2. **Inactivity Timeout** - Pauses recording after a configurable period of no user activity

### How It Works

#### Pause Triggers
- **Tab Hidden**: When `document.hidden` becomes `true` (user switches tabs or minimizes window)
- **Inactivity Timeout**: After no user activity for the configured duration (default: 5 minutes)

#### Resume Triggers
- **Tab Visible**: When user returns to the tab
- **User Activity**: Any of these events: `mousedown`, `keydown`, `scroll`, `touchstart`

#### What Happens on Pause
1. Stops rrweb recording (`stopRecording()`)
2. Flushes remaining data to server (`flush()` - sends data without closing session)
3. Stops the upload scheduler (`stopScheduler()`)
4. Network/console collectors remain patched but recording is paused
5. **Session remains "active"** on the server (not marked as "closed")

#### What Happens on Resume
1. Restarts rrweb recording (`startRecording()`)
2. Restarts the upload scheduler (`startScheduler()`)
3. Resets the inactivity timer
4. **Continues using the same session** (session ID unchanged)

## Configuration

### Default Settings

```javascript
window.quicklook("init", "YOUR_PROJECT_KEY", {
  inactivityTimeout: 300000,  // 5 minutes (in milliseconds)
  pauseOnHidden: true         // Pause when tab is hidden
});
```

### Custom Configuration

```javascript
// Shorter timeout for testing
window.quicklook("init", "YOUR_PROJECT_KEY", {
  inactivityTimeout: 60000,   // 1 minute
  pauseOnHidden: true
});

// Disable inactivity timeout, keep visibility detection
window.quicklook("init", "YOUR_PROJECT_KEY", {
  inactivityTimeout: 0,       // Disabled
  pauseOnHidden: true
});

// Disable both (not recommended)
window.quicklook("init", "YOUR_PROJECT_KEY", {
  inactivityTimeout: 0,
  pauseOnHidden: false
});
```

## Files Modified

### New Files
- `src/activity.js` - Core activity monitoring module

### Modified Files
- `src/init.js` - Integration of activity monitoring
- `src/upload.js` - Added `stopScheduler()` and `flush()` functions
- `README.md` - Documentation updates

### Key Implementation Detail: Session Continuity

**Important:** When pausing due to inactivity or tab visibility, the SDK uses `flush()` instead of `flushAndEnd()`. This is critical because:

- `flush()` - Sends remaining events to the server via regular chunk endpoint, **session stays "active"**
- `flushAndEnd()` - Sends data to the `/end` endpoint with `status: "close"`, **session becomes "closed"**

This ensures that when the user returns and recording resumes, new chunks can be added to the same active session. The session is only marked as "closed" when:
1. User explicitly calls `quicklook("stop")`
2. The auto-close job runs on the server (after extended inactivity, e.g., 30+ minutes)
3. The tab is actually closed (browser clears sessionStorage)

## Architecture

```
┌─────────────────────────────────────────┐
│         User Activity Events            │
│  (mousedown, keydown, scroll, touch)    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      activity.js (Activity Monitor)     │
│  • Tracks inactivity timer              │
│  • Monitors visibility changes          │
│  • Manages pause/resume state           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         init.js (Callbacks)             │
│  • pauseCallback: stop recording        │
│  • resumeCallback: start recording      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      record.js & upload.js              │
│  • Start/stop rrweb recording           │
│  • Start/stop upload scheduler          │
│  • Flush data on pause                  │
└─────────────────────────────────────────┘
```

## Testing

### Test File
Use `test-inactivity.html` to test the feature:

```bash
# Start the server (if needed)
cd quicklook-server
npm run dev

# Open test file in browser
open quicklook-sdk/test-inactivity.html
```

### Test Scenarios

1. **Tab Switching**
   - Open the test page
   - Switch to another tab
   - Check console: should see pause message
   - Return to tab: should see resume message

2. **Inactivity Timeout**
   - Open the test page
   - Don't interact for 30 seconds (test uses 30s instead of 5min)
   - Recording should pause automatically
   - Move mouse: recording should resume

3. **Activity Reset**
   - Wait 20 seconds without activity
   - Move mouse
   - Timer should reset to 30 seconds

4. **Console Monitoring**
   - Open DevTools console
   - Watch for `[quicklook]` messages about pause/resume

## Benefits

### Cost Savings
- **Bandwidth**: No data sent while paused
- **Storage**: Less data stored on server
- **Processing**: Reduced server load

### User Experience
- Seamless pause/resume (no user action required)
- Session continuity maintained (same session ID)
- No impact on active users

### Performance
- Minimal overhead (event listeners use `passive: true`)
- Efficient timer management
- No polling or continuous checks

## Edge Cases Handled

1. **Multiple Tabs**: Each tab has independent activity monitoring
2. **Tab Hidden During Inactivity**: Both triggers work together (no double pause)
3. **Rapid Tab Switching**: Debounced through pause/resume state checks
4. **Page Navigation**: Session continues across same-origin navigations
5. **Manual Stop**: Calling `stop()` also cleans up activity monitoring

## Future Enhancements

Potential improvements for future versions:

1. **Configurable Activity Events**: Let users specify which events count as activity
2. **Progressive Timeout**: Reduce recording quality before full pause
3. **Activity Analytics**: Track pause/resume events in session metadata
4. **Smart Resume**: Resume with a snapshot event to capture current state
5. **Bandwidth Throttling**: Reduce upload frequency during low activity instead of full pause

## API Reference

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `inactivityTimeout` | number | `300000` (5 min) | Milliseconds of inactivity before pause. Set to `0` to disable. |
| `pauseOnHidden` | boolean | `true` | Pause recording when tab is hidden/minimized. |

### Internal Functions (activity.js)

- `setActivityConfig(config)` - Configure activity monitoring
- `setActivityCallbacks(onPause, onResume)` - Set pause/resume callbacks
- `startActivityMonitoring()` - Start monitoring user activity
- `stopActivityMonitoring()` - Stop monitoring and cleanup
- `isPausedByActivity()` - Check if currently paused

## Backward Compatibility

This feature is **fully backward compatible**:

- Default behavior: Enabled with 5-minute timeout
- Existing integrations: Work without changes
- Opt-out: Set `inactivityTimeout: 0` and `pauseOnHidden: false`

## Troubleshooting

### Recording Not Pausing

1. Check configuration: `inactivityTimeout` should be > 0
2. Verify `pauseOnHidden` is `true`
3. Check console for `[quicklook]` messages
4. Ensure activity events are firing (check DevTools Event Listeners)

### Recording Not Resuming

1. Check if tab is visible (`document.hidden === false`)
2. Try triggering activity (mouse move, key press)
3. Check console for errors
4. Verify recording was started initially

### False Positives (Pausing Too Early)

1. Increase `inactivityTimeout` value
2. Check if other scripts are preventing events
3. Verify events are bubbling to document level

## License

Same as Quicklook SDK
