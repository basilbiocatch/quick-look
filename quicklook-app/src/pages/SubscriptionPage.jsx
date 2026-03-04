import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { getSubscriptionStatus, createBillingPortal, cancelSubscription } from "../api/subscriptionApi";

export default function SubscriptionPage() {
  const { user, loadUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm("Cancel at period end? You'll keep Pro until the current period ends.")) return;
    setCancelLoading(true);
    try {
      await cancelSubscription();
      await getSubscriptionStatus().then((res) => setStatus(res.data));
      loadUser();
    } catch (err) {
      console.error(err);
    } finally {
      setCancelLoading(false);
    }
  };

  useEffect(() => {
    getSubscriptionStatus()
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const base = window.location.origin;
      const res = await createBillingPortal(`${base}/account/subscription`);
      const url = res.data?.redirectUrl;
      if (url) window.location.href = url;
    } catch (err) {
      console.error(err);
    } finally {
      setPortalLoading(false);
    }
  };

  const plan = user?.plan || status?.plan || "free";
  const isPro = plan === "pro";
  const sub = status?.subscription;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 480, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Subscription
      </Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
            <Typography variant="h6">Current plan</Typography>
            <Chip label={isPro ? "Pro" : "Free"} color={isPro ? "primary" : "default"} size="small" />
          </Box>
          {isPro && sub && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Status: {sub.status}
                {sub.cancelAtPeriodEnd && " (cancels at period end)"}
              </Typography>
              {sub.currentPeriodEnd && (
                <Typography variant="body2" color="text.secondary">
                  Period end: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {isPro ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleManage}
            disabled={portalLoading}
          >
            {portalLoading ? <CircularProgress size={24} /> : "Manage subscription"}
          </Button>
          {sub && !sub.cancelAtPeriodEnd && (
            <Button variant="outlined" color="secondary" fullWidth onClick={handleCancel} disabled={cancelLoading}>
              {cancelLoading ? <CircularProgress size={20} /> : "Cancel subscription"}
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Upgrade to Pro for AI insights, 5,000 sessions/month, and unlimited projects.
          </Alert>
          <Button variant="contained" fullWidth onClick={() => navigate("/account/upgrade")}>
            Upgrade to Pro
          </Button>
        </>
      )}
    </Box>
  );
}
