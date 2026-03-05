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
  Tooltip,
  Button,
  Switch,
  FormControlLabel,
  Snackbar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import ReplayIcon from "@mui/icons-material/Replay";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import CloseIcon from "@mui/icons-material/Close";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getSession, getEvents, getSessions, getProject, updateProject, getEnsureSummary } from "../api/quicklookApi";
import { getEventsDurationMs, getPagesFromEvents, getEventMarksFromEvents, getEventMarksWithTypes, urlPageKey } from "../utils/activityList";
import RightPanel from "../components/RightPanel";
import PlayerControls from "../components/PlayerControls";
import DevToolsPanel, { getConsoleEvents } from "../components/DevToolsPanel";
import ProFeatureGate from "../components/ProFeatureGate";
import EventsLoader from "../components/EventsLoader";
import ErrorDisplay from "../components/ErrorDisplay";
import CodeIcon from "@mui/icons-material/Code";
import Badge from "@mui/material/Badge";

export default function ReplayPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { user } = useAuth();
  const canAccessDevTools = user?.plan === "pro";
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);
  const [error, setError] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [skipInactive, setSkipInactive] = useState(false);
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(-1);
  const [showEndOverlay, setShowEndOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [autoPlay, setAutoPlay] = useState(false);
  const [excludedUrls, setExcludedUrls] = useState([]);
  const [skippedInactivityMsg, setSkippedInactivityMsg] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summaryUpgradeRequired, setSummaryUpgradeRequired] = useState(false);
  const [relatedSessionsByIp, setRelatedSessionsByIp] = useState([]);
  const [relatedSessionsByDevice, setRelatedSessionsByDevice] = useState([]);
  const [eventsRetryKey, setEventsRetryKey] = useState(0);
  const countdownRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const skipMessageTimeoutRef = useRef(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setShowEndOverlay(false);
    setCountdown(5);
    setCurrentTime(0);
    setPlaying(false);
    setExcludedUrls([]);
    setAiSummary(null);
    setSummaryError("");
    setSummaryUpgradeRequired(false);
    setSummaryLoading(false);
    setRelatedSessionsByIp([]);
    setRelatedSessionsByDevice([]);
    (async () => {
      setLoading(true);
      setError("");
      setEventsError(null);
      setEventsLoading(false);
      try {
        const sRes = await getSession(sessionId);
        if (cancelled) return;
        const sessionData = sRes.data?.data || null;
        setSession(sessionData);
        if (!sessionData) {
          setLoading(false);
          return;
        }

        if (!cancelled) setLoading(false);
        if (!cancelled) setEventsLoading(true);

        const projectKey = sessionData.projectKey;

        try {
          // Load sessions list and events in parallel
          const [eventsRes, sessionsRes] = await Promise.all([
            getEvents(sessionId),
            projectKey
              ? getSessions({ projectKey, limit: 200, skip: 0 })
              : Promise.resolve({ data: { data: [] } }),
          ]);
          if (cancelled) return;

          const data = eventsRes.data;
          const allEvents = data?.events || [];
          const eventMeta = data?.meta || {};

          setEvents(allEvents);
          setMeta(eventMeta);
          setEventsLoading(false);

          const firstMeta = allEvents.find((e) => e.type === 4);
          if (firstMeta?.data?.href) setCurrentUrl(firstMeta.data.href);

          if (projectKey && sessionsRes?.data?.data) {
            const sessions = sessionsRes.data.data;
            setSessionsList(sessions);
            const index = sessions.findIndex((s) => s.sessionId === sessionId);
            setCurrentSessionIndex(index);
          }

          // Related sessions (same IP / same device) in parallel
          const [ipRes, deviceRes] = await Promise.all([
            projectKey && sessionData?.ipAddress
              ? getSessions({ projectKey, ipAddress: sessionData.ipAddress, limit: 50 }).catch(() => null)
              : null,
            projectKey && sessionData?.deviceId
              ? getSessions({ projectKey, deviceId: sessionData.deviceId, limit: 50 }).catch(() => null)
              : null,
          ]);
          if (!cancelled) {
            setRelatedSessionsByIp(ipRes?.data?.data ?? []);
            setRelatedSessionsByDevice(deviceRes?.data?.data ?? []);
          }
        } catch (eventsErr) {
          if (!cancelled) {
            setEventsError(eventsErr.response?.data?.error || eventsErr.message || "Failed to load replay");
            setEvents([]);
            setEventsLoading(false);
          }
        }

        // AI summary: only use if already present; user can generate on demand
        setAiSummary(sessionData?.aiSummary ?? null);
        setSummaryError("");
        setSummaryLoading(false);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, eventsRetryKey]);

  const handleGenerateSummary = () => {
    if (!sessionId || summaryLoading) return;
    setSummaryError("");
    setSummaryUpgradeRequired(false);
    setSummaryLoading(true);
    getEnsureSummary(sessionId)
      .then((sumRes) => {
        setAiSummary(sumRes.data?.aiSummary ?? null);
        setSummaryError("");
        setSummaryUpgradeRequired(false);
      })
      .catch((sumErr) => {
        const data = sumErr.response?.data;
        const isUpgradeRequired = data?.code === "UPGRADE_REQUIRED";
        setSummaryUpgradeRequired(!!isUpgradeRequired);
        setSummaryError(isUpgradeRequired ? (data?.error || "Upgrade required") : (data?.error || sumErr.message || "Summary unavailable"));
        setAiSummary(null);
      })
      .finally(() => setSummaryLoading(false));
  };

  const goToPreviousSession = () => {
    if (currentSessionIndex > 0 && sessionsList[currentSessionIndex - 1]) {
      const prevSession = sessionsList[currentSessionIndex - 1];
      navigate(`/sessions/${prevSession.sessionId}`, { replace: false });
    }
  };

  const goToNextSession = () => {
    if (currentSessionIndex >= 0 && currentSessionIndex < sessionsList.length - 1 && sessionsList[currentSessionIndex + 1]) {
      const nextSession = sessionsList[currentSessionIndex + 1];
      navigate(`/sessions/${nextSession.sessionId}`, { replace: false });
    }
  };

  const hasFullSnapshot = events.some((e) => Number(e.type) === 2);
  // Always use original events so 1x = real-time. When "Skip inactivity" is on, we jump over long gaps in the tick instead of compressing the timeline.
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
  const devToolsBadge = React.useMemo(() => {
    const consoleEv = getConsoleEvents(events, events[0]?.timestamp ?? 0);
    const errors = consoleEv.filter((e) => e.level === "error").length;
    return errors > 0 ? errors : 0;
  }, [events]);
  const goToPrevPage = () => {
    if (currentPageIndex > 0) handleSeek(visiblePages[currentPageIndex - 1].timeMs);
  };
  const goToNextPage = () => {
    if (currentPageIndex < visiblePages.length - 1) handleSeek(visiblePages[currentPageIndex + 1].timeMs);
  };
  const handleExcludeUrl = (url) => {
    const key = urlPageKey(url);
    setExcludedUrls((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };
  const handleUnexcludeUrl = (pageKey) => setExcludedUrls((prev) => prev.filter((u) => u !== pageKey));
  
  const handleSaveExclusions = async () => {
    if (!session?.projectKey || excludedUrls.length === 0) return;
    try {
      const projectRes = await getProject(session.projectKey);
      const project = projectRes.data?.data;
      if (!project) return;
      
      const existingExclusions = project.excludedUrls || [];
      const pathsToAdd = excludedUrls
        .map(urlPageKey => {
          try {
            return new URL(urlPageKey).pathname;
          } catch {
            return urlPageKey;
          }
        })
        .filter(path => !existingExclusions.some(existing => existing.includes(path) || path.includes(existing)));
      
      if (pathsToAdd.length === 0) {
        alert('All excluded pages are already in project exclusions');
        return;
      }
      
      const newExclusions = [...existingExclusions, ...pathsToAdd];
      await updateProject(session.projectKey, { excludedUrls: newExclusions });
      alert(`Added ${pathsToAdd.length} page(s) to project exclusions. Future sessions won't record these pages.`);
    } catch (err) {
      console.error('Failed to save exclusions:', err);
      alert('Failed to save exclusions to project settings');
    }
  };

  const handleSeek = async (timeMs) => {
    setCurrentTime(timeMs);
    const totalDuration = durationMs || (session?.duration ?? 0);
    if (totalDuration > 0 && timeMs >= totalDuration - 50) {
      setShowEndOverlay(true);
      setPlaying(false);
      setCountdown(5);
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

  // Sync current time from replayer while playing
  const INACTIVITY_THRESHOLD_MS = 30 * 1000;
  const tickStartRef = useRef(null);
  const startPositionRef = useRef(0);
  const lastTimeRef = useRef(0);
  useEffect(() => {
    if (!playing) return;
    tickStartRef.current = Date.now();
    startPositionRef.current = currentTime;
    lastTimeRef.current = currentTime;
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
        if (t != null) {
          lastTimeRef.current = t;
          setCurrentTime(t);
        }

        if (t != null && totalDuration > 0 && t >= totalDuration - 50) {
          if (!showEndOverlay) {
            setShowEndOverlay(true);
            setPlaying(false);
            setCountdown(5);
            try {
              if (wrapper?.pause) wrapper.pause();
            } catch (_) {}
          }
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

  // Handle end-of-session countdown
  useEffect(() => {
    if (showEndOverlay && autoPlay && currentSessionIndex >= 0 && currentSessionIndex < sessionsList.length - 1) {
      countdownRef.current = 5;
      setCountdown(5);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      countdownIntervalRef.current = setInterval(() => {
        countdownRef.current -= 1;
        setCountdown(countdownRef.current);
        if (countdownRef.current <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          goToNextSession();
        }
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [showEndOverlay, autoPlay, currentSessionIndex, sessionsList.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!showEndOverlay) return;
      
      if (e.code === "Space" && !e.target.matches("input, textarea")) {
        e.preventDefault();
        handleReplay();
      } else if (e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        handleNextSession();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showEndOverlay]);

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

  const handleNextSession = () => {
    setShowEndOverlay(false);
    if (currentSessionIndex >= 0 && currentSessionIndex < sessionsList.length - 1) {
      goToNextSession();
    }
  };

  // Player effect: mount with initial events, then use addEvent for incremental updates
  useEffect(() => {
    if (!playerEvents.length || !hasFullSnapshot || !containerRef.current || !session) return;

    let mounted = true;
    let playerInstance = null;
    let lastEventCount = 0;

    Promise.all([
      import("rrweb-player"),
      import("rrweb-player/dist/style.css"),
    ])
      .then(([mod]) => {
        if (!mounted || !containerRef.current) return;
        const rrwebPlayer = mod.default;
        if (!rrwebPlayer) return;
        
        // Clear any existing content in the container
        containerRef.current.innerHTML = '';
        
        // Get viewport dimensions from meta event in the events array
        const metaEvent = playerEvents.find((e) => e.type === 4);
        const width = metaEvent?.data?.width || meta?.viewport?.width || session.meta?.viewport?.width || 1024;
        const height = metaEvent?.data?.height || meta?.viewport?.height || session.meta?.viewport?.height || 768;
        
        // Ensure Meta event has proper dimensions by creating a patched events array
        const eventsWithProperMeta = playerEvents.map((e) => {
          if (e.type === 4 && (!e.data?.width || !e.data?.height)) {
            return {
              ...e,
              data: {
                ...e.data,
                width: width,
                height: height,
              },
            };
          }
          return e;
        });
        
        const w = Math.max(100, Math.min(width, typeof window !== "undefined" ? window.innerWidth - 360 : width));
        const h = Math.max(100, Math.min(height, 600));
        
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
        lastEventCount = eventsWithProperMeta.length;
        
        // Force first frame to render and layout (Svelte mounts async; goto(0) paints the initial snapshot)
        requestAnimationFrame(() => {
          if (!mounted || !playerInstance) return;
          try {
            if (playerInstance.setSpeed) {
              playerInstance.setSpeed(1);
            }
            
            if (playerInstance.goto) playerInstance.goto(0, false);
            if (playerInstance.triggerResize) playerInstance.triggerResize();
            // Auto-play when entering a session
            setPlaying(true);
            if (playerInstance.play) playerInstance.play();
          } catch (_) {}
        });
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
      // Also clear the container on cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [playerEvents, session]);

  // Prevent scroll jumping when user manually scrolls to bottom
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let isUserScrolling = false;
    let scrollTimeout = null;
    let lastScrollHeight = scrollContainer.scrollHeight;
    let wasAtBottom = false;

    const handleScroll = () => {
      isUserScrolling = true;
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      
      // Check if user is at or near bottom (within 5px threshold)
      wasAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
      lastScrollHeight = scrollHeight;
      
      // Clear any pending timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Reset user scrolling flag after scroll ends
      scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
      }, 200);
    };

    const handleResize = () => {
      // If user was at bottom and content height changed, maintain bottom position
      if (wasAtBottom && scrollContainer.scrollHeight !== lastScrollHeight) {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        });
      }
      lastScrollHeight = scrollContainer.scrollHeight;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    
    // Use ResizeObserver to detect content size changes (more efficient than MutationObserver)
    const resizeObserver = new ResizeObserver(() => {
      if (wasAtBottom && isUserScrolling) {
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        });
      }
      lastScrollHeight = scrollContainer.scrollHeight;
    });
    
    resizeObserver.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, []);

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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "background.default" }}>
      {/* Top header: Logo, Back, Session Navigation - spans full width */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: isMobile ? 1.5 : 2,
          py: isMobile ? 1 : 1.5,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Back Button */}
        <Button
          onClick={() => navigate("/")}
          startIcon={<ArrowBackIcon />}
          sx={{
            textTransform: "none",
            color: "primary.main",
            bgcolor: "rgba(0, 0, 0, 0.04)",
            borderRadius: 2,
            px: 1.5,
            py: 0.75,
            "&:hover": {
              bgcolor: "rgba(0, 0, 0, 0.08)",
            },
          }}
        >
          Back
        </Button>

        {/* Session Navigation */}
        {sessionsList.length > 1 && currentSessionIndex >= 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              ml: 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              bgcolor: "rgba(0, 0, 0, 0.04)",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <IconButton
              size="small"
              onClick={goToPreviousSession}
              disabled={currentSessionIndex === 0}
              aria-label="Previous session"
              sx={{
                color: "text.secondary",
                "&:disabled": {
                  opacity: 0.3,
                },
                "&:hover:not(:disabled)": {
                  bgcolor: "rgba(0, 0, 0, 0.08)",
                },
              }}
            >
              <NavigateBeforeIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2" sx={{ fontSize: "0.875rem", color: "primary.main", fontWeight: 500, minWidth: 80, textAlign: "center" }}>
              {currentSessionIndex + 1} / {sessionsList.length.toLocaleString()} sessions
            </Typography>
            <IconButton
              size="small"
              onClick={goToNextSession}
              disabled={currentSessionIndex >= sessionsList.length - 1}
              aria-label="Next session"
              sx={{
                color: "primary.main",
                "&:disabled": {
                  opacity: 0.3,
                },
                "&:hover:not(:disabled)": {
                  bgcolor: "rgba(0, 0, 0, 0.08)",
                },
              }}
            >
              <NavigateNextIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
        
        <Box sx={{ flex: 1 }} />
        
        <Box
          component="button"
          onClick={() => setDevToolsOpen((prev) => !prev)}
          aria-label="DevTools"
          aria-expanded={devToolsOpen}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            border: "none",
            cursor: "pointer",
            bgcolor: devToolsOpen 
              ? "rgba(190,149,250,0.15)" 
              : "rgba(0, 0, 0, 0.04)",
            color: devToolsOpen ? "primary.main" : "text.secondary",
            transition: "all 0.2s ease",
            position: "relative",
            "&:hover": {
              bgcolor: devToolsOpen 
                ? "rgba(190,149,250,0.25)" 
                : "rgba(0, 0, 0, 0.08)",
              color: "primary.main",
            },
          }}
        >
          <CodeIcon fontSize="small" />
          <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
            DevTools
          </Typography>
          {devToolsBadge > 0 && canAccessDevTools && (
            <Box
              sx={{
                minWidth: 18,
                height: 18,
                borderRadius: "9px",
                bgcolor: "error.main",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.625rem",
                fontWeight: 600,
                px: 0.5,
              }}
            >
              {devToolsBadge}
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Main content area: row on desktop, column on mobile (player then panels) */}
      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
            ...(isMobile && { flex: "0 0 auto", minHeight: 200, maxHeight: "42vh" }),
          }}
        >
          {/* URL bar with page index (1/2) and prev/next */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            mx: isMobile ? 1 : 1.5,
            mt: 1,
            borderRadius: 1,
            overflow: "hidden",
            boxShadow: (theme) => (theme.palette.mode === "dark" ? "0 1px 3px rgba(0,0,0,0.3)" : "0 1px 2px rgba(0,0,0,0.08)"),
          }}
        >
          <TextField
            fullWidth
            size="small"
            value={visiblePages.length > 0 ? `${currentPageIndex + 1}/${visiblePages.length} ${(visiblePages[currentPageIndex]?.url ?? currentUrl) || "—"}` : (currentUrl || "—")}
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
        {/* Main replay area */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
            mx: isMobile ? 1 : 1.5,
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
            ref={scrollContainerRef}
            sx={{
              width: "100%",
              height: "100%",
              overflow: "auto",
              p: 1,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              position: "relative",
              overscrollBehavior: "contain",
              overscrollBehaviorY: "contain",
              minHeight: 300,
            }}
          >
            <Box
              ref={containerRef}
              data-ql-block
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                minWidth: 320,
                minHeight: 300,
              }}
            />
            {eventsLoading && (
              <EventsLoader />
            )}
            {!eventsLoading && eventsError && (
              <ErrorDisplay
                message={eventsError}
                onRetry={() => setEventsRetryKey((k) => k + 1)}
                fillAndCenter
              />
            )}
            {!loading &&
              !eventsLoading &&
              !eventsError &&
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
          {devToolsOpen && (canAccessDevTools ? (
            <DevToolsPanel open={devToolsOpen} onClose={() => setDevToolsOpen(false)} events={events} />
          ) : (
            <Box sx={{ position: "absolute", bottom: 0, left: 0, right: 0, top: 0, overflow: "auto", p: 2, bgcolor: "background.paper", zIndex: 10 }}>
              <ProFeatureGate
                title="DevTools"
                description="Console logs, network requests, and user context synced with replay. Upgrade to Pro to unlock."
                compact
              />
            </Box>
          ))}
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
      {/* End of Session Overlay */}
      {showEndOverlay && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            gap: 3,
          }}
        >
          <Tooltip title="Close">
            <IconButton
              onClick={() => setShowEndOverlay(false)}
              aria-label="Close"
              sx={{
                position: "absolute",
                top: 16,
                right: 16,
                bgcolor: "background.paper",
                color: "text.primary",
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
          {/* Action Buttons */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {/* Replay Button */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <Button
                onClick={handleReplay}
                startIcon={<ReplayIcon />}
                sx={{
                  bgcolor: "background.paper",
                  color: "text.primary",
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  fontSize: "1rem",
                  fontWeight: 500,
                  textTransform: "none",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  "&:hover": {
                    bgcolor: "action.hover",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)",
                  },
                }}
              >
                Replay
              </Button>
              <Box
                sx={{
                  bgcolor: "rgba(0, 0, 0, 0.6)",
                  color: "white",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: "0.75rem",
                  fontWeight: 500,
                }}
              >
                Space
              </Box>
            </Box>

            {/* Next Session Button */}
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
              <Button
                onClick={handleNextSession}
                disabled={currentSessionIndex >= sessionsList.length - 1}
                startIcon={<SkipNextIcon />}
                sx={{
                  bgcolor: "background.paper",
                  color: "text.primary",
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  fontSize: "1rem",
                  fontWeight: 500,
                  textTransform: "none",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  position: "relative",
                  overflow: "visible",
                  "&:hover:not(:disabled)": {
                    bgcolor: "action.hover",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)",
                  },
                  "&:disabled": {
                    opacity: 0.5,
                  },
                }}
              >
                Next session
                {autoPlay && currentSessionIndex < sessionsList.length - 1 && countdown > 0 && (
                  <Box
                    sx={{
                      ml: 1,
                      bgcolor: "primary.main",
                      color: "white",
                      px: 1.5,
                      py: 0.25,
                      borderRadius: "0 12px 12px 0",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      minWidth: 24,
                      textAlign: "center",
                    }}
                  >
                    {countdown}
                  </Box>
                )}
              </Button>
              <Box
                sx={{
                  bgcolor: "rgba(0, 0, 0, 0.6)",
                  color: "white",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: "0.75rem",
                  fontWeight: 500,
                }}
              >
                Shift + →
              </Box>
            </Box>
          </Box>

          {/* AutoPlay Toggle */}
          <Paper
            elevation={0}
            sx={{
              bgcolor: "background.paper",
              borderRadius: 3,
              px: 2.5,
              py: 1.5,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <SkipNextIcon sx={{ color: "text.secondary", fontSize: 20 }} />
            <Typography variant="body2" sx={{ fontSize: "0.875rem", fontWeight: 500 }}>
              AutoPlay
            </Typography>
            <Switch
              checked={autoPlay}
              onChange={(e) => {
                setAutoPlay(e.target.checked);
                if (e.target.checked) {
                  setCountdown(5);
                }
              }}
              color="primary"
            />
          </Paper>
        </Box>
      )}
        {/* Right panel: side-by-side on desktop, full-width below player on mobile */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
            ...(isMobile && { flex: 1 }),
          }}
        >
          <RightPanel
            session={session}
            events={events}
            meta={meta}
            onSeek={handleSeek}
            currentTimeMs={currentTime}
            excludedUrls={excludedUrls}
            onExcludeUrl={handleExcludeUrl}
            onUnexcludeUrl={handleUnexcludeUrl}
            onSaveExclusions={handleSaveExclusions}
            aiSummary={aiSummary}
            summaryLoading={summaryLoading}
            summaryError={summaryError}
            summaryUpgradeRequired={summaryUpgradeRequired}
            onGenerateSummary={handleGenerateSummary}
            relatedSessionsByIp={relatedSessionsByIp}
            relatedSessionsByDevice={relatedSessionsByDevice}
            isMobile={isMobile}
          />
        </Box>
      </Box>
      {/* Brief message when "Skip inactivity" jumps over a long gap */}
      <Snackbar
        open={Boolean(skippedInactivityMsg)}
        message={skippedInactivityMsg}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 80, sm: 90 } }}
        autoHideDuration={2500}
        onClose={() => setSkippedInactivityMsg(null)}
      />
    </Box>
  );
}
