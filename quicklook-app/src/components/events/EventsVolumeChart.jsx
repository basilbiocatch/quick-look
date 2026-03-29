import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { chartAxisTick, chartGridStroke, chartMargins, chartTooltipContentStyle } from "./eventsChartStyles";

function formatTick(isoDay) {
  if (isoDay == null || typeof isoDay !== "string") return "—";
  try {
    const d = parseISO(`${isoDay}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return isoDay;
    return format(d, "MMM d");
  } catch {
    return isoDay;
  }
}

const paperSx = {
  p: 2.5,
  borderRadius: 2,
  height: "100%",
  bgcolor: "background.paper",
  borderColor: "divider",
};

export default function EventsVolumeChart({ daily = [], loading }) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = alpha(theme.palette.text.secondary, 0.9);

  const data = daily.map((d) => ({
    date: d?.date,
    count: Number(d?.count) || 0,
    uniqueSessions: Number(d?.uniqueSessions) || 0,
    label: formatTick(d?.date),
  }));

  const axisCommon = {
    tickLine: false,
    axisLine: false,
    tick: chartAxisTick(theme),
  };

  return (
    <Paper variant="outlined" sx={paperSx}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.25, letterSpacing: "-0.01em" }}>
        Volume
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
        Events per day · sessions per day
      </Typography>
      {loading ? (
        <Box sx={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Box>
      ) : data.length === 0 ? (
        <Box sx={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No data in this range
          </Typography>
        </Box>
      ) : (
        <Box sx={{ width: "100%", height: 280, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <ComposedChart data={data} margin={{ ...chartMargins, left: 0, right: 4 }}>
              <CartesianGrid stroke={chartGridStroke(theme)} vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="label" interval="preserveStartEnd" height={36} {...axisCommon} />
              <YAxis yAxisId="left" width={36} {...axisCommon} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" width={36} {...axisCommon} allowDecimals={false} />
              <Tooltip
                contentStyle={chartTooltipContentStyle(theme)}
                labelFormatter={(_, payload) => {
                  if (payload && payload[0]?.payload?.date) {
                    try {
                      return format(parseISO(`${payload[0].payload.date}T12:00:00.000Z`), "PPP");
                    } catch {
                      return payload[0].payload.date;
                    }
                  }
                  return "";
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="plainline"
                wrapperStyle={{ fontSize: 11, color: theme.palette.text.secondary }}
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="count"
                name="Events"
                fill={alpha(primary, 0.08)}
                stroke={primary}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="uniqueSessions"
                name="Sessions"
                stroke={secondary}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: secondary }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
