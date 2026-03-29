import React, { useMemo } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { chartTooltipContentStyle, pieFillsForData } from "./eventsChartStyles";

const paperSx = {
  p: 2.5,
  borderRadius: 2,
  height: "100%",
  bgcolor: "background.paper",
  borderColor: "divider",
};

export default function EventsDistributionPie({ rows = [], topN = 5, loading }) {
  const theme = useTheme();

  const data = useMemo(() => {
    const sorted = [...rows].sort((a, b) => (b.count || 0) - (a.count || 0));
    if (sorted.length === 0) return [];
    const head = sorted.slice(0, topN);
    const restCount = sorted.slice(topN).reduce((s, r) => s + (r.count || 0), 0);
    const out = head.map((r) => ({
      name: r.name.length > 20 ? `${r.name.slice(0, 18)}…` : r.name,
      fullName: r.name,
      value: r.count,
    }));
    if (restCount > 0) {
      out.push({ name: `Other (${sorted.length - topN})`, fullName: "Other", value: restCount });
    }
    return out;
  }, [rows, topN]);

  const fills = useMemo(() => pieFillsForData(theme, data), [theme, data]);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  return (
    <Paper variant="outlined" sx={paperSx}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25, letterSpacing: "-0.01em" }}>
        Mix
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        Share of total volume
      </Typography>
      {loading ? (
        <Box sx={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Box>
      ) : data.length === 0 ? (
        <Box sx={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No data
          </Typography>
        </Box>
      ) : (
        <Box sx={{ width: "100%", height: 280, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={1.5}
                dataKey="value"
                nameKey="name"
                stroke={theme.palette.background.paper}
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={fills[i]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={chartTooltipContentStyle(theme)}
                formatter={(value) => [`${value} (${total ? ((value / total) * 100).toFixed(1) : 0}%)`, ""]}
              />
              <Legend
                verticalAlign="middle"
                align="right"
                layout="vertical"
                iconType="circle"
                iconSize={6}
                wrapperStyle={{ fontSize: 10, color: theme.palette.text.secondary, paddingLeft: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
