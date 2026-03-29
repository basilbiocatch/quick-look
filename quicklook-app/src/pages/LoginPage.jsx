import React, { useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  Link as MuiLink,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { getPublicAssetUrl } from "../utils/baseUrl";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const invite = searchParams.get("invite") || "";
  const from = invite
    ? `/invitations/${encodeURIComponent(invite)}`
    : location.state?.from?.pathname || "/";

  if (user) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const result = await login({ email: email.trim(), password, remember });
    setSubmitting(false);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || "Login failed");
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
          Sign in
        </Typography>
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
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{ mb: 1.5 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label="Remember me"
            sx={{ mb: 2, "& .MuiFormControlLabel-label": { fontSize: "0.875rem" } }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={submitting}
            sx={{ py: 1.5, mb: 1 }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 2 }}>
            <MuiLink component={Link} to="/forgot-password" color="primary" underline="hover">
              Forgot password?
            </MuiLink>
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Don&apos;t have an account?{" "}
            <MuiLink
              component={Link}
              to={invite ? `/signup?invite=${encodeURIComponent(invite)}` : "/signup"}
              color="primary"
              underline="hover"
            >
              Sign up
            </MuiLink>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
