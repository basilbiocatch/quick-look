import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Chip,
  Link,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { getInvoices, createBillingPortal } from "../api/subscriptionApi";

export default function BillingPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    getInvoices()
      .then((res) => setInvoices(res.data?.invoices || []))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdatePayment = async () => {
    setPortalLoading(true);
    try {
      const base = window.location.origin;
      const res = await createBillingPortal(`${base}/account/billing`);
      const url = res.data?.redirectUrl;
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setPortalLoading(false);
    }
  };

  const isPro = user?.plan === "pro";

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Billing & Invoices
      </Typography>

      {isPro && (
        <Button
          variant="outlined"
          sx={{ mb: 2 }}
          onClick={handleUpdatePayment}
          disabled={portalLoading}
        >
          {portalLoading ? <CircularProgress size={20} /> : "Update payment method"}
        </Button>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Invoice</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No invoices yet.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>${((inv.amount || 0) / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip label={inv.status || "—"} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">
                    {inv.invoicePdfUrl ? (
                      <Link href={inv.invoicePdfUrl} target="_blank" rel="noopener">
                        Download
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
