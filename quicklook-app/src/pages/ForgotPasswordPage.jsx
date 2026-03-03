import React, { useState } from "react";
import { Link } from "react-router-dom";
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
import { forgotPassword } from "../api/authApi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Something went wrong");
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
          Forgot password
        </Typography>
        {sent ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            If that email is registered, you will receive a reset link shortly. Check your inbox and spam folder.
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
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                {submitting ? "Sending…" : "Send reset link"}
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
