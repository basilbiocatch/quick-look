import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";

function EmptyRadarIllustration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 280 180"
      sx={{
        width: "100%",
        maxWidth: 280,
        height: "auto",
        display: "block",
        color: "primary.main",
      }}
      aria-hidden
    >
      <defs>
        <linearGradient id="active-empty-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="active-empty-stroke" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Soft backdrop */}
      <ellipse cx="140" cy="100" rx="118" ry="72" fill="url(#active-empty-grad)" />
      {/* Concentric rings — “radar” with no targets */}
      <circle cx="140" cy="100" r="68" fill="none" stroke="url(#active-empty-stroke)" strokeWidth="1.5" />
      <circle cx="140" cy="100" r="48" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
      <circle cx="140" cy="100" r="28" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
      {/* Sweep wedge (static) */}
      <path
        d="M140 100 L200 55 A72 72 0 0 0 140 28 Z"
        fill="currentColor"
        fillOpacity="0.06"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="0.75"
      />
      {/* Center hub */}
      <circle cx="140" cy="100" r="6" fill="currentColor" fillOpacity="0.45" />
      {/* Decorative “no blips” — small dim crosses where contacts might be */}
      <path
        d="M62 78h4M64 76v4M218 118h4M220 116v4M96 132h4M98 130v4"
        stroke="currentColor"
        strokeOpacity="0.12"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Box>
  );
}

export default function ActiveSessionsEmptyState({ projectKey }) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        maxWidth: 440,
        mx: "auto",
        textAlign: "center",
        px: 2,
        py: 1,
        "@keyframes fadeIn": {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        animation: "fadeIn 0.45s ease-out",
      }}
    >
      <EmptyRadarIllustration />
      <Typography variant="h6" fontWeight={700} sx={{ mt: 2.5, mb: 1 }}>
        No active sessions
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6, maxWidth: 380, mx: "auto" }}>
        Nobody is on your site right now. When visitors arrive, live sessions show up here automatically. Drive traffic
        with a campaign or experiment to see activity.
      </Typography>
      <Button
        variant="outlined"
        size="medium"
        startIcon={<ScienceOutlinedIcon />}
        onClick={() => projectKey && navigate(`/projects/${projectKey}/ab-tests`)}
        sx={{ textTransform: "none" }}
      >
        Open A/B tests
      </Button>
    </Box>
  );
}
