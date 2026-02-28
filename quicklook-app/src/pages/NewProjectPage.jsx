import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Alert,
  IconButton,
  InputAdornment,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { createProject } from "../api/quicklookApi";

const steps = ["Project details", "Integration"];

function getApiBase() {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base) return base.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://your-api.example.com";
}

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState("");
  const [allowedDomainsText, setAllowedDomainsText] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdProject, setCreatedProject] = useState(null);
  const [copied, setCopied] = useState(false);

  const domains = allowedDomainsText
    .split(/[\n,]/)
    .map((d) => d.trim())
    .filter(Boolean);

  const handleNext = async () => {
    setError("");
    if (activeStep === 0) {
      if (!name.trim()) {
        setError("Project name is required");
        return;
      }
      setSubmitting(true);
      try {
        const res = await createProject({
          name: name.trim(),
          allowedDomains: domains,
          retentionDays: Number(retentionDays) || 30,
        });
        const data = res.data?.data;
        if (data) {
          setCreatedProject(data);
          setActiveStep(1);
        } else {
          setError(res.data?.error || "Failed to create project");
        }
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Failed to create project");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    setError("");
    if (activeStep === 1) setActiveStep(0);
    else navigate("/");
  };

  const handleFinish = () => {
    navigate(createdProject ? `/projects/${createdProject.projectKey}/sessions` : "/");
  };

  const apiBase = getApiBase();
  const snippet = createdProject
    ? `<script src="${apiBase}/quicklook-sdk.js"></script>
<script>
  quicklook('init', {
    apiUrl: '${apiBase}',
    projectKey: '${createdProject.projectKey}'
  });
  // Optional: identify user
  // quicklook('setIdentity', { email: 'user@example.com', firstName: 'Jane' });
</script>`
    : "";

  const copySnippet = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 3 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }} color="inherit">
        Back
      </Button>
      <Paper
        elevation={0}
        sx={{
          maxWidth: 560,
          mx: "auto",
          p: 4,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
          New project
        </Typography>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {activeStep === 0 && (
          <Box>
            <TextField
              fullWidth
              label="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="My app"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Allowed domains"
              placeholder="one per line or comma-separated"
              value={allowedDomainsText}
              onChange={(e) => setAllowedDomainsText(e.target.value)}
              multiline
              rows={3}
              helperText="Domains that can send recordings (e.g. app.example.com). Leave empty to allow any."
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Retention (days)"
              type="number"
              inputProps={{ min: 1, max: 365 }}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 3 }}>
              <Button onClick={handleBack}>Cancel</Button>
              <Button variant="contained" onClick={handleNext} disabled={submitting}>
                {submitting ? "Creating…" : "Next"}
              </Button>
            </Box>
          </Box>
        )}

        {activeStep === 1 && createdProject && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Add this script to your site to start recording sessions.
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: "action.hover",
                borderRadius: 1,
                position: "relative",
                fontFamily: "monospace",
                fontSize: "0.8125rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              <IconButton
                size="small"
                onClick={copySnippet}
                sx={{ position: "absolute", top: 8, right: 8 }}
                aria-label="Copy"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              {snippet}
            </Paper>
            {copied && (
              <Typography variant="caption" color="success.main" sx={{ mt: 1, display: "block" }}>
                Copied to clipboard.
              </Typography>
            )}
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
              <Button onClick={() => setActiveStep(0)}>Back</Button>
              <Button variant="contained" onClick={handleFinish}>
                Go to sessions
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
