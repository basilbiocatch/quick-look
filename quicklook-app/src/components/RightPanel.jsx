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
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SaveIcon from "@mui/icons-material/Save";
import { parseDevice, parseOS, parseBrowser, formatDuration } from "../utils/sessionParser";
import { buildActivityList, getPagesFromEvents, urlPageKey } from "../utils/activityList";
import { format } from "date-fns";
import PropertyRow from "./PropertyRow";

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

export default function RightPanel({ session, events, meta, onSeek, currentTimeMs, excludedUrls = [], onExcludeUrl, onUnexcludeUrl, onSaveExclusions }) {
  const [activitySearch, setActivitySearch] = useState("");

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
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          How to set up
        </Typography>
        <PropertyRow label="Total events" value={String(eventCount)} />
        <PropertyRow label="User's sessions" value="1/1" />
        <Typography
          component="button"
          variant="caption"
          sx={{ color: "primary.main", cursor: "pointer", border: 0, background: "none", mt: 0.5, p: 0 }}
        >
          Show all sessions
        </Typography>
      </CollapsibleSection>

      <CollapsibleSection
        title="Session properties"
        defaultOpen={true}
        action={
          <IconButton size="small" title="Show all properties">
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
        <PropertyRow label="Device" value={device} />
        <PropertyRow label="Op. system" value={os} />
        <PropertyRow label="Browser" value={browser} />
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
          sx={{ color: "primary.main", cursor: "pointer", border: 0, background: "none", mt: 0.5, p: 0 }}
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
    </Box>
  );
}
