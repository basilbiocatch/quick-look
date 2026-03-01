# Inactivity Detection Flow Diagram

## State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    INITIAL STATE                                │
│                                                                 │
│                    Recording NOT Started                        │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ quicklook("init", ...)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    RECORDING ACTIVE                             │
│                                                                 │
│  • rrweb recording DOM/events                                   │
│  • Network/console collectors active                            │
│  • Upload scheduler running (5s interval)                       │
│  • Inactivity timer running (5min default)                      │
│  • Visibility listener active                                   │
│                                                                 │
└─────┬───────────────────────────────────────────────────┬───────┘
      │                                                   │
      │ Tab Hidden OR                                     │ User Activity
      │ Inactivity Timeout                                │ (mouse/key/scroll)
      │                                                   │
      ▼                                                   │ Resets Timer
┌─────────────────────────────────────────────────────┐  │
│                                                     │  │
│              RECORDING PAUSED                       │  │
│                                                     │  │
│  • rrweb recording STOPPED                          │  │
│  • Network/console collectors still patched        │  │
│  • Upload scheduler STOPPED                         │  │
│  • Data flushed to server                           │  │
│  • Inactivity timer STOPPED                         │  │
│  • Waiting for resume trigger                       │  │
│                                                     │  │
└─────┬───────────────────────────────────────────────┘  │
      │                                                   │
      │ Tab Visible AND                                   │
      │ User Activity                                     │
      │                                                   │
      ▼                                                   │
┌─────────────────────────────────────────────────────┐  │
│                                                     │  │
│              RECORDING RESUMED                      │  │
│                                                     │  │
│  • rrweb recording RESTARTED                        │  │
│  • Upload scheduler RESTARTED                       │  │
│  • Inactivity timer RESET                           │  │
│                                                     │  │
└─────┬───────────────────────────────────────────────┘  │
      │                                                   │
      │                                                   │
      └───────────────────────────────────────────────────┘
                         │
                         │ quicklook("stop")
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    RECORDING STOPPED                            │
│                                                                 │
│  • All recording stopped                                        │
│  • Activity monitoring removed                                  │
│  • Data flushed                                                 │
│  • Session ended                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Event Flow

### Pause Sequence

```
User switches tab OR 5 minutes of inactivity
                │
                ▼
┌───────────────────────────────────┐
│  document.visibilitychange event  │
│  OR inactivity timer expires      │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  activity.js detects trigger      │
│  isPaused = false → true          │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Call pauseCallback()             │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  init.js callback executes:       │
│  1. stopRecording()               │
│  2. flushAndEnd()                 │
│  3. stopScheduler()               │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Recording paused                 │
│  No more data collected           │
└───────────────────────────────────┘
```

### Resume Sequence

```
User returns to tab AND moves mouse
                │
                ▼
┌───────────────────────────────────┐
│  document.visibilitychange event  │
│  AND mousedown/keydown/scroll     │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  activity.js detects activity     │
│  isPaused = true → false          │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Call resumeCallback()            │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  init.js callback executes:       │
│  1. startRecording()              │
│  2. startScheduler()              │
│  3. Reset inactivity timer        │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Recording resumed                │
│  Data collection continues        │
└───────────────────────────────────┘
```

## Timeline Example

```
Time    Event                           State           Action
────────────────────────────────────────────────────────────────────
0:00    User loads page                 INIT            -
0:01    quicklook("init") called        ACTIVE          Start recording
0:05    User typing                     ACTIVE          Timer reset
0:10    User scrolling                  ACTIVE          Timer reset
0:15    User switches to email tab      PAUSED          Stop recording
0:20    (User reading email)            PAUSED          No recording
0:25    User returns to page            PAUSED          Waiting for activity
0:26    User moves mouse                ACTIVE          Resume recording
0:31    User reading (no activity)      ACTIVE          Timer counting
1:31    No activity for 1 minute        ACTIVE          Timer counting
5:31    No activity for 5 minutes       PAUSED          Stop recording
5:35    User moves mouse                ACTIVE          Resume recording
6:00    quicklook("stop") called        STOPPED         End session
```

## Component Interaction

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser Events                           │
│                                                                  │
│  visibilitychange  mousedown  keydown  scroll  touchstart       │
└────────┬──────────────┬──────────┬──────────┬──────────┬────────┘
         │              │          │          │          │
         │              └──────────┴──────────┴──────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐      ┌──────────────────┐
│  Visibility     │      │  Activity Events │
│  Handler        │      │  Handler         │
└────────┬────────┘      └────────┬─────────┘
         │                        │
         └────────────┬───────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │    activity.js         │
         │                        │
         │  • isPaused state      │
         │  • inactivityTimer     │
         │  • pauseRecording()    │
         │  • resumeRecording()   │
         └────────┬───────────────┘
                  │
                  │ Callbacks
                  │
                  ▼
         ┌────────────────────────┐
         │      init.js           │
         │                        │
         │  pauseCallback:        │
         │    stopRecording()     │
         │    flushAndEnd()       │
         │    stopScheduler()     │
         │                        │
         │  resumeCallback:       │
         │    startRecording()    │
         │    startScheduler()    │
         └────────┬───────────────┘
                  │
         ┌────────┴───────────────┐
         │                        │
         ▼                        ▼
┌─────────────────┐      ┌─────────────────┐
│   record.js     │      │   upload.js     │
│                 │      │                 │
│  • rrweb        │      │  • Event buffer │
│  • DOM capture  │      │  • Compression  │
│  • Event emit   │      │  • API upload   │
└─────────────────┘      └─────────────────┘
```

## Configuration Impact

```
┌─────────────────────────────────────────────────────────────┐
│  Configuration: inactivityTimeout                           │
└─────────────────────────────────────────────────────────────┘

Value: 300000 (5 minutes - default)
Effect: Pause after 5 minutes of no activity
Use Case: Standard web apps, documentation sites

Value: 60000 (1 minute)
Effect: Pause after 1 minute of no activity
Use Case: High-traffic sites, cost optimization

Value: 0 (disabled)
Effect: Never pause due to inactivity
Use Case: Critical monitoring, always-record scenarios

┌─────────────────────────────────────────────────────────────┐
│  Configuration: pauseOnHidden                               │
└─────────────────────────────────────────────────────────────┘

Value: true (default)
Effect: Pause when tab is hidden/minimized
Use Case: Most applications (recommended)

Value: false
Effect: Continue recording even when tab is hidden
Use Case: Background monitoring, testing scenarios
```
