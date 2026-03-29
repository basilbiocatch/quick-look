import React from "react";
import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

export default function EventsPageHeader({ title = "Events", subtitle, onRefresh, refreshing }) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, mb: 2 }}>
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {onRefresh && (
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={onRefresh} disabled={refreshing} size="small" aria-label="Refresh">
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
}
