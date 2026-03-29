import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Box, Paper, Typography, Button, CircularProgress, Alert, Link as MuiLink } from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { acceptProjectInvitation } from "../api/quicklookApi";
import { getPublicAssetUrl } from "../utils/baseUrl";

export default function AcceptInvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !token) return;
    if (!user) return;
    let cancelled = false;
    setStatus("working");
    setError("");
    acceptProjectInvitation(token)
      .then((res) => {
        if (cancelled) return;
        const projectKey = res.data?.data?.projectKey;
        if (projectKey) {
          setStatus("done");
          navigate(`/projects/${projectKey}/sessions`, { replace: true });
        } else {
          setStatus("error");
          setError("Unexpected response");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setError(err.response?.data?.error || err.message || "Failed to accept invitation");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, token, navigate]);

  if (authLoading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    const enc = token ? encodeURIComponent(token) : "";
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          p: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            maxWidth: 420,
            width: "100%",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, mb: 2 }}>
            <img src={getPublicAssetUrl("logo.png")} alt="" style={{ height: 36, width: 36 }} />
            <Typography variant="h6" fontWeight={700}>
              Quicklook
            </Typography>
          </Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, textAlign: "center" }}>
            You&apos;ve been invited to a project
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
            Sign in or create an account with the same email the invitation was sent to.
          </Typography>
          <Button fullWidth variant="contained" component={Link} to={`/login?invite=${enc}`} sx={{ mb: 1.5 }}>
            Sign in
          </Button>
          <Button fullWidth variant="outlined" component={Link} to={`/signup?invite=${enc}`}>
            Create account
          </Button>
        </Paper>
      </Box>
    );
  }

  if (status === "working" || status === "idle") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <CircularProgress />
        <Typography color="text.secondary">Accepting invitation…</Typography>
      </Box>
    );
  }

  if (status === "error") {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
        <Paper sx={{ p: 3, maxWidth: 480, width: "100%" }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button component={Link} to="/" variant="contained">
            Go to dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  return null;
}
