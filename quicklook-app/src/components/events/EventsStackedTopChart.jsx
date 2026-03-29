import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { chartAxisTick, chartGridStroke, chartMargins, chartTooltipContentStyle, primaryStackStyles } from "./eventsChartStyles";

function formatTick(isoDay) {
  if (isoDay == null || typeof isoDay !== "string") return "—";
  try {
    const d = parseISO(`${isoDay}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return isoDay;
    return format(d, "MMM d");
  } catch {
    return String(isoDay);
  }
}

const paperSx = {
  p: 2.5,
  borderRadius: 2,
  height: "100%",
  bgcolor: "background.paper",
  borderColor: "divider",
};

export default function EventsStackedTopChart({ stackedByDay = [], topNames = [], loading }) {
  const theme = useTheme();
  const styles = primaryStackStyles(theme, topNames.length);

  const data = stackedByDay.map((row) => {
    const date = row?.date;
    return {
      ...row,
      date,
      label: formatTick(date),
    };
  });

  const axisCommon = {
    tickLine: false,
    axisLine: false,
    tick: chartAxisTick(theme),
  };

  return (
    <Paper variant="outlined" sx={paperSx}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25, letterSpacing: "-0.01em" }}>
        By event name
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        Top names — stacked daily
      </Typography>
      {loading ? (
        <Box sx={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Box>
      ) : !topNames.length || data.length === 0 ? (
        <Box sx={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Not enough events
          </Typography>
        </Box>
      ) : (
        <Box sx={{ width: "100%", height: 300, minHeight: 260, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <AreaChart data={data} margin={{ ...chartMargins, left: 0 }}>
              <CartesianGrid stroke={chartGridStroke(theme)} vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="label" interval="preserveStartEnd" height={36} {...axisCommon} />
              <YAxis width={36} {...axisCommon} allowDecimals={false} />
              <Tooltip contentStyle={chartTooltipContentStyle(theme)} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 10, color: theme.palette.text.secondary, lineHeight: 1.4 }}
              />
              {topNames.map((name, i) => (
                <Area
                  key={`${name}-${i}`}
                  type="monotone"
                  dataKey={`s${i}`}
                  name={name}
                  stackId="events"
                  stroke={styles[i].stroke}
                  fill={styles[i].fill}
                  strokeWidth={0}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
