import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Button, Paper } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

const gradientStyle = {
  background: "linear-gradient(135deg, rgba(190,149,250,0.9) 0%, rgba(147,112,219,0.85) 50%, rgba(99,102,241,0.85) 100%)",
  boxShadow: "0 2px 12px rgba(190,149,250,0.35)",
  "&:hover": {
    background: "linear-gradient(135deg, rgba(190,149,250,1) 0%, rgba(147,112,219,0.95) 50%, rgba(99,102,241,0.95) 100%)",
    boxShadow: "0 4px 16px rgba(190,149,250,0.45)",
  },
};

/**
 * Shown when a Free user tries to access a Pro feature. Keeps the feature visible but not accessible.
 * @param {string} title - Feature name (e.g. "Insights", "DevTools")
 * @param {string} description - Short copy (e.g. "AI-powered friction patterns...")
 * @param {React.ReactNode} [icon] - Optional icon (default Lock)
 * @param {boolean} [compact] - If true, use smaller padding (e.g. inside replay toolbar)
 */
export default function ProFeatureGate({ title, description, icon, compact = false }) {
  const navigate = useNavigate();
  const Icon = icon || LockIcon;

  const content = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        py: compact ? 2 : 6,
        px: compact ? 2 : 4,
      }}
    >
      <Box
        sx={{
          width: compact ? 40 : 56,
          height: compact ? 40 : 56,
          borderRadius: 2,
          bgcolor: "rgba(190,149,250,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 1.5,
        }}
      >
        <Icon sx={{ fontSize: compact ? 22 : 32, color: "primary.main" }} />
      </Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 320 }}>
        {description}
      </Typography>
      <Button
        variant="contained"
        size={compact ? "small" : "medium"}
        onClick={() => navigate("/account/upgrade")}
        startIcon={<AutoAwesomeIcon />}
        sx={{
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 2,
          ...gradientStyle,
        }}
      >
        Upgrade to Pro
      </Button>
    </Box>
  );

  if (compact) {
    return (
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          borderColor: "rgba(190,149,250,0.35)",
          background: "linear-gradient(135deg, rgba(190,149,250,0.08) 0%, rgba(147,112,219,0.05) 100%)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {content}
      </Paper>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 360, p: 3 }}>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          maxWidth: 400,
          width: "100%",
          borderColor: "rgba(190,149,250,0.35)",
          background: "linear-gradient(135deg, rgba(190,149,250,0.08) 0%, rgba(147,112,219,0.05) 100%)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {content}
      </Paper>
    </Box>
  );
}
