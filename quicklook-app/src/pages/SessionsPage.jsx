import React, { useState, useEffect, useMemo } from "react";
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
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import FlagIcon from "@mui/icons-material/Flag";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TabIcon from "@mui/icons-material/Tab";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LinkIcon from "@mui/icons-material/Link";
import PlaceIcon from "@mui/icons-material/Place";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SortIcon from "@mui/icons-material/Sort";
import VideocamIcon from "@mui/icons-material/Videocam";
import { getSessions } from "../api/quicklookApi";
import {
  formatDuration,
  parseDevice,
  parseOS,
  parseBrowser,
  getCountryFlagEmoji,
} from "../utils/sessionParser";
import { format } from "date-fns";
import SessionSidebar from "../components/SessionSidebar";

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
};

const ROW_HEIGHT = 60;
const COLUMN_WIDTHS = { user: 220, play: 52, date: 160, events: 64, duration: 72, pages: 56, device: 120, location: 110 };
const COLUMN_GAP = 2; // mr in theme spacing units, applied consistently

export default function SessionsPage() {
  const navigate = useNavigate();
  const { projectKey: routeProjectKey } = useParams();
  const projectKey = routeProjectKey || "";
  useEffect(() => {
    if (!routeProjectKey) navigate("/", { replace: true });
  }, [routeProjectKey, navigate]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("closed");
  const [total, setTotal] = useState(0);
  const [daysFilter, setDaysFilter] = useState(30);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [columnFilterAnchor, setColumnFilterAnchor] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [activeFilters, setActiveFilters] = useState([]);
  const [dateRangeAnchor, setDateRangeAnchor] = useState(null);
  const [filterValueModal, setFilterValueModal] = useState(null);
  const [filterInputValue, setFilterInputValue] = useState("");
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

  const load = async () => {
    if (!projectKey.trim()) {
      setSessions([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await getSessions({
        projectKey: projectKey.trim(),
        status: status || undefined,
        from: fromTo.from,
        to: fromTo.to,
        limit: 100,
        skip: 0,
      });
      const data = res.data?.data || [];
      setSessions(data);
      setTotal(res.data?.total ?? data.length);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load sessions");
      setSessions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectKey, status, fromTo.from, fromTo.to]);

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
    activeFilters.forEach((f) => {
      if (f.type === "durationMin" && f.value != null) {
        list = list.filter((s) => (s.duration || 0) >= f.value);
      }
      if (f.type === "durationMax" && f.value != null) {
        list = list.filter((s) => (s.duration || 0) <= f.value);
      }
      if (f.type === "pagesMin" && f.value != null) {
        list = list.filter((s) => (s.pageCount || 0) >= f.value);
      }
    });
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
  };

  const removeFilter = (id) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const locationDisplay = (session) => {
    const loc = session.meta?.location || session.meta?.countryCode;
    const countryCode = typeof loc === "string" ? loc : loc?.countryCode;
    const city = typeof loc === "object" && loc?.city ? loc.city : null;
    const flag = countryCode ? getCountryFlagEmoji(countryCode) : null;
    if (flag || city) return { flag, text: city || countryCode || "—" };
    return { flag: null, text: "—" };
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <SessionSidebar
        projectKey={projectKey}
        status={status}
        setStatus={setStatus}
        onOpenFilterPanel={() => setFilterPanelOpen(true)}
      />

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
            onClick={(e) => setColumnFilterAnchor(e.currentTarget)}
            aria-label="Column filter"
            sx={{ color: "text.secondary" }}
          >
            <FilterListIcon sx={{ fontSize: 20 }} />
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
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
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
                      label={f.type === "durationMin" ? `Duration ≥ ${(f.value / 1000) || 0}s` : f.type === "pagesMin" ? `Pages ≥ ${f.value}` : `${f.label}: ${f.value}`}
                      onDelete={() => removeFilter(f.id)}
                      sx={{ fontSize: "0.8125rem" }}
                    />
                  ))}
                </Box>
              )}

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
                  <CheckCircleIcon color="primary" sx={{ fontSize: 28 }} />
                  <Typography variant="h5" fontWeight={700} sx={{ fontSize: "1.25rem" }}>
                    {statusLabel}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <Box sx={{ textAlign: "center", minWidth: 80 }}>
                    <Typography variant="body1" fontWeight={700} sx={{ fontSize: "1.0625rem", lineHeight: 1.2 }}>
                      {summary.users.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem", letterSpacing: "0.05em" }}>
                      USERS
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "center", minWidth: 80 }}>
                    <Typography variant="body1" fontWeight={700} sx={{ fontSize: "1.0625rem", lineHeight: 1.2 }}>
                      {summary.sessions.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem", letterSpacing: "0.05em" }}>
                      SESSIONS
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "center", minWidth: 80 }}>
                    <Typography variant="body1" fontWeight={700} sx={{ fontSize: "1.0625rem", lineHeight: 1.2 }}>
                      {formatDuration(summary.avgDurationMs)}
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
                        <Box sx={{ display: "flex", alignItems: "center", minWidth: COLUMN_WIDTHS.user, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            USER
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.play && (
                        <Box sx={{ minWidth: COLUMN_WIDTHS.play, mr: COLUMN_GAP }} />
                      )}
                      {visibleColumns.date && (
                        <Box sx={{ minWidth: COLUMN_WIDTHS.date, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            DATE
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.events && (
                        <Box sx={{ minWidth: COLUMN_WIDTHS.events, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            EVENTS
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.duration && (
                        <Box sx={{ minWidth: COLUMN_WIDTHS.duration, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            DURATION
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.pages && (
                        <Box sx={{ minWidth: COLUMN_WIDTHS.pages, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            PAGES
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.device && (
                        <Box sx={{ minWidth: COLUMN_WIDTHS.device, mr: COLUMN_GAP }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            DEVICE
                          </Typography>
                        </Box>
                      )}
                      {visibleColumns.location && (
                        <Box sx={{ minWidth: COLUMN_WIDTHS.location }}>
                          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                            LOCATION
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <List disablePadding>
                      {filteredSessions.map((session, idx) => {
                        const loc = locationDisplay(session);
                        const userKey = session.user?.email || session.sessionId || "";
                        const sessionsForUser = sessionCountByUser.get(userKey) ?? 1;
                        return (
                          <ListItemButton
                            key={session.sessionId}
                            onClick={() => {
                              markSessionOpened(session.sessionId);
                              navigate(`/sessions/${session.sessionId}`);
                            }}
                            sx={{
                              minHeight: ROW_HEIGHT,
                              height: ROW_HEIGHT,
                              py: 0,
                              px: 2,
                              borderBottom: idx < filteredSessions.length - 1 ? "1px solid" : "none",
                              borderColor: "divider",
                              bgcolor: openedSessionIds.has(session.sessionId)
                                ? (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)")
                                : (theme) => (theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"),
                              "&:hover": { bgcolor: "action.selected" },
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {visibleColumns.user && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: COLUMN_WIDTHS.user, mr: COLUMN_GAP }} onClick={(e) => e.stopPropagation()}>
                                <PersonOutlineIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                  <VideocamIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                  <Typography variant="body2" component="span" sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                                    {sessionsForUser}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" noWrap sx={{ fontSize: "0.875rem", maxWidth: 140 }} title={session.sessionId}>
                                  {String(session.sessionId).slice(0, 16)}{session.sessionId.length > 16 ? "…" : ""}
                                </Typography>
                              </Box>
                            )}
                            {visibleColumns.play && (
                              <Box sx={{ minWidth: COLUMN_WIDTHS.play, mr: COLUMN_GAP }} onClick={(e) => e.stopPropagation()}>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markSessionOpened(session.sessionId);
                                    navigate(`/sessions/${session.sessionId}`);
                                  }}
                                  sx={{ p: 0.5 }}
                                >
                                  <PlayArrowIcon sx={{ fontSize: 20 }} />
                                </IconButton>
                              </Box>
                            )}
                            {visibleColumns.date && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: COLUMN_WIDTHS.date, mr: COLUMN_GAP }}>
                                <CalendarMonthIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                                  {session.createdAt ? format(new Date(session.createdAt), "MMM d, yy | h:mm a") : "—"}
                                </Typography>
                              </Box>
                            )}
                            {visibleColumns.events && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: COLUMN_WIDTHS.events, mr: COLUMN_GAP }}>
                                <FlagIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                                  {session.chunkCount ?? 0}
                                </Typography>
                              </Box>
                            )}
                            {visibleColumns.duration && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: COLUMN_WIDTHS.duration, mr: COLUMN_GAP }}>
                                <ScheduleIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                                  {formatDuration(session.duration)}
                                </Typography>
                              </Box>
                            )}
                            {visibleColumns.pages && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: COLUMN_WIDTHS.pages, mr: COLUMN_GAP }}>
                                <TabIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                                  {session.pageCount ?? 0}
                                </Typography>
                              </Box>
                            )}
                            {visibleColumns.device && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: COLUMN_WIDTHS.device, mr: COLUMN_GAP }}>
                                <DesktopWindowsIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
                                  {parseDevice(session.meta?.userAgent)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem", ml: 0.25 }}>
                                  {parseBrowser(session.meta?.userAgent)}
                                </Typography>
                              </Box>
                            )}
                            {visibleColumns.location && (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: COLUMN_WIDTHS.location }}>
                                {loc.flag && (
                                  <Typography component="span" sx={{ fontSize: "1rem", lineHeight: 1 }}>
                                    {loc.flag}
                                  </Typography>
                                )}
                                <Typography variant="body2" noWrap sx={{ fontSize: "0.875rem" }}>
                                  {loc.text}
                                </Typography>
                              </Box>
                            )}
                          </ListItemButton>
                        );
                      })}
                    </List>
                  </>
                )}
                {!loading && filteredSessions.length === 0 && (
                  <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography color="text.secondary">No sessions match your filters.</Typography>
                  </Box>
                )}
              </Paper>
            </>
          )}
        </Box>
      </Box>

      {/* Filter panel drawer */}
      <Drawer
        anchor="left"
        open={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
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
        <TextField
          size="small"
          placeholder="Looking for something?"
          fullWidth
          sx={{ m: 2, mt: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2, pt: 1, display: "block", letterSpacing: "0.05em" }}>
          SESSIONS
        </Typography>
        <List dense>
          <ListItemButton onClick={() => { setFilterValueModal({ type: "durationMin", label: "Duration (min seconds)" }); setFilterInputValue(""); }}>
            <ListItemIcon sx={{ minWidth: 32 }}><ScheduleIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Duration" />
            <span style={{ opacity: 0.5 }}>›</span>
          </ListItemButton>
          <ListItemButton onClick={() => { setFilterValueModal({ type: "pagesMin", label: "Pages (min)" }); setFilterInputValue(""); }}>
            <ListItemIcon sx={{ minWidth: 32 }}><TabIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Number of pages per visit" />
            <span style={{ opacity: 0.5 }}>›</span>
          </ListItemButton>
          <ListItemButton>
            <ListItemIcon sx={{ minWidth: 32 }}><LinkIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Visited URL" />
            <span style={{ opacity: 0.5 }}>›</span>
          </ListItemButton>
        </List>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 2, pt: 2, display: "block", letterSpacing: "0.05em" }}>
          LOCATION
        </Typography>
        <List dense>
          <ListItemButton>
            <ListItemIcon sx={{ minWidth: 32 }}><PlaceIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="City" />
            <span style={{ opacity: 0.5 }}>›</span>
          </ListItemButton>
        </List>
      </Drawer>

      {/* Simple modal to set filter value */}
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
          <Paper
            sx={{ p: 2, minWidth: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="subtitle2" sx={{ mb: 2 }}>{filterValueModal.label}</Typography>
            <TextField
              type="number"
              size="small"
              fullWidth
              value={filterInputValue}
              onChange={(e) => setFilterInputValue(e.target.value)}
              placeholder={filterValueModal.type === "durationMin" ? "Seconds" : "Min pages"}
              inputProps={{ min: 0 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = parseInt(filterInputValue, 10);
                  const value = filterValueModal.type === "durationMin" ? (v * 1000) : v;
                  if (!Number.isNaN(value) && value >= 0) addFilter({ type: filterValueModal.type, label: filterValueModal.label, value });
                  setFilterValueModal(null);
                }
              }}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => setFilterValueModal(null)}>Cancel</Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  const v = parseInt(filterInputValue, 10);
                  const value = filterValueModal.type === "durationMin" ? (v * 1000) : v;
                  if (!Number.isNaN(value) && value >= 0) addFilter({ type: filterValueModal.type, label: filterValueModal.label, value });
                  setFilterValueModal(null);
                }}
              >
                Add filter
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
