import React from "react";
import { Box, Typography } from "@mui/material";

export default function PropertyRow({ label, value }) {
  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
        {label}
      </Typography>
      <Typography variant="body2" noWrap title={value} sx={{ fontSize: "0.8125rem" }}>
        {value ?? "—"}
      </Typography>
    </Box>
  );
}
