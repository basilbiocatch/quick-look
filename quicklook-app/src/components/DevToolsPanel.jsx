import React, { useMemo, useState } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
  Slide,
  IconButton,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";

function formatTimeMs(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Extract console events: type 5, data.tag === "ql_console" */
export function getConsoleEvents(events, baseTime) {
  if (!Array.isArray(events)) return [];
  const t0 = baseTime ?? events[0]?.timestamp ?? 0;
  return events
    .filter((e) => Number(e.type) === 5 && e.data?.tag === "ql_console" && e.data?.payload)
    .map((e) => ({
      level: e.data.payload.level || "log",
      args: e.data.payload.args ?? "",
      timeMs: (e.timestamp || 0) - t0,
      timeStr: formatTimeMs((e.timestamp || 0) - t0),
    }));
}

/** Extract network events: type 5, data.tag === "ql_network" */
export function getNetworkEvents(events, baseTime) {
  if (!Array.isArray(events)) return [];
  const t0 = baseTime ?? events[0]?.timestamp ?? 0;
  return events
    .filter((e) => Number(e.type) === 5 && e.data?.tag === "ql_network" && e.data?.payload)
    .map((e) => ({
      method: e.data.payload.method || "GET",
      url: e.data.payload.url ?? "",
      status: e.data.payload.status ?? 0,
      duration: e.data.payload.duration ?? 0,
      responseSize: e.data.payload.responseSize ?? 0,
      timeMs: (e.timestamp || 0) - t0,
      timeStr: formatTimeMs((e.timestamp || 0) - t0),
    }));
}

function ConsoleIcon({ level }) {
  switch (level) {
    case "error":
      return <ErrorIcon sx={{ fontSize: 14, color: "error.main", mr: 0.5 }} />;
    case "warn":
      return <WarningIcon sx={{ fontSize: 14, color: "warning.main", mr: 0.5 }} />;
    case "info":
      return <InfoIcon sx={{ fontSize: 14, color: "info.main", mr: 0.5 }} />;
    default:
      return null;
  }
}

const LEVEL_COLORS = {
  error: "error.main",
  warn: "warning.main",
  info: "info.main",
  log: "text.secondary",
};

export default function DevToolsPanel({ open, onClose, events }) {
  const [tab, setTab] = useState(0);
  const [consoleFilter, setConsoleFilter] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");

  const baseTime = events[0]?.timestamp ?? 0;
  const consoleEvents = useMemo(() => getConsoleEvents(events, baseTime), [events, baseTime]);
  const networkEvents = useMemo(() => getNetworkEvents(events, baseTime), [events, baseTime]);

  const filteredConsole = useMemo(() => {
    if (!consoleFilter.trim()) return consoleEvents;
    const q = consoleFilter.toLowerCase();
    return consoleEvents.filter(
      (e) => e.level.toLowerCase().includes(q) || (e.args && String(e.args).toLowerCase().includes(q))
    );
  }, [consoleEvents, consoleFilter]);

  const filteredNetwork = useMemo(() => {
    if (!networkFilter.trim()) return networkEvents;
    const q = networkFilter.toLowerCase();
    return networkEvents.filter(
      (e) =>
        (e.url && e.url.toLowerCase().includes(q)) ||
        (e.method && e.method.toLowerCase().includes(q))
    );
  }, [networkEvents, networkFilter]);

  const content = (
    <Paper
      elevation={8}
      sx={{
        height: 380,
        maxHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderBottom: "none",
        borderRadius: "12px 12px 0 0",
        boxShadow: (theme) =>
          theme.palette.mode === "dark" ? "0 -4px 20px rgba(0,0,0,0.5)" : "0 -4px 20px rgba(0,0,0,0.15)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", px: 1, py: 0.5, borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 40 }}>
          <Tab label="Console" id="devtools-tab-0" aria-controls="devtools-panel-0" />
          <Tab label="Network" id="devtools-tab-1" aria-controls="devtools-panel-1" />
        </Tabs>
        <IconButton size="small" onClick={onClose} aria-label="Close DevTools">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Console tab */}
      <Box
        role="tabpanel"
        id="devtools-panel-0"
        aria-labelledby="devtools-tab-0"
        sx={{
          flex: 1,
          minHeight: 0,
          display: tab === 0 ? "flex" : "none",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 1, py: 0.5 }}>
          <TextField
            size="small"
            placeholder="Filter"
            value={consoleFilter}
            onChange={(e) => setConsoleFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiInputBase-root": { fontSize: "0.8125rem" }, maxWidth: 280 }}
          />
        </Box>
        <Box sx={{ flex: 1, overflow: "auto", px: 1, pb: 1, fontFamily: "monospace", fontSize: "0.8125rem" }}>
          {filteredConsole.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {consoleEvents.length === 0 ? "No console messages recorded." : "No messages match the filter."}
            </Typography>
          ) : (
            filteredConsole.map((entry, i) => (
              <Box
                key={i}
                sx={{
                  py: 0.25,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 0.5,
                }}
              >
                <ConsoleIcon level={entry.level} />
                <Typography component="span" sx={{ color: LEVEL_COLORS[entry.level] || "text.primary", flexShrink: 0 }}>
                  [{entry.timeStr}]
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    color: LEVEL_COLORS[entry.level] || "text.primary",
                    wordBreak: "break-all",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {entry.args || "(empty)"}
                </Typography>
              </Box>
            ))
          )}
        </Box>
      </Box>

      {/* Network tab */}
      <Box
        role="tabpanel"
        id="devtools-panel-1"
        aria-labelledby="devtools-tab-1"
        sx={{
          flex: 1,
          minHeight: 0,
          display: tab === 1 ? "flex" : "none",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 1, py: 0.5 }}>
          <TextField
            size="small"
            placeholder="Filter by URL or method"
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiInputBase-root": { fontSize: "0.8125rem" }, maxWidth: 320 }}
          />
        </Box>
        <TableContainer sx={{ flex: 1, overflow: "auto", fontSize: "0.8125rem" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Method</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Size</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>URL</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredNetwork.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      {networkEvents.length === 0 ? "No network requests recorded." : "No requests match the filter."}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredNetwork.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{row.timeStr}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{row.method}</TableCell>
                    <TableCell
                      sx={{
                        fontFamily: "monospace",
                        color: row.status >= 400 ? "error.main" : row.status >= 300 ? "warning.main" : "text.primary",
                      }}
                    >
                      {row.status}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{row.duration} ms</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{row.responseSize}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }} title={row.url}>
                      {row.url}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Paper>
  );

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit timeout={300}>
      <Box
        data-ql-block
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {content}
      </Box>
    </Slide>
  );
}

export { formatTimeMs };
