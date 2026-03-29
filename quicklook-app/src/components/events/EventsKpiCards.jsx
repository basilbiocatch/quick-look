import React from "react";
import { Box, Paper, Typography, Skeleton } from "@mui/material";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import CategoryIcon from "@mui/icons-material/Category";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { alpha, useTheme } from "@mui/material/styles";

function KpiCard({ icon, label, value, sub, loading }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        flex: "1 1 160px",
        minWidth: 0,
        p: 2,
        borderRadius: 2,
        bgcolor: "background.paper",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.25 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            color: "primary.main",
          }}
        >
          {icon}
        </Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontSize: 10 }}>
          {label}
        </Typography>
      </Box>
      {loading ? (
        <Skeleton width={100} height={36} />
      ) : (
        <Typography variant="h5" fontWeight={600} sx={{ lineHeight: 1.15, mb: 0.25, letterSpacing: "-0.02em" }}>
          {value}
        </Typography>
      )}
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.9 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

/**
 * @param {{ totals: { totalEvents?: number, uniqueSessions?: number, uniqueEventNames?: number, avgEventsPerSession?: number } | null, loading?: boolean }} props
 */
export default function EventsKpiCards({ totals, loading }) {
  const te = totals?.totalEvents ?? 0;
  const us = totals?.uniqueSessions ?? 0;
  const un = totals?.uniqueEventNames ?? 0;
  const avg = totals?.avgEventsPerSession ?? 0;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
      <KpiCard
        icon={<ShowChartIcon sx={{ fontSize: 18 }} />}
        label="Total events"
        value={te.toLocaleString()}
        sub="In selected range"
        loading={loading}
      />
      <KpiCard
        icon={<PeopleOutlineIcon sx={{ fontSize: 18 }} />}
        label="Unique sessions"
        value={us.toLocaleString()}
        sub="Sessions that sent ≥1 event"
        loading={loading}
      />
      <KpiCard
        icon={<CategoryIcon sx={{ fontSize: 18 }} />}
        label="Distinct event names"
        value={un.toLocaleString()}
        sub="Different track() names"
        loading={loading}
      />
      <KpiCard
        icon={<TrendingUpIcon sx={{ fontSize: 18 }} />}
        label="Avg events / session"
        value={loading ? "—" : avg.toLocaleString()}
        sub="Among sessions with events"
        loading={loading}
      />
    </Box>
  );
}
