import React from "react";
import { TextField, Typography } from "@mui/material";

/**
 * Prefix filter on event name (server matches case-insensitive prefix).
 * @param {{ value: string, onChange: (v: string) => void, disabled?: boolean }} props
 */
export default function EventsNameFilter({ value, onChange, disabled }) {
  return (
    <div>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
        Event name (prefix)
      </Typography>
      <TextField
        size="small"
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="e.g. checkout_ or leave empty for all"
      />
    </div>
  );
}
