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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
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
  const [allowedDomains, setAllowedDomains] = useState([]);
  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdProject, setCreatedProject] = useState(null);
  const [integrationMode, setIntegrationMode] = useState("developer");
  const [copied, setCopied] = useState(false);

  const handleAddDomain = () => {
    const v = newDomain.trim();
    if (!v || allowedDomains.includes(v)) return;
    setAllowedDomains((prev) => [...prev, v]);
    setNewDomain("");
  };

  const handleRemoveDomain = (index) => {
    setAllowedDomains((prev) => prev.filter((_, i) => i !== index));
  };

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
          allowedDomains,
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
    ? `<script src="${apiBase}/quicklook-sdk.js" async></script>
<script>
  quicklook('init', {
    apiUrl: '${apiBase}',
    projectKey: '${createdProject.projectKey}'
  });
  // Optional: identify user
  // quicklook('setIdentity', { email: 'user@example.com', firstName: 'Jane' });
</script>`
    : "";

  const snippetPrompt = snippet
    ? `Add this session recording script to my site in a non-blocking way. Place it at the end of the body. Use the async attribute on the script that loads the SDK so it does not block page load. Here is the exact code to add:

${snippet}`
    : "";

  const copySnippet = () => {
    const text = integrationMode === "developer" ? snippet : snippetPrompt;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
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
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Allowed domains
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Add domains that may send recordings. Leave empty to allow any origin.
            </Typography>
            <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="e.g. app.example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddDomain())}
              />
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddDomain} disabled={!newDomain.trim()} sx={{ flexShrink: 0 }} aria-label="Add domain">
                Add
              </Button>
            </Box>
            {allowedDomains.length > 0 ? (
              <List dense sx={{ bgcolor: "action.hover", borderRadius: 1, mb: 2 }}>
                {allowedDomains.map((domain, index) => (
                  <ListItem key={`${domain}-${index}`}>
                    <ListItemText primary={domain} primaryTypographyProps={{ variant: "body2", fontFamily: "monospace" }} />
                    <ListItemSecondaryAction>
                      <IconButton size="small" onClick={() => handleRemoveDomain(index)} aria-label="Remove domain">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No domains added. Any origin can send recordings.
              </Typography>
            )}
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
            <ToggleButtonGroup
              value={integrationMode}
              exclusive
              onChange={(_, v) => v != null && setIntegrationMode(v)}
              size="small"
              sx={{ mb: 2 }}
            >
              <ToggleButton value="developer" aria-label="I'm a developer">
                I'm a developer
              </ToggleButton>
              <ToggleButton value="ai" aria-label="I use an AI web builder">
                I use an AI web builder
              </ToggleButton>
            </ToggleButtonGroup>
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
                aria-label={integrationMode === "developer" ? "Copy script" : "Copy prompt"}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              {integrationMode === "developer" ? snippet : snippetPrompt}
            </Paper>
            {copied && (
              <Typography variant="caption" color="success.main" sx={{ mt: 1, display: "block" }}>
                Copied to clipboard.
              </Typography>
            )}
            {integrationMode === "ai" && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Copy the prompt above and paste it into your AI assistant so it adds the script in a non-blocking way.
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
