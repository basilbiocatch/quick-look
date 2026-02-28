import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Typography,
  IconButton,
  Paper,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { useParams, useNavigate } from "react-router-dom";
import { getSession, getEvents } from "../api/quicklookApi";
import { getEventsDurationMs, getPagesFromEvents, getEventMarksFromEvents } from "../utils/activityList";
import RightPanel from "../components/RightPanel";
import PlayerControls from "../components/PlayerControls";
import DevToolsPanel, { getConsoleEvents } from "../components/DevToolsPanel";
import CodeIcon from "@mui/icons-material/Code";
import Badge from "@mui/material/Badge";

export default function ReplayPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [skipInactive, setSkipInactive] = useState(true);
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [sRes, eRes] = await Promise.all([
          getSession(sessionId),
          getEvents(sessionId),
        ]);
        if (cancelled) return;
        setSession(sRes.data?.data || null);
        const ev = eRes.data?.events || [];
        setEvents(ev);
        setMeta(eRes.data?.meta || null);
        const firstMeta = ev.find((e) => e.type === 4);
        if (firstMeta?.data?.href) setCurrentUrl(firstMeta.data.href);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const hasFullSnapshot = events.some((e) => Number(e.type) === 2);
  const durationMs = events.length >= 2
    ? getEventsDurationMs(events)
    : (session?.duration ?? (session?.closedAt && session?.createdAt ? new Date(session.closedAt) - new Date(session.createdAt) : 0));
  const pages = React.useMemo(() => getPagesFromEvents(events), [events]);
  const eventMarks = React.useMemo(() => getEventMarksFromEvents(events), [events]);
  const currentPageIndex = React.useMemo(() => {
    if (pages.length === 0) return 0;
    let idx = 0;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].timeMs <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [pages, currentTime]);
  const devToolsBadge = React.useMemo(() => {
    const consoleEv = getConsoleEvents(events, events[0]?.timestamp ?? 0);
    const errors = consoleEv.filter((e) => e.level === "error").length;
    return errors > 0 ? errors : 0;
  }, [events]);
  const goToPrevPage = () => {
    if (currentPageIndex > 0) handleSeek(pages[currentPageIndex - 1].timeMs);
  };
  const goToNextPage = () => {
    if (currentPageIndex < pages.length - 1) handleSeek(pages[currentPageIndex + 1].timeMs);
  };

  const handleSeek = (timeMs) => {
    setCurrentTime(timeMs);
    try {
      const replayer = playerRef?.current?.getReplayer?.();
      if (replayer) replayer.pause(timeMs);
      else if (playerRef?.current?.goto) playerRef.current.goto(timeMs);
    } catch (_) {}
  };

  const handleTogglePlay = () => {
    try {
      const replayer = playerRef?.current?.getReplayer?.();
      if (replayer) {
        if (playing) replayer.pause();
        else replayer.play();
      } else if (playerRef?.current?.toggle) playerRef.current.toggle();
    } catch (_) {}
    setPlaying((p) => !p);
  };

  // Sync current time from replayer while playing; when skipInactive is on, jump to next activity over long inactive gaps
  const INACTIVITY_THRESHOLD_MS = 1500;
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      try {
        const replayer = playerRef?.current?.getReplayer?.();
        const wrapper = playerRef?.current;
        if (!replayer || typeof replayer.getCurrentTime !== "function") return;
        const t = replayer.getCurrentTime();
        if (typeof t !== "number" || Number.isNaN(t)) return;
        setCurrentTime(t);

        if (skipInactive && eventMarks.length > 0) {
          const nextMark = eventMarks.find((m) => m > t + 80);
          if (nextMark != null && nextMark - t > INACTIVITY_THRESHOLD_MS) {
            if (wrapper && typeof wrapper.goto === "function") {
              wrapper.goto(nextMark, true);
            } else {
              replayer.pause(nextMark);
              replayer.play();
            }
          }
        }
      } catch (_) {}
    };
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [playing, skipInactive, eventMarks]);

  useEffect(() => {
    if (!events.length || !hasFullSnapshot || !containerRef.current || !session) return;

    let mounted = true;
    let playerInstance = null;

    Promise.all([
      import("rrweb-player"),
      import("rrweb-player/dist/style.css"),
    ])
      .then(([mod]) => {
        if (!mounted || !containerRef.current) return;
        const rrwebPlayer = mod.default;
        if (!rrwebPlayer) return;
        const width = session.meta?.viewport?.width || 1024;
        const height = session.meta?.viewport?.height || 768;
        playerInstance = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events,
            width: Math.min(width, typeof window !== "undefined" ? window.innerWidth - 360 : width),
            height: Math.min(height, 600),
            autoPlay: false,
            showController: false,
            skipInactive: true,
          },
        });
        playerRef.current = playerInstance;
      })
      .catch((e) => {
        console.warn("rrweb-player load failed", e);
        if (mounted) setError("Replay player failed to load. Check console.");
      });

    return () => {
      mounted = false;
      if (playerInstance && typeof playerInstance.destroy === "function") {
        try {
          playerInstance.destroy();
        } catch (_) {}
      }
      playerRef.current = null;
    };
  }, [events, session]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }
  if (error && !session) {
    return (
      <Box p={3}>
        <Alert severity="error" action={<IconButton onClick={() => navigate("/")}><ArrowBackIcon /></IconButton>}>
          {error}
        </Alert>
      </Box>
    );
  }
  if (!session) {
    return null;
  }

  return (
    <Box sx={{ display: "flex", height: "100vh", bgcolor: "background.default" }}>
      <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, borderRight: "1px solid", borderColor: "divider" }}>
        {/* Top header: Back, title, Play */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.5,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: 1,
          }}
        >
          <IconButton onClick={() => navigate("/")} size="small" aria-label="Back">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: "0.9375rem" }}>
            Session replay
          </Typography>
          <IconButton size="small" onClick={handleTogglePlay} aria-label={playing ? "Pause" : "Play"} color="primary">
            {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Badge badgeContent={devToolsBadge} color="error" size="small">
            <IconButton
              size="small"
              onClick={() => setDevToolsOpen((prev) => !prev)}
              aria-label="DevTools"
              aria-expanded={devToolsOpen}
              color={devToolsOpen ? "primary" : "default"}
            >
              <CodeIcon fontSize="small" />
              <Typography variant="caption" sx={{ ml: 0.5, fontSize: "0.75rem" }}>
                DevTools
              </Typography>
            </IconButton>
          </Badge>
        </Box>
        {/* URL bar with page index (1/2) and prev/next */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            mx: 1.5,
            mt: 1,
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: (theme) => (theme.palette.mode === "dark" ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.08)"),
          }}
        >
          <TextField
            fullWidth
            size="small"
            value={pages.length > 0 ? `${currentPageIndex + 1}/${pages.length} ${(pages[currentPageIndex]?.url ?? currentUrl) || "—"}` : (currentUrl || "—")}
            readOnly
            variant="outlined"
            sx={{
              "& .MuiOutlinedInput-root": {
                fontSize: "0.8125rem",
                py: 0.25,
                "& fieldset": { border: "none" },
              },
            }}
            InputProps={{
              startAdornment: pages.length > 1 && (
                <InputAdornment position="start" sx={{ mr: 0.5 }}>
                  <IconButton size="small" onClick={goToPrevPage} disabled={currentPageIndex === 0} aria-label="Previous page">
                    <ChevronLeftIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={goToNextPage} disabled={currentPageIndex >= pages.length - 1} aria-label="Next page">
                    <ChevronRightIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => {
                      const url = pages.length > 0 ? pages[currentPageIndex]?.url : currentUrl;
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
        {/* Main replay area */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
            mx: 1.5,
            mt: 1,
            mb: 0,
            borderRadius: 1,
            bgcolor: "background.default",
            boxShadow: (theme) => (theme.palette.mode === "dark" ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 6px rgba(0,0,0,0.1)"),
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: "100%",
              overflow: "auto",
              p: 1,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <Box
              ref={containerRef}
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
              }}
            />
            {hasFullSnapshot && (
              <Box
                aria-label="Click to play or pause"
                onClick={handleTogglePlay}
                sx={{ position: "absolute", inset: 0, cursor: "pointer", zIndex: 1 }}
              />
            )}
            {!loading &&
              (events.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center", p: 2 }}>
                  No events recorded for this session.
                </Typography>
              ) : !hasFullSnapshot ? (
                <Box sx={{ alignSelf: "center", p: 2, textAlign: "center", maxWidth: 420 }}>
                  <Typography variant="body2" color="text.secondary">
                    No full snapshot in this recording; replay not available.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    The first chunk (with the page snapshot) was not saved—often because the tab was closed before the first upload (~2–5 s). Start a new session and stay on the page a few seconds so the first chunk is sent.
                  </Typography>
                </Box>
              ) : null)}
          </Box>
          <DevToolsPanel open={devToolsOpen} onClose={() => setDevToolsOpen(false)} events={events} />
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
            skipInactive={skipInactive}
            onSkipInactiveChange={setSkipInactive}
            onTogglePlay={handleTogglePlay}
          />
        )}
      </Box>
      {/* Right panel: full height from top */}
      <RightPanel
        session={session}
        events={events}
        meta={meta}
        onSeek={handleSeek}
        currentTimeMs={currentTime}
      />
    </Box>
  );
}
