import React from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useAuth } from "../contexts/AuthContext";

export default function UpgradeBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.plan !== "free") return null;

  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "wrap",
          px: 2,
          py: 1.25,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "rgba(190,149,250,0.35)",
          background: "linear-gradient(135deg, rgba(190,149,250,0.12) 0%, rgba(147,112,219,0.08) 50%, rgba(99,102,241,0.08) 100%)",
          boxShadow: "0 0 20px rgba(190,149,250,0.08)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <AutoAwesomeIcon sx={{ fontSize: 22, color: "primary.main" }} />
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: "0.875rem", color: "text.primary" }}>
              Unlock AI tools
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
              Upgrade to Pro for insights, reports, and 5,000 sessions/month.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={() => navigate("/account/upgrade")}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.8125rem",
            px: 1.5,
            py: 0.75,
            borderRadius: 2,
            color:"white",
            background: "linear-gradient(135deg, rgba(190,149,250,0.9) 0%, rgba(147,112,219,0.85) 50%, rgba(99,102,241,0.85) 100%)",
            boxShadow: "0 2px 12px rgba(190,149,250,0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, rgba(190,149,250,1) 0%, rgba(147,112,219,0.95) 50%, rgba(99,102,241,0.95) 100%)",
              boxShadow: "0 4px 16px rgba(190,149,250,0.45)",
            },
          }}
        >
          Upgrade to Pro
        </Button>
      </Box>
    </Box>
  );
}
