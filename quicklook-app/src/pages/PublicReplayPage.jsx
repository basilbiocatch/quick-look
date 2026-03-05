import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Snackbar,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useParams } from "react-router-dom";
import { getPublicShare } from "../api/quicklookApi";
import { getEventsDurationMs, getPagesFromEvents, getEventMarksFromEvents, getEventMarksWithTypes, urlPageKey } from "../utils/activityList";
import PlayerControls from "../components/PlayerControls";
import ErrorDisplay from "../components/ErrorDisplay";

const INACTIVITY_THRESHOLD_MS = 30 * 1000;

export default function PublicReplayPage() {
  const { shareToken } = useParams();
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [skipInactive, setSkipInactive] = useState(false);
  const [excludedUrls, setExcludedUrls] = useState([]);
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [skippedInactivityMsg, setSkippedInactivityMsg] = useState(null);
  const [eventsRetryKey, setEventsRetryKey] = useState(0);
  const tickStartRef = useRef(null);
  const startPositionRef = useRef(0);
  const skipMessageTimeoutRef = useRef(null);

  useEffect(() => {
    if (!shareToken) return;
    let cancelled = false;
    setShowEndOverlay(false);
    setCurrentTime(0);
    setPlaying(false);
    setExcludedUrls([]);
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getPublicShare(shareToken);
        if (cancelled) return;
        const payload = res.data?.data;
        if (!payload?.session) {
          setError("Share link not found or expired");
          setLoading(false);
          return;
        }
        setSession(payload.session);
        setEvents(payload.events || []);
        setMeta(payload.meta || {});
        const firstMeta = (payload.events || []).find((e) => e.type === 4);
        if (firstMeta?.data?.href) setCurrentUrl(firstMeta.data.href);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || err.message || "Failed to load shared recording");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shareToken, eventsRetryKey]);

  const hasFullSnapshot = events.some((e) => Number(e.type) === 2);
  const playerEvents = events;
  const durationMs = playerEvents.length >= 2
    ? getEventsDurationMs(playerEvents)
    : (session?.duration ?? (session?.closedAt && session?.createdAt ? new Date(session.closedAt) - new Date(session.createdAt) : 0));
  const pages = React.useMemo(() => getPagesFromEvents(playerEvents), [playerEvents]);
  const excludedSet = React.useMemo(() => new Set(excludedUrls), [excludedUrls]);
  const visiblePages = React.useMemo(
    () => pages.filter((p) => !excludedSet.has(urlPageKey(p.url))),
    [pages, excludedSet]
  );
  const eventMarks = React.useMemo(() => getEventMarksFromEvents(playerEvents), [playerEvents]);
  const eventMarksWithTypes = React.useMemo(() => getEventMarksWithTypes(playerEvents), [playerEvents]);
  const currentPageIndex = React.useMemo(() => {
    if (visiblePages.length === 0) return 0;
    let idx = 0;
    for (let i = 0; i < visiblePages.length; i++) {
      if (visiblePages[i].timeMs <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [visiblePages, currentTime]);

  const goToPrevPage = () => {
    if (currentPageIndex > 0) handleSeek(visiblePages[currentPageIndex - 1].timeMs);
  };
  const goToNextPage = () => {
    if (currentPageIndex < visiblePages.length - 1) handleSeek(visiblePages[currentPageIndex + 1].timeMs);
  };

  const handleSeek = (timeMs) => {
    setCurrentTime(timeMs);
    const totalDuration = durationMs || (session?.duration ?? 0);
    if (totalDuration > 0 && timeMs >= totalDuration - 50) {
      setShowEndOverlay(true);
      setPlaying(false);
    } else if (showEndOverlay && timeMs < totalDuration - 100) {
      setShowEndOverlay(false);
    }
    try {
      const wrapper = playerRef?.current;
      if (wrapper?.goto) wrapper.goto(timeMs, false);
    } catch (_) {}
  };

  const handleTogglePlay = () => {
    const wrapper = playerRef?.current;
    if (!wrapper) return;
    try {
      if (playing) {
        if (wrapper.pause) wrapper.pause();
      } else {
        if (wrapper.play) wrapper.play();
      }
      setPlaying((p) => !p);
    } catch (_) {}
  };

  useEffect(() => {
    if (!playing) return;
    tickStartRef.current = Date.now();
    startPositionRef.current = currentTime;
    const tick = () => {
      try {
        const wrapper = playerRef?.current;
        const replayer = wrapper?.getReplayer?.();
        const totalDuration = durationMs || (session?.duration ?? 0) || 1;
        let t = null;
        if (replayer && typeof replayer.getCurrentTime === "function") {
          const ct = replayer.getCurrentTime();
          if (typeof ct === "number" && !Number.isNaN(ct)) t = ct;
        }
        if (t == null && tickStartRef.current != null) {
          const elapsed = Date.now() - tickStartRef.current;
          t = Math.min(startPositionRef.current + elapsed, totalDuration);
        }
        if (t != null) setCurrentTime(t);
        if (t != null && totalDuration > 0 && t >= totalDuration - 50) {
          setShowEndOverlay(true);
          setPlaying(false);
          try { if (wrapper?.pause) wrapper.pause(); } catch (_) {}
        } else if (showEndOverlay && t != null && t < totalDuration - 100) {
          setShowEndOverlay(false);
        }
        if (t != null && skipInactive && eventMarks.length > 0 && wrapper?.goto) {
          const nextMark = eventMarks.find((m) => m > t + 80);
          if (nextMark != null && nextMark - t > INACTIVITY_THRESHOLD_MS) {
            const skippedSeconds = Math.round((nextMark - t) / 1000);
            wrapper.goto(nextMark, true);
            setSkippedInactivityMsg(`Skipped ${skippedSeconds}s of inactivity`);
            if (skipMessageTimeoutRef.current) clearTimeout(skipMessageTimeoutRef.current);
            skipMessageTimeoutRef.current = setTimeout(() => {
              setSkippedInactivityMsg(null);
              skipMessageTimeoutRef.current = null;
            }, 2500);
          }
        }
      } catch (_) {}
    };
    const id = setInterval(tick, 100);
    return () => {
      clearInterval(id);
      if (skipMessageTimeoutRef.current) {
        clearTimeout(skipMessageTimeoutRef.current);
        skipMessageTimeoutRef.current = null;
      }
    };
  }, [playing, skipInactive, eventMarks, durationMs, session?.duration, showEndOverlay]);

  const handleReplay = () => {
    setShowEndOverlay(false);
    setCurrentTime(0);
    handleSeek(0);
    setPlaying(true);
    try {
      const wrapper = playerRef?.current;
      if (wrapper?.goto) wrapper.goto(0, true);
      else if (wrapper?.play) wrapper.play();
    } catch (_) {}
  };

  useEffect(() => {
    if (!playerEvents.length || !hasFullSnapshot || !containerRef.current || !session) return;
    let mounted = true;
    let playerInstance = null;
    const metaEvent = playerEvents.find((e) => e.type === 4);
    const width = metaEvent?.data?.width || meta?.viewport?.width || session.meta?.viewport?.width || 1024;
    const height = metaEvent?.data?.height || meta?.viewport?.height || session.meta?.viewport?.height || 768;
    const eventsWithProperMeta = playerEvents.map((e) => {
      if (e.type === 4 && (!e.data?.width || !e.data?.height)) {
        return { ...e, data: { ...e.data, width, height } };
      }
      return e;
    });
    const w = Math.max(100, Math.min(width, typeof window !== "undefined" ? window.innerWidth - 48 : width));
    const h = Math.max(100, Math.min(height, 600));
    Promise.all([import("rrweb-player"), import("rrweb-player/dist/style.css")])
      .then(([mod]) => {
        if (!mounted || !containerRef.current) return;
        const rrwebPlayer = mod.default;
        if (!rrwebPlayer) return;
        containerRef.current.innerHTML = "";
        playerInstance = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events: eventsWithProperMeta,
            width: w,
            height: h,
            autoPlay: false,
            showController: false,
            skipInactive: false,
            speed: 1,
            maxScale: 0,
            mouseTail: false,
          },
        });
        playerRef.current = playerInstance;
        requestAnimationFrame(() => {
          if (!mounted || !playerInstance) return;
          try {
            if (playerInstance.setSpeed) playerInstance.setSpeed(1);
            if (playerInstance.goto) playerInstance.goto(0, false);
            if (playerInstance.triggerResize) playerInstance.triggerResize();
            setPlaying(true);
            if (playerInstance.play) playerInstance.play();
          } catch (_) {}
        });
      })
      .catch((e) => {
        console.warn("rrweb-player load failed", e);
        if (mounted) setError("Replay player failed to load.");
      });
    return () => {
      mounted = false;
      if (playerInstance && typeof playerInstance.destroy === "function") {
        try { playerInstance.destroy(); } catch (_) {}
      }
      playerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [playerEvents, session]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="background.default">
        <CircularProgress />
      </Box>
    );
  }
  if (error && !session) {
    return (
      <Box p={3} bgcolor="background.default" minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
        <ErrorDisplay message={error} onRetry={() => setEventsRetryKey((k) => k + 1)} fillAndCenter />
      </Box>
    );
  }
  if (!session) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1.5, flexShrink: 0 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.secondary" }}>
          Shared recording
        </Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Paper elevation={0} variant="outlined" sx={{ mx: 1.5, mt: 1, borderRadius: 1, overflow: "hidden" }}>
          <TextField
            fullWidth
            size="small"
            value={visiblePages.length > 0 ? `${currentPageIndex + 1}/${visiblePages.length} ${(visiblePages[currentPageIndex]?.url ?? currentUrl) || "—"}` : (currentUrl || "—")}
            readOnly
            variant="outlined"
            sx={{ "& .MuiOutlinedInput-root": { fontSize: "0.8125rem", py: 0.25, "& fieldset": { border: "none" } } }}
            InputProps={{
              startAdornment: visiblePages.length > 1 && (
                <InputAdornment position="start" sx={{ mr: 0.5 }}>
                  <IconButton size="small" onClick={goToPrevPage} disabled={currentPageIndex === 0} aria-label="Previous page">
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={goToNextPage} disabled={currentPageIndex >= visiblePages.length - 1} aria-label="Next page">
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      const url = visiblePages.length > 0 ? visiblePages[currentPageIndex]?.url : currentUrl;
                      if (url) navigator.clipboard.writeText(url);
                    }}
                    aria-label="Copy URL"
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Paper>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            mx: 1.5,
            mt: 1,
            borderRadius: 1,
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            ref={scrollContainerRef}
            sx={{ width: "100%", height: "100%", overflow: "auto", p: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", minHeight: 300 }}
          >
            <Box ref={containerRef} data-ql-block sx={{ position: "relative", minWidth: 320, minHeight: 300 }} />
            {events.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center", p: 2 }}>
                No events recorded for this session.
              </Typography>
            )}
            {!loading && events.length > 0 && !hasFullSnapshot && (
              <Box sx={{ alignSelf: "center", p: 2, textAlign: "center", maxWidth: 420 }}>
                <Typography variant="body2" color="text.secondary">
                  No full snapshot in this recording; replay not available.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
        {(durationMs > 0 || session.duration != null || session.closedAt) && (
          <PlayerControls
            duration={(durationMs || session.duration) ?? (session.closedAt && session.createdAt ? new Date(session.closedAt) - new Date(session.createdAt) : 0)}
            currentTime={currentTime}
            onCurrentTimeChange={setCurrentTime}
            playing={playing}
            onPlayingChange={setPlaying}
            playerRef={playerRef}
            eventMarks={eventMarks}
            eventMarksWithTypes={eventMarksWithTypes}
            skipInactive={skipInactive}
            onSkipInactiveChange={setSkipInactive}
            onTogglePlay={handleTogglePlay}
          />
        )}
      </Box>
      {showEndOverlay && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <Button
            onClick={handleReplay}
            variant="contained"
            sx={{ borderRadius: 3, px: 3, py: 1.5, fontSize: "1rem", fontWeight: 500, textTransform: "none" }}
          >
            Replay
          </Button>
        </Box>
      )}
      <Snackbar
        open={Boolean(skippedInactivityMsg)}
        message={skippedInactivityMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: 90 }}
        autoHideDuration={2500}
        onClose={() => setSkippedInactivityMsg(null)}
      />
    </Box>
  );
}
