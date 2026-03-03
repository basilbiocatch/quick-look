import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Collapse,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  Tooltip,
  Tabs,
  Tab,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BadgeIcon from "@mui/icons-material/Badge";
import TuneIcon from "@mui/icons-material/Tune";
import FilterListIcon from "@mui/icons-material/FilterList";
import CodeIcon from "@mui/icons-material/Code";
import GestureIcon from "@mui/icons-material/Gesture";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import PublicIcon from "@mui/icons-material/Public";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PsychologyIcon from "@mui/icons-material/Psychology";
import CircularProgress from "@mui/material/CircularProgress";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AndroidIcon from "@mui/icons-material/Android";
import AppleIcon from "@mui/icons-material/Apple";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import TabletIcon from "@mui/icons-material/Tablet";
import LaptopIcon from "@mui/icons-material/Laptop";
import LanguageIcon from "@mui/icons-material/Language";
import RouterIcon from "@mui/icons-material/Router";
import { useNavigate } from "react-router-dom";
import { parseDevice, parseOS, parseBrowser, formatDuration } from "../utils/sessionParser";
import { buildActivityList, getPagesFromEvents, urlPageKey } from "../utils/activityList";
import { format } from "date-fns";
import PropertyRow from "./PropertyRow";

function getApiBase() {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base) return base.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function CollapsibleSection({ title, defaultOpen = true, children, action }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 1,
          px: 1.5,
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: "0.8125rem" }}>
          {title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {action}
          <IconButton size="small">{open ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
        </Box>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function urlToPathname(url) {
  if (!url || typeof url !== "string") return url || "";
  try {
    const path = new URL(url).pathname;
    return path || "/";
  } catch {
    return url;
  }
}

function ActivityIcon({ type }) {
  switch (type) {
    case "click":
      return <GestureIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    case "input":
      return <TouchAppIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    case "custom":
      return <CodeIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    case "url":
      return <PublicIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    default:
      return null;
  }
}

const iconSx = { fontSize: 18, color: "text.secondary" };

function DeviceIcon({ device, os }) {
  if (/Android/i.test(os || "")) return <AndroidIcon sx={iconSx} />;
  if (/iOS|iPhone|iPad|Mac/i.test(os || "")) return <AppleIcon sx={iconSx} />;
  switch (device) {
    case "Mobile":
      return <PhoneAndroidIcon sx={iconSx} />;
    case "Tablet":
      return <TabletIcon sx={iconSx} />;
    case "Desktop":
    default:
      return <DesktopWindowsIcon sx={iconSx} />;
  }
}

function OSIcon({ os }) {
  if (/Android/i.test(os || "")) return <AndroidIcon sx={iconSx} />;
  if (/iOS|Mac|iPhone|iPad/i.test(os || "")) return <AppleIcon sx={iconSx} />;
  if (/Windows/i.test(os || "")) return <DesktopWindowsIcon sx={iconSx} />;
  return <LaptopIcon sx={iconSx} />;
}

function BrowserIcon() {
  return <LanguageIcon sx={iconSx} />;
}

export default function RightPanel({
  session,
  events,
  meta,
  onSeek,
  currentTimeMs,
  excludedUrls = [],
  onExcludeUrl,
  onUnexcludeUrl,
  onSaveExclusions,
  aiSummary = null,
  summaryLoading = false,
  summaryError = "",
  relatedSessionsByIp = [],
  relatedSessionsByDevice = [],
}) {
  const navigate = useNavigate();
  const [relatedTab, setRelatedTab] = useState(0);
  const [activitySearch, setActivitySearch] = useState("");
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [setupIntegrationMode, setSetupIntegrationMode] = useState("developer");
  const [allPropertiesDialogOpen, setAllPropertiesDialogOpen] = useState(false);
  const [setupCopied, setSetupCopied] = useState(false);

  const activities = useMemo(() => buildActivityList(events || []), [events]);
  const pages = useMemo(() => getPagesFromEvents(events || []), [events]);
  const excludedSet = useMemo(() => new Set(excludedUrls || []), [excludedUrls]);
  const visiblePages = useMemo(() => pages.filter((p) => !excludedSet.has(urlPageKey(p.url))), [pages, excludedSet]);
  const excludedPageKeys = useMemo(() => excludedUrls || [], [excludedUrls]);
  const filteredActivities = useMemo(() => {
    if (!activitySearch.trim()) return activities;
    const q = activitySearch.toLowerCase();
    return activities.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.detail && a.detail.toLowerCase().includes(q))
    );
  }, [activities, activitySearch]);

  if (!session) return null;

  const user = session.user || {};
  const m = session.meta || {};
  const eventCount = meta?.eventCount ?? events?.length ?? 0;
  const device = parseDevice(m.userAgent);
  const os = parseOS(m.userAgent);
  const browser = parseBrowser(m.userAgent);

  const apiBase = getApiBase();
  const setupSnippet = session.projectKey && apiBase
    ? `<script src="${apiBase}/quicklook-sdk.js" async></script>
<script>
  quicklook('init', {
    apiUrl: '${apiBase}',
    projectKey: '${session.projectKey}'
  });
  // Optional: identify user
  // quicklook('setIdentity', { email: 'user@example.com', firstName: 'Jane' });
</script>`
    : "";

  const setupPrompt = setupSnippet
    ? `Add this session recording script to my site in a non-blocking way. Place it at the end of the body. Use the async attribute on the script that loads the SDK so it does not block page load. Here is the exact code to add:

${setupSnippet}`
    : "";

  const copySetupSnippet = () => {
    const text = setupIntegrationMode === "developer" ? setupSnippet : setupPrompt;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setSetupCopied(true);
      setTimeout(() => setSetupCopied(false), 2000);
    });
  };

  const allPropertiesEntries = useMemo(() => {
    const entries = [];
    if (session) {
      Object.entries(session).forEach(([k, v]) => {
        if (k === "meta" && v && typeof v === "object") return;
        const val = v == null ? "—" : (typeof v === "object" ? JSON.stringify(v) : String(v));
        entries.push({ key: k, value: val });
      });
      if (m && typeof m === "object") {
        Object.entries(m).forEach(([k, v]) => {
          const val = v == null ? "—" : (typeof v === "object" ? JSON.stringify(v) : String(v));
          entries.push({ key: `meta.${k}`, value: val });
        });
      }
    }
    return entries;
  }, [session, m]);

  const goToAllSessions = (e) => {
    e?.stopPropagation?.();
    if (session?.projectKey) navigate(`/projects/${session.projectKey}/sessions`);
  };

  return (
    <Box
      sx={{
        width: 340,
        minWidth: 340,
        overflow: "auto",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        boxShadow: (theme) => (theme.palette.mode === "dark" ? "0 0 24px rgba(0,0,0,0.15)" : "0 0 20px rgba(0,0,0,0.06)"),
        pt: 0,
        borderRadius: 1,
        m: 1.5,
        mr: 2,
      }}
    >
      <CollapsibleSection
        title="User properties"
        defaultOpen={true}
        action={
          <IconButton size="small" title="Show all user details">
            <BadgeIcon fontSize="small" />
          </IconButton>
        }
      >
        <PropertyRow label="ID" value={session.sessionId?.slice(0, 20) + (session.sessionId?.length > 20 ? "…" : "")} />
        <Typography
          component="button"
          variant="caption"
          onClick={() => setSetupDialogOpen(true)}
          sx={{ color: "primary.main", cursor: "pointer", border: 0, background: "none", mt: 0.5, p: 0, textDecoration: "underline", "&:hover": { opacity: 0.9 } }}
        >
          How to set up
        </Typography>
        <PropertyRow label="Total events" value={String(eventCount)} />
        <PropertyRow label="User's sessions" value="1/1" />
        <Typography
          component="button"
          variant="caption"
          onClick={goToAllSessions}
          sx={{ color: "primary.main", cursor: "pointer", border: 0, background: "none", mt: 0.5, p: 0, textDecoration: "underline", "&:hover": { opacity: 0.9 } }}
        >
          Show all sessions
        </Typography>
      </CollapsibleSection>

      <CollapsibleSection
        title="Related sessions"
        defaultOpen={true}
        action={
          <Tooltip title="Other sessions from the same device or IP in this project">
            <RouterIcon sx={{ fontSize: 18, color: "text.secondary" }} />
          </Tooltip>
        }
      >
        <Tabs
          value={relatedTab}
          onChange={(_, v) => setRelatedTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 36, mb: 1, "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: "0.75rem" } }}
        >
          <Tab label={`By Device (${(relatedSessionsByDevice ?? []).filter((s) => s.sessionId !== session.sessionId).length})`} />
          <Tab label={`By IP (${(relatedSessionsByIp ?? []).filter((s) => s.sessionId !== session.sessionId).length})`} />
        </Tabs>
          {relatedTab === 0 && (
            <Box>
              {session.deviceId ? (
                <>
                  <List dense disablePadding sx={{ maxHeight: 200, overflow: "auto" }}>
                    {(relatedSessionsByDevice ?? [])
                      .filter((s) => s.sessionId !== session.sessionId)
                      .slice(0, 20)
                      .map((s) => (
                        <ListItem key={s.sessionId} disablePadding>
                          <ListItemButton
                            onClick={() => navigate(`/projects/${session.projectKey}/sessions/${s.sessionId}`)}
                            sx={{ py: 0.25, borderRadius: 1 }}
                          >
                            <ListItemText
                              primary={s.sessionId?.slice(0, 8) + "…"}
                              secondary={
                                s.createdAt
                                  ? format(new Date(s.createdAt), "MMM d, h:mm a") +
                                    (s.duration != null ? ` · ${formatDuration(s.duration)}` : "")
                                  : ""
                              }
                              primaryTypographyProps={{ variant: "caption", fontFamily: "monospace" }}
                              secondaryTypographyProps={{ variant: "caption" }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                  </List>
                  {(relatedSessionsByDevice ?? []).filter((s) => s.sessionId !== session.sessionId).length > 20 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      + more. Use filters on sessions page to see all.
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  No device ID for this session.
                </Typography>
              )}
            </Box>
          )}
          {relatedTab === 1 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {(relatedSessionsByIp ?? []).filter((s) => s.sessionId !== session.sessionId).length} other session(s) from this IP
              </Typography>
              <List dense disablePadding sx={{ maxHeight: 200, overflow: "auto" }}>
                {(relatedSessionsByIp ?? [])
                  .filter((s) => s.sessionId !== session.sessionId)
                  .slice(0, 20)
                  .map((s) => (
                    <ListItem key={s.sessionId} disablePadding>
                      <ListItemButton
                        onClick={() => navigate(`/projects/${session.projectKey}/sessions/${s.sessionId}`)}
                        sx={{ py: 0.25, borderRadius: 1 }}
                      >
                        <ListItemText
                          primary={s.sessionId?.slice(0, 8) + "…"}
                          secondary={
                            s.createdAt
                              ? format(new Date(s.createdAt), "MMM d, h:mm a") +
                                (s.duration != null ? ` · ${formatDuration(s.duration)}` : "")
                              : ""
                          }
                          primaryTypographyProps={{ variant: "caption", fontFamily: "monospace" }}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
              </List>
              {(relatedSessionsByIp ?? []).filter((s) => s.sessionId !== session.sessionId).length > 20 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  + more. Use filters on sessions page to see all.
                </Typography>
              )}
            </Box>
          )}
        </CollapsibleSection>

      <CollapsibleSection
        title="AI Summary"
        defaultOpen={true}
        action={
          <PsychologyIcon sx={{ fontSize: 18, color: "primary.main" }} />
        }
      >
        {summaryLoading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="caption" color="text.secondary">Generating summary…</Typography>
          </Box>
        )}
        {summaryError && !summaryLoading && (
          <Typography variant="caption" color="error">{summaryError}</Typography>
        )}
        {aiSummary && !summaryLoading && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{(() => {
              const raw = aiSummary.narrative;
              if (raw == null) return "—";
              if (typeof raw !== "string") return String(raw);
              const s = raw.trim();
              if (s.startsWith("{") && s.includes('"narrative"')) {
                try {
                  const parsed = JSON.parse(s);
                  if (parsed && typeof parsed.narrative === "string") return parsed.narrative;
                } catch (_) { /* ignore */ }
              }
              return raw;
            })()}</Typography>
            <PropertyRow label="Intent" value={aiSummary.intent || "—"} />
            <PropertyRow label="Emotional score" value={aiSummary.emotionalScore != null ? `${aiSummary.emotionalScore}/10` : "—"} />
            {aiSummary.keyMoment && <PropertyRow label="Key moment" value={aiSummary.keyMoment} />}
            {aiSummary.dropOffReason && <PropertyRow label="Drop-off reason" value={aiSummary.dropOffReason} />}
          </Box>
        )}
        {!aiSummary && !summaryLoading && !summaryError && (
          <Typography variant="caption" color="text.secondary">No summary yet. Open the session to generate one.</Typography>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Session properties"
        defaultOpen={true}
        action={
          <IconButton size="small" title="Show all properties" onClick={(e) => { e.stopPropagation(); setAllPropertiesDialogOpen(true); }}>
            <TuneIcon fontSize="small" />
          </IconButton>
        }
      >
        <PropertyRow
          label="Date"
          value={
            session.createdAt
              ? format(new Date(session.createdAt), "MMMM d, yyyy 'at' h:mm a")
              : "—"
          }
        />
        <PropertyRow label="Device" value={device} icon={<DeviceIcon device={device} os={os} />} />
        <PropertyRow label="Op. system" value={os} icon={<OSIcon os={os} />} />
        <PropertyRow label="Browser" value={browser} icon={<BrowserIcon />} />
        <PropertyRow label="Duration" value={session.duration != null ? formatDuration(session.duration) : "—"} />
        <PropertyRow
          label="Dimensions"
          value={
            m.viewport
              ? `${m.viewport.width}×${m.viewport.height}`
              : m.screen
                ? `${m.screen.width}×${m.screen.height}`
                : "—"
          }
        />
        {session.attributes != null && Object.keys(session.attributes).length > 0 && (
          <PropertyRow
            label="Custom"
            value={Object.entries(session.attributes)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")}
          />
        )}
        <Typography
          component="button"
          variant="caption"
          onClick={() => setAllPropertiesDialogOpen(true)}
          sx={{ color: "primary.main", cursor: "pointer", border: 0, background: "none", mt: 0.5, p: 0, textDecoration: "underline", "&:hover": { opacity: 0.9 } }}
        >
          Show all properties
        </Typography>
      </CollapsibleSection>

      <CollapsibleSection
        title="Activities"
        defaultOpen={true}
        action={
          <IconButton size="small" title="Activity stream">
            <AutoAwesomeIcon fontSize="small" sx={{ color: "primary.main" }} />
          </IconButton>
        }
      >
        <TextField
          size="small"
          placeholder="Search activity"
          value={activitySearch}
          onChange={(e) => setActivitySearch(e.target.value)}
          fullWidth
          sx={{ mb: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterListIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
        <List dense disablePadding sx={{ maxHeight: 320, overflow: "auto" }}>
          {filteredActivities.length === 0 ? (
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="caption" color="text.secondary">
                    {activities.length === 0 ? "No activities" : "No matches"}
                  </Typography>
                }
              />
            </ListItem>
          ) : (
            filteredActivities.map((act, i) => (
              <ListItem
                key={i}
                disablePadding
                sx={{ py: 0.25 }}
                component="div"
              >
                <ListItemButton
                  onClick={() => onSeek?.(act.timeMs)}
                  sx={{
                    py: 0.5,
                    borderRadius: 1,
                    transition: "background 0.25s ease, box-shadow 0.25s ease",
                    "&.Mui-selected": {
                      background: "linear-gradient(135deg, rgba(190,149,250,0.3) 0%, rgba(147,112,219,0.18) 100%)",
                      boxShadow: "inset 0 0 0 1px rgba(190,149,250,0.2)",
                      "&:hover": { background: "linear-gradient(135deg, rgba(190,149,250,0.4) 0%, rgba(147,112,219,0.25) 100%)" },
                    },
                  }}
                  selected={currentTimeMs != null && Math.abs(currentTimeMs - act.timeMs) < 2000}
                >
                  <ActivityIcon type={act.type} />
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="caption" fontWeight={500}>
                          {act.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          at {act.time}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      act.detail ? (
                        <Typography variant="caption" noWrap sx={{ display: "block", maxWidth: 260 }}>
                          {act.detail}
                        </Typography>
                      ) : null
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))
          )}
        </List>
      </CollapsibleSection>

      {pages.length > 0 && (
        <CollapsibleSection title="Pages" defaultOpen={true}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Click to jump to when the URL changed. Exclude URLs to hide them from the list and page navigation.
          </Typography>
          <List dense disablePadding sx={{ maxHeight: 200, overflow: "auto", "& .MuiListItem-root": { py: 0.25 }, "& .MuiListItem-root + .MuiListItem-root": { mt: 0.75 } }}>
            {visiblePages.map((p, i) => (
              <ListItem key={i} disablePadding secondaryAction={typeof onExcludeUrl === "function" ? (
                <IconButton
                  size="small"
                  aria-label="Exclude URL from view"
                  onClick={(e) => { e.stopPropagation(); onExcludeUrl(p.url); }}
                  sx={{ opacity: 0.7 }}
                >
                  <VisibilityOffIcon fontSize="small" />
                </IconButton>
              ) : null}>
                <ListItemButton
                  onClick={() => onSeek?.(p.timeMs)}
                  sx={{
                    py: 0.5,
                    borderRadius: 1,
                    transition: "background 0.25s ease, box-shadow 0.25s ease",
                    "&.Mui-selected": {
                      background: "linear-gradient(135deg, rgba(190,149,250,0.3) 0%, rgba(147,112,219,0.18) 100%)",
                      boxShadow: "inset 0 0 0 1px rgba(190,149,250,0.2)",
                      "&:hover": { background: "linear-gradient(135deg, rgba(190,149,250,0.4) 0%, rgba(147,112,219,0.25) 100%)" },
                    },
                  }}
                  selected={currentTimeMs != null && Math.abs(currentTimeMs - p.timeMs) < 1500}
                >
                  <PublicIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1, flexShrink: 0 }} />
                  <ListItemText
                    primary={
                      <Typography variant="caption" noWrap sx={{ maxWidth: 220 }}>
                        {urlToPathname(p.url)}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {Math.floor(p.timeMs / 1000)}s
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {excludedPageKeys.length > 0 && typeof onUnexcludeUrl === "function" && (
            <CollapsibleSection title={`Excluded (${excludedPageKeys.length})`} defaultOpen={false}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                These pages are hidden from this replay. Save to project settings to prevent recording them in future sessions.
              </Typography>
              <List dense disablePadding sx={{ maxHeight: 160, overflow: "auto", "& .MuiListItem-root + .MuiListItem-root": { mt: 0.75 } }}>
                {excludedPageKeys.map((pageKey, i) => (
                  <ListItem key={i} disablePadding secondaryAction={
                    <IconButton
                      size="small"
                      aria-label="Include URL again"
                      onClick={() => onUnexcludeUrl(pageKey)}
                      sx={{ opacity: 0.8 }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  }>
                    <ListItemText
                      primary={
                        <Typography variant="caption" noWrap sx={{ maxWidth: 220, color: "text.secondary" }}>
                          {urlToPathname(pageKey)}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
              {typeof onSaveExclusions === "function" && (
                <Tooltip title="Add these excluded pages to project settings to prevent recording them in future sessions">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SaveIcon fontSize="small" />}
                    onClick={onSaveExclusions}
                    sx={{ mt: 1.5, fontSize: "0.75rem" }}
                    fullWidth
                  >
                    Save to project exclusions
                  </Button>
                </Tooltip>
              )}
            </CollapsibleSection>
          )}
        </CollapsibleSection>
      )}

      <Dialog open={setupDialogOpen} onClose={() => setSetupDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>How to set up</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Add this script to your site to start recording sessions for this project.
          </Typography>
          {setupSnippet ? (
            <>
              <ToggleButtonGroup
                value={setupIntegrationMode}
                exclusive
                onChange={(_, v) => v != null && setSetupIntegrationMode(v)}
                size="small"
                sx={{ mb: 1.5 }}
              >
                <ToggleButton value="developer" aria-label="I'm a developer">
                  I'm a developer
                </ToggleButton>
                <ToggleButton value="ai" aria-label="I use an AI web builder">
                  I use an AI web builder
                </ToggleButton>
              </ToggleButtonGroup>
              <Box
                component="pre"
                sx={{
                  p: 1.5,
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {setupIntegrationMode === "developer" ? setupSnippet : setupPrompt}
              </Box>
              {setupIntegrationMode === "ai" && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Copy the prompt above and paste it into your AI assistant so it adds the script in a non-blocking way.
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No project key. Open project settings to get the integration script.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialogOpen(false)}>Close</Button>
          {setupSnippet && (
            <Button startIcon={<ContentCopyIcon />} onClick={copySetupSnippet} variant="contained">
              {setupCopied ? "Copied!" : setupIntegrationMode === "developer" ? "Copy script" : "Copy prompt"}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={allPropertiesDialogOpen} onClose={() => setAllPropertiesDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>All session properties</DialogTitle>
        <DialogContent>
          <List dense disablePadding sx={{ maxHeight: 400, overflow: "auto" }}>
            {allPropertiesEntries.map(({ key, value }, i) => (
              <ListItem key={i} disablePadding sx={{ py: 0.5, flexDirection: "column", alignItems: "stretch" }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
                  {key}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.8125rem", wordBreak: "break-all" }} title={value}>
                  {value}
                </Typography>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAllPropertiesDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
