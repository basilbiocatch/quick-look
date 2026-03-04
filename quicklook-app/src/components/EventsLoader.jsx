import React from "react";
import { Box, Typography } from "@mui/material";

/**
 * Video/events loader with a magical recording indicator animation.
 * Shown in the replay player area while events are loading.
 * @param {Object} props
 * @param {number} [props.chunksLoaded] - Chunks loaded so far (for progress)
 * @param {number} [props.totalChunks] - Total chunks (for progress)
 */
export default function EventsLoader({ chunksLoaded, totalChunks } = {}) {
  const showProgress = typeof chunksLoaded === "number" && typeof totalChunks === "number" && totalChunks > 1;
  return (
    <Box
      data-ql-block
      sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        bgcolor: "background.default",
        borderRadius: 1,
        overflow: "hidden",
        "@keyframes eventsLoaderPulse": {
          "0%, 100%": { transform: "scale(0.85)", opacity: 0.7 },
          "50%": { transform: "scale(1)", opacity: 1 },
        },
        "@keyframes eventsLoaderRipple": {
          "0%": { transform: "scale(0.8)", opacity: 1 },
          "100%": { transform: "scale(2.5)", opacity: 0 },
        },
        "@keyframes eventsLoaderFade": {
          "0%, 100%": { opacity: 0.7 },
          "50%": { opacity: 1 },
        },
      }}
    >
      {/* Magical Recording Indicator */}
      <Box
        sx={{
          position: "relative",
          width: 80,
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Ripple 1 */}
        <Box
          sx={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: "2px solid rgba(138, 43, 226, 0.6)", // Magical Purple
            animation: "eventsLoaderRipple 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          }}
        />
        {/* Ripple 2 */}
        <Box
          sx={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: "2px solid rgba(186, 85, 211, 0.6)", // Orchid Pink/Purple
            animation: "eventsLoaderRipple 2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
            animationDelay: "1s",
          }}
        />
        
        {/* Core Recording Dot - Magical Orb */}
        <Box
          sx={{
            position: "relative",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, rgba(200, 162, 255, 1) 0%, rgba(138, 43, 226, 1) 50%, rgba(75, 0, 130, 1) 100%)",
            boxShadow: "inset -4px -4px 8px rgba(0,0,0,0.3), 0 0 20px rgba(138, 43, 226, 0.8), 0 0 40px rgba(147, 112, 219, 0.6)",
            animation: "eventsLoaderPulse 2s ease-in-out infinite",
          }}
        >
          {/* Inner Highlight for 3D effect */}
          <Box
            sx={{
              position: "absolute",
              top: "15%",
              left: "15%",
              width: "30%",
              height: "30%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)",
              pointerEvents: "none",
            }}
          />
        </Box>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: "text.secondary",
          fontWeight: 500,
          letterSpacing: "0.04em",
          animation: "eventsLoaderFade 1.5s ease-in-out infinite",
          display: "flex",
          alignItems: "center",
          gap: 1.5
        }}
      >
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "#8a2be2",
            display: "inline-block",
            animation: "eventsLoaderPulse 1.5s ease-in-out infinite",
            boxShadow: "0 0 8px rgba(138, 43, 226, 0.8)"
          }}
        />
        Loading recording…
        {showProgress && (
          <Box component="span" sx={{ ml: 0.5, opacity: 0.9 }}>
            ({chunksLoaded}/{totalChunks} chunks)
          </Box>
        )}
      </Typography>
    </Box>
  );
}
