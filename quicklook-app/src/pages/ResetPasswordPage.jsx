import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Link as MuiLink,
} from "@mui/material";
import { getPublicAssetUrl } from "../utils/baseUrl";
import { resetPassword } from "../api/authApi";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing reset token. Please use the link from your email.");
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

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
          width: "100%",
          maxWidth: 400,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.25, mb: 3 }}>
          <img src={getPublicAssetUrl("logo.png")} alt="" style={{ height: 36, width: 36, display: "block" }} />
          <Typography variant="h5" fontWeight={700}>
            Quicklook
          </Typography>
        </Box>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 3, textAlign: "center", color: "text.secondary" }}>
          Set new password
        </Typography>
        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Password updated. Redirecting to sign in…
          </Alert>
        ) : !token ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Invalid or missing reset link. Request a new one from the{" "}
            <MuiLink component={Link} to="/forgot-password">forgot password</MuiLink> page.
          </Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                helperText={`At least ${MIN_PASSWORD_LENGTH} characters`}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                sx={{ mb: 3 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={submitting}
                sx={{ py: 1.5, mb: 2 }}
              >
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </Box>
          </>
        )}
        <Typography variant="body2" color="text.secondary" textAlign="center">
          <MuiLink component={Link} to="/login" color="primary" underline="hover">
            Back to sign in
          </MuiLink>
        </Typography>
      </Paper>
    </Box>
  );
}
