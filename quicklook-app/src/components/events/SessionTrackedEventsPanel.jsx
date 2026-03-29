import React, { useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
  Collapse,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { format } from "date-fns";

function formatEventTime(ev) {
  const d = ev.clientTimestamp || ev.createdAt;
  if (!d) return "";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return format(dt, "MMM d, HH:mm:ss");
  } catch {
    return "";
  }
}

/**
 * @param {{ events: Array<{ eventId: string, name: string, properties?: object, clientTimestamp?: string, createdAt?: string }>, loading?: boolean }} props
 */
export default function SessionTrackedEventsPanel({ events = [], loading }) {
  const [openId, setOpenId] = useState(null);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!events.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No product events in this session. Use quicklook.track() in your app.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {events.map((ev) => {
        const hasProps = ev.properties && typeof ev.properties === "object" && Object.keys(ev.properties).length > 0;
        const expanded = openId === ev.eventId;
        return (
          <Box key={ev.eventId} sx={{ borderBottom: "1px solid", borderColor: "divider", py: 0.5 }}>
            <ListItem
              disablePadding
              secondaryAction={
                hasProps ? (
                  <IconButton size="small" edge="end" onClick={() => setOpenId(expanded ? null : ev.eventId)} aria-label="Toggle properties">
                    {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </IconButton>
                ) : null
              }
            >
              <ListItemText
                primary={
                  <Typography component="span" variant="body2" sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>
                    {ev.name}
                  </Typography>
                }
                secondary={formatEventTime(ev)}
              />
            </ListItem>
            {hasProps && (
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{ pl: 1, pr: 1, pb: 1 }}>
                  <Typography variant="caption" component="pre" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.7rem", m: 0 }}>
                    {JSON.stringify(ev.properties, null, 2)}
                  </Typography>
                </Box>
              </Collapse>
            )}
          </Box>
        );
      })}
    </List>
  );
}
