import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Box, Paper, Typography, Button, Alert, Link as MuiLink } from "@mui/material";
import { getPublicAssetUrl } from "../utils/baseUrl";
import { verifyEmail } from "../api/authApi";
import { useAuth } from "../contexts/AuthContext";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loadUser } = useAuth();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Missing verification token. Check your email for the verification link.");
      return;
    }
    verifyEmail(token)
      .then(() => {
        setStatus("success");
        loadUser();
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err.response?.data?.error || err.message || "Verification failed");
      });
  }, [token, loadUser]);

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
          Email verification
        </Typography>
        {status === "loading" && (
          <Typography color="text.secondary" textAlign="center">
            Verifying…
          </Typography>
        )}
        {status === "success" && (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              Your email is verified. You can use Quicklook fully now.
            </Alert>
            <Button fullWidth variant="contained" component={Link} to="/" sx={{ py: 1.5 }}>
              Go to dashboard
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
            {user ? (
              <Button fullWidth variant="contained" component={Link} to="/" sx={{ py: 1.5 }}>
                Go to dashboard
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary" textAlign="center">
                <MuiLink component={Link} to="/login" color="primary" underline="hover">
                  Sign in
                </MuiLink>
              </Typography>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}
