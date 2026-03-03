import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActionArea,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import AssessmentIcon from "@mui/icons-material/Assessment";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { getReports, getReport, postReportsGenerate } from "../api/quicklookApi";

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
];

export default function ReportsPage() {
  const { projectKey } = useParams();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchReports = useCallback(() => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    getReports(projectKey, { type: typeFilter || undefined, limit: 30 })
      .then((res) => {
        if (res.data?.data) setReports(res.data.data);
        else setReports([]);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to load reports");
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, [projectKey, typeFilter]);

  useEffect(() => {
    if (!projectKey) {
      navigate("/", { replace: true });
      return;
    }
    fetchReports();
  }, [projectKey, typeFilter, fetchReports, navigate]);

  const handleGenerate = (reportType = "weekly") => {
    if (!projectKey) return;
    setGenerating(true);
    setError(null);
    postReportsGenerate(projectKey, { type: reportType })
      .then((res) => {
        if (res.data?.data) {
          setSelectedReport(res.data.data);
          setReports((prev) => [res.data.data, ...prev]);
        }
        fetchReports();
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to generate report");
      })
      .finally(() => setGenerating(false));
  };

  const handleSelectReport = (report) => {
    if (report.reportId === selectedReport?.reportId) return;
    setLoadingReport(true);
    getReport(report.reportId)
      .then((res) => {
        if (res.data?.data) setSelectedReport(res.data.data);
      })
      .catch(() => setSelectedReport(report))
      .finally(() => setLoadingReport(false));
  };

  const formatDate = (d) => {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!projectKey) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <AssessmentIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h5" fontWeight={600}>
            UX Reports
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {TYPE_OPTIONS.map((o) => (
                <MenuItem key={o.value || "all"} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
            onClick={() => handleGenerate("weekly")}
            disabled={generating}
          >
            {generating ? "Generating…" : "Generate report"}
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchReports} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", gap: 3, flexDirection: { xs: "column", md: "row" } }}>
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : reports.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
              <AssessmentIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
              <Typography>
                No reports yet. Click &quot;Generate report&quot; to create a weekly UX insights report.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 560, overflow: "auto" }}>
              {reports.map((report) => (
                <CardActionArea
                  key={report.reportId}
                  onClick={() => handleSelectReport(report)}
                  sx={{
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "&:last-child": { borderBottom: 0 },
                  }}
                >
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {report.title || `${report.type} report`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                      {report.summary ? `${report.summary.slice(0, 120)}…` : formatDate(report.generatedAt)}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {report.type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(report.generatedAt)}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              ))}
            </Box>
          )}
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            width: { xs: "100%", md: 480 },
            flexShrink: 0,
            overflow: "auto",
            maxHeight: 640,
          }}
        >
          {loadingReport ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedReport ? (
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {selectedReport.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                {selectedReport.type} · {formatDate(selectedReport.generatedAt)}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Executive summary
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mb: 2 }}>
                {selectedReport.summary || "—"}
              </Typography>
              <Divider sx={{ my: 2 }} />
              {(selectedReport.sections || []).map((section, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {section.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ whiteSpace: "pre-wrap" }}
                  >
                    {section.content || "—"}
                  </Typography>
                </Box>
              ))}
              {selectedReport.metrics && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Metrics
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sessions: {selectedReport.metrics.totalSessions ?? "—"} · Conversion:{" "}
                    {selectedReport.metrics.conversionRate != null
                      ? `${Number(selectedReport.metrics.conversionRate).toFixed(1)}%`
                      : "—"}
                  </Typography>
                </>
              )}
            </CardContent>
          ) : (
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Select a report to view summary and sections.
              </Typography>
            </CardContent>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
