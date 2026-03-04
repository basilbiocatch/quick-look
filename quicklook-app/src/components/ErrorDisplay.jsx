import React, { useState, useId } from "react";
import { Box, Typography, Button, Collapse, useTheme } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

/**
 * Maps raw error messages (e.g. "Request failed with status code 500") to friendly copy.
 */
function getFriendlyMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== "string") return "Something went wrong.";
  const s = rawMessage.toLowerCase();
  if (s.includes("500") || s.includes("internal server error")) return "Our servers had a hiccup. Please try again in a moment.";
  if (s.includes("502") || s.includes("503") || s.includes("504")) return "We're temporarily unavailable. Please try again shortly.";
  if (s.includes("404")) return "This couldn't be found. It may have been removed.";
  if (s.includes("403") || s.includes("401")) return "You don't have access to this.";
  if (s.includes("network") || s.includes("failed to fetch")) return "Connection issue. Check your network and try again.";
  return "Something went wrong. Please try again.";
}

/**
 * Short title for the error type.
 */
function getFriendlyTitle(rawMessage) {
  if (!rawMessage || typeof rawMessage !== "string") return "Something went wrong";
  const s = rawMessage.toLowerCase();
  if (s.includes("500") || s.includes("502") || s.includes("503") || s.includes("504")) return "Server hiccup";
  if (s.includes("404")) return "Not found";
  if (s.includes("403") || s.includes("401")) return "Access denied";
  if (s.includes("network") || s.includes("failed to fetch")) return "Connection problem";
  return "Something went wrong";
}

const IllustrationSvg = ({ compact, theme, idPrefix }) => {
  const size = compact ? 64 : 120;
  const isDark = theme.palette.mode === "dark";
  const gradStart = isDark ? theme.palette.grey[800] : "#FFEBEE";
  const gradEnd = isDark ? theme.palette.grey[900] : "#FCE4EC";
  const cloudStart = isDark ? theme.palette.grey[600] : "#ECEFF1";
  const cloudEnd = isDark ? theme.palette.grey[700] : "#CFD8DC";
  const strokeStart = isDark ? theme.palette.grey[500] : "#B0BEC5";
  const strokeEnd = isDark ? theme.palette.grey[600] : "#90A4AE";
  const accent = isDark ? theme.palette.grey[400] : theme.palette.grey[600];
  const gradId = `${idPrefix}-grad`;
  const cloudId = `${idPrefix}-cloud`;
  const strokeId = `${idPrefix}-stroke`;
  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      sx={{ display: "block", mx: "auto", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor={gradStart} />
          <stop offset="1" stopColor={gradEnd} />
        </linearGradient>
        <linearGradient id={cloudId} x1="28" y1="38" x2="88" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor={cloudStart} />
          <stop offset="1" stopColor={cloudEnd} />
        </linearGradient>
        <linearGradient id={strokeId} x1="28" y1="38" x2="88" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor={strokeStart} />
          <stop offset="1" stopColor={strokeEnd} />
        </linearGradient>
      </defs>
      {/* Soft gradient background circle */}
      <circle cx="60" cy="60" r="54" fill={`url(#${gradId})`} opacity={isDark ? 0.5 : 0.4} />
      {/* Cloud shape - friendly and soft */}
      <path
        d="M32 72c-6 0-10-5-10-11s4-11 10-11c1 0 2 0 3 .2C36 46 46 38 58 38c12 0 22 8 24 20 1 0 2-.2 3-.2 7 0 12 5 12 11s-5 11-12 11H32z"
        fill={`url(#${cloudId})`}
        stroke={`url(#${strokeId})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Small exclamation - theme-aware */}
      <path
        d="M58 52v18M58 74v4"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        opacity={0.9}
      />
      <circle cx="58" cy="48" r="3" fill={accent} opacity={0.9} />
    </Box>
  );
};

/**
 * Reusable error state with illustration and friendly message.
 * Replaces raw "Request failed with status code 500" style text.
 *
 * @param {string} message - Raw error message (e.g. from catch)
 * @param {string} [title] - Override title (default: derived from message)
 * @param {string} [friendlyMessage] - Override body text (default: derived from message)
 * @param {boolean} [compact] - Smaller layout for side panels
 * @param {function} [onRetry] - If provided, shows a "Try again" button
 * @param {boolean} [showDetails] - If true, allow expanding to show raw message (default: true when message is long or looks technical)
 * @param {boolean} [fillAndCenter] - If true, root fills container and content is centered (e.g. replay area)
 */
export default function ErrorDisplay({
  message = "",
  title,
  friendlyMessage,
  compact = false,
  onRetry,
  showDetails: showDetailsProp,
  fillAndCenter = false,
}) {
  const theme = useTheme();
  const idPrefix = useId().replace(/:/g, "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const titleText = title ?? getFriendlyTitle(message);
  const bodyText = friendlyMessage ?? getFriendlyMessage(message);
  const hasTechnicalMessage = message && (message.length > 40 || message.includes("status code") || message.includes("Error"));
  const showDetails = showDetailsProp ?? (hasTechnicalMessage && !compact);

  return (
    <Box
      data-ql-block
      sx={{
        ...(fillAndCenter && {
          position: "absolute",
          inset: 0,
          bgcolor: "background.default",
          borderRadius: 1,
          zIndex: 1,
        }),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        p: compact ? 2 : 3,
        maxWidth: compact ? 280 : 380,
        mx: "auto",
      }}
    >
      <IllustrationSvg compact={compact} theme={theme} idPrefix={idPrefix} />
      <Typography
        variant={compact ? "subtitle2" : "subtitle1"}
        sx={{
          fontWeight: 600,
          color: "text.primary",
          mt: compact ? 1.5 : 2,
          mb: 0.5,
        }}
      >
        {titleText}
      </Typography>
      <Typography
        variant={compact ? "caption" : "body2"}
        sx={{ color: "text.secondary", mb: showDetails || onRetry ? 2 : 0 }}
      >
        {bodyText}
      </Typography>
      {onRetry && (
        <Button
          size="small"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          variant="outlined"
          sx={{ mt: 1 }}
        >
          Try again
        </Button>
      )}
      {showDetails && message && (
        <Box sx={{ width: "100%", mt: 1 }}>
          <Button
            size="small"
            onClick={() => setDetailsOpen((o) => !o)}
            endIcon={detailsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            Technical details
          </Button>
          <Collapse in={detailsOpen}>
            <Typography
              component="pre"
              variant="caption"
              sx={{
                p: 1.5,
                bgcolor: "action.hover",
                borderRadius: 1,
                textAlign: "left",
                overflow: "auto",
                maxHeight: 120,
                color: "text.secondary",
                fontFamily: "monospace",
              }}
            >
              {message}
            </Typography>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

export { getFriendlyMessage, getFriendlyTitle };
