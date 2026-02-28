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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import SettingsIcon from "@mui/icons-material/Settings";
import FilterListIcon from "@mui/icons-material/FilterList";
import CodeIcon from "@mui/icons-material/Code";
import MouseIcon from "@mui/icons-material/Mouse";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import LanguageIcon from "@mui/icons-material/Language";
import { parseDevice, parseOS, parseBrowser, formatDuration } from "../utils/sessionParser";
import { buildActivityList, getPagesFromEvents } from "../utils/activityList";
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

function ActivityIcon({ type }) {
  switch (type) {
    case "click":
      return <MouseIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    case "input":
      return <TouchAppIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    case "custom":
      return <CodeIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    case "url":
      return <LanguageIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1 }} />;
    default:
      return null;
  }
}

export default function RightPanel({ session, events, meta, onSeek, currentTimeMs }) {
  const [activitySearch, setActivitySearch] = useState("");

  const activities = useMemo(() => buildActivityList(events || []), [events]);
  const pages = useMemo(() => getPagesFromEvents(events || []), [events]);
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
        borderLeft: "1px solid",
        borderColor: "divider",
        overflow: "auto",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        boxShadow: (theme) => (theme.palette.mode === "dark" ? "-4px 0 12px rgba(0,0,0,0.25)" : "-2px 0 8px rgba(0,0,0,0.06)"),
      }}
    >
      <CollapsibleSection
        title="User properties"
        defaultOpen={true}
        action={
          <IconButton size="small" title="Show all user details">
            <PersonOutlineIcon fontSize="small" />
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
            <SettingsIcon fontSize="small" />
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
        <Typography
          component="button"
          variant="caption"
          sx={{ color: "primary.main", cursor: "pointer", border: 0, background: "none", mt: 0.5, p: 0 }}
        >
          Show all properties
        </Typography>
      </CollapsibleSection>

      <CollapsibleSection title="Activities" defaultOpen={true}>
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
                  sx={{ py: 0.5, borderRadius: 1 }}
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
            Click to jump to when the URL changed
          </Typography>
          <List dense disablePadding sx={{ maxHeight: 200, overflow: "auto" }}>
            {pages.map((p, i) => (
              <ListItem key={i} disablePadding>
                <ListItemButton
                  onClick={() => onSeek?.(p.timeMs)}
                  sx={{ py: 0.5, borderRadius: 1 }}
                  selected={currentTimeMs != null && Math.abs(currentTimeMs - p.timeMs) < 1500}
                >
                  <LanguageIcon sx={{ fontSize: 16, color: "text.secondary", mr: 1, flexShrink: 0 }} />
                  <ListItemText
                    primary={
                      <Typography variant="caption" noWrap sx={{ maxWidth: 280 }}>
                        {p.url}
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
        </CollapsibleSection>
      )}
    </Box>
  );
}
