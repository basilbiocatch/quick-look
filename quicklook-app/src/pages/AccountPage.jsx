import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { changePassword } from "../api/authApi";

const MIN_PASSWORD_LENGTH = 8;

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 480, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Account
      </Typography>
      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Email
        </Typography>
        <Typography variant="body1">{user?.email || "—"}</Typography>
        {user?.name != null && user.name !== "" && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
              Name
            </Typography>
            <Typography variant="body1">{user.name}</Typography>
          </>
        )}
      </Paper>

      <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
        Change password
      </Typography>
      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
            {success}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
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
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            sx={{ mb: 3 }}
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </Button>
        </Box>
      </Paper>

      <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          sx={{ textTransform: "none" }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  );
}
