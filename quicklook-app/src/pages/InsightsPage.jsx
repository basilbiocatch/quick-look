import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Chip,
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
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import PeopleIcon from "@mui/icons-material/People";
import { getInsights, patchInsight, postInsightsGenerate } from "../api/quicklookApi";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
];

function formatFrictionType(type) {
  if (!type) return "Friction";
  return String(type)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InsightsPage() {
  const { projectKey } = useParams();
  const navigate = useNavigate();
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [patching, setPatching] = useState(false);

  const fetchInsights = useCallback(() => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    getInsights(projectKey, { status: statusFilter || undefined, limit: 50 })
      .then((res) => {
        if (res.data?.data) setInsights(res.data.data);
        else setInsights([]);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to load insights");
        setInsights([]);
      })
      .finally(() => setLoading(false));
  }, [projectKey, statusFilter]);

  useEffect(() => {
    if (!projectKey) {
      navigate("/", { replace: true });
      return;
    }
    fetchInsights();
  }, [projectKey, statusFilter, fetchInsights, navigate]);

  const handleGenerate = () => {
    if (!projectKey) return;
    setGenerating(true);
    setError(null);
    postInsightsGenerate(projectKey)
      .then(() => fetchInsights())
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to generate insights");
      })
      .finally(() => setGenerating(false));
  };

  const handlePatchStatus = (insightId, status) => {
    setPatching(true);
    patchInsight(insightId, { status })
      .then((res) => {
        if (res.data?.data) {
          setInsights((prev) =>
            prev.map((i) => (i.insightId === insightId ? { ...i, ...res.data.data } : i))
          );
          if (selectedInsight?.insightId === insightId) {
            setSelectedInsight((prev) => (prev ? { ...prev, ...res.data.data } : null));
          }
        }
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to update");
      })
      .finally(() => setPatching(false));
  };

  const criticalCount = insights.filter(
    (i) => i.status === "active" && (i.severity === "high" || i.severity === "critical")
  ).length;
  const totalAffected = insights.reduce(
    (sum, i) => sum + (Array.isArray(i.affectedSessions) ? i.affectedSessions.length : 0),
    0
  );

  if (!projectKey) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <LightbulbIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h5" fontWeight={600}>
            AI Insights
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value || "all"} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={generating ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? "Generating…" : "Generate insights"}
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchInsights} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Summary cards */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Card variant="outlined" sx={{ minWidth: 140 }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              Critical issues
            </Typography>
            <Typography variant="h4" color={criticalCount > 0 ? "error.main" : "text.primary"}>
              {criticalCount}
            </Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ minWidth: 140 }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              Affected sessions
            </Typography>
            <Typography variant="h4">{totalAffected}</Typography>
          </CardContent>
        </Card>
        <Card variant="outlined" sx={{ minWidth: 140 }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">
              Total insights
            </Typography>
            <Typography variant="h4">{insights.length}</Typography>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: "flex", gap: 3, flexDirection: { xs: "column", md: "row" } }}>
        {/* List */}
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : insights.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center", color: "text.secondary" }}>
              <LightbulbIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
              <Typography>
                No insights yet. Run &quot;Generate insights&quot; to analyze friction patterns and
                conversion impact.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 560, overflow: "auto" }}>
              {insights.map((insight) => (
                <CardActionArea
                  key={insight.insightId}
                  onClick={() => setSelectedInsight(insight)}
                  sx={{
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "&:last-child": { borderBottom: 0 },
                  }}
                >
                  <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {formatFrictionType(insight.frictionType)}
                      </Typography>
                      <Chip
                        label={insight.severity || "—"}
                        size="small"
                        color={
                          insight.severity === "high" || insight.severity === "critical"
                            ? "error"
                            : insight.severity === "medium"
                              ? "warning"
                              : "default"
                        }
                        sx={{ height: 20 }}
                      />
                      <Chip label={insight.status} size="small" variant="outlined" sx={{ height: 20 }} />
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                      {insight.page && insight.page !== "unknown" ? insight.page : "—"}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Impact:{" "}
                        {insight.impact?.conversionDrop != null
                          ? `${Number(insight.impact.conversionDrop).toFixed(1)}%`
                          : "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Affected: {Array.isArray(insight.affectedSessions) ? insight.affectedSessions.length : 0}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              ))}
            </Box>
          )}
        </Paper>

        {/* Detail panel */}
        <Paper
          variant="outlined"
          sx={{
            width: { xs: "100%", md: 380 },
            flexShrink: 0,
            overflow: "auto",
            maxHeight: 600,
          }}
        >
          {selectedInsight ? (
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {formatFrictionType(selectedInsight.frictionType)}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                <Chip label={selectedInsight.severity} size="small" color="primary" />
                <Chip label={selectedInsight.status} size="small" variant="outlined" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Page: {selectedInsight.page && selectedInsight.page !== "unknown" ? selectedInsight.page : "—"}
              </Typography>
              {selectedInsight.impact && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Conversion drop:{" "}
                    {selectedInsight.impact.conversionDrop != null
                      ? `${Number(selectedInsight.impact.conversionDrop).toFixed(1)}%`
                      : "—"}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Affected sessions: {selectedInsight.impact.affectedUserCount ?? selectedInsight.affectedSessions?.length ?? 0}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Root cause
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {selectedInsight.rootCause || "—"}
              </Typography>
              {/* Suggested fixes (A/B ideas) – always show section */}
              <Typography
                variant="subtitle2"
                color="text.secondary"
                gutterBottom
                sx={{ mt: 2 }}
              >
                Suggested fixes (A/B ideas)
              </Typography>
              {Array.isArray(selectedInsight.suggestedFixes) &&
              selectedInsight.suggestedFixes.length > 0 ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mt: 1 }}>
                  {selectedInsight.suggestedFixes.map((fix, idx) => {
                    const lift = fix.predictedLift || fix.expectedLift || {};
                    const minLift = Number(lift.min);
                    const maxLift = Number(lift.max);
                    const hasLift = !Number.isNaN(minLift) || !Number.isNaN(maxLift);
                    const liftStr =
                      hasLift
                        ? `${minLift.toFixed(1)}–${maxLift.toFixed(1)}%`
                        : "—";
                    const conf = fix.confidence != null ? `${Math.round(Number(fix.confidence) * 100)}%` : "—";
                    const priority = fix.priority || "medium";
                    return (
                      <Paper
                        key={idx}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          backgroundColor:
                            priority === "high"
                              ? "action.hover"
                              : "background.paper",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {fix.description || "—"}
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1.5,
                            mt: 1,
                            flexWrap: "wrap",
                          }}
                        >
                          {hasLift && (
                            <Chip
                              size="small"
                              label={`Predicted lift: ${liftStr}`}
                              color="primary"
                              variant="outlined"
                              sx={{ height: 22 }}
                            />
                          )}
                          {conf !== "—" && (
                            <Chip
                              size="small"
                              label={`Confidence: ${conf}`}
                              variant="outlined"
                              sx={{ height: 22 }}
                            />
                          )}
                          <Chip
                            size="small"
                            label={priority}
                            color={
                              priority === "high"
                                ? "error"
                                : priority === "medium"
                                  ? "warning"
                                  : "default"
                            }
                            sx={{ height: 22 }}
                          />
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  No suggested fixes for this insight yet. Run &quot;Generate insights&quot; again
                  (with the analytics service updated) to get A/B fix suggestions and predicted lift.
                </Typography>
              )}
              <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/projects/${projectKey}/sessions`)}
                >
                  View sessions
                </Button>
                {selectedInsight.status === "active" && (
                  <>
                    <Button
                      size="small"
                      color="primary"
                      disabled={patching}
                      onClick={() => handlePatchStatus(selectedInsight.insightId, "resolved")}
                    >
                      Mark resolved
                    </Button>
                    <Button
                      size="small"
                      disabled={patching}
                      onClick={() => handlePatchStatus(selectedInsight.insightId, "ignored")}
                    >
                      Ignore
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          ) : (
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Select an insight to see details, root cause, and actions.
              </Typography>
            </CardContent>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
