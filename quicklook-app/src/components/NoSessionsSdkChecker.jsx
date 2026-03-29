import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SettingsIcon from "@mui/icons-material/Settings";
import MenuBookIcon from "@mui/icons-material/MenuBook";

function getApiBase() {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base) return base.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

const CHECKLIST_ITEMS = [
  {
    id: "script",
    label: "Add the QuickLook script to your site (in <head> or before </body>)",
  },
  {
    id: "init",
    label: "Call quicklook('init', projectKey) with this project's key after the script loads",
  },
  {
    id: "visit",
    label: "Visit a page where the script is loaded — the first session starts automatically",
  },
];

export default function NoSessionsSdkChecker({ projectKey }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const apiBase = getApiBase();
  const snippet =
    projectKey && apiBase
      ? `<script src="${apiBase}/quicklook-sdk.js" async></script>
<script>
  quicklook('init', '${projectKey}', { apiUrl: '${apiBase}' });
</script>`
      : null;

  const handleCopy = async () => {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const goToSettings = () => {
    navigate(`/projects/${projectKey}/settings`);
  };

  const goToSdkDocs = () => {
    navigate("/docs/sdk");
  };

  return (
    <Paper
      elevation={0}
      sx={{
        maxWidth: 520,
        mx: "auto",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: (t) =>
          t.palette.mode === "dark"
            ? "rgba(255,255,255,0.03)"
            : "rgba(0,0,0,0.02)",
        "@keyframes fadeIn": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        animation: "fadeIn 0.4s ease-out",
      }}
    >
      <Box
        sx={{
          px: 2.5,
          pt: 2.5,
          pb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            opacity: 0.9,
          }}
        >
          <VideocamOffIcon sx={{ fontSize: 26 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.25 }}>
            No sessions yet — is the SDK installed?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Use this checklist to confirm the recording script is set up correctly.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 2.5, py: 2 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: "0.06em", display: "block", mb: 1.5 }}>
          CHECKLIST
        </Typography>
        <List dense disablePadding sx={{ mb: 2 }}>
          {CHECKLIST_ITEMS.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ alignItems: "flex-start", mb: 0.75 }}>
              <ListItemIcon sx={{ minWidth: 28, mt: 0.25 }}>
                <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  variant: "body2",
                  sx: { color: "text.primary" },
                }}
              />
            </ListItem>
          ))}
        </List>

        {snippet && (
          <>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ letterSpacing: "0.06em", display: "block", mb: 1 }}>
              YOUR SCRIPT (use this project key)
            </Typography>
            <Box
              sx={{
                position: "relative",
                borderRadius: 1.5,
                bgcolor: (t) =>
                  t.palette.mode === "dark" ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.06)",
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
              }}
            >
              <Box
                component="pre"
                sx={{
                  p: 2,
                  m: 0,
                  fontFamily: "ui-monospace, 'SF Mono', Monaco, monospace",
                  fontSize: "0.8125rem",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "text.primary",
                  overflow: "auto",
                  maxHeight: 140,
                }}
              >
                {snippet}
              </Box>
              <Tooltip title={copied ? "Copied!" : "Copy script"}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    bgcolor: "background.paper",
                    boxShadow: 1,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <ContentCopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </>
        )}

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SettingsIcon sx={{ fontSize: 18 }} />}
            onClick={goToSettings}
            sx={{ textTransform: "none" }}
          >
            Project settings & integration
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<MenuBookIcon sx={{ fontSize: 18 }} />}
            onClick={goToSdkDocs}
            sx={{ textTransform: "none" }}
          >
            SDK docs
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, lineHeight: 1.5 }}>
          After adding the script, open your site in a new tab and use it for a few seconds. Sessions usually appear within 10–30 seconds.
        </Typography>
      </Box>
    </Paper>
  );
}
