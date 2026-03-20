import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Drawer,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  alpha,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import BugReportIcon from "@mui/icons-material/BugReport";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { format, parseISO } from "date-fns";
import { getIssues, getIssueDetail, getIssuesDaily } from "../api/quicklookApi";

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "error", label: "Errors only" },
  { value: "warning", label: "Warnings only" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "javascript_error", label: "JS errors" },
  { value: "javascript_warning", label: "JS warnings" },
];

const SEGMENT_OPTIONS = [
  { value: "all", label: "All users" },
  { value: "checkout", label: "Checkout users" },
];

const SORT_OPTIONS = [
  { value: "occurrences", label: "Occurrences" },
  { value: "sessions", label: "Affected sessions" },
  { value: "lastSeen", label: "Last seen" },
];

function formatDate(d) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "MMM d, yyyy · HH:mm");
}

function formatShortDate(d) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, "MMM d");
}

function truncate(str, maxLen = 100) {
  if (!str) return "";
  const s = String(str);
  return s.length <= maxLen ? s : s.slice(0, maxLen) + "…";
}

export default function IssuesPage() {
  const { projectKey } = useParams();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("occurrences");
  const [detailIssueId, setDetailIssueId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dailyData, setDailyData] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const fetchIssues = useCallback(() => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    const params = { limit: 200 };
    if (severityFilter) params.severity = severityFilter;
    if (typeFilter) params.type = typeFilter;
    if (segmentFilter && segmentFilter !== "all") params.segment = segmentFilter;
    if (dateFrom) params.from = new Date(dateFrom).toISOString();
    if (dateTo) params.to = new Date(dateTo + "T23:59:59.999Z").toISOString();
    getIssues(projectKey, params)
      .then((res) => setIssues(res.data?.data ?? []))
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to load issues");
        setIssues([]);
      })
      .finally(() => setLoading(false));
  }, [projectKey, severityFilter, typeFilter, segmentFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!projectKey) {
      navigate("/", { replace: true });
      return;
    }
    fetchIssues();
  }, [projectKey, severityFilter, typeFilter, segmentFilter, dateFrom, dateTo, fetchIssues, navigate]);

  useEffect(() => {
    if (!detailIssueId || !projectKey) {
      setDetailData(null);
      return;
    }
    setDetailLoading(true);
    getIssueDetail(projectKey, detailIssueId, { days: 30 })
      .then((res) => setDetailData(res.data?.data ?? null))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [projectKey, detailIssueId]);

  useEffect(() => {
    if (!projectKey) return;
    setDailyLoading(true);
    const params = { days: 30 };
    if (segmentFilter && segmentFilter !== "all") params.segment = segmentFilter;
    getIssuesDaily(projectKey, params)
      .then((res) => setDailyData(res.data?.data ?? []))
      .catch(() => setDailyData([]))
      .finally(() => setDailyLoading(false));
  }, [projectKey, segmentFilter]);

  const filteredAndSortedIssues = useMemo(() => {
    let list = [...issues];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => (i.message || "").toLowerCase().includes(q) || (i.signature || "").toLowerCase().includes(q));
    }
    if (sortBy === "occurrences") list.sort((a, b) => (b.occurrenceCount || 0) - (a.occurrenceCount || 0));
    else if (sortBy === "sessions") list.sort((a, b) => (b.affectedSessionCount || 0) - (a.affectedSessionCount || 0));
    else if (sortBy === "lastSeen") list.sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));
    return list;
  }, [issues, search, sortBy]);

  const paginatedIssues = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredAndSortedIssues.slice(start, start + rowsPerPage);
  }, [filteredAndSortedIssues, page, rowsPerPage]);

  const handlePageChange = (_, newPage) => setPage(newPage);
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    setPage(0);
  }, [search, severityFilter, typeFilter, segmentFilter, dateFrom, dateTo, sortBy]);

  useEffect(() => {
    if (filteredAndSortedIssues.length > 0 && page * rowsPerPage >= filteredAndSortedIssues.length) {
      setPage(0);
    }
  }, [filteredAndSortedIssues.length, page, rowsPerPage]);

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const totalErrors = errors.reduce((s, i) => s + (i.occurrenceCount || 0), 0);
  const totalWarnings = warnings.reduce((s, i) => s + (i.occurrenceCount || 0), 0);
  const totalOccurrences = totalErrors + totalWarnings;
  const errorsPct = totalOccurrences ? Math.round((totalErrors / totalOccurrences) * 100) : 0;

  const handleCopyMessage = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {});
  };

  if (!projectKey) return null;

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: 2.5 }}>
      {/* Header */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            }}
          >
            <BugReportIcon sx={{ fontSize: 22, color: "primary.main" }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.2 }}>
              Issues
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Errors & warnings from session replays
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={fetchIssues} disabled={loading} size="small" aria-label="Refresh" sx={{ color: "text.secondary" }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }} variant="outlined">
          {error}
        </Alert>
      )}

      {/* Summary + mini chart */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <Paper variant="outlined" sx={{ flex: "1 1 200px", minWidth: 0, p: 2, borderRadius: 2 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
            <Typography variant="h4" fontWeight={700} color="error.main">
              {loading ? "—" : totalErrors.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              errors
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {errors.length} distinct · {segmentFilter === "checkout" ? "checkout users" : "all users"}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ flex: "1 1 200px", minWidth: 0, p: 2, borderRadius: 2 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
            <Typography variant="h4" fontWeight={700} color="warning.main">
              {loading ? "—" : totalWarnings.toLocaleString()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              warnings
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {warnings.length} distinct · {segmentFilter === "checkout" ? "checkout users" : "all users"}
          </Typography>
        </Paper>
        {!loading && totalOccurrences > 0 && (
          <Paper variant="outlined" sx={{ flex: "2 1 280px", minWidth: 0, p: 2, borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Errors vs warnings
            </Typography>
            <Box sx={{ display: "flex", height: 8, borderRadius: 1, overflow: "hidden", bgcolor: "action.hover" }}>
              <Box sx={{ width: `${errorsPct}%`, bgcolor: "error.main", transition: "width 0.3s ease" }} />
              <Box sx={{ width: `${100 - errorsPct}%`, bgcolor: "warning.main", transition: "width 0.3s ease" }} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {errorsPct}% errors
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {100 - errorsPct}% warnings
              </Typography>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Errors per day graph */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2.5 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
          Errors per day
        </Typography>
        {dailyLoading ? (
          <Box sx={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : dailyData.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
            No daily data in the last 30 days
          </Typography>
        ) : (
          <Box sx={{ overflow: "auto" }}>
            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, height: 120, minWidth: "min-content" }}>
              {dailyData.map((day) => {
                const max = Math.max(1, ...dailyData.map((d) => d.errors + d.warnings));
                const total = day.errors + day.warnings;
                const errH = total ? (day.errors / max) * 100 : 0;
                const warnH = total ? (day.warnings / max) * 100 : 0;
                const label = day.date ? format(parseISO(day.date), "MMM d") : "";
                return (
                  <Tooltip key={day.date} title={`${label}: ${day.errors} errors, ${day.warnings} warnings`}>
                    <Box sx={{ flex: "1 1 0", minWidth: 8, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-end" }}>
                      <Box
                        sx={{
                          height: `${warnH}%`,
                          minHeight: day.warnings ? 2 : 0,
                          bgcolor: "warning.main",
                          borderRadius: "2px 2px 0 0",
                          opacity: 0.9,
                        }}
                      />
                      <Box
                        sx={{
                          height: `${errH}%`,
                          minHeight: day.errors ? 2 : 0,
                          bgcolor: "error.main",
                          borderRadius: errH > 0 && day.warnings === 0 ? "2px 2px 0 0" : 0,
                          opacity: 0.9,
                        }}
                      />
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5, px: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {dailyData[0]?.date ? format(parseISO(dailyData[0].date), "MMM d") : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {dailyData[dailyData.length - 1]?.date ? format(parseISO(dailyData[dailyData.length - 1].date), "MMM d") : ""}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: "wrap" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: "error.main" }} />
                <Typography variant="caption" color="text.secondary">Errors</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: "warning.main" }} />
                <Typography variant="caption" color="text.secondary">Warnings</Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Filters row */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 1.5,
          mb: 2,
        }}
      >
        <TextField
          size="small"
          placeholder="Search message…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: "100%", sm: 220 }, "& .MuiInputBase-root": { borderRadius: 2 } }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }} variant="outlined">
          <InputLabel>Severity</InputLabel>
          <Select value={severityFilter} label="Severity" onChange={(e) => setSeverityFilter(e.target.value)} sx={{ borderRadius: 2 }}>
            {SEVERITY_OPTIONS.map((o) => (
              <MenuItem key={o.value || "all"} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }} variant="outlined">
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)} sx={{ borderRadius: 2 }}>
            {TYPE_OPTIONS.map((o) => (
              <MenuItem key={o.value || "all"} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }} variant="outlined">
          <InputLabel>Segment</InputLabel>
          <Select value={segmentFilter} label="Segment" onChange={(e) => setSegmentFilter(e.target.value)} sx={{ borderRadius: 2 }}>
            {SEGMENT_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField size="small" type="date" label="From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} slotProps={{ input: { sx: { borderRadius: 2 } } }} sx={{ width: 130 }} />
        <TextField size="small" type="date" label="To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} slotProps={{ input: { sx: { borderRadius: 2 } } }} sx={{ width: 130 }} />
        <FormControl size="small" sx={{ minWidth: 140 }} variant="outlined">
          <InputLabel>Sort by</InputLabel>
          <Select value={sortBy} label="Sort by" onChange={(e) => setSortBy(e.target.value)} sx={{ borderRadius: 2 }}>
            {SORT_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Table */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5, py: 1.25 }}>
                  Severity
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5, py: 1.25 }}>
                  Message
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5, py: 1.25 }}>
                  Count
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5, py: 1.25 }}>
                  Sessions
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5, py: 1.25 }}>
                  First seen
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5, py: 1.25 }}>
                  Last seen
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={28} />
                  </TableCell>
                </TableRow>
              ) : filteredAndSortedIssues.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
                    <BugReportIcon sx={{ fontSize: 36, opacity: 0.4, display: "block", mx: "auto", mb: 1 }} />
                    <Typography variant="body2">
                      {issues.length === 0
                        ? "No issues yet. Data is aggregated by the analytics job from session replays."
                        : "No issues match your filters or search."}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedIssues.map((row) => (
                  <TableRow
                    key={row.issueId}
                    hover
                    sx={{
                      cursor: "pointer",
                      "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
                    }}
                    onClick={() => setDetailIssueId(row.issueId)}
                  >
                    <TableCell sx={{ py: 1.25 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {row.severity === "error" ? (
                          <ErrorIcon sx={{ fontSize: 16, color: "error.main" }} />
                        ) : (
                          <WarningIcon sx={{ fontSize: 16, color: "warning.main" }} />
                        )}
                        <Typography variant="caption" fontWeight={500} color={row.severity === "error" ? "error.main" : "warning.main"}>
                          {row.severity === "error" ? "Error" : "Warning"}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", fontFamily: "monospace", fontSize: "0.8125rem", py: 1.25 }} title={row.message}>
                      {truncate(row.message, 72)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", py: 1.25 }}>
                      {(row.occurrenceCount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", py: 1.25 }}>
                      {(row.affectedSessionCount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8125rem", color: "text.secondary", py: 1.25 }}>
                      {formatShortDate(row.firstSeen)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8125rem", color: "text.secondary", py: 1.25 }}>
                      {formatShortDate(row.lastSeen)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {!loading && filteredAndSortedIssues.length > 0 && (
          <TablePagination
            component="div"
            count={filteredAndSortedIssues.length}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="Rows:"
            sx={{
              borderTop: 1,
              borderColor: "divider",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.02),
              "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows": { mt: 0, mb: 0 },
            }}
          />
        )}
      </Paper>

      {/* Detail drawer */}
      <Drawer
        anchor="right"
        open={Boolean(detailIssueId)}
        onClose={() => setDetailIssueId(null)}
        slotProps={{ backdrop: { sx: { bgcolor: "rgba(0,0,0,0.2)" } } }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 460 },
            maxWidth: "100%",
            borderRadius: 0,
            boxShadow: (t) => t.shadows[8],
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Issue detail
            </Typography>
            <IconButton size="small" onClick={() => setDetailIssueId(null)} aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
            {detailLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : detailData?.issue ? (
              <>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                  <Box
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: detailData.issue.severity === "error" ? "error.main" : "warning.main",
                      color: "background.paper",
                    }}
                  >
                    <Typography variant="caption" fontWeight={600}>
                      {detailData.issue.severity === "error" ? "Error" : "Warning"}
                    </Typography>
                  </Box>
                  <Tooltip title="Copy">
                    <IconButton size="small" onClick={() => handleCopyMessage(detailData.issue.message)}>
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography
                  component="pre"
                  sx={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "monospace",
                    fontSize: "0.8125rem",
                    bgcolor: "action.hover",
                    p: 1.5,
                    borderRadius: 1,
                    mb: 2,
                    maxHeight: 120,
                    overflow: "auto",
                  }}
                >
                  {detailData.issue.message || "—"}
                </Typography>

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Occurrences over time
                </Typography>
                {detailData.occurrencesOverTime?.length > 0 ? (
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.5, height: 100 }}>
                      {detailData.occurrencesOverTime.map(({ date, count }) => {
                        const max = Math.max(...detailData.occurrencesOverTime.map((o) => o.count), 1);
                        const h = (count / max) * 100;
                        return (
                          <Tooltip key={date} title={`${date}: ${count}`}>
                            <Box
                              sx={{
                                flex: 1,
                                minWidth: 6,
                                height: `${h}%`,
                                bgcolor: detailData.issue.severity === "error" ? "error.main" : "warning.main",
                                borderRadius: 0.5,
                                opacity: 0.9,
                                transition: "height 0.2s ease",
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {detailData.occurrencesOverTime[0]?.date}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {detailData.occurrencesOverTime[detailData.occurrencesOverTime.length - 1]?.date}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    No data in range.
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Affected sessions
                </Typography>
                {detailData.affectedSessions?.length > 0 ? (
                  <Box sx={{ "& .MuiTableRow-root:hover": { bgcolor: "action.hover" } }}>
                    <Table size="small">
                      <TableBody>
                        {detailData.affectedSessions.slice(0, 30).map((s) => (
                          <TableRow key={s.sessionId}>
                            <TableCell sx={{ py: 0.75, border: 0 }}>
                              <Box
                                component="button"
                                onClick={() => {
                                  setDetailIssueId(null);
                                  navigate(`/sessions/${s.sessionId}`);
                                }}
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                  fontFamily: "monospace",
                                  fontSize: "0.8125rem",
                                  color: "primary.main",
                                  bg: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  p: 0,
                                  "&:hover": { textDecoration: "underline" },
                                }}
                              >
                                {String(s.sessionId).slice(0, 14)}…
                                <OpenInNewIcon sx={{ fontSize: 14 }} />
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary", py: 0.75, border: 0 }} align="right">
                              {formatShortDate(s.timestamp)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {detailData.affectedSessions.length > 30 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        Showing 30 of {detailData.affectedSessions.length}
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No sessions in range.
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Select an issue to view details.
              </Typography>
            )}
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
