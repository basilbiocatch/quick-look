# GCS Timeout and Performance Fixes

## Problem
Experiencing `ECONNRESET`, `socket hang up`, and timeout errors when uploading/downloading chunks to/from Google Cloud Storage, especially for long sessions with many chunks (100+).

## Root Causes

### 1. **Insufficient Timeouts**
- Default GCS client timeout too short for large chunks or slow network conditions
- Operations timing out at 120s when they need more time

### 2. **Expensive Repeated Operations**
- `saveChunk` was calling `countChunks()` on every chunk upload
- For GCS, this means listing all files with prefix (e.g., 180+ files for long sessions)
- This list operation was timing out repeatedly

## Solutions Implemented

### 1. Increased GCS Timeouts (`quicklook-server/src/storage/gcsAdapter.js`)

**Storage Client Configuration:**
```javascript
timeout: 300000, // 5 minutes (was 120s)
retryOptions: {
  autoRetry: true,
  retryDelayMultiplier: 2,
  totalTimeout: 600000, // 10 minutes total retry window (was 3 min)
  maxRetryDelay: 64000,
  maxRetries: 6, // (was 5)
  idempotencyStrategy: 1, // Always retry
}
```

**Upload Operations:**
- Timeout: 300s (5 minutes)
- Resumable uploads for chunks >2MB (was >5MB)
- More reliable for large chunks and network interruptions

**Download Operations:**
- Timeout: 180s (3 minutes) per chunk download
- Handles parallel downloads of many chunks

### 2. Optimized Chunk Counting (`quicklook-server/src/services/quicklookService.js`)

**Before:**
```javascript
sessionDoc.chunkCount = await chunkStorage.countChunks(sessionId);
// Lists all files on every chunk upload - O(n) GCS API call
```

**After:**
```javascript
// Increment chunk count based on index instead of listing files
const indexBasedCount = (index ?? 0) + 1;
if (indexBasedCount > (sessionDoc.chunkCount || 0)) {
  sessionDoc.chunkCount = indexBasedCount;
}
// O(1) operation, no GCS API call
```

## Benefits

1. **Eliminates timeout errors** - Operations have sufficient time to complete
2. **Handles network variability** - Automatic retries with exponential backoff
3. **Scales with session length** - No performance degradation for long sessions
4. **Reduces GCS API costs** - Eliminates repeated list operations
5. **Improves reliability** - Resumable uploads handle interruptions gracefully

## Testing Recommendations

1. Monitor logs for `GCS upload` and `GCS download` messages
2. Check that long sessions (100+ chunks) upload without timeouts
3. Verify `getEvents` API calls complete successfully
4. Monitor GCS API usage in Google Cloud Console

## Rollback

If issues occur, revert these files:
- `quicklook-server/src/storage/gcsAdapter.js`
- `quicklook-server/src/services/quicklookService.js`

The changes are backward compatible and don't affect MongoDB storage.
