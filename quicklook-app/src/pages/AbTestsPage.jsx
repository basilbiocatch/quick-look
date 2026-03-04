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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ScienceIcon from "@mui/icons-material/Science";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useAuth } from "../contexts/AuthContext";
import ProFeatureGate from "../components/ProFeatureGate";
import { getAbTests, patchAbTest } from "../api/quicklookApi";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
];

export default function AbTestsPage() {
  const { projectKey } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedTest, setSelectedTest] = useState(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [resultsForm, setResultsForm] = useState({
    controlConversion: "",
    variantConversion: "",
    actualLift: "",
    pValue: "",
    sampleSize: "",
  });
  const [patching, setPatching] = useState(false);

  const fetchTests = useCallback(() => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    getAbTests(projectKey, { status: statusFilter || undefined, limit: 50 })
      .then((res) => {
        if (res.data?.data) setTests(res.data.data);
        else setTests([]);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message || "Failed to load A/B tests");
        setTests([]);
      })
      .finally(() => setLoading(false));
  }, [projectKey, statusFilter]);

  useEffect(() => {
    if (!projectKey) {
      navigate("/", { replace: true });
      return;
    }
    fetchTests();
  }, [projectKey, statusFilter, fetchTests, navigate]);

  if (user?.plan !== "pro") {
    return (
      <ProFeatureGate
        title="A/B Tests"
        description="Run experiments with suggested fixes and predicted lift. Upgrade to Pro to create and manage A/B tests."
      />
    );
  }

  const handleStatusChange = (testId, status) => {
    setPatching(true);
    patchAbTest(testId, { status })
      .then((res) => {
        if (res.data?.data) {
          setTests((prev) =>
            prev.map((t) => (t.testId === testId ? { ...t, ...res.data.data } : t))
          );
          if (selectedTest?.testId === testId) setSelectedTest((prev) => (prev ? { ...prev, ...res.data.data } : null));
        }
      })
      .catch((err) => setError(err.response?.data?.error || err.message || "Failed to update"))
      .finally(() => setPatching(false));
  };

  const openResultsDialog = (test) => {
    setSelectedTest(test);
    setResultsForm({
      controlConversion: test.results?.controlConversion ?? "",
      variantConversion: test.results?.variantConversion ?? "",
      actualLift: test.results?.actualLift ?? "",
      pValue: test.results?.pValue ?? "",
      sampleSize: test.results?.sampleSize ?? "",
    });
    setResultsDialogOpen(true);
  };

  const submitResults = () => {
    if (!selectedTest) return;
    const payload = {
      status: "completed",
      results: {
        controlConversion: resultsForm.controlConversion === "" ? undefined : Number(resultsForm.controlConversion),
        variantConversion: resultsForm.variantConversion === "" ? undefined : Number(resultsForm.variantConversion),
        actualLift: resultsForm.actualLift === "" ? undefined : Number(resultsForm.actualLift),
        pValue: resultsForm.pValue === "" ? undefined : Number(resultsForm.pValue),
        sampleSize: resultsForm.sampleSize === "" ? undefined : Number(resultsForm.sampleSize),
      },
    };
    setPatching(true);
    patchAbTest(selectedTest.testId, payload)
      .then((res) => {
        if (res.data?.data) {
          setTests((prev) =>
            prev.map((t) => (t.testId === selectedTest.testId ? { ...t, ...res.data.data } : t))
          );
        }
        setResultsDialogOpen(false);
      })
      .catch((err) => setError(err.response?.data?.error || err.message || "Failed to save results"))
      .finally(() => setPatching(false));
  };

  if (!projectKey) return null;

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <ScienceIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h5" fontWeight={600}>
            A/B Tests
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
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchTests} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }} icon={false}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          What are A/B tests here?
        </Typography>
        <Typography variant="body2" component="span">
          QuickLook doesn&apos;t run your experiments—you run them in your own app or tool. This page is for{" "}
          <strong>tracking</strong> those tests: when you try a fix we suggested, create an A/B test here, run the
          experiment yourself, then come back and <strong>record the actual results</strong>. Those real numbers help us
          improve our &quot;predicted lift&quot; for future suggestions.
        </Typography>
      </Alert>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : tests.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center", color: "text.secondary", px: 2 }}>
            <ScienceIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
            <Typography variant="body1" sx={{ mb: 1 }}>
              No A/B tests yet
            </Typography>
            <Typography variant="body2">
              Go to <strong>Insights</strong>, pick an insight with a suggested fix, and click &quot;Create A/B test&quot;.
              Then run your experiment elsewhere and come back here to record the results—that helps us improve our predictions.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 520, overflow: "auto" }}>
            {tests.map((test) => (
              <CardActionArea
                key={test.testId}
                onClick={() => setSelectedTest(selectedTest?.testId === test.testId ? null : test)}
                sx={{
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  "&:last-child": { borderBottom: 0 },
                }}
              >
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ maxWidth: 280 }}>
                      {test.changeDescription || test.hypothesis || "A/B test"}
                    </Typography>
                    <Chip label={test.status} size="small" variant="outlined" sx={{ height: 20 }} />
                    {test.results?.actualLift != null && (
                      <Chip
                        size="small"
                        label={`Lift: ${Number(test.results.actualLift).toFixed(1)}%`}
                        color="primary"
                        sx={{ height: 20 }}
                      />
                    )}
                  </Box>
                  {test.expectedLift && (test.expectedLift.min != null || test.expectedLift.max != null) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      Expected lift: {[test.expectedLift.min, test.expectedLift.max].filter((x) => x != null).join("–")}%
                    </Typography>
                  )}
                  <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {test.status === "planned" && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(test.testId, "running");
                        }}
                        disabled={patching}
                      >
                        Start test
                      </Button>
                    )}
                    {(test.status === "running" || test.status === "planned") && (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={(e) => {
                          e.stopPropagation();
                          openResultsDialog(test);
                        }}
                        disabled={patching}
                      >
                        Record results
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            ))}
          </Box>
        )}
      </Paper>

      <Dialog open={resultsDialogOpen} onClose={() => setResultsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Record A/B test results</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter what actually happened. We use this to improve our predicted lift for future suggestions.
          </Typography>
          <TextField
            size="small"
            label="Control conversion (%)"
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            value={resultsForm.controlConversion}
            onChange={(e) => setResultsForm((f) => ({ ...f, controlConversion: e.target.value }))}
            fullWidth
            sx={{ mt: 1 }}
          />
          <TextField
            size="small"
            label="Variant conversion (%)"
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            value={resultsForm.variantConversion}
            onChange={(e) => setResultsForm((f) => ({ ...f, variantConversion: e.target.value }))}
            fullWidth
            sx={{ mt: 2 }}
          />
          <TextField
            size="small"
            label="Actual lift (%)"
            type="number"
            inputProps={{ step: 0.01 }}
            value={resultsForm.actualLift}
            onChange={(e) => setResultsForm((f) => ({ ...f, actualLift: e.target.value }))}
            fullWidth
            sx={{ mt: 2 }}
          />
          <TextField
            size="small"
            label="Sample size"
            type="number"
            inputProps={{ min: 0 }}
            value={resultsForm.sampleSize}
            onChange={(e) => setResultsForm((f) => ({ ...f, sampleSize: e.target.value }))}
            fullWidth
            sx={{ mt: 2 }}
          />
          <TextField
            size="small"
            label="p-value"
            type="number"
            inputProps={{ min: 0, max: 1, step: 0.001 }}
            value={resultsForm.pValue}
            onChange={(e) => setResultsForm((f) => ({ ...f, pValue: e.target.value }))}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultsDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submitResults} disabled={patching}>
            Save & complete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
