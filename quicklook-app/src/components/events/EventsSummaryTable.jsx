import React from "react";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Box,
} from "@mui/material";

/**
 * @param {{ rows: Array<{ name: string, count: number, uniqueSessions?: number }>, loading?: boolean }} props
 */
export default function EventsSummaryTable({ rows = [], loading }) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!rows.length) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">No events in this range. Send events from your app with quicklook.track().</Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Event name</TableCell>
            <TableCell align="right">Count</TableCell>
            <TableCell align="right">Unique sessions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} hover>
              <TableCell sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}>{row.name}</TableCell>
              <TableCell align="right">{row.count}</TableCell>
              <TableCell align="right">{row.uniqueSessions ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
