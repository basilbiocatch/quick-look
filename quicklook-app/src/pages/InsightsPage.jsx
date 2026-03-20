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
  Rating,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ScienceIcon from "@mui/icons-material/Science";
import { useAuth } from "../contexts/AuthContext";
import ProFeatureGate from "../components/ProFeatureGate";
import { getInsights, patchInsight, postInsightsGenerate, createAbTest } from "../api/quicklookApi";

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
  const { user } = useAuth();
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [patching, setPatching] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolveActualLift, setResolveActualLift] = useState("");
  const [createAbDialogOpen, setCreateAbDialogOpen] = useState(false);
  const [creatingAb, setCreatingAb] = useState(false);

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

  if (user?.plan !== "pro") {
    return (
      <ProFeatureGate
        title="Insights"
        description="AI-powered friction patterns, conversion impact, and suggested fixes. Upgrade to Pro to unlock."
      />
    );
  }

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

  const handlePatchStatus = (insightId, status, extra = {}) => {
    setPatching(true);
    patchInsight(insightId, { status, ...extra })
      .then((res) => {
        if (res.data?.data) {
          setInsights((prev) =>
            prev.map((i) => (i.insightId === insightId ? { ...i, ...res.data.data } : i))
          );
          if (selectedInsight?.insightId === insightId) {
            setSelectedInsight((prev) => (prev ? { ...prev, ...res.data.data } : null));
          }
        }
        setResolveDialogOpen(false);
        setResolveActualLift("");
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to update");
      })
      .finally(() => setPatching(false));
  };

  const handleRateAccuracy = (insightId, rating) => {
    if (rating == null) return;
    setPatching(true);
    patchInsight(insightId, { accuracyRating: rating })
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
        setError(err.response?.data?.error || err.message || "Failed to save rating");
      })
      .finally(() => setPatching(false));
  };

  const handleMarkResolvedClick = () => {
    if (!selectedInsight) return;
    setResolveActualLift("");
    setResolveDialogOpen(true);
  };

  const handleConfirmResolve = () => {
    if (!selectedInsight) return;
    const lift = parseFloat(resolveActualLift, 10);
    const extra = Number.isNaN(lift) ? {} : { actualLift: lift };
    handlePatchStatus(selectedInsight.insightId, "resolved", extra);
  };

  const handleCreateAbTest = () => {
    if (!selectedInsight || !projectKey) return;
    const firstFix = Array.isArray(selectedInsight.suggestedFixes) && selectedInsight.suggestedFixes[0]
      ? selectedInsight.suggestedFixes[0]
      : null;
    const lift = firstFix?.predictedLift || firstFix?.expectedLift;
    setCreatingAb(true);
    createAbTest({
      projectKey,
      insightId: selectedInsight.insightId,
      hypothesis: selectedInsight.rootCause || "",
      changeDescription: firstFix?.description || selectedInsight.rootCause || "",
      expectedLift: lift && typeof lift === "object" ? { min: lift.min, max: lift.max } : undefined,
    })
      .then(() => {
        setCreateAbDialogOpen(false);
        navigate(`/projects/${projectKey}/ab-tests`);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to create A/B test");
      })
      .finally(() => setCreatingAb(false));
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
          <Button
            variant="outlined"
            startIcon={<ScienceIcon />}
            onClick={() => navigate(`/projects/${projectKey}/ab-tests`)}
          >
            A/B Tests
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
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                We predict how much each fix could improve conversion. If you run a test and record the real result in A/B Tests, our predictions get better over time.
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
              {/* Rate accuracy (Phase 7 feedback) */}
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                Rate accuracy
              </Typography>
              <Rating
                name="accuracy"
                value={selectedInsight.accuracyRating ?? 0}
                max={5}
                size="small"
                disabled={patching}
                onChange={(_, v) => handleRateAccuracy(selectedInsight.insightId, v)}
              />
              {selectedInsight.resolvedAt && (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  Resolved {new Date(selectedInsight.resolvedAt).toLocaleDateString()}
                  {selectedInsight.actualLift != null && (
                    <> · Actual lift: {Number(selectedInsight.actualLift).toFixed(1)}%</>
                  )}
                </Typography>
              )}
              <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() =>
                    navigate(`/projects/${projectKey}/sessions`, {
                      state: {
                        insightSessionIds:
                          Array.isArray(selectedInsight.affectedSessions) && selectedInsight.affectedSessions.length > 0
                            ? selectedInsight.affectedSessions
                            : undefined,
                      },
                    })
                  }
                >
                  View sessions
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setCreateAbDialogOpen(true)}
                >
                  Track as A/B test
                </Button>
                {selectedInsight.status === "active" && (
                  <>
                    <Button
                      size="small"
                      color="primary"
                      disabled={patching}
                      onClick={handleMarkResolvedClick}
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
              <Dialog open={createAbDialogOpen} onClose={() => setCreateAbDialogOpen(false)}>
                <DialogTitle>Track as A/B test</DialogTitle>
                <DialogContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    We&apos;ll save this insight and our predicted lift so you can track the experiment. You run the actual A/B test in your own app or tool. When it&apos;s done, go to <strong>A/B Tests</strong> and record the real result—that helps us improve our predictions for you next time.
                  </Typography>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setCreateAbDialogOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={handleCreateAbTest} disabled={creatingAb}>
                    {creatingAb ? "Creating…" : "Create"}
                  </Button>
                </DialogActions>
              </Dialog>
              <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)}>
                <DialogTitle>Mark as resolved</DialogTitle>
                <DialogContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Optional: enter the actual conversion lift (%) you observed (e.g. from an A/B test)
                    to improve future predictions.
                  </Typography>
                  <TextField
                    size="small"
                    label="Actual lift (%)"
                    type="number"
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                    value={resolveActualLift}
                    onChange={(e) => setResolveActualLift(e.target.value)}
                    fullWidth
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={handleConfirmResolve} disabled={patching}>
                    Resolve
                  </Button>
                </DialogActions>
              </Dialog>
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
