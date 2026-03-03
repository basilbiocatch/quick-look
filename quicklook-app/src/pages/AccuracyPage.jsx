import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import Button from "@mui/material/Button";
import PsychologyIcon from "@mui/icons-material/Psychology";
import { getAccuracyMetrics, postModelsRetrain } from "../api/quicklookApi";

export default function AccuracyPage() {
  const { projectKey } = useParams();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retraining, setRetraining] = useState(false);
  const [retrainMessage, setRetrainMessage] = useState(null);

  const fetchMetrics = useCallback(() => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    getAccuracyMetrics(projectKey)
      .then((res) => {
        if (res.data?.data) setMetrics(res.data.data);
        else setMetrics(null);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to load metrics");
        setMetrics(null);
      })
      .finally(() => setLoading(false));
  }, [projectKey]);

  useEffect(() => {
    if (!projectKey) {
      navigate("/", { replace: true });
      return;
    }
    fetchMetrics();
  }, [projectKey, fetchMetrics, navigate]);

  const handleRetrain = () => {
    setRetraining(true);
    setRetrainMessage(null);
    postModelsRetrain(projectKey)
      .then((res) => {
        const msg = res.data?.message ?? (res.data?.trained ? "Model retrained." : "Not enough data to retrain.");
        setRetrainMessage(msg);
        if (res.data?.trained) fetchMetrics();
      })
      .catch((err) => setRetrainMessage(err.response?.data?.error || err.message || "Retrain failed"))
      .finally(() => setRetraining(false));
  };

  if (!projectKey) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <TrendingUpIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h5" fontWeight={600}>
            Accuracy metrics
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchMetrics} disabled={loading}>
          Refresh
        </Button>
        <Button
          variant="outlined"
          startIcon={retraining ? <CircularProgress size={16} /> : <PsychologyIcon />}
          onClick={handleRetrain}
          disabled={retraining}
        >
          {retraining ? "Retraining…" : "Retrain model"}
        </Button>
      </Box>
      {retrainMessage && (
        <Alert severity="info" onClose={() => setRetrainMessage(null)} sx={{ mb: 2 }}>
          {retrainMessage}
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : metrics ? (
        <>
          <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
            <Card variant="outlined" sx={{ minWidth: 140 }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  Resolution rate
                </Typography>
                <Typography variant="h4">
                  {metrics.resolutionRate != null ? `${metrics.resolutionRate}%` : "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {metrics.resolvedCount ?? 0} resolved, {metrics.ignoredCount ?? 0} ignored
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ minWidth: 140 }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  Avg accuracy rating
                </Typography>
                <Typography variant="h4">
                  {metrics.avgAccuracyRating != null ? metrics.avgAccuracyRating.toFixed(1) : "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {metrics.ratingsCount ?? 0} ratings (1–5)
                </Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ minWidth: 140 }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  A/B tests completed
                </Typography>
                <Typography variant="h4">{metrics.abTestsCompleted ?? 0}</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ minWidth: 140 }}>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  Avg lift error
                </Typography>
                <Typography variant="h4">
                  {metrics.avgLiftError != null ? `${metrics.avgLiftError > 0 ? "+" : ""}${metrics.avgLiftError}%` : "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Predicted vs actual
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {Array.isArray(metrics.liftPredictions) && metrics.liftPredictions.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Predicted vs actual lift (completed A/B tests)
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Test</TableCell>
                    <TableCell align="right">Predicted</TableCell>
                    <TableCell align="right">Actual</TableCell>
                    <TableCell align="right">Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metrics.liftPredictions.map((row) => (
                    <TableRow key={row.testId}>
                      <TableCell sx={{ maxWidth: 240 }} title={row.changeDescription}>
                        <Typography noWrap variant="body2">
                          {row.changeDescription || row.testId}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {row.predictedMin != null && row.predictedMax != null
                          ? `${row.predictedMin.toFixed(1)}–${row.predictedMax.toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell align="right">{row.actual != null ? `${row.actual.toFixed(1)}%` : "—"}</TableCell>
                      <TableCell align="right">
                        {row.error != null ? (
                          <Chip
                            size="small"
                            label={`${row.error > 0 ? "+" : ""}${row.error.toFixed(1)}%`}
                            color={row.error > 0 ? "success" : row.error < 0 ? "error" : "default"}
                            variant="outlined"
                          />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            </>
          )}

          {(!metrics.liftPredictions || metrics.liftPredictions.length === 0) && (
            <Typography variant="body2" color="text.secondary">
              Complete A/B tests and record results to see predicted vs actual lift here. Mark insights
              resolved with actual lift and rate accuracy to improve metrics.
            </Typography>
          )}
        </>
      ) : (
        <Typography color="text.secondary">No metrics yet.</Typography>
      )}
    </Box>
  );
}
