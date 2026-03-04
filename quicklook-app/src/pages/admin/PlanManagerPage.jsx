import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import SyncIcon from "@mui/icons-material/Sync";
import BarChartIcon from "@mui/icons-material/BarChart";
import FlagIcon from "@mui/icons-material/Flag";
import {
  getAdminPlans,
  createPlan,
  updatePlan,
  activatePlan,
  deactivatePlan,
  syncPlanToStripe,
  getExperiments,
  createExperiment,
  getExperiment,
  updateExperiment,
  getExperimentResults,
  concludeExperiment,
} from "../../api/adminApi";

const TAB_PLANS = 0;
const TAB_EXPERIMENTS = 1;

function PlansTab({ plans, loading, error, onRefresh }) {
  const [editModal, setEditModal] = useState(null);
  const [createModal, setCreateModal] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [syncing, setSyncing] = useState(null);

  const handleOpenEdit = (plan) => {
    setEditModal(plan);
    setJsonText(typeof plan?.config === "object" ? JSON.stringify(plan.config, null, 2) : JSON.stringify(plan || {}, null, 2));
    setSaveError("");
  };

  const handleCloseEdit = () => {
    setEditModal(null);
    setJsonText("");
    setSaveError("");
  };

  const handleSaveEdit = async () => {
    if (!editModal?.id && !createModal) return;
    setSaveError("");
    setSaving(true);
    try {
      let payload;
      try {
        payload = JSON.parse(jsonText);
      } catch (e) {
        setSaveError("Invalid JSON");
        return;
      }
      if (createModal) {
        await createPlan(payload);
        setCreateModal(false);
      } else {
        await updatePlan(editModal.id, payload);
        setEditModal(null);
      }
      setJsonText("");
      setSaveError("");
      onRefresh();
    } catch (err) {
      setSaveError(err.response?.data?.error || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOpen = () => {
    setCreateModal(true);
    setEditModal(null);
    setJsonText(JSON.stringify({ tier: "pro", displayName: "Pro", active: true }, null, 2));
    setSaveError("");
  };

  const handleCreateClose = () => {
    setCreateModal(false);
    setJsonText("");
    setSaveError("");
  };

  const handleToggleActive = async (plan) => {
    if (!plan?.id) return;
    setToggling(plan.id);
    try {
      if (plan.active) {
        await deactivatePlan(plan.id);
      } else {
        await activatePlan(plan.id);
      }
      onRefresh();
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  };

  const handleSync = async (planId) => {
    setSyncing(planId);
    try {
      await syncPlanToStripe(planId);
      onRefresh();
    } finally {
      setSyncing(null);
    }
  };

  const list = Array.isArray(plans) ? plans : plans?.plans || plans?.data || [];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">Plan configurations</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={handleCreateOpen}>
          Create plan
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
      ) : list.length === 0 ? (
        <Typography color="text.secondary">No plans. Create one to get started.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Plan ID</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell>Price/month</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Stripe</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((plan) => (
                <TableRow key={plan.id || plan.planId || plan._id}>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{plan.planId ?? plan.id ?? "—"}</TableCell>
                  <TableCell>{plan.displayName ?? plan.planId ?? plan.id}</TableCell>
                  <TableCell>{plan.tier ?? "—"}</TableCell>
                  <TableCell>{plan.pricing?.monthly?.displayPrice ?? (plan.pricing?.monthly?.amount != null ? `$${plan.pricing.monthly.amount}/mo` : "—")}</TableCell>
                  <TableCell>
                    <Chip size="small" label={plan.active ? "Active" : "Inactive"} color={plan.active ? "success" : "default"} />
                  </TableCell>
                  <TableCell>
                    {plan.stripeProductId || plan.stripePriceId ? (
                      <Typography variant="caption" color="text.secondary">
                        {plan.stripeProductId && `Prod: ${String(plan.stripeProductId).slice(0, 20)}…`}
                        {plan.stripePriceId && ` Price: ${String(plan.stripePriceId).slice(0, 20)}…`}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Not synced</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Switch
                      size="small"
                      checked={!!plan.active}
                      disabled={toggling === (plan.id || plan.planId)}
                      onChange={() => handleToggleActive(plan)}
                    />
                    <IconButton size="small" onClick={() => handleSync(plan.id || plan.planId)} disabled={!!syncing}>
                      <SyncIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleOpenEdit(plan)}><EditIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!editModal || createModal} onClose={createModal ? handleCreateClose : handleCloseEdit} maxWidth="md" fullWidth>
        <DialogTitle>{createModal ? "Create plan" : "Edit plan"}</DialogTitle>
        <DialogContent>
          {saveError && <Alert severity="error" sx={{ mb: 1 }}>{saveError}</Alert>}
          <TextField
            fullWidth
            multiline
            minRows={12}
            maxRows={24}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{"tier":"pro","displayName":"Pro",...}'
            sx={{ fontFamily: "monospace", mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={createModal ? handleCreateClose : handleCloseEdit}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ExperimentsTab({ experiments, loading, error, onRefresh, plans = [] }) {
  const [resultsModal, setResultsModal] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [concludeModal, setConcludeModal] = useState(null);
  const [winner, setWinner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    experimentId: "",
    name: "",
    description: "",
    targetTier: "pro",
    status: "draft",
    variants: [
      { planId: "", name: "Control", trafficAllocation: 50 },
      { planId: "", name: "Variant B", trafficAllocation: 50 },
    ],
  });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const proPlans = plans.filter((p) => p.tier === "pro" && (p.planId || p.id));

  const openEdit = useCallback(async (exp) => {
    const id = exp._id || exp.experimentId;
    if (!id) return;
    setEditModal(id);
    setEditForm(null);
    setEditError("");
    try {
      const res = await getExperiment(id);
      const e = res.data;
      setEditForm({
        name: e.name || "",
        description: e.description || "",
        targetTier: e.targetTier || "pro",
        status: e.status || "draft",
        variants: Array.isArray(e.variants) && e.variants.length
          ? e.variants.map((v) => ({
              planId: v.planId || "",
              name: v.name || "",
              trafficAllocation: v.trafficAllocation ?? 50,
            }))
          : [
              { planId: "", name: "Control", trafficAllocation: 50 },
              { planId: "", name: "Variant B", trafficAllocation: 50 },
            ],
      });
    } catch {
      setEditError("Failed to load experiment");
    }
  }, []);

  const handleUpdateExperiment = async () => {
    if (!editModal || !editForm) return;
    setEditError("");
    const variants = editForm.variants
      .filter((v) => v.planId && v.name.trim())
      .map((v) => ({ planId: v.planId, name: v.name.trim(), trafficAllocation: Number(v.trafficAllocation) || 0 }));
    if (variants.length < 2) {
      setEditError("Add at least two variants with a plan selected for each");
      return;
    }
    setEditSaving(true);
    try {
      await updateExperiment(editModal, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        targetTier: editForm.targetTier || "pro",
        status: editForm.status || "draft",
        variants,
      });
      setEditModal(null);
      setEditForm(null);
      onRefresh();
    } catch (err) {
      setEditError(err.response?.data?.error || err.message || "Failed to update experiment");
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreateExperiment = async () => {
    setCreateError("");
    if (!createForm.experimentId.trim() || !createForm.name.trim()) {
      setCreateError("Experiment ID and name are required");
      return;
    }
    const variants = createForm.variants
      .filter((v) => v.planId && v.name.trim())
      .map((v) => ({ planId: v.planId, name: v.name.trim(), trafficAllocation: Number(v.trafficAllocation) || 0 }));
    if (variants.length < 2) {
      setCreateError("Add at least two variants with a plan selected for each");
      return;
    }
    setCreating(true);
    try {
      await createExperiment({
        experimentId: createForm.experimentId.trim(),
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        targetTier: createForm.targetTier || "pro",
        status: createForm.status || "draft",
        variants,
      });
      setCreateOpen(false);
      setCreateForm({
        experimentId: "",
        name: "",
        description: "",
        targetTier: "pro",
        status: "draft",
        variants: [
          { planId: "", name: "Control", trafficAllocation: 50 },
          { planId: "", name: "Variant B", trafficAllocation: 50 },
        ],
      });
      onRefresh();
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || "Failed to create experiment");
    } finally {
      setCreating(false);
    }
  };

  const loadResults = useCallback(async (id) => {
    setResultsModal(id);
    setResultsData(null);
    try {
      const res = await getExperimentResults(id);
      setResultsData(res.data);
    } catch {
      setResultsData({ error: "Failed to load results" });
    }
  }, []);

  const handleConclude = async () => {
    const id = concludeModal?._id || concludeModal?.experimentId;
    if (!id || !winner) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      await concludeExperiment(id, winner);
      setConcludeModal(null);
      setWinner("");
      onRefresh();
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.message || "Failed to conclude");
    } finally {
      setSubmitting(false);
    }
  };

  const list = Array.isArray(experiments) ? experiments : experiments?.experiments || experiments?.data || [];

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6">A/B experiments</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => { setCreateOpen(true); setCreateError(""); }}>
          Create experiment
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
      ) : list.length === 0 ? (
        <Typography color="text.secondary">No experiments. Create one to run a pricing A/B test.</Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Variants</TableCell>
                <TableCell>Impressions</TableCell>
                <TableCell>Checkout starts</TableCell>
                <TableCell>Conversions</TableCell>
                <TableCell>Conversion rate</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((exp) => {
                const metrics = exp.metrics || [];
                const totalImpressions = metrics.reduce((s, m) => s + (m.impressions || 0), 0);
                const totalStarts = metrics.reduce((s, m) => s + (m.checkoutStarts || 0), 0);
                const totalConversions = metrics.reduce((s, m) => s + (m.conversions || 0), 0);
                const rate = totalStarts ? ((totalConversions / totalStarts) * 100).toFixed(1) : "—";
                const variants = (exp.variants || []).map((v) => v.name || v.planId).join(", ") || "—";
                return (
                  <TableRow key={exp.id || exp.experimentId || exp._id}>
                    <TableCell>{exp.name || exp.experimentId}</TableCell>
                    <TableCell><Chip size="small" label={exp.status || "—"} /></TableCell>
                    <TableCell>{variants}</TableCell>
                    <TableCell>{totalImpressions}</TableCell>
                    <TableCell>{totalStarts}</TableCell>
                    <TableCell>{totalConversions}</TableCell>
                    <TableCell>{rate}%</TableCell>
                    <TableCell align="right">
                      <Button size="small" startIcon={<BarChartIcon />} onClick={() => loadResults(exp._id || exp.experimentId)}>
                        Results
                      </Button>
                      {exp.status !== "concluded" && (
                        <Button size="small" onClick={() => openEdit(exp)}>
                          Edit
                        </Button>
                      )}
                      {exp.status === "running" && (
                        <Button size="small" startIcon={<FlagIcon />} onClick={() => setConcludeModal(exp)}>
                          Conclude
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!resultsModal} onClose={() => setResultsModal(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Experiment results</DialogTitle>
        <DialogContent>
          {resultsData?.error && <Alert severity="error">{resultsData.error}</Alert>}
          {resultsData && !resultsData.error && (
            <Box component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.85rem" }}>
              {JSON.stringify(resultsData, null, 2)}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResultsModal(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!concludeModal} onClose={() => { setConcludeModal(null); setWinner(""); setSubmitError(""); }}>
        <DialogTitle>Conclude experiment</DialogTitle>
        <DialogContent>
          {submitError && <Alert severity="error" sx={{ mb: 1 }}>{submitError}</Alert>}
          <Typography sx={{ mb: 1 }}>Select winning variant:</Typography>
          <TextField
            fullWidth
            size="small"
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
            placeholder="Variant name (e.g. Control)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConcludeModal(null); setWinner(""); }}>Cancel</Button>
          <Button variant="contained" onClick={handleConclude} disabled={!winner.trim() || submitting}>
            {submitting ? "Concluding…" : "Conclude"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editModal} onClose={() => { if (!editSaving) { setEditModal(null); setEditForm(null); setEditError(""); } }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit experiment</DialogTitle>
        <DialogContent>
          {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
          {!editForm ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress /></Box>
          ) : (
            <>
              <TextField fullWidth size="small" label="Experiment ID" value={editModal} disabled sx={{ mt: 1, mb: 1.5 }} />
              <TextField
                fullWidth
                size="small"
                label="Name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                sx={{ mb: 1.5 }}
              />
              <TextField
                fullWidth
                size="small"
                label="Description (optional)"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                sx={{ mb: 1.5 }}
              />
              <TextField
                fullWidth
                size="small"
                label="Target tier"
                value={editForm.targetTier}
                onChange={(e) => setEditForm((f) => ({ ...f, targetTier: e.target.value }))}
                sx={{ mb: 1.5 }}
              />
              <TextField
                fullWidth
                size="small"
                select
                SelectProps={{ native: true }}
                label="Status"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                sx={{ mb: 2 }}
              >
                <option value="draft">Draft</option>
                <option value="running">Running</option>
                <option value="paused">Paused</option>
              </TextField>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Variants (pick a plan and traffic % for each)</Typography>
              {editForm.variants.map((v, i) => (
                <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
                  <TextField
                    size="small"
                    select
                    SelectProps={{ native: true }}
                    label="Plan"
                    value={v.planId}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        variants: f.variants.map((vv, ii) => (ii === i ? { ...vv, planId: e.target.value } : vv)),
                      }))
                    }
                    sx={{ minWidth: 140 }}
                  >
                    <option value="">—</option>
                    {proPlans.map((p) => (
                      <option key={p.planId || p.id} value={p.planId || p.id}>{p.name || p.planId}</option>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    label="Variant name"
                    value={v.name}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        variants: f.variants.map((vv, ii) => (ii === i ? { ...vv, name: e.target.value } : vv)),
                      }))
                    }
                    sx={{ minWidth: 120 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="%"
                    value={v.trafficAllocation}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        variants: f.variants.map((vv, ii) => (ii === i ? { ...vv, trafficAllocation: e.target.value } : vv)),
                      }))
                    }
                    inputProps={{ min: 0, max: 100 }}
                    sx={{ width: 70 }}
                  />
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditModal(null); setEditForm(null); setEditError(""); }} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateExperiment} disabled={!editForm || editSaving}>
            {editSaving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create experiment</DialogTitle>
        <DialogContent>
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <TextField
            fullWidth
            size="small"
            label="Experiment ID"
            placeholder="e.g. pricing_test_march_2026"
            value={createForm.experimentId}
            onChange={(e) => setCreateForm((f) => ({ ...f, experimentId: e.target.value }))}
            sx={{ mt: 1, mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Name"
            placeholder="e.g. Pro $29 vs $19"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Description (optional)"
            value={createForm.description}
            onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Target tier"
            value={createForm.targetTier}
            onChange={(e) => setCreateForm((f) => ({ ...f, targetTier: e.target.value }))}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            select
            SelectProps={{ native: true }}
            label="Status"
            value={createForm.status}
            onChange={(e) => setCreateForm((f) => ({ ...f, status: e.target.value }))}
            sx={{ mb: 2 }}
          >
            <option value="draft">Draft</option>
            <option value="running">Running</option>
            <option value="paused">Paused</option>
          </TextField>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Variants (pick a plan and traffic % for each)</Typography>
          {createForm.variants.map((v, i) => (
            <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
              <TextField
                size="small"
                select
                SelectProps={{ native: true }}
                label="Plan"
                value={v.planId}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    variants: f.variants.map((vv, ii) => (ii === i ? { ...vv, planId: e.target.value } : vv)),
                  }))
                }
                sx={{ minWidth: 180 }}
              >
                <option value="">Select plan</option>
                {proPlans.map((p) => (
                  <option key={p.planId || p.id} value={p.planId || p.id}>
                    {p.displayName || p.planId} ({p.pricing?.monthly?.displayPrice || p.pricing?.annual?.displayPrice || p.planId})
                  </option>
                ))}
              </TextField>
              <TextField
                size="small"
                label="Variant name"
                placeholder="e.g. Control"
                value={v.name}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    variants: f.variants.map((vv, ii) => (ii === i ? { ...vv, name: e.target.value } : vv)),
                  }))
                }
                sx={{ minWidth: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="Traffic %"
                value={v.trafficAllocation}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    variants: f.variants.map((vv, ii) => (ii === i ? { ...vv, trafficAllocation: Number(e.target.value) || 0 } : vv)),
                  }))
                }
                inputProps={{ min: 0, max: 100 }}
                sx={{ width: 90 }}
              />
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateExperiment} disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function PlanManagerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isExperimentsRoute = location.pathname.endsWith("/experiments");
  const [tab, setTab] = useState(isExperimentsRoute ? TAB_EXPERIMENTS : TAB_PLANS);

  useEffect(() => {
    setTab(isExperimentsRoute ? TAB_EXPERIMENTS : TAB_PLANS);
  }, [isExperimentsRoute]);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState("");
  const [experiments, setExperiments] = useState([]);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [experimentsError, setExperimentsError] = useState("");

  const loadPlans = useCallback(() => {
    setPlansLoading(true);
    setPlansError("");
    getAdminPlans()
      .then((res) => {
        const data = res.data?.plans ?? res.data?.data ?? res.data;
        setPlans(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setPlansError(err.response?.data?.error || err.message || "Failed to load plans");
        setPlans([]);
      })
      .finally(() => setPlansLoading(false));
  }, []);

  const loadExperiments = useCallback(() => {
    setExperimentsLoading(true);
    setExperimentsError("");
    getExperiments()
      .then((res) => {
        const data = res.data?.experiments ?? res.data?.data ?? res.data;
        setExperiments(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setExperimentsError(err.response?.data?.error || err.message || "Failed to load experiments");
        setExperiments([]);
      })
      .finally(() => setExperimentsLoading(false));
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (tab === TAB_EXPERIMENTS) loadExperiments();
  }, [tab, loadExperiments]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Admin — Plans &amp; experiments</Typography>
      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v);
          navigate(v === TAB_EXPERIMENTS ? "/admin/experiments" : "/admin/plans", { replace: true });
        }}
        sx={{ mb: 3 }}
      >
        <Tab label="Plans" />
        <Tab label="Experiments" />
      </Tabs>
      {tab === TAB_PLANS && (
        <PlansTab plans={plans} loading={plansLoading} error={plansError} onRefresh={loadPlans} />
      )}
      {tab === TAB_EXPERIMENTS && (
        <ExperimentsTab experiments={experiments} loading={experimentsLoading} error={experimentsError} onRefresh={loadExperiments} plans={plans} />
      )}
    </Box>
  );
}
