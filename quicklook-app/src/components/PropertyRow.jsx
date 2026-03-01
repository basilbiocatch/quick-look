import React from "react";
import { Box, Typography } from "@mui/material";

export default function PropertyRow({ label, value, icon }) {
  return (
    <Box sx={{ py: 0.5, display: "flex", alignItems: "flex-start", gap: 1 }}>
      {icon && (
        <Box sx={{ mt: 0.25, color: "text.secondary", display: "flex", alignItems: "center" }}>
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
          {label}
        </Typography>
        <Typography variant="body2" noWrap title={value} sx={{ fontSize: "0.8125rem" }}>
          {value ?? "—"}
        </Typography>
      </Box>
    </Box>
  );
}
