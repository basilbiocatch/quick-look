import React from "react";
import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";

const SORT_OPTIONS = [
  { value: "count_desc", label: "Count (high → low)" },
  { value: "count_asc", label: "Count (low → high)" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

export default function EventsSortControl({ value, onChange, disabled }) {
  return (
    <div>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
        Sort
      </Typography>
      <FormControl size="small" fullWidth disabled={disabled}>
        <InputLabel id="events-sort-label">Sort by</InputLabel>
        <Select
          labelId="events-sort-label"
          label="Sort by"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}
