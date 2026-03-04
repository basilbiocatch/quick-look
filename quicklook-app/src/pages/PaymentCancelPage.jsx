import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";

export default function PaymentCancelPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", py: 6, px: 2, textAlign: "center" }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        Checkout cancelled
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        You can try again whenever you're ready.
      </Typography>
      <Button variant="contained" onClick={() => navigate("/account/upgrade")}>
        Try again
      </Button>
    </Box>
  );
}
