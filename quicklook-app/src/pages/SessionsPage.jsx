import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Chip,
  Menu,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { FixedSizeList } from "react-window";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import PlayCircleFilledIcon from "@mui/icons-material/PlayCircleFilled";
import FlagIcon from "@mui/icons-material/Flag";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TabIcon from "@mui/icons-material/Tab";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LinkIcon from "@mui/icons-material/Link";
import PlaceIcon from "@mui/icons-material/Place";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SortIcon from "@mui/icons-material/Sort";
import VideocamIcon from "@mui/icons-material/Videocam";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { getSessions, getProject } from "../api/quicklookApi";
import { generateAndSaveProjectThumbnail } from "../utils/projectThumbnail";
import { useProjects } from "../contexts/ProjectsContext";
import {
  formatDuration,
  parseDevice,
  parseOS,
  parseBrowser,
  getCountryFlagEmoji,
} from "../utils/sessionParser";
import { format } from "date-fns";
import SessionSidebar from "../components/SessionSidebar";

/** Text operators for string fields */
const TEXT_OPERATORS = [
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "doesNotContain", label: "does not contain" },
];

/** Numeric operators for duration / page count */
const NUMERIC_OPERATORS = [
  { value: "atLeast", label: "at least" },
  { value: "atMost", label: "at most" },
  { value: "equals", label: "equals" },
];

/** Filter fields by category. valueType: 'text' | 'number'. getValue(session) returns value(s) to match. */
const FILTER_FIELDS = [
  {
    category: "Sessions",
    fields: [
      { key: "visitedUrl", label: "Visited URL", valueType: "text", icon: LinkIcon },
      { key: "landingUrl", label: "Landing URL", valueType: "text", icon: LinkIcon },
      { key: "exitUrl", label: "Exit URL", valueType: "text", icon: LinkIcon },
      { key: "duration", label: "Duration", valueType: "number", icon: ScheduleIcon },
      { key: "pageCount", label: "Number of pages", valueType: "number", icon: TabIcon },
    ],
  },
  {
    category: "Location",
    fields: [
      { key: "country", label: "Country", valueType: "text", icon: PlaceIcon },
      { key: "city", label: "City", valueType: "text", icon: PlaceIcon },
      { key: "region", label: "State/region", valueType: "text", icon: PlaceIcon },
      { key: "ipAddress", label: "IP", valueType: "text", icon: PlaceIcon },
    ],
  },
  {
    category: "User",
    fields: [
      { key: "userEmail", label: "User email", valueType: "text", icon: PersonOutlineIcon },
      { key: "userName", label: "User name", valueType: "text", icon: PersonOutlineIcon },
    ],
  },
  {
    category: "Technology",
    fields: [
      { key: "browser", label: "Browser", valueType: "text", icon: DesktopWindowsIcon },
      { key: "device", label: "Device", valueType: "text", icon: DesktopWindowsIcon },
    ],
  },
];

function getSessionValueForFilter(session, fieldKey) {
  const m = session.meta || {};
  const loc = m.location;
  switch (fieldKey) {
    case "visitedUrl":
      return Array.isArray(session.pages) ? session.pages : [];
    case "landingUrl":
      return Array.isArray(session.pages) && session.pages.length > 0 ? [session.pages[0]] : [];
    case "exitUrl":
      return Array.isArray(session.pages) && session.pages.length > 0 ? [session.pages[session.pages.length - 1]] : [];
    case "duration":
      return session.duration != null ? session.duration : 0;
    case "pageCount":
      return session.pageCount != null ? session.pageCount : 0;
    case "country":
      return m.countryCode || (typeof loc === "object" && loc?.countryCode) || "";
    case "city":
      return m.city || (typeof loc === "object" && loc?.city) || "";
    case "region":
      return (typeof loc === "object" && loc?.regionName) || "";
    case "ipAddress":
      return session.ipAddress || "";
    case "userEmail":
      return session.user?.email || "";
    case "userName":
      return [session.user?.firstName, session.user?.lastName].filter(Boolean).join(" ") || "";
    case "browser":
      return parseBrowser(m.userAgent) || "";
    case "device":
      return parseDevice(m.userAgent) || "";
    default:
      return "";
  }
}

function sessionMatchesFilter(session, filter) {
  let { type: fieldKey, operator, value } = filter;
  if (value == null || (typeof value === "string" && !value.trim())) return true;
  if (!operator && (fieldKey === "durationMin" || fieldKey === "durationMax" || fieldKey === "pagesMin")) {
    if (fieldKey === "durationMin") {
      fieldKey = "duration";
      operator = "atLeast";
      value = typeof value === "number" ? value / 1000 : value;
    } else if (fieldKey === "durationMax") {
      fieldKey = "duration";
      operator = "atMost";
      value = typeof value === "number" ? value / 1000 : value;
    } else {
      fieldKey = "pageCount";
      operator = "atLeast";
    }
  }

  const raw = getSessionValueForFilter(session, fieldKey);
  const strVal = String(value).toLowerCase().trim();

  if (fieldKey === "duration" || fieldKey === "pageCount") {
    const num = typeof raw === "number" ? raw : Number(raw);
    const filterNum = fieldKey === "duration" ? Number(value) * 1000 : Number(value);
    if (Number.isNaN(filterNum)) return true;
    switch (operator) {
      case "atLeast":
        return num >= filterNum;
      case "atMost":
        return num <= filterNum;
      case "equals":
        return fieldKey === "duration" ? Math.abs(num - filterNum) < 1000 : num === filterNum;
      default:
        return true;
    }
  }

  const isArray = Array.isArray(raw);
  const strings = isArray ? raw.map((x) => String(x).toLowerCase()) : [String(raw).toLowerCase()];
  const anyMatches = (pred) => (isArray ? strings.some(pred) : pred(strings[0]));
  switch (operator) {
    case "is":
      return anyMatches((s) => s === strVal);
    case "isNot":
      return !anyMatches((s) => s === strVal);
    case "contains":
      return anyMatches((s) => s.includes(strVal));
    case "doesNotContain":
      return !anyMatches((s) => s.includes(strVal));
    default:
      return true;
  }
}

function getFilterChipLabel(f) {
  if (f.type === "durationMin") return `Duration ≥ ${(f.value / 1000) || 0}s`;
  if (f.type === "durationMax") return `Duration ≤ ${(f.value / 1000) || 0}s`;
  if (f.type === "pagesMin") return `Pages ≥ ${f.value}`;
  if (f.label && !f.operator) return `${f.label} ${f.value}`;
  const opLabel =
    NUMERIC_OPERATORS.find((o) => o.value === f.operator)?.label ||
    TEXT_OPERATORS.find((o) => o.value === f.operator)?.label ||
    f.operator;
  const field = FILTER_FIELDS.flatMap((c) => c.fields).find((x) => x.key === f.type);
  const name = field?.label || f.type;
  const val =
    f.type === "duration" && typeof f.value === "number"
      ? `${f.value / 1000}s`
      : f.type === "duration"
        ? `${String(f.value)}s`
        : String(f.value);
  return `${name} ${opLabel} ${val}`;
}

function locationDisplay(session) {
  const loc = session.meta?.location || session.meta?.countryCode;
  const countryCode = typeof loc === "string" ? loc : loc?.countryCode;
  const city = typeof loc === "object" && loc?.city ? loc.city : null;
  const flag = countryCode ? getCountryFlagEmoji(countryCode) : null;
  if (flag || city) return { flag, text: city || countryCode || "—" };
  return { flag: null, text: "—" };
}

const DAYS_OPTIONS = [
  { label: "Last 7 days", value: 7 },
  { label: "Last 14 days", value: 14 },
  { label: "Last 30 days", value: 30 },
  { label: "Last 90 days", value: 90 },
];

const COLUMN_KEYS = [
  "user",
  "play",
  "date",
  "events",
  "duration",
  "pages",
  "device",
  "location",
  "ip",
];

const DEFAULT_VISIBLE_COLUMNS = {
  user: true,
  play: true,
  date: true,
  events: true,
  duration: true,
  pages: true,
  device: true,
  location: true,
  ip: false,
};

const ROW_HEIGHT = 60;
const COLUMN_WIDTHS = { user: 160, play: 52, date: 160, events: 64, duration: 72, pages: 56, device: 120, location: 110, ip: 120 };

/** Page size for sessions list; server allows up to 200 per request. */
const SESSIONS_PAGE_SIZE = 100;
const COLUMN_GAP = 2; // mr in theme spacing units, applied consistently

const SAVED_VIEWS_STORAGE_KEY = (projectKey) => `quicklook_saved_views_${projectKey || ""}`;

function getSavedViewsFromStorage(projectKey) {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_STORAGE_KEY(projectKey));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

function saveSavedViewsToStorage(projectKey, views) {
  try {
    localStorage.setItem(SAVED_VIEWS_STORAGE_KEY(projectKey), JSON.stringify(views));
  } catch (_) {}
}

const SessionRow = React.memo(function SessionRow({
  session,
  style: rowStyle,
  visibleColumns,
  sessionsForUser,
  isOpened,
  isTransitioning,
  onRowClick,
  status,
}) {
  const [localTime, setLocalTime] = useState(() => Date.now());
  const isLive = session.status === "active";

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setLocalTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const device = useMemo(() => parseDevice(session.meta?.userAgent), [session.meta?.userAgent]);
  const browser = useMemo(() => parseBrowser(session.meta?.userAgent), [session.meta?.userAgent]);
  const loc = useMemo(() => locationDisplay(session), [session]);
  const identityLabel = useMemo(() => {
    const u = session.user;
    if (!u?.email) return null;
    return u.email;
  }, [session.user]);

  const durationDisplay = isLive && session.createdAt
    ? formatDuration(localTime - new Date(session.createdAt).getTime())
    : formatDuration(session.duration);

  return (
    <div style={rowStyle}>
      <ListItemButton
        onClick={() => onRowClick(session)}
        sx={{
          minHeight: ROW_HEIGHT - 1,
          height: ROW_HEIGHT - 1,
          py: 0,
          px: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          background: isOpened
            ? "linear-gradient(90deg, rgba(190,149,250,0.18) 0%, rgba(190,149,250,0.08) 50%, rgba(147,112,219,0.06) 100%)"
            : (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"),
          boxShadow: isOpened ? "inset 0 0 0 1px rgba(190,149,250,0.2)" : "none",
          transition: "background 0.25s ease, box-shadow 0.25s ease, opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: isTransitioning ? 0 : 1,
          transform: isTransitioning ? "translateX(20px) scale(0.98)" : "translateX(0) scale(1)",
          "&:hover": {
            bgcolor: "action.selected",
            transform: isTransitioning ? "translateX(20px) scale(0.98)" : "translateX(2px) scale(1)",
          },
          display: "flex",
          alignItems: "center",
        }}
      >
        {visibleColumns.user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: COLUMN_WIDTHS.user, minWidth: COLUMN_WIDTHS.user, maxWidth: COLUMN_WIDTHS.user, flexShrink: 0, mr: COLUMN_GAP, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <PersonOutlineIcon sx={{ fontSize: 18, color: "text.secondary", flexShrink: 0 }} />
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
              <VideocamIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2" component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                {sessionsForUser}
              </Typography>
            </Box>
            {isLive && status === "" && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  flexShrink: 0,
                  "@keyframes pulse": {
                    "0%": { opacity: 1, transform: "scale(1)" },
                    "50%": { opacity: 0.5, transform: "scale(1.1)" },
                    "100%": { opacity: 1, transform: "scale(1)" },
                  },
                  animation: "pulse 2s ease-in-out infinite",
                }}
              >
                <FiberManualRecordIcon sx={{ fontSize: 10, color: "#ef4444", filter: "drop-shadow(0 0 4px rgba(239, 68, 68, 0.6))" }} />
                <Typography variant="caption" sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "#ef4444", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  Live
                </Typography>
              </Box>
            )}
            <Typography variant="body2" noWrap sx={{ fontSize: "0.875rem", minWidth: 0, flex: "1 1 auto", ...(!identityLabel && { color: "text.secondary" }) }} title={identityLabel || session.sessionId}>
              {identityLabel ?? (session.sessionId ? `${session.sessionId.slice(0, 12)}${session.sessionId.length > 12 ? "…" : ""}` : "")}
            </Typography>
          </Box>
        )}
        {visibleColumns.play && (
          <Box sx={{ width: COLUMN_WIDTHS.play, minWidth: COLUMN_WIDTHS.play, flexShrink: 0, mr: COLUMN_GAP }} onClick={(e) => e.stopPropagation()}>
            <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); onRowClick(session); }} sx={{ p: 0.5 }}>
              <PlayCircleFilledIcon sx={{ fontSize: 22 }} />
            </IconButton>
          </Box>
        )}
        {visibleColumns.date && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: COLUMN_WIDTHS.date, minWidth: COLUMN_WIDTHS.date, flexShrink: 0, mr: COLUMN_GAP }}>
            <CalendarMonthIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2" noWrap sx={{ fontSize: "0.875rem" }}>
              {session.createdAt ? format(new Date(session.createdAt), "MMM d, yy | h:mm a") : "—"}
            </Typography>
          </Box>
        )}
        {visibleColumns.events && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: COLUMN_WIDTHS.events, minWidth: COLUMN_WIDTHS.events, flexShrink: 0, mr: COLUMN_GAP }}>
            <FlagIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>{session.chunkCount ?? 0}</Typography>
          </Box>
        )}
        {visibleColumns.duration && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: COLUMN_WIDTHS.duration, minWidth: COLUMN_WIDTHS.duration, flexShrink: 0, mr: COLUMN_GAP }}>
            <ScheduleIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>{durationDisplay}</Typography>
          </Box>
        )}
        {visibleColumns.pages && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: COLUMN_WIDTHS.pages, minWidth: COLUMN_WIDTHS.pages, flexShrink: 0, mr: COLUMN_GAP }}>
            <TabIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>{session.pageCount ?? 0}</Typography>
          </Box>
        )}
        {visibleColumns.device && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: COLUMN_WIDTHS.device, minWidth: COLUMN_WIDTHS.device, flexShrink: 0, mr: COLUMN_GAP }}>
            <DesktopWindowsIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>{device}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", ml: 0.25 }}>{browser}</Typography>
          </Box>
        )}
        {visibleColumns.location && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: COLUMN_WIDTHS.location, minWidth: COLUMN_WIDTHS.location, flexShrink: 0, mr: COLUMN_GAP }}>
            {loc.flag && <Typography component="span" sx={{ fontSize: "1rem", lineHeight: 1 }}>{loc.flag}</Typography>}
            <Typography variant="body2" noWrap sx={{ fontSize: "0.875rem" }}>{loc.text}</Typography>
          </Box>
        )}
        {visibleColumns.ip && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: COLUMN_WIDTHS.ip, minWidth: COLUMN_WIDTHS.ip, flexShrink: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontFamily: "monospace", fontSize: "0.875rem" }} title={session.ipAddress || ""}>
              {session.ipAddress || "—"}
            </Typography>
          </Box>
        )}
      </ListItemButton>
    </div>
  );
});

export default function SessionsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { refetch: refetchProjects } = useProjects();
  const { projectKey: routeProjectKey } = useParams();
  const projectKey = routeProjectKey || "";
  const thumbnailAttemptedRef = React.useRef(false);
  useEffect(() => {
    if (!routeProjectKey) navigate("/", { replace: true });
  }, [routeProjectKey, navigate]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("closed");
  const [total, setTotal] = useState(0);
  /** Whole-dataset stats from API (unique users, avg duration) for the current filter; used for header. */
  const [wholeStats, setWholeStats] = useState(null);
  const [daysFilter, setDaysFilter] = useState(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [columnFilterAnchor, setColumnFilterAnchor] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [activeFilters, setActiveFilters] = useState([]);
  const [dateRangeAnchor, setDateRangeAnchor] = useState(null);
  const [filterValueModal, setFilterValueModal] = useState(null);
  const [filterInputValue, setFilterInputValue] = useState("");
  const [filterOperator, setFilterOperator] = useState("contains");
  const [openedSessionIds, setOpenedSessionIds] = useState(() => {
    try {
      const raw = sessionStorage.getItem("quicklook_opened_sessions");
      if (raw) {
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
      }
    } catch (_) {}
    return new Set();
  });
  const [savedViews, setSavedViews] = useState([]);
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const [transitioningSessionId, setTransitioningSessionId] = useState(null);
  const [tabVisible, setTabVisible] = useState(() => typeof document !== "undefined" && !document.hidden);

  useEffect(() => {
    const onVisibilityChange = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    setSavedViews(getSavedViewsFromStorage(projectKey));
  }, [projectKey]);

  useEffect(() => {
    thumbnailAttemptedRef.current = false;
  }, [projectKey]);

  // When sessions are shown and project has no cover image, capture a random session frame and save as project thumbnail
  useEffect(() => {
    if (!projectKey.trim() || sessions.length === 0 || loading || thumbnailAttemptedRef.current) return;
    let cancelled = false;
    (async () => {
      thumbnailAttemptedRef.current = true;
      try {
        const res = await getProject(projectKey);
        const project = res.data?.data;
        if (cancelled || !project || project.thumbnailUrl) return;
        await generateAndSaveProjectThumbnail(projectKey, { onRefetch: refetchProjects });
      } catch (_) {
        thumbnailAttemptedRef.current = false;
      }
    })();
    return () => { cancelled = true; };
  }, [projectKey, sessions.length, loading, refetchProjects]);

  const applySavedView = (view) => {
    setStatus(view.status ?? "closed");
    setDaysFilter(view.daysFilter ?? 30);
    setSearchQuery(view.searchQuery ?? "");
    setActiveFilters(
      (view.filters || []).map((f, i) => ({ ...f, id: Date.now() + i }))
    );
  };

  const saveCurrentView = () => {
    const name = (saveViewName || "").trim();
    if (!name) return;
    const view = {
      id: `view_${Date.now()}`,
      name,
      status,
      daysFilter,
      searchQuery,
      filters: activeFilters.map(({ type, operator, label, value }) => ({ type, operator, label, value })),
    };
    const next = [...savedViews, view];
    setSavedViews(next);
    saveSavedViewsToStorage(projectKey, next);
    setSaveViewName("");
    setSaveViewDialogOpen(false);
  };

  const deleteSavedView = (id, e) => {
    e?.stopPropagation?.();
    const next = savedViews.filter((v) => v.id !== id);
    setSavedViews(next);
    saveSavedViewsToStorage(projectKey, next);
  };

  const markSessionOpened = (sessionId) => {
    setOpenedSessionIds((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      try {
        sessionStorage.setItem("quicklook_opened_sessions", JSON.stringify([...next]));
      } catch (_) {}
      return next;
    });
  };

  const fromTo = useMemo(() => {
    const to = Date.now();
    const from = to - daysFilter * 24 * 60 * 60 * 1000;
    return { from, to };
  }, [daysFilter]);

  const load = useCallback(async (options = {}) => {
    const { isRefresh = false, silent = false } = options;
    if (!projectKey.trim()) {
      setSessions([]);
      setTotal(0);
      setWholeStats(null);
      setLoading(false);
      return;
    }
    if (isRefresh && !silent) {
      setRefreshing(true);
    } else if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const res = await getSessions({
        projectKey: projectKey.trim(),
        status: status || undefined,
        from: fromTo.from,
        to: fromTo.to,
        limit: SESSIONS_PAGE_SIZE,
        skip: 0,
      });
      const data = res.data?.data || [];
      setSessions(data);
      setTotal(res.data?.total ?? data.length);
      if (res.data?.uniqueUsers != null && res.data?.avgDurationMs != null) {
        setWholeStats({ uniqueUsers: res.data.uniqueUsers, avgDurationMs: res.data.avgDurationMs });
      } else {
        setWholeStats(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load sessions");
      setSessions([]);
      setTotal(0);
      setWholeStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectKey, status, fromTo.from, fromTo.to]);

  const loadMore = useCallback(async () => {
    if (!projectKey.trim() || loadingMore || sessions.length >= total) return;
    setLoadingMore(true);
    setError("");
    try {
      const res = await getSessions({
        projectKey: projectKey.trim(),
        status: status || undefined,
        from: fromTo.from,
        to: fromTo.to,
        limit: SESSIONS_PAGE_SIZE,
        skip: sessions.length,
      });
      const data = res.data?.data || [];
      setSessions((prev) => [...prev, ...data]);
      setTotal((prevTotal) => res.data?.total != null ? res.data.total : Math.max(prevTotal, sessions.length + data.length));
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load more sessions");
    } finally {
      setLoadingMore(false);
    }
  }, [projectKey, status, fromTo.from, fromTo.to, sessions.length, total, loadingMore]);

  const handleRefresh = () => {
    load({ isRefresh: true, silent: false });
  };

  const sessionsLengthRef = React.useRef(0);
  sessionsLengthRef.current = sessions.length;

  useEffect(() => {
    load();
    // Poll only when tab is visible. Active/all: 10s; closed: 30s. Skip when user has loaded more than one page.
    let interval;
    if (projectKey.trim() && tabVisible) {
      const pollInterval = status === "active" || status === "" ? 10000 : 30000;
      interval = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        if (sessionsLengthRef.current <= SESSIONS_PAGE_SIZE) {
          load({ isRefresh: true, silent: true });
        }
      }, pollInterval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [load, projectKey, status, tabVisible]);

  const filteredSessions = useMemo(() => {
    let list = sessions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          (s.sessionId && s.sessionId.toLowerCase().includes(q)) ||
          (s.user?.email && s.user.email.toLowerCase().includes(q))
      );
    }
    list = list.filter((s) => activeFilters.every((f) => sessionMatchesFilter(s, f)));
    return list;
  }, [sessions, searchQuery, activeFilters]);

  const summary = useMemo(() => {
    const list = filteredSessions;
    const count = list.length;
    const uniqueUsers = new Set(list.map((s) => s.user?.email || s.sessionId).filter(Boolean)).size;
    const totalDuration = list.reduce((acc, s) => acc + (s.duration || 0), 0);
    const avgDurationMs = count > 0 ? Math.round(totalDuration / count) : 0;
    return {
      users: uniqueUsers,
      sessions: count,
      avgDurationMs,
    };
  }, [filteredSessions]);

  const sessionCountByUser = useMemo(() => {
    const map = new Map();
    filteredSessions.forEach((s) => {
      const key = s.user?.email || s.sessionId || "";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [filteredSessions]);

  const statusLabel = status === "closed" ? "Completed sessions" : status === "active" ? "Active sessions" : "All sessions";

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addFilter = (filter) => {
    setActiveFilters((prev) => [...prev, { id: Date.now(), ...filter }]);
    setFilterPanelOpen(false);
    setFilterValueModal(null);
  };

  const removeFilter = (id) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const submitFilterValue = () => {
    if (!filterValueModal) return;
    const { type, valueType } = filterValueModal;
    let value;
    if (valueType === "number") {
      const v = parseInt(filterInputValue, 10);
      if (Number.isNaN(v) || v < 0) return;
      value = type === "duration" ? v : v;
    } else {
      const v = filterInputValue.trim();
      if (!v) return;
      value = v;
    }
    addFilter({
      type,
      operator: filterOperator,
      value,
      label: filterValueModal.label,
    });
  };

  const handleRowClick = useCallback((session) => {
    setTransitioningSessionId(session.sessionId);
    markSessionOpened(session.sessionId);
    setTimeout(() => navigate(`/sessions/${session.sessionId}`), 250);
  }, [navigate]);

  const LIST_HEIGHT = 600;

  return (
    <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh" }}>
      {/* On mobile: segment menu on top. On desktop: left sidebar. */}
      {isMobile ? (
        <SessionSidebar status={status} setStatus={setStatus} placement="top" />
      ) : (
        <SessionSidebar status={status} setStatus={setStatus} />
      )}

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar: date range, search, + Filter, column filter icon — fixed heights */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2.5,
            minHeight: 48,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="outlined"
            size="small"
            startIcon={<CalendarMonthIcon sx={{ fontSize: 18 }} />}
            onClick={(e) => setDateRangeAnchor(e.currentTarget)}
            sx={{
              textTransform: "none",
              fontSize: "0.875rem",
              minHeight: 36,
              px: 1.5,
              borderColor: "divider",
              color: "text.primary",
            }}
          >
            Last {daysFilter} days
          </Button>
          <Menu
            anchorEl={dateRangeAnchor}
            open={Boolean(dateRangeAnchor)}
            onClose={() => setDateRangeAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          >
            {DAYS_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.value}
                onClick={() => {
                  setDaysFilter(opt.value);
                  setDateRangeAnchor(null);
                }}
              >
                {opt.label}
              </MenuItem>
            ))}
          </Menu>
          <TextField
            size="small"
            placeholder="Search sessions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 180 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                </InputAdornment>
              ),
              sx: { fontSize: "0.875rem", height: 36, "& fieldset": { borderRadius: "6px" } },
            }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            onClick={() => setFilterPanelOpen(true)}
            sx={{
              textTransform: "none",
              fontSize: "0.875rem",
              minHeight: 36,
              px: 1.5,
              borderColor: "divider",
              color: "text.primary",
            }}
          >
            Filter
          </Button>
          <Box sx={{ flex: 1 }} />
          <IconButton
            size="small"
            onClick={handleRefresh}
            aria-label="Refresh sessions"
            disabled={loading || refreshing}
            sx={{ color: "text.secondary" }}
          >
            {refreshing ? (
              <CircularProgress size={20} sx={{ color: "text.secondary" }} />
            ) : (
              <RefreshIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
          <Menu
            anchorEl={columnFilterAnchor}
            open={Boolean(columnFilterAnchor)}
            onClose={() => setColumnFilterAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            {COLUMN_KEYS.map((key) => (
              <MenuItem key={key} dense onClick={() => toggleColumn(key)}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={!!visibleColumns[key]} readOnly />}
                  label={key === "ip" ? "IP" : key.charAt(0).toUpperCase() + key.slice(1)}
                  sx={{ pointerEvents: "none" }}
                />
              </MenuItem>
            ))}
          </Menu>
        </Box>

        <Box sx={{ flex: 1, p: 2.5, overflow: "auto" }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          {!projectKey.trim() && (
            <Paper sx={{ p: 3, textAlign: "center" }}>
              <Typography color="text.secondary">Select or add a project to list sessions.</Typography>
            </Paper>
          )}

          {projectKey.trim() && (
            <>
              {/* Active filters chips */}
              {activeFilters.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
                  {activeFilters.map((f) => (
                    <Chip
                      key={f.id}
                      size="small"
                      label={getFilterChipLabel(f)}
                      onDelete={() => removeFilter(f.id)}
                      sx={{ fontSize: "0.8125rem" }}
                    />
                  ))}
                </Box>
              )}

              {/* Saved views: one-click filter presets */}
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 2 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.6875rem", letterSpacing: "0.06em", mr: 0.5 }}>
                  SAVED VIEWS
                </Typography>
                {savedViews.map((view) => (
                  <Chip
                    key={view.id}
                    icon={<BookmarkIcon sx={{ fontSize: 16, color: "primary.main" }} />}
                    label={view.name}
                    onClick={() => applySavedView(view)}
                    onDelete={(e) => deleteSavedView(view.id, e)}
                    deleteIcon={<DeleteOutlineIcon sx={{ fontSize: 18 }} />}
                    size="small"
                    variant="outlined"
                    sx={{
                      fontSize: "0.8125rem",
                      borderColor: "divider",
                      "&:hover": {
                        borderColor: "primary.main",
                        bgcolor: "rgba(190,149,250,0.08)",
                      },
                    }}
                  />
                ))}
                <Button
                  size="small"
                  startIcon={<BookmarkAddIcon sx={{ fontSize: 18 }} />}
                  onClick={() => { setSaveViewName(""); setSaveViewDialogOpen(true); }}
                  sx={{
                    textTransform: "none",
                    fontSize: "0.8125rem",
                    color: "text.secondary",
                    "&:hover": { color: "primary.main", bgcolor: "rgba(190,149,250,0.08)" },
                  }}
                >
                  Save current view
                </Button>
              </Box>

              {/* Header: title left; summarizer + filter icon right, aligned */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 2,
                  mb: 2,
                  minHeight: 40,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <AutoAwesomeIcon color="primary" sx={{ fontSize: 28 }} />
                  <Typography variant="h5" fontWeight={700} sx={{ fontSize: "1.25rem" }}>
                    {statusLabel}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <Box sx={{ textAlign: "center", minWidth: 80 }}>
                    <Typography variant="body1" fontWeight={700} sx={{ fontSize: "1.0625rem", lineHeight: 1.2 }}>
                      {(wholeStats?.uniqueUsers ?? summary.users).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem", letterSpacing: "0.05em" }}>
                      USERS
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "center", minWidth: 80 }}>
                    <Typography variant="body1" fontWeight={700} sx={{ fontSize: "1.0625rem", lineHeight: 1.2 }}>
                      {total.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem", letterSpacing: "0.05em" }}>
                      SESSIONS
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "center", minWidth: 80 }}>
                    <Typography variant="body1" fontWeight={700} sx={{ fontSize: "1.0625rem", lineHeight: 1.2 }}>
                      {formatDuration(wholeStats?.avgDurationMs ?? summary.avgDurationMs)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem", letterSpacing: "0.05em" }}>
                      AVG. DURATION
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => setColumnFilterAnchor(e.currentTarget)}
                    aria-label="Sort or filter columns"
                    sx={{ color: "text.secondary", ml: 0.5 }}
                  >
                    <SortIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>
              </Box>

              {/* Sessions list */}
              <Paper
                elevation={0}
                variant="outlined"
                sx={{
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                {loading ? (
                  <Box display="flex" justifyContent="center" alignItems="center" minHeight={320}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    {/* Header row — same column widths and padding as rows for alignment */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        px: 2,
                        minHeight: 44,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        bgcolor: "action.hover",
                      }}
                    >
                      {visibleColumns.user && (
                        <Box sx={{ display: "flex", alignItems: "center", width: COLUMN_WIDTHS.user, minWidth: COLUMN_WIDTHS.user, flexShrink: 0, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            USER
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.play && (
                        <Box sx={{ width: COLUMN_WIDTHS.play, minWidth: COLUMN_WIDTHS.play, flexShrink: 0, mr: COLUMN_GAP }} />
                      )}
                      {visibleColumns.date && (
                        <Box sx={{ width: COLUMN_WIDTHS.date, minWidth: COLUMN_WIDTHS.date, flexShrink: 0, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            DATE
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.events && (
                        <Box sx={{ width: COLUMN_WIDTHS.events, minWidth: COLUMN_WIDTHS.events, flexShrink: 0, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            EVENTS
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.duration && (
                        <Box sx={{ width: COLUMN_WIDTHS.duration, minWidth: COLUMN_WIDTHS.duration, flexShrink: 0, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            DURATION
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.pages && (
                        <Box sx={{ width: COLUMN_WIDTHS.pages, minWidth: COLUMN_WIDTHS.pages, flexShrink: 0, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            PAGES
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.device && (
                        <Box sx={{ width: COLUMN_WIDTHS.device, minWidth: COLUMN_WIDTHS.device, flexShrink: 0, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            DEVICE
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.location && (
                        <Box sx={{ width: COLUMN_WIDTHS.location, minWidth: COLUMN_WIDTHS.location, flexShrink: 0, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            LOCATION
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.ip && (
                        <Box sx={{ width: COLUMN_WIDTHS.ip, minWidth: COLUMN_WIDTHS.ip, flexShrink: 0 }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            IP
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <FixedSizeList
                      height={LIST_HEIGHT}
                      itemCount={filteredSessions.length}
                      itemSize={ROW_HEIGHT}
                      width="100%"
                      style={{ overflowX: "auto" }}
                    >
                      {({ index, style }) => {
                        const session = filteredSessions[index];
                        const userKey = session.user?.email || session.sessionId || "";
                        return (
                          <SessionRow
                            session={session}
                            style={style}
                            visibleColumns={visibleColumns}
                            sessionsForUser={sessionCountByUser.get(userKey) ?? 1}
                            isOpened={openedSessionIds.has(session.sessionId)}
                            isTransitioning={transitioningSessionId === session.sessionId}
                            onRowClick={handleRowClick}
                            status={status}
                          />
                        );
                      }}
                    </FixedSizeList>
                  </>
                )}
                {!loading && filteredSessions.length === 0 && (
                  <Box
                    sx={{
                      py: 6,
                      px: 2,
                      textAlign: "center",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      "@keyframes pulseRing": {
                        "0%": { opacity: 0.6, transform: "scale(0.95)" },
                        "50%": { opacity: 0.2, transform: "scale(1.15)" },
                        "100%": { opacity: 0.6, transform: "scale(0.95)" },
                      },
                      "@keyframes dotWave": {
                        "0%, 60%, 100%": { opacity: 0.35 },
                        "30%": { opacity: 1 },
                      },
                    }}
                  >
                    {sessions.length === 0 ? (
                      <>
                        <Box
                          sx={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 72,
                            height: 72,
                          }}
                        >
                          <Box
                            sx={{
                              position: "absolute",
                              width: 72,
                              height: 72,
                              borderRadius: "50%",
                              bgcolor: "primary.main",
                              opacity: 0.12,
                              animation: "pulseRing 2.2s ease-in-out infinite",
                            }}
                          />
                          <Box
                            sx={{
                              position: "absolute",
                              width: 72,
                              height: 72,
                              borderRadius: "50%",
                              bgcolor: "primary.main",
                              opacity: 0.08,
                              animation: "pulseRing 2.2s ease-in-out infinite",
                              animationDelay: "0.55s",
                            }}
                          />
                          <VideocamIcon
                            sx={{
                              fontSize: 36,
                              color: "primary.main",
                              position: "relative",
                              zIndex: 1,
                              animation: "pulseRing 2.2s ease-in-out infinite",
                            }}
                          />
                        </Box>
                        <Typography variant="body1" color="text.secondary" fontWeight={500}>
                          Waiting for sessions
                          <Box
                            component="span"
                            sx={{
                              "& > span": {
                                animation: "dotWave 1.4s ease-in-out infinite",
                                "&:nth-of-type(1)": { animationDelay: "0s" },
                                "&:nth-of-type(2)": { animationDelay: "0.2s" },
                                "&:nth-of-type(3)": { animationDelay: "0.4s" },
                              },
                            }}
                          >
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                          </Box>
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280 }}>
                          Add the integration script to your site. New recordings will appear here.
                        </Typography>
                      </>
                    ) : (
                      <Typography color="text.secondary">No sessions match your filters.</Typography>
                    )}
                  </Box>
                )}
                {/* Pagination: show count and Load more when there are more sessions than loaded */}
                {!loading && total > 0 && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 1,
                      px: 2,
                      py: 1.5,
                      borderTop: "1px solid",
                      borderColor: "divider",
                      bgcolor: "action.hover",
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Showing {sessions.length.toLocaleString()} of {total.toLocaleString()} sessions
                    </Typography>
                    {sessions.length < total && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={loadMore}
                        disabled={loadingMore}
                        sx={{ textTransform: "none" }}
                      >
                        {loadingMore ? "Loading…" : "Load more"}
                      </Button>
                    )}
                  </Box>
                )}
              </Paper>
            </>
          )}
        </Box>
      </Box>

      {/* Filter panel drawer — ensure it appears above nav (z-index 1100) and other UI */}
      <Drawer
        anchor="left"
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        slotProps={{
          root: { sx: { zIndex: 1300 } },
        }}
        ModalProps={{
          sx: { zIndex: 1300 },
        }}
        PaperProps={{
          sx: { width: 280, mt: 0, borderRadius: 0 },
        }}
      >
        <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle1" fontWeight={600}>
            New filter
          </Typography>
          <IconButton size="small" onClick={() => setFilterPanelOpen(false)}>
            <span style={{ fontSize: 18 }}>×</span>
          </IconButton>
        </Box>
        {FILTER_FIELDS.map((group) => (
          <Box key={group.category} sx={{ pb: 1 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2, pt: group.category === "Sessions" ? 2 : 2, display: "block", letterSpacing: "0.05em" }}>
              {group.category.toUpperCase()}
            </Typography>
            <List dense>
              {group.fields.map((field) => {
                const Icon = field.icon;
                return (
                  <ListItemButton
                    key={field.key}
                    onClick={() => {
                      setFilterValueModal({ type: field.key, label: field.label, valueType: field.valueType });
                      setFilterInputValue("");
                      setFilterOperator(field.valueType === "number" ? "atLeast" : "contains");
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={field.label} />
                    <span style={{ opacity: 0.5 }}>›</span>
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Drawer>

      {/* Filter value modal: operator + value */}
      {filterValueModal && (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.5)",
            zIndex: 1300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setFilterValueModal(null)}
        >
          <Paper sx={{ p: 2, minWidth: 320 }} onClick={(e) => e.stopPropagation()}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              {filterValueModal.label}
            </Typography>
            <FormControl size="small" fullWidth sx={{ mb: 2 }}>
              <InputLabel>Operator</InputLabel>
              <Select
                value={filterOperator}
                label="Operator"
                onChange={(e) => setFilterOperator(e.target.value)}
              >
                {(filterValueModal.valueType === "number" ? NUMERIC_OPERATORS : TEXT_OPERATORS).map((op) => (
                  <MenuItem key={op.value} value={op.value}>
                    {op.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type={filterValueModal.valueType === "number" ? "number" : "text"}
              size="small"
              fullWidth
              value={filterInputValue}
              onChange={(e) => setFilterInputValue(e.target.value)}
              placeholder={
                filterValueModal.valueType === "number"
                  ? filterValueModal.type === "duration"
                    ? "Seconds"
                    : "Number"
                  : "Enter value…"
              }
              inputProps={filterValueModal.valueType === "number" ? { min: 0 } : {}}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitFilterValue();
                }
              }}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => setFilterValueModal(null)}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={submitFilterValue}>
                Add filter
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Save current view dialog */}
      <Dialog open={saveViewDialogOpen} onClose={() => setSaveViewDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Save current view</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Save the current filters (date range, segment, search, duration/pages) as a preset you can apply with one click.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="View name"
            placeholder="e.g. Long sessions, Last 7 days"
            value={saveViewName}
            onChange={(e) => setSaveViewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveCurrentView()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveViewDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveCurrentView} disabled={!saveViewName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
