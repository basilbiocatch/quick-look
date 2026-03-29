import React from "react";
import { Box, Button, ButtonGroup, TextField, Typography } from "@mui/material";

const PRESETS = [
  { id: "7", label: "7d", days: 7 },
  { id: "30", label: "30d", days: 30 },
  { id: "90", label: "90d", days: 90 },
];

export function isoRangeForPreset(days) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function isoToDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @param {{ preset: string, from: string, to: string, onPreset: (id: string, fromIso: string, toIso: string) => void, onCustomFrom: (v: string) => void, onCustomTo: (v: string) => void }} props
 */
export default function EventsDateRangeFilter({ preset, from, to, onPreset, onCustomFrom, onCustomTo }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
        Time range
      </Typography>
      <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: "wrap", mb: 1.5 }}>
        {PRESETS.map((p) => {
          const range = isoRangeForPreset(p.days);
          return (
            <Button
              key={p.id}
              variant={preset === p.id ? "contained" : "outlined"}
              onClick={() => onPreset(p.id, range.from, range.to)}
            >
              {p.label}
            </Button>
          );
        })}
        <Button variant={preset === "custom" ? "contained" : "outlined"} onClick={() => onPreset("custom", from, to)}>
          Custom
        </Button>
      </ButtonGroup>
      {preset === "custom" && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <TextField
            label="From"
            type="datetime-local"
            size="small"
            value={isoToDatetimeLocalValue(from)}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onCustomFrom(new Date(v).toISOString());
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="To"
            type="datetime-local"
            size="small"
            value={isoToDatetimeLocalValue(to)}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              onCustomTo(new Date(v).toISOString());
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 220 }}
          />
        </Box>
      )}
    </Box>
  );
}
