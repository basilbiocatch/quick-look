import React, { useState } from "react";
import { Alert, AlertTitle, Button, Box } from "@mui/material";
import { useAuth, needsEmailVerification } from "../contexts/AuthContext";

export default function VerificationBanner() {
  const { user, resendVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || !needsEmailVerification(user)) return null;

  const handleResend = async () => {
    setSending(true);
    setSent(false);
    const result = await resendVerification();
    setSending(false);
    if (result.success) setSent(true);
  };

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Alert
        severity="warning"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={handleResend} disabled={sending}>
            {sending ? "Sending…" : sent ? "Sent" : "Resend verification email"}
          </Button>
        }
      >
        <AlertTitle>Verify your email</AlertTitle>
        Please verify your email to continue using Quicklook. Check your inbox for the verification link, or resend it below.
      </Alert>
    </Box>
  );
}
