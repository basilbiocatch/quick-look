import React, { useMemo } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { chartAxisTick, chartGridStroke, chartMargins, chartTooltipContentStyle } from "./eventsChartStyles";

const paperSx = {
  p: 2.5,
  borderRadius: 2,
  height: "100%",
  bgcolor: "background.paper",
  borderColor: "divider",
};

export default function EventsTopBarChart({ rows = [], limit = 12, loading }) {
  const theme = useTheme();
  const fill = alpha(theme.palette.primary.main, 0.42);

  const data = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (b.count || 0) - (a.count || 0));
    return sorted.slice(0, limit).map((r) => ({
      name: r.name.length > 28 ? `${r.name.slice(0, 26)}…` : r.name,
      fullName: r.name,
      count: r.count,
      uniqueSessions: r.uniqueSessions ?? 0,
    }));
  }, [rows, limit]);

  return (
    <Paper variant="outlined" sx={paperSx}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25, letterSpacing: "-0.01em" }}>
        Top events
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        Total count in range
      </Typography>
      {loading ? (
        <Box sx={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Box>
      ) : data.length === 0 ? (
        <Box sx={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No events
          </Typography>
        </Box>
      ) : (
        <Box sx={{ width: "100%", height: Math.max(200, data.length * 32), minHeight: 180, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <BarChart data={data} layout="vertical" margin={{ ...chartMargins, left: 4 }} barCategoryGap={8}>
              <CartesianGrid stroke={chartGridStroke(theme)} horizontal={false} strokeDasharray="4 6" />
              <XAxis type="number" tick={chartAxisTick(theme)} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={112} tick={{ ...chartAxisTick(theme), fontSize: 10 }} />
              <Tooltip
                contentStyle={chartTooltipContentStyle(theme)}
                formatter={(value) => [value, "Events"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
              />
              <Bar dataKey="count" name="Events" fill={fill} radius={[0, 2, 2, 0]} maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
