import React, { useState, useEffect, useCallback } from "react";
import { Box, Paper, Typography, Alert, Stack } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import EventsPageHeader from "../components/events/EventsPageHeader";
import EventsDateRangeFilter, { isoRangeForPreset } from "../components/events/EventsDateRangeFilter";
import EventsNameFilter from "../components/events/EventsNameFilter";
import EventsSortControl from "../components/events/EventsSortControl";
import EventsSummaryTable from "../components/events/EventsSummaryTable";
import EventsKpiCards from "../components/events/EventsKpiCards";
import EventsVolumeChart from "../components/events/EventsVolumeChart";
import EventsStackedTopChart from "../components/events/EventsStackedTopChart";
import EventsTopBarChart from "../components/events/EventsTopBarChart";
import EventsDistributionPie from "../components/events/EventsDistributionPie";
import { getTrackedEventsSummary, getTrackedEventNames, getTrackedEventsAnalytics } from "../api/quicklookApi";
import ChartErrorBoundary from "../components/ChartErrorBoundary";

export default function EventsPage() {
  const { projectKey } = useParams();
  const navigate = useNavigate();
  const initial = isoRangeForPreset(7);
  const [preset, setPreset] = useState("7");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [namePrefix, setNamePrefix] = useState("");
  const [sort, setSort] = useState("count_desc");
  const [rows, setRows] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nameOptions, setNameOptions] = useState([]);

  const fetchAll = useCallback(async () => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    const summaryParams = {
      from,
      to,
      sort,
      limit: 100,
    };
    if (namePrefix.trim()) summaryParams.name = namePrefix.trim();
    const analyticsParams = { from, to };
    if (namePrefix.trim()) analyticsParams.name = namePrefix.trim();

    try {
      const sumRes = await getTrackedEventsSummary(projectKey, summaryParams);
      setRows(sumRes.data?.data ?? []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load events");
      setRows([]);
    }

    try {
      const anRes = await getTrackedEventsAnalytics(projectKey, analyticsParams);
      setAnalytics(anRes.data?.data ?? null);
    } catch {
      setAnalytics(null);
    }

    setLoading(false);
  }, [projectKey, from, to, namePrefix, sort]);

  const fetchNames = useCallback(() => {
    if (!projectKey) return;
    getTrackedEventNames(projectKey, { from, to })
      .then((res) => setNameOptions(res.data?.data ?? []))
      .catch(() => setNameOptions([]));
  }, [projectKey, from, to]);

  useEffect(() => {
    if (!projectKey) {
      navigate("/", { replace: true });
      return;
    }
    fetchAll();
  }, [projectKey, fetchAll, navigate]);

  useEffect(() => {
    if (!projectKey) return;
    fetchNames();
  }, [projectKey, fetchNames]);

  const handlePreset = (id, fromIso, toIso) => {
    setPreset(id);
    setFrom(fromIso);
    setTo(toIso);
  };

  const handleCustomFrom = (v) => {
    setPreset("custom");
    setFrom(v);
  };

  const handleCustomTo = (v) => {
    setPreset("custom");
    setTo(v);
  };

  if (!projectKey) return null;

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, sm: 3 }, py: 2.5 }}>
      <EventsPageHeader
        title="Events"
        subtitle="Product analytics from quicklook.track() — volume, trends, and breakdowns."
        onRefresh={() => {
          fetchAll();
          fetchNames();
        }}
        refreshing={loading}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} flexWrap="wrap" useFlexGap>
          <Box sx={{ flex: "1 1 280px", minWidth: 0 }}>
            <EventsDateRangeFilter
              preset={preset}
              from={from}
              to={to}
              onPreset={handlePreset}
              onCustomFrom={handleCustomFrom}
              onCustomTo={handleCustomTo}
            />
          </Box>
          {/* <Box sx={{ flex: "1 1 200px", minWidth: 0 }}>
            <EventsNameFilter value={namePrefix} onChange={setNamePrefix} disabled={loading} />
            {nameOptions.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Known names in range: {nameOptions.slice(0, 12).join(", ")}
                {nameOptions.length > 12 ? "…" : ""}
              </Typography>
            )}
          </Box> */}
          <Box sx={{ flex: "0 1 220px", minWidth: 0 }}>
            <EventsSortControl value={sort} onChange={setSort} disabled={loading} />
          </Box>
        </Stack>
      </Paper>

      <ChartErrorBoundary>
        <EventsKpiCards totals={analytics?.totals ?? null} loading={loading} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: 2,
            mb: 2,
            alignItems: "stretch",
          }}
        >
          <EventsVolumeChart daily={analytics?.daily ?? []} loading={loading} />
          <EventsStackedTopChart
            stackedByDay={analytics?.stackedByDay ?? []}
            topNames={analytics?.topNames ?? []}
            loading={loading}
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
            gap: 2,
            mb: 2,
            alignItems: "stretch",
          }}
        >
          <EventsTopBarChart rows={rows} limit={14} loading={loading} />
          <EventsDistributionPie rows={rows} topN={5} loading={loading} />
        </Box>
      </ChartErrorBoundary>

      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, mt: 0.5 }}>
        Full breakdown
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
        Sorted table — use filters above to narrow names (prefix match)
      </Typography>
      <EventsSummaryTable rows={rows} loading={loading} />
    </Box>
  );
}
